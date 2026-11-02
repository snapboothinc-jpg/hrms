alter table public.competency_assessments
  add column assessment_method text check (length(assessment_method) <= 120);

alter table public.evaluation_assignments
  add column self_profile_score numeric(5,2) check (self_profile_score between 0 and 100);

do $$
declare constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.evaluation_items'::regclass
      and contype = 'c'
      and position('kpi_target IS NOT NULL' in pg_get_constraintdef(oid)) > 0
  loop
    execute format('alter table public.evaluation_items drop constraint %I', constraint_name);
  end loop;
end $$;
alter table public.evaluation_items
  add constraint evaluation_items_kpi_target_nonnegative
    check (kpi_target is null or kpi_target >= 0);

create table public.evaluation_development_responses (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.evaluation_assignments(id) on delete restrict,
  respondent text not null check (respondent in ('self','evaluator')),
  content jsonb not null default '{}'::jsonb check (jsonb_typeof(content) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_by uuid,
  unique (assignment_id, respondent)
);
create index on public.evaluation_development_responses(assignment_id);
alter table public.evaluation_development_responses enable row level security;
grant select on public.evaluation_development_responses to authenticated;
grant all on public.evaluation_development_responses to service_role;
create policy "scoped" on public.evaluation_development_responses for select to authenticated
  using (exists (
    select 1 from public.evaluation_assignments a
    where a.id = assignment_id
      and (a.evaluator_id = public.my_employee_id() or (
        public.can_view_perf(a.employee_id)
        and (respondent = 'self' or a.status = 'approved' or public.has_perm('perf.approve'))
      ))
  ));
create trigger touch before update on public.evaluation_development_responses
  for each row execute function public.tg_touch();
create trigger audit after insert or update or delete on public.evaluation_development_responses
  for each row execute function public.tg_audit();

create table public.employee_critical_requirements (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  requirement_type text not null check (requirement_type in ('license','certification','qualification','safety')),
  name text not null check (length(name) between 2 and 160),
  description text check (length(description) <= 2000),
  issuing_authority text check (length(issuing_authority) <= 160),
  reference_number text check (length(reference_number) <= 120),
  valid_from date,
  expires_on date,
  file_id uuid references public.file_metadata(id) on delete restrict,
  is_safety_critical boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_by uuid,
  check (expires_on is null or valid_from is null or expires_on >= valid_from)
);
create index on public.employee_critical_requirements(employee_id, is_active);
alter table public.employee_critical_requirements enable row level security;
grant select on public.employee_critical_requirements to authenticated;
grant all on public.employee_critical_requirements to service_role;
create policy "scoped" on public.employee_critical_requirements for select to authenticated
  using (public.can_view_employee(employee_id) or exists (
    select 1 from public.evaluation_assignments a
    where a.employee_id = employee_critical_requirements.employee_id
      and a.evaluator_id = public.my_employee_id()
  ));
create trigger touch before update on public.employee_critical_requirements
  for each row execute function public.tg_touch();
create trigger audit after insert or update or delete on public.employee_critical_requirements
  for each row execute function public.tg_audit();

create table public.evaluation_critical_requirement_reviews (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.evaluation_assignments(id) on delete restrict,
  requirement_id uuid not null references public.employee_critical_requirements(id) on delete restrict,
  compliance_status text not null check (compliance_status in ('compliant','needs_review','non_compliant')),
  comments text check (length(comments) <= 2000),
  reviewed_at timestamptz not null default now(),
  reviewed_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_by uuid,
  unique (assignment_id, requirement_id)
);
create index on public.evaluation_critical_requirement_reviews(assignment_id);
alter table public.evaluation_critical_requirement_reviews enable row level security;
grant select on public.evaluation_critical_requirement_reviews to authenticated;
grant all on public.evaluation_critical_requirement_reviews to service_role;
create policy "scoped" on public.evaluation_critical_requirement_reviews for select to authenticated
  using (exists (
    select 1 from public.evaluation_assignments a
    where a.id = assignment_id and (
      a.evaluator_id = public.my_employee_id()
      or public.can_view_perf(a.employee_id)
    )
  ));
create trigger touch before update on public.evaluation_critical_requirement_reviews
  for each row execute function public.tg_touch();
create trigger audit after insert or update or delete on public.evaluation_critical_requirement_reviews
  for each row execute function public.tg_audit();

create or replace function public.validate_evaluation_item_weights()
returns trigger language plpgsql security definer set search_path=public as $$
declare item_weight_total numeric;
begin
  if new.status='active' and old.status is distinct from new.status then
    select coalesce(sum(weight),0) into item_weight_total
      from public.evaluation_items where version_id=new.id and weight>0;
    if item_weight_total>0 and item_weight_total<>100 then
      raise exception 'RULE: configured rating and KPI item weights must total 100 percent (currently %)',
        item_weight_total;
    end if;
  end if;
  return new;
end $$;
create trigger validate_evaluation_item_weights
  before update of status on public.evaluation_profile_versions
  for each row execute function public.validate_evaluation_item_weights();

create or replace function public.compute_evaluation_profile_score(_assignment uuid, _respondent text)
returns numeric language sql stable security definer set search_path=public as $$
  with items as (
    select (i->>'id')::uuid id, i->>'item_type' item_type,
      coalesce((i->>'weight')::numeric,0) weight,
      nullif(i->>'kpi_target','')::numeric target,
      (a.snapshot->>'rating_scale_max')::numeric scale_max
    from public.evaluation_assignments a,
      jsonb_array_elements(a.snapshot->'sections') s,
      jsonb_array_elements(s->'items') i
    where a.id = _assignment
  )
  select round(coalesce(sum(case
    when i.item_type = 'rating' then i.weight * coalesce(r.rating,0) / i.scale_max
    when i.item_type = 'kpi' and i.target > 0
      then i.weight * least(greatest(coalesce(r.kpi_actual,0),0) / i.target,1)
    else 0 end),0),2)
  from items i left join public.evaluation_responses r
    on r.assignment_id = _assignment and r.item_id = i.id and r.respondent = _respondent
  where i.weight > 0
$$;

drop function public.save_evaluation(uuid,text,jsonb,text,integer);
create function public.save_evaluation(
  _assignment uuid, _respondent text, _responses jsonb, _overall_comment text,
  _development jsonb, _expected int
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare a public.evaluation_assignments; r jsonb; fr jsonb; me uuid := public.my_employee_id();
  valid_ids uuid[]; allowed_keys text[];
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into a from public.evaluation_assignments where id=_assignment for update;
  if not found or not (public.can_view_perf(a.employee_id) or a.evaluator_id=me) then raise exception 'NOT_FOUND'; end if;
  if _respondent='evaluator' and a.evaluator_id is distinct from me then
    raise exception 'FORBIDDEN: only the assigned evaluator can complete this form'; end if;
  if _respondent='evaluator' and a.self_evaluation and a.self_submitted_at is null then
    raise exception 'RULE: employee self-evaluation must be submitted before supervisor review';
  end if;
  if _respondent='self' then
    if a.employee_id is distinct from me then raise exception 'FORBIDDEN: only the employee can complete the self-evaluation'; end if;
    if not a.self_evaluation then raise exception 'RULE: self-evaluation is not configured for this cycle'; end if;
    if a.self_submitted_at is not null and a.status <> 'reopened' then raise exception 'RULE: self-evaluation already submitted'; end if;
    allowed_keys:=array['strengths','improvement_areas','accomplishments','development_needs',
      'career_interests','suggested_activities','personal_goals'];
  elsif _respondent='evaluator' then
    allowed_keys:=array['strengths','improvement_areas','performance_weaknesses','development_needs',
      'recommended_learning','recommended_training','competency_improvements','target_outcomes',
      'next_steps','advancement_considerations','overall_assessment','observations',
      'overall_recommendation','development_recommendation','improvement_priorities','review_comments',
      'rating_difference_explanations'];
  else raise exception 'INVALID: respondent must be self or evaluator'; end if;
  if a.status in ('submitted','under_review','approved') then
    raise exception 'RULE: the evaluation is % and cannot be edited',a.status; end if;
  if a.version <> _expected then raise exception 'CONFLICT: this evaluation was changed by someone else'; end if;
  if jsonb_typeof(coalesce(_development,'{}'::jsonb)) <> 'object'
    or exists(select 1 from jsonb_object_keys(coalesce(_development,'{}'::jsonb)) as key(name)
      where not (name = any(allowed_keys)))
    or exists(select 1 from jsonb_each_text(coalesce(_development,'{}'::jsonb)) e where length(e.value)>4000)
  then raise exception 'INVALID: development response fields are invalid'; end if;
  select array_agg((i->>'id')::uuid) into valid_ids
    from jsonb_array_elements(a.snapshot->'sections') s,jsonb_array_elements(s->'items') i;
  for r in select * from jsonb_array_elements(coalesce(_responses->'items','[]'::jsonb)) loop
    if not ((r->>'item_id')::uuid = any(valid_ids)) then raise exception 'INVALID: unknown item in response'; end if;
    if (r->>'rating') is not null and ((r->>'rating')::numeric < 1 or
      (r->>'rating')::numeric > (a.snapshot->>'rating_scale_max')::numeric) then
      raise exception 'INVALID: rating out of range'; end if;
    insert into public.evaluation_responses(assignment_id,item_id,respondent,rating,text_value,choice_values,kpi_actual,comment)
    values (_assignment,(r->>'item_id')::uuid,_respondent,nullif(r->>'rating','')::numeric,
      nullif(r->>'text_value',''),r->'choice_values',nullif(r->>'kpi_actual','')::numeric,nullif(r->>'comment',''))
    on conflict (assignment_id,item_id,respondent) do update set rating=excluded.rating,
      text_value=excluded.text_value,choice_values=excluded.choice_values,
      kpi_actual=excluded.kpi_actual,comment=excluded.comment;
  end loop;
  for fr in select * from jsonb_array_elements(coalesce(_responses->'performance_factors','[]'::jsonb)) loop
    if not exists(select 1 from jsonb_array_elements(a.snapshot->'performance_factors') f
      where f->>'factor_code'=fr->>'factor_code') then raise exception 'INVALID: unknown performance factor'; end if;
    if nullif(fr->>'rating','') is not null and ((fr->>'rating')::int < 1 or (fr->>'rating')::int > 5) then
      raise exception 'INVALID: performance factor rating must be between 1 and 5'; end if;
    insert into public.evaluation_factor_responses(assignment_id,factor_code,respondent,rating,comment)
    values (_assignment,fr->>'factor_code',_respondent,nullif(fr->>'rating','')::int,nullif(fr->>'comment',''))
    on conflict (assignment_id,factor_code,respondent) do update set rating=excluded.rating,comment=excluded.comment;
  end loop;
  insert into public.evaluation_development_responses(assignment_id,respondent,content)
    values (_assignment,_respondent,coalesce(_development,'{}'::jsonb))
    on conflict (assignment_id,respondent) do update set content=excluded.content;
  if _respondent='evaluator' then
    perform public.assert_transition('evaluation',a.status,'in_progress');
    update public.evaluation_assignments set status='in_progress',
      overall_comment=coalesce(_overall_comment,overall_comment)
      where id=_assignment returning * into a;
  else
    update public.evaluation_assignments set status=case when status='not_started' then 'in_progress' else status end
      where id=_assignment returning * into a;
  end if;
  return to_jsonb(a)-'snapshot';
end $$;

grant execute on function public.save_evaluation(uuid,text,jsonb,text,jsonb,int) to authenticated;
revoke all on function public.compute_evaluation_profile_score(uuid,text) from public,authenticated;
grant execute on function public.compute_evaluation_profile_score(uuid,text) to authenticated;

create or replace function public.submit_evaluation(_assignment uuid, _respondent text, _idem uuid, _hash text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare prev jsonb; a public.evaluation_assignments; me uuid:=public.my_employee_id();
  missing int; missing_factors int; missing_evidence int; emp public.employees; result jsonb;
  calculated_score numeric;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  prev:=public._idem_get(_idem,'submit_evaluation',_hash); if prev is not null then return prev; end if;
  select * into a from public.evaluation_assignments where id=_assignment for update;
  if not found or not (public.can_view_perf(a.employee_id) or a.evaluator_id=me) then raise exception 'NOT_FOUND'; end if;
  select * into emp from public.employees where id=a.employee_id;
  if _respondent='self' then
    if a.employee_id is distinct from me then raise exception 'FORBIDDEN'; end if;
    if not a.self_evaluation then raise exception 'RULE: self-evaluation is not configured for this cycle'; end if;
    if a.self_submitted_at is not null and a.status<>'reopened' then raise exception 'RULE: already submitted'; end if;
    if jsonb_array_length(coalesce(a.snapshot->'performance_factors','[]'::jsonb))>0 then
      select count(*) into missing_factors from jsonb_array_elements(a.snapshot->'performance_factors') f
        left join public.evaluation_factor_responses r on r.assignment_id=a.id
          and r.factor_code=f->>'factor_code' and r.respondent='self' where r.rating is null;
      if missing_factors>0 then raise exception 'RULE: rate all ten performance factors before submission'; end if;
      select count(*) into missing_evidence from jsonb_array_elements(a.snapshot->'performance_factors') f
        where coalesce((f->>'evidence_required')::boolean,false)
          and not exists(select 1 from public.evaluation_evidence ev where ev.assignment_id=a.id
            and ev.factor_code=f->>'factor_code' and ev.created_by=auth.uid());
      if missing_evidence>0 then raise exception 'RULE: evidence is required for % performance factor(s)',missing_evidence; end if;
      perform public.compute_performance_factor_score(a.id,'self');
    end if;
    select count(*) into missing
      from jsonb_array_elements(a.snapshot->'sections') s,jsonb_array_elements(s->'items') i
      left join public.evaluation_responses r on r.assignment_id=a.id
        and r.item_id=(i->>'id')::uuid and r.respondent='self'
      where coalesce((i->>'is_required')::boolean,true) and (
        (i->>'item_type'='kpi' and (r.kpi_actual is null or r.rating is null))
        or (i->>'item_type'='rating' and r.rating is null)
        or (i->>'item_type' not in ('kpi','rating') and r.id is null
          or i->>'item_type' not in ('kpi','rating') and r.rating is null and r.text_value is null
            and r.kpi_actual is null and r.choice_values is null));
    if missing>0 then raise exception 'RULE: complete all required KPI results and profile items before submission'; end if;
    select count(*) into missing_evidence
      from jsonb_array_elements(a.snapshot->'sections') s,jsonb_array_elements(s->'items') i
      where coalesce((i->>'evidence_required')::boolean,false)
        and not exists(select 1 from public.evaluation_evidence ev
          where ev.assignment_id=a.id and ev.item_id=(i->>'id')::uuid and ev.created_by=auth.uid());
    if missing_evidence>0 then raise exception 'RULE: evidence is required for % profile item(s)',missing_evidence; end if;
    calculated_score:=public.compute_evaluation_profile_score(a.id,'self');
    update public.evaluation_assignments set self_submitted_at=now(),self_score=
      public.compute_performance_factor_score(a.id,'self'),self_profile_score=calculated_score
      where id=_assignment returning * into a;
    perform public._notify((select user_id from public.employees where id=a.evaluator_id),
      'Self-evaluation submitted',emp.first_name||' '||emp.last_name||' submitted a self-evaluation',
      '/performance/evaluations/'||a.id);
  elsif _respondent='evaluator' then
    if a.evaluator_id is distinct from me then raise exception 'FORBIDDEN: only the assigned evaluator can submit'; end if;
    if a.self_evaluation and a.self_submitted_at is null then
      raise exception 'RULE: employee self-evaluation must be submitted before supervisor review';
    end if;
    perform public.assert_transition('evaluation',a.status,'submitted');
    select count(*) into missing from jsonb_array_elements(a.snapshot->'sections') s,jsonb_array_elements(s->'items') i
      left join public.evaluation_responses r on r.assignment_id=a.id
        and r.item_id=(i->>'id')::uuid and r.respondent='evaluator'
      where coalesce((i->>'is_required')::boolean,true) and (
        (i->>'item_type'='kpi' and (r.kpi_actual is null or r.rating is null))
        or (i->>'item_type'='rating' and r.rating is null)
        or (i->>'item_type' not in ('kpi','rating') and r.id is null
          or i->>'item_type' not in ('kpi','rating') and r.rating is null and r.text_value is null
            and r.kpi_actual is null and r.choice_values is null));
    if missing>0 then raise exception 'RULE: complete all required KPI results and profile items before submission'; end if;
    select count(*) into missing_evidence
      from jsonb_array_elements(a.snapshot->'sections') s,jsonb_array_elements(s->'items') i
      where coalesce((i->>'evidence_required')::boolean,false)
        and not exists(select 1 from public.evaluation_evidence ev
          where ev.assignment_id=a.id and ev.item_id=(i->>'id')::uuid and ev.created_by=auth.uid());
    if missing_evidence>0 then raise exception 'RULE: evidence is required for % profile item(s)',missing_evidence; end if;
    if jsonb_array_length(coalesce(a.snapshot->'performance_factors','[]'::jsonb))>0 then
      select count(*) into missing_factors from jsonb_array_elements(a.snapshot->'performance_factors') f
        left join public.evaluation_factor_responses r on r.assignment_id=a.id
          and r.factor_code=f->>'factor_code' and r.respondent='evaluator' where r.rating is null;
      if missing_factors>0 then raise exception 'RULE: rate all ten performance factors before submission'; end if;
      select count(*) into missing_evidence from jsonb_array_elements(a.snapshot->'performance_factors') f
        where coalesce((f->>'evidence_required')::boolean,false)
          and not exists(select 1 from public.evaluation_evidence ev where ev.assignment_id=a.id
            and ev.factor_code=f->>'factor_code' and ev.created_by=auth.uid());
      if missing_evidence>0 then raise exception 'RULE: evidence is required for % performance factor(s)',missing_evidence; end if;
    end if;
    calculated_score:=public.compute_evaluation_profile_score(a.id,'evaluator');
    update public.evaluation_assignments set status='submitted',submitted_at=now(),
      overall_score=calculated_score,supervisor_score=public.compute_performance_factor_score(a.id,'evaluator')
      where id=_assignment returning * into a;
    update public.approval_tasks set status='cancelled'
      where workflow_type='evaluation' and record_id=a.id and status='pending';
    insert into public.approval_tasks(workflow_type,record_id,record_label,employee_id,submitted_by,assignee_role)
      values ('evaluation',a.id,'Evaluation: '||emp.first_name||' '||emp.last_name, a.employee_id,auth.uid(),'hr_admin');
    perform public._notify_role('hr_admin','Evaluation awaiting approval',
      emp.first_name||' '||emp.last_name||' evaluation was submitted','/approvals');
    perform public._notify(emp.user_id,'Your evaluation was submitted',
      'Your evaluator submitted your evaluation for review','/performance/evaluations/'||a.id);
  else raise exception 'INVALID: respondent must be self or evaluator'; end if;
  result:=to_jsonb(a)-'snapshot';
  return public._idem_put(_idem,'submit_evaluation',_hash,result);
end $$;

grant execute on function public.submit_evaluation(uuid,text,uuid,text) to authenticated;

drop function public.save_assessment(uuid,uuid,uuid,int,text,text,boolean,int);
create function public.save_assessment(
  _id uuid, _employee uuid, _competency uuid, _level int, _evidence text, _comments text,
  _reassess boolean, _version int, _method text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.competency_assessments;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.has_perm('comp.assess') then raise exception 'FORBIDDEN: you are not an authorized assessor'; end if;
  if not (public.can_manage_team_member(_employee) or public.has_perm('comp.manage')) then raise exception 'NOT_FOUND'; end if;
  if _employee=public.my_employee_id() then raise exception 'FORBIDDEN: you cannot assess yourself'; end if;
  if not exists(select 1 from public.competencies where id=_competency and status='active') then raise exception 'RULE: competency is not active'; end if;
  if length(coalesce(_method,''))>120 then raise exception 'INVALID: assessment method is too long'; end if;
  if _id is null then
    insert into public.competency_assessments(employee_id,competency_id,current_level,evidence_summary,
      comments,is_reassessment,assessment_method)
      values (_employee,_competency,_level,nullif(_evidence,''),nullif(_comments,''),
        coalesce(_reassess,false),nullif(trim(_method),'')) returning * into r;
  else
    update public.competency_assessments set current_level=_level,evidence_summary=nullif(_evidence,''),
      comments=nullif(_comments,''),is_reassessment=coalesce(_reassess,is_reassessment),
      assessment_method=nullif(trim(_method),'')
      where id=_id and assessor_id=auth.uid() and status='draft' and version=_version returning * into r;
    if not found then
      if exists(select 1 from public.competency_assessments where id=_id and assessor_id=auth.uid() and status='draft') then
        raise exception 'CONFLICT: this assessment was changed elsewhere';
      end if;
      raise exception 'NOT_FOUND';
    end if;
  end if;
  return to_jsonb(r);
end $$;
revoke all on function public.save_assessment(uuid,uuid,uuid,int,text,text,boolean,int, text) from public;
grant execute on function public.save_assessment(uuid,uuid,uuid,int,text,text,boolean,int,text) to authenticated;

create or replace function public.save_employee_critical_requirement(
  _id uuid,_employee uuid,_type text,_name text,_description text,_authority text,
  _reference text,_valid_from date,_expires_on date,_file uuid,_safety boolean,_active boolean,
  _idem uuid,_hash text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare previous jsonb; r public.employee_critical_requirements; result jsonb;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  previous:=public._idem_get(_idem,'save_employee_critical_requirement',_hash);
  if previous is not null then return previous; end if;
  if not (public.has_perm('hr.employees') or public.has_perm('admin.org')) then raise exception 'FORBIDDEN'; end if;
  if _type not in ('license','certification','qualification','safety')
    or length(trim(coalesce(_name,''))) not between 2 and 160
    or length(coalesce(_description,''))>2000
    or length(coalesce(_authority,''))>160
    or length(coalesce(_reference,''))>120
    or (_expires_on is not null and _valid_from is not null and _expires_on<_valid_from)
  then raise exception 'INVALID: critical requirement details are invalid'; end if;
  if _file is not null and not exists(select 1 from public.file_metadata where id=_file and uploaded_by=auth.uid()) then
    raise exception 'NOT_FOUND: supporting document'; end if;
  if _id is null then
    insert into public.employee_critical_requirements(employee_id,requirement_type,name,description,
      issuing_authority,reference_number,valid_from,expires_on,file_id,is_safety_critical,is_active)
      values (_employee,_type,trim(_name),nullif(trim(_description),''),nullif(trim(_authority),''),
        nullif(trim(_reference),''),_valid_from,_expires_on,_file,coalesce(_safety,false),coalesce(_active,true))
      returning * into r;
  else
    update public.employee_critical_requirements set requirement_type=_type,name=trim(_name),
      description=nullif(trim(_description),''),issuing_authority=nullif(trim(_authority),''),
      reference_number=nullif(trim(_reference),''),valid_from=_valid_from,expires_on=_expires_on,
      file_id=_file,is_safety_critical=coalesce(_safety,false),is_active=coalesce(_active,true)
      where id=_id and employee_id=_employee returning * into r;
    if not found then raise exception 'NOT_FOUND'; end if;
  end if;
  result:=to_jsonb(r);
  return public._idem_put(_idem,'save_employee_critical_requirement',_hash,result);
end $$;

create or replace function public.review_evaluation_critical_requirement(
  _assignment uuid,_requirement uuid,_status text,_comments text,_idem uuid,_hash text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare previous jsonb; a public.evaluation_assignments; r public.evaluation_critical_requirement_reviews;
  me uuid:=public.my_employee_id();
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  previous:=public._idem_get(_idem,'review_evaluation_critical_requirement',_hash);
  if previous is not null then return previous; end if;
  select * into a from public.evaluation_assignments where id=_assignment for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if not (a.evaluator_id=me or public.has_perm('perf.approve')) then raise exception 'FORBIDDEN'; end if;
  if a.status='approved' then raise exception 'RULE: finalized evaluation requirement reviews are immutable'; end if;
  if not exists(select 1 from public.employee_critical_requirements
    where id=_requirement and employee_id=a.employee_id and is_active) then raise exception 'NOT_FOUND'; end if;
  if _status not in ('compliant','needs_review','non_compliant') or length(coalesce(_comments,''))>2000 then
    raise exception 'INVALID: requirement review is invalid'; end if;
  insert into public.evaluation_critical_requirement_reviews(assignment_id,requirement_id,compliance_status,comments)
    values (_assignment,_requirement,_status,nullif(trim(_comments),'')) on conflict (assignment_id,requirement_id)
    do update set compliance_status=excluded.compliance_status,comments=excluded.comments,
      reviewed_at=now(),reviewed_by=auth.uid()
    returning * into r;
  return public._idem_put(_idem,'review_evaluation_critical_requirement',_hash,to_jsonb(r));
end $$;

revoke all on function public.save_employee_critical_requirement(uuid,uuid,text,text,text,text,text,date,date,uuid,boolean,boolean,uuid,text) from public;
revoke all on function public.review_evaluation_critical_requirement(uuid,uuid,text,text,uuid,text) from public;
grant execute on function public.save_employee_critical_requirement(uuid,uuid,text,text,text,text,text,date,date,uuid,boolean,boolean,uuid,text) to authenticated;
grant execute on function public.review_evaluation_critical_requirement(uuid,uuid,text,text,uuid,text) to authenticated;

create or replace function public.evaluation_competency_assessor_names(_assessment_ids uuid[])
returns table(assessment_id uuid, assessor_name text)
language sql stable security definer set search_path=public as $$
  select a.id,coalesce(p.full_name,'Authorized assessor')
  from public.competency_assessments a
  join public.profiles p on p.id=a.assessor_id
  where a.id=any(_assessment_ids) and public.can_view_comp(a.employee_id)
$$;
revoke all on function public.evaluation_competency_assessor_names(uuid[]) from public;
grant execute on function public.evaluation_competency_assessor_names(uuid[]) to authenticated;

alter function public.prepare_ai_context(uuid) rename to _prepare_ai_context_base;
revoke all on function public._prepare_ai_context_base(uuid) from public,authenticated;
create function public.prepare_ai_context(_employee uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare context jsonb; kpis jsonb; outcomes jsonb;
begin
  context:=public._prepare_ai_context_base(_employee);
  if public.can_view_perf(_employee) then
    select coalesce(jsonb_agg(jsonb_build_object(
      'name',item.value->>'label','description',item.value->>'help_text',
      'target',nullif(item.value->>'kpi_target','')::numeric,'unit',item.value->>'kpi_unit',
      'employee_actual',sr.kpi_actual,'supervisor_actual',er.kpi_actual,
      'employee_rating',sr.rating,'supervisor_rating',er.rating,
      'employee_comment',sr.comment,'supervisor_comment',er.comment
    ) order by item.value->>'label'),'[]'::jsonb) into kpis
    from (
      select a.id,a.snapshot from public.evaluation_assignments a
      where a.employee_id=_employee and a.status='approved'
      order by a.approved_at desc limit 1
    ) a
    cross join lateral jsonb_array_elements(a.snapshot->'sections') as section(value)
    cross join lateral jsonb_array_elements(section.value->'items') as item(value)
    left join public.evaluation_responses sr on sr.assignment_id=a.id
      and sr.item_id=(item.value->>'id')::uuid and sr.respondent='self'
    left join public.evaluation_responses er on er.assignment_id=a.id
      and er.item_id=(item.value->>'id')::uuid and er.respondent='evaluator'
    where item.value->>'item_type'='kpi';
    select jsonb_build_object('employee',self_response.content,'supervisor',supervisor_response.content)
      into outcomes
    from (
      select id from public.evaluation_assignments
      where employee_id=_employee and status='approved'
      order by approved_at desc limit 1
    ) a
    left join public.evaluation_development_responses self_response
      on self_response.assignment_id=a.id and self_response.respondent='self'
    left join public.evaluation_development_responses supervisor_response
      on supervisor_response.assignment_id=a.id and supervisor_response.respondent='evaluator';
  end if;
  return context || jsonb_build_object(
    'position_kpis',coalesce(kpis,'[]'::jsonb),
    'development_outcomes',outcomes
  );
end $$;
revoke all on function public.prepare_ai_context(uuid) from public;
grant execute on function public.prepare_ai_context(uuid) to authenticated;
