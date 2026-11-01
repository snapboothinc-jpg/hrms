-- Position-specific performance factors are versioned separately from legacy
-- profile items so competency assessments and historic evaluation snapshots
-- remain independent and immutable.
alter table public.evaluation_profile_versions
  add column scoring_method text not null default 'weighted'
    check (scoring_method in ('weighted', 'equal')),
  add column final_score_rule text not null default 'supervisor'
    check (final_score_rule in ('supervisor', 'self', 'average')),
  add column classification_thresholds jsonb not null default '[]'::jsonb
    check (jsonb_typeof(classification_thresholds) = 'array');

alter table public.evaluation_assignments
  add column self_score numeric(4,2) check (self_score between 1 and 5),
  add column supervisor_score numeric(4,2) check (supervisor_score between 1 and 5),
  add column final_score numeric(4,2) check (final_score between 1 and 5),
  add column classification text check (length(classification) <= 120);

alter table public.evaluation_evidence add column factor_code text;

create table public.evaluation_profile_factors (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.evaluation_profile_versions(id) on delete cascade,
  factor_code text not null check (factor_code in (
    'quality_of_work','quantity_of_work','job_knowledge','ability_to_learn','dependability',
    'initiative','human_relations_teamwork','cost_consciousness','discipline',
    'safety_consciousness_equipment'
  )),
  title text not null check (length(title) between 2 and 120),
  description text not null check (length(description) between 2 and 2000),
  indicators jsonb not null default '[]'::jsonb check (jsonb_typeof(indicators) = 'array'),
  weight numeric(5,2) not null default 10 check (weight between 0 and 100),
  evidence_required boolean not null default false,
  sort_order int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_by uuid,
  unique (version_id, factor_code)
);
create index on public.evaluation_profile_factors(version_id, sort_order);

create table public.evaluation_factor_responses (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.evaluation_assignments(id) on delete restrict,
  factor_code text not null check (factor_code in (
    'quality_of_work','quantity_of_work','job_knowledge','ability_to_learn','dependability',
    'initiative','human_relations_teamwork','cost_consciousness','discipline',
    'safety_consciousness_equipment'
  )),
  respondent text not null check (respondent in ('self','evaluator')),
  rating int check (rating between 1 and 5),
  comment text check (length(comment) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_by uuid,
  unique (assignment_id, factor_code, respondent)
);
create index on public.evaluation_factor_responses(assignment_id);

alter table public.evaluation_profile_factors enable row level security;
alter table public.evaluation_factor_responses enable row level security;
grant select on public.evaluation_profile_factors, public.evaluation_factor_responses to authenticated;
grant all on public.evaluation_profile_factors, public.evaluation_factor_responses to service_role;

create trigger touch before update on public.evaluation_profile_factors
  for each row execute function public.tg_touch();
create trigger audit after insert or update or delete on public.evaluation_profile_factors
  for each row execute function public.tg_audit();
create trigger lock_factors before insert or update or delete on public.evaluation_profile_factors
  for each row execute function public.tg_profile_content_locked();
create trigger touch before update on public.evaluation_factor_responses
  for each row execute function public.tg_touch();
create trigger audit after insert or update or delete on public.evaluation_factor_responses
  for each row execute function public.tg_audit();
create trigger audit after insert or update or delete on public.evaluation_responses
  for each row execute function public.tg_audit();

create policy "read" on public.evaluation_profile_factors for select to authenticated
  using (public.has_perm('perf.manage') or public.has_perm('perf.evaluate'));
create policy "scoped" on public.evaluation_factor_responses for select to authenticated
  using (exists (
    select 1 from public.evaluation_assignments a
    where a.id = assignment_id
      and (a.evaluator_id = public.my_employee_id() or (
        public.can_view_perf(a.employee_id)
        and (respondent = 'self' or a.status = 'approved' or public.has_perm('perf.approve'))
      ))
  ));
drop policy "scoped" on public.evaluation_responses;
create policy "scoped" on public.evaluation_responses for select to authenticated
  using (exists (
    select 1 from public.evaluation_assignments a
    where a.id = assignment_id
      and (a.evaluator_id = public.my_employee_id() or (
        public.can_view_perf(a.employee_id)
        and (respondent = 'self' or a.status = 'approved' or public.has_perm('perf.approve'))
      ))
  ));
drop policy "scoped" on public.evaluation_evidence;
create policy "scoped" on public.evaluation_evidence for select to authenticated
  using (exists (
    select 1 from public.evaluation_assignments a
    where a.id = assignment_id
      and (a.evaluator_id = public.my_employee_id() or (
        public.can_view_perf(a.employee_id)
        and (created_by = auth.uid() or a.status = 'approved' or public.has_perm('perf.approve'))
      ))
  ));

create or replace function public._default_performance_factors()
returns table(factor_code text, title text, description text, indicators jsonb)
language sql immutable set search_path=public as $$
  values
    ('quality_of_work','Quality of Work','Accuracy, completeness and consistency of work.','["Produces accurate and complete work","Checks work and corrects errors","Meets established quality standards"]'::jsonb),
    ('quantity_of_work','Quantity of Work','Volume of work completed relative to role expectations.','["Completes an appropriate volume of work","Maintains productivity during assigned hours","Meets agreed output commitments"]'::jsonb),
    ('job_knowledge','Job Knowledge','Understanding and application of job duties, procedures and tools.','["Applies role-specific procedures correctly","Uses required tools and systems effectively","Understands how the role supports operations"]'::jsonb),
    ('ability_to_learn','Ability to Learn','Capacity to acquire and apply new knowledge and skills.','["Applies feedback to subsequent work","Learns new procedures and tools","Adapts when requirements change"]'::jsonb),
    ('dependability','Dependability','Reliability, attendance and completion of commitments.','["Follows through on assigned commitments","Communicates delays or blockers promptly","Can be relied on to complete assigned work"]'::jsonb),
    ('initiative','Initiative','Proactive problem solving and appropriate independent action.','["Identifies and raises issues early","Takes appropriate action within role authority","Suggests practical process improvements"]'::jsonb),
    ('human_relations_teamwork','Human Relations / Teamwork','Respectful communication, cooperation and contribution to team outcomes.','["Communicates respectfully and clearly","Cooperates across roles and teams","Contributes constructively to shared work"]'::jsonb),
    ('cost_consciousness','Cost Consciousness','Responsible use of time, materials and organizational resources.','["Uses materials and equipment responsibly","Avoids preventable waste and rework","Considers cost when making work decisions"]'::jsonb),
    ('discipline','Discipline','Compliance with policies, procedures and workplace expectations.','["Follows applicable policies and procedures","Maintains professional conduct","Completes required records and approvals"]'::jsonb),
    ('safety_consciousness_equipment','Safety Consciousness / Care of Equipment','Safe work practices and responsible care of equipment.','["Follows safety procedures and reports hazards","Uses and cares for equipment correctly","Stops and escalates unsafe work conditions"]'::jsonb)
$$;

create or replace function public._seed_performance_factors(_version uuid) returns void
language plpgsql set search_path=public as $$
begin
  insert into public.evaluation_profile_factors(version_id,factor_code,title,description,indicators,weight,evidence_required,sort_order)
  select _version, factor_code, title, description, indicators, 10, false, n
  from public._default_performance_factors() with ordinality as f(factor_code,title,description,indicators,n)
  on conflict (version_id,factor_code) do nothing;
end $$;

create or replace function public.create_profile(_position uuid, _name text, _desc text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare p public.evaluation_profiles; v public.evaluation_profile_versions;
begin
  if not public.has_perm('perf.manage') then raise exception 'FORBIDDEN'; end if;
  insert into public.evaluation_profiles(position_id,name,description) values (_position,_name,_desc) returning * into p;
  insert into public.evaluation_profile_versions(profile_id,position_id,version_number,scoring_method)
    values (p.id,_position,1,'equal') returning * into v;
  perform public._seed_performance_factors(v.id);
  return jsonb_build_object('profile',to_jsonb(p),'version',to_jsonb(v));
end $$;

create or replace function public.new_profile_version(_profile uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare src public.evaluation_profile_versions; v public.evaluation_profile_versions; s record; nsid uuid;
begin
  if not public.has_perm('perf.manage') then raise exception 'FORBIDDEN'; end if;
  if exists(select 1 from public.evaluation_profile_versions where profile_id=_profile and status='draft') then
    raise exception 'RULE: this profile already has a draft version'; end if;
  select * into src from public.evaluation_profile_versions where profile_id=_profile order by version_number desc limit 1;
  if not found then raise exception 'NOT_FOUND'; end if;
  insert into public.evaluation_profile_versions(profile_id,position_id,version_number,rating_scale_max,instructions,
    effective_date,scoring_method,final_score_rule,classification_thresholds)
    values (_profile,src.position_id,src.version_number+1,src.rating_scale_max,src.instructions,src.effective_date,
      src.scoring_method,src.final_score_rule,src.classification_thresholds) returning * into v;
  for s in select * from public.evaluation_sections where version_id=src.id order by sort_order loop
    insert into public.evaluation_sections(version_id,title,description,sort_order)
      values (v.id,s.title,s.description,s.sort_order) returning id into nsid;
    insert into public.evaluation_items(version_id,section_id,label,help_text,item_type,weight,options,kpi_target,kpi_unit,
      competency_id,evidence_required,is_required,sort_order)
      select v.id,nsid,label,help_text,item_type,weight,options,kpi_target,kpi_unit,competency_id,evidence_required,is_required,sort_order
      from public.evaluation_items where section_id=s.id;
  end loop;
  insert into public.evaluation_profile_factors(version_id,factor_code,title,description,indicators,weight,evidence_required,sort_order)
    select v.id,factor_code,title,description,indicators,weight,evidence_required,sort_order
    from public.evaluation_profile_factors where version_id=src.id;
  if not exists(select 1 from public.evaluation_profile_factors where version_id=v.id) then
    perform public._seed_performance_factors(v.id);
  end if;
  return to_jsonb(v);
end $$;

create or replace function public.save_profile_version(_version_id uuid, _c jsonb, _expected int) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v public.evaluation_profile_versions; s jsonb; it jsonb; f jsonb; sid uuid; si int := 0; ii int;
begin
  if not public.has_perm('perf.manage') then raise exception 'FORBIDDEN'; end if;
  select * into v from public.evaluation_profile_versions where id=_version_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v.status <> 'draft' then raise exception 'RULE: only draft versions can be edited; create a new version instead'; end if;
  if v.version <> _expected then raise exception 'CONFLICT: this profile version was changed by someone else'; end if;
  if jsonb_typeof(_c->'performance_factors') <> 'array' or jsonb_array_length(_c->'performance_factors') <> 10 then
    raise exception 'INVALID: configure all ten performance factors'; end if;
  if (select count(distinct x->>'factor_code') from jsonb_array_elements(_c->'performance_factors') x) <> 10 then
    raise exception 'INVALID: performance factor codes must be unique'; end if;
  if exists (
    select 1 from jsonb_array_elements(_c->'performance_factors') f
    where not exists (
      select 1 from public._default_performance_factors() d
      where d.factor_code=f->>'factor_code' and d.title=f->>'title'
    )
  ) then raise exception 'INVALID: preserve the original ten performance factor names'; end if;
  if exists (
    select 1 from jsonb_array_elements(_c->'performance_factors') f
    where jsonb_typeof(f->'indicators') is distinct from 'array'
  ) then raise exception 'INVALID: each performance factor needs evaluation indicators'; end if;
  if exists (
    select 1 from jsonb_array_elements(_c->'performance_factors') f,
      jsonb_array_elements(f->'indicators') i
    where jsonb_typeof(i) <> 'string' or length(trim(i #>> '{}')) < 2 or length(i #>> '{}') > 1000
  ) or exists (
    select 1 from jsonb_array_elements(_c->'performance_factors') f
    where jsonb_array_length(f->'indicators')=0
  ) then raise exception 'INVALID: each performance factor needs valid evaluation indicators'; end if;
  if _c->>'scoring_method' not in ('weighted','equal') then raise exception 'INVALID: scoring method'; end if;
  if coalesce(_c->>'final_score_rule','supervisor') not in ('supervisor','self','average') then
    raise exception 'INVALID: final score rule'; end if;
  if exists (
    select 1 from jsonb_array_elements(coalesce(_c->'classification_thresholds','[]'::jsonb)) t
    where nullif(t->>'label','') is null or length(t->>'label') > 120
      or coalesce((t->>'min')::numeric,0) < 1 or coalesce((t->>'max')::numeric,0) > 5
      or (t->>'min')::numeric > (t->>'max')::numeric
  ) then   raise exception 'INVALID: classification thresholds must have a label and valid 1-5 bounds'; end if;
  if exists (
    select 1 from jsonb_array_elements(coalesce(_c->'classification_thresholds','[]'::jsonb)) a,
      jsonb_array_elements(coalesce(_c->'classification_thresholds','[]'::jsonb)) b
    where a->>'label' < b->>'label'
      and (a->>'min')::numeric <= (b->>'max')::numeric
      and (b->>'min')::numeric <= (a->>'max')::numeric
  ) then raise exception 'INVALID: classification ranges cannot overlap'; end if;
  delete from public.evaluation_items where version_id=_version_id;
  delete from public.evaluation_sections where version_id=_version_id;
  for s in select * from jsonb_array_elements(coalesce(_c->'sections','[]'::jsonb)) loop
    insert into public.evaluation_sections(version_id,title,description,sort_order)
      values (_version_id,s->>'title',nullif(s->>'description',''),si) returning id into sid;
    si := si+1; ii := 0;
    for it in select * from jsonb_array_elements(coalesce(s->'items','[]'::jsonb)) loop
      insert into public.evaluation_items(version_id,section_id,label,help_text,item_type,weight,options,kpi_target,kpi_unit,
        competency_id,evidence_required,is_required,sort_order)
      values (_version_id,sid,it->>'label',nullif(it->>'help_text',''),it->>'item_type',coalesce((it->>'weight')::numeric,0),
        coalesce(it->'options','[]'::jsonb),nullif(it->>'kpi_target','')::numeric,nullif(it->>'kpi_unit',''),
        nullif(it->>'competency_id','')::uuid,coalesce((it->>'evidence_required')::boolean,false),
        coalesce((it->>'is_required')::boolean,true),ii);
      ii := ii+1;
    end loop;
  end loop;
  delete from public.evaluation_profile_factors where version_id=_version_id;
  for f in select * from jsonb_array_elements(_c->'performance_factors') loop
    insert into public.evaluation_profile_factors(version_id,factor_code,title,description,indicators,weight,evidence_required,sort_order)
    values (_version_id,f->>'factor_code',f->>'title',f->>'description',coalesce(f->'indicators','[]'::jsonb),
      coalesce((f->>'weight')::numeric,10),coalesce((f->>'evidence_required')::boolean,false),
      coalesce((f->>'sort_order')::int,0));
  end loop;
  update public.evaluation_profile_versions set rating_scale_max=5,
    instructions=nullif(_c->>'instructions',''), effective_date=nullif(_c->>'effective_date','')::date,
    scoring_method=_c->>'scoring_method',final_score_rule=coalesce(_c->>'final_score_rule','supervisor'),
    classification_thresholds=coalesce(_c->'classification_thresholds','[]'::jsonb)
  where id=_version_id returning * into v;
  return to_jsonb(v);
end $$;

create or replace function public.activate_profile_version(_version_id uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v public.evaluation_profile_versions; total numeric; factors int;
begin
  if not public.has_perm('perf.manage') then raise exception 'FORBIDDEN'; end if;
  select * into v from public.evaluation_profile_versions where id=_version_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  perform public.assert_transition('profile_version',v.status,'active');
  select count(*),coalesce(sum(weight),0) into factors,total
    from public.evaluation_profile_factors where version_id=_version_id;
  if factors <> 10 then raise exception 'RULE: all ten performance factors must be configured'; end if;
  if v.scoring_method='weighted' and total <> 100 then
    raise exception 'RULE: factor weights must total 100 percent (currently %)', total; end if;
  update public.evaluation_profile_versions set status='archived'
    where position_id=v.position_id and status='active';
  update public.evaluation_profile_versions set status='active', activated_at=now(), activated_by=auth.uid(),
    effective_date=coalesce(effective_date,current_date) where id=_version_id returning * into v;
  return to_jsonb(v);
end $$;

create or replace function public._build_snapshot(_version_id uuid) returns jsonb
language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
    'version_id',v.id,'profile_id',p.id,'profile_name',p.name,'version_number',v.version_number,
    'position_id',v.position_id,'rating_scale_max',v.rating_scale_max,'instructions',v.instructions,
    'scoring_method',v.scoring_method,'final_score_rule',v.final_score_rule,
    'classification_thresholds',v.classification_thresholds,
    'performance_factors',coalesce((select jsonb_agg(to_jsonb(f)-'created_at'-'updated_at'-'created_by'-'updated_by'
      order by f.sort_order) from public.evaluation_profile_factors f where f.version_id=v.id),'[]'::jsonb),
    'sections',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'description',s.description,
      'items',coalesce((select jsonb_agg(to_jsonb(i)-'created_at'-'updated_at'-'created_by'-'updated_by' order by i.sort_order)
        from public.evaluation_items i where i.section_id=s.id),'[]'::jsonb)) order by s.sort_order)
      from public.evaluation_sections s where s.version_id=v.id),'[]'::jsonb))
  from public.evaluation_profile_versions v join public.evaluation_profiles p on p.id=v.profile_id
  where v.id=_version_id
$$;

create or replace function public.validate_evaluation_assignment_snapshot() returns trigger
language plpgsql security definer set search_path=public as $$
declare factor_count int; cycle_self boolean;
begin
  factor_count:=jsonb_array_length(coalesce(new.snapshot->'performance_factors','[]'::jsonb));
  if factor_count<>10 then raise exception 'RULE: a new assignment requires all ten configured performance factors'; end if;
  select self_evaluation into cycle_self from public.evaluation_cycles where id=new.cycle_id;
  if coalesce(new.snapshot->>'final_score_rule','supervisor') in ('self','average') and not cycle_self then
    raise exception 'RULE: this profile final-score rule requires employee self-evaluation'; end if;
  return new;
end $$;
create trigger validate_assignment_snapshot before insert on public.evaluation_assignments
  for each row execute function public.validate_evaluation_assignment_snapshot();

create or replace function public.compute_performance_factor_score(_assignment uuid, _respondent text) returns numeric
language sql stable security definer set search_path=public as $$
  with factors as (
    select f.factor_code,f.weight,(r.rating)::numeric rating,
      a.snapshot->>'scoring_method' scoring_method
    from public.evaluation_assignments a
    cross join lateral jsonb_to_recordset(a.snapshot->'performance_factors')
      as f(factor_code text,weight numeric)
    left join public.evaluation_factor_responses r
      on r.assignment_id=a.id and r.factor_code=f.factor_code and r.respondent=_respondent
    where a.id=_assignment
  )
  select case when count(rating)=0 then null else round(
    sum(rating * case when scoring_method='equal' then 1 else weight end)
      / nullif(sum(case when scoring_method='equal' then 1 else weight end),0),2) end
  from factors
$$;

update public.evaluation_assignments set overall_score=null
where status<>'approved' and overall_score is not null;

create or replace function public.save_evaluation(_assignment uuid, _respondent text, _responses jsonb,
  _overall_comment text, _expected int) returns jsonb
language plpgsql security definer set search_path=public as $$
declare a public.evaluation_assignments; r jsonb; fr jsonb; me uuid := public.my_employee_id(); valid_ids uuid[];
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into a from public.evaluation_assignments where id=_assignment for update;
  if not found or not (public.can_view_perf(a.employee_id) or a.evaluator_id=me) then raise exception 'NOT_FOUND'; end if;
  if _respondent='evaluator' and a.evaluator_id is distinct from me then
    raise exception 'FORBIDDEN: only the assigned evaluator can complete this form'; end if;
  if _respondent='self' then
    if a.employee_id is distinct from me then raise exception 'FORBIDDEN: only the employee can complete the self-evaluation'; end if;
    if not a.self_evaluation then raise exception 'RULE: self-evaluation is not configured for this cycle'; end if;
    if a.self_submitted_at is not null and a.status <> 'reopened' then raise exception 'RULE: self-evaluation already submitted'; end if;
  end if;
  if a.status in ('submitted','under_review','approved') then raise exception 'RULE: the evaluation is % and cannot be edited',a.status; end if;
  if a.version <> _expected then raise exception 'CONFLICT: this evaluation was changed by someone else'; end if;
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
    on conflict (assignment_id,item_id,respondent) do update set rating=excluded.rating,text_value=excluded.text_value,
      choice_values=excluded.choice_values,kpi_actual=excluded.kpi_actual,comment=excluded.comment;
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
  if _respondent='evaluator' then
    perform public.assert_transition('evaluation',a.status,'in_progress');
    update public.evaluation_assignments set status='in_progress',overall_comment=coalesce(_overall_comment,overall_comment)
      where id=_assignment returning * into a;
  else
    update public.evaluation_assignments set status=case when status='not_started' then 'in_progress' else status end
      where id=_assignment returning * into a;
  end if;
  return to_jsonb(a)-'snapshot';
end $$;

create or replace function public.submit_evaluation(_assignment uuid, _respondent text, _idem uuid, _hash text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare prev jsonb; a public.evaluation_assignments; me uuid:=public.my_employee_id(); missing int; missing_factors int;
  missing_evidence int; emp public.employees; result jsonb; calculated_score numeric;
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
        left join public.evaluation_factor_responses r on r.assignment_id=a.id and r.factor_code=f->>'factor_code' and r.respondent='self'
        where r.rating is null;
      if missing_factors>0 then raise exception 'RULE: rate all ten performance factors before submission'; end if;
      select count(*) into missing_evidence from jsonb_array_elements(a.snapshot->'performance_factors') f
        where coalesce((f->>'evidence_required')::boolean,false)
          and not exists(select 1 from public.evaluation_evidence ev where ev.assignment_id=a.id
            and ev.factor_code=f->>'factor_code' and ev.created_by=auth.uid());
      if missing_evidence>0 then raise exception 'RULE: evidence is required for % performance factor(s)',missing_evidence; end if;
      calculated_score:=public.compute_performance_factor_score(a.id,'self');
    end if;
    update public.evaluation_assignments set self_submitted_at=now(),self_score=calculated_score where id=_assignment returning * into a;
    perform public._notify((select user_id from public.employees where id=a.evaluator_id),'Self-evaluation submitted',
      emp.first_name||' '||emp.last_name||' submitted a self-evaluation','/performance/evaluations/'||a.id);
  elsif _respondent='evaluator' then
    if a.evaluator_id is distinct from me then raise exception 'FORBIDDEN: only the assigned evaluator can submit'; end if;
    perform public.assert_transition('evaluation',a.status,'submitted');
    select count(*) into missing from jsonb_array_elements(a.snapshot->'sections') s,jsonb_array_elements(s->'items') i
      left join public.evaluation_responses r on r.assignment_id=a.id and r.item_id=(i->>'id')::uuid and r.respondent='evaluator'
      where coalesce((i->>'is_required')::boolean,true) and (r.id is null or
        (r.rating is null and r.text_value is null and r.kpi_actual is null and r.choice_values is null));
    if missing>0 then raise exception 'RULE: % required profile item(s) are not answered',missing; end if;
    if jsonb_array_length(coalesce(a.snapshot->'performance_factors','[]'::jsonb))>0 then
      select count(*) into missing_factors from jsonb_array_elements(a.snapshot->'performance_factors') f
        left join public.evaluation_factor_responses r on r.assignment_id=a.id and r.factor_code=f->>'factor_code' and r.respondent='evaluator'
        where r.rating is null;
      if missing_factors>0 then raise exception 'RULE: rate all ten performance factors before submission'; end if;
      select count(*) into missing_evidence from jsonb_array_elements(a.snapshot->'performance_factors') f
        where coalesce((f->>'evidence_required')::boolean,false)
          and not exists(select 1 from public.evaluation_evidence ev where ev.assignment_id=a.id
            and ev.factor_code=f->>'factor_code' and ev.created_by=auth.uid());
      if missing_evidence>0 then raise exception 'RULE: evidence is required for % performance factor(s)',missing_evidence; end if;
    end if;
    update public.evaluation_assignments set status='submitted',submitted_at=now()
      where id=_assignment returning * into a;
    update public.approval_tasks set status='cancelled' where workflow_type='evaluation' and record_id=a.id and status='pending';
    insert into public.approval_tasks(workflow_type,record_id,record_label,employee_id,submitted_by,assignee_role)
      values ('evaluation',a.id,'Evaluation: '||emp.first_name||' '||emp.last_name,a.employee_id,auth.uid(),'hr_admin');
    perform public._notify_role('hr_admin','Evaluation awaiting approval',emp.first_name||' '||emp.last_name||
      ' evaluation was submitted','/approvals');
    perform public._notify(emp.user_id,'Your evaluation was submitted',
      'Your evaluator submitted your evaluation for review','/performance/evaluations/'||a.id);
  else
    raise exception 'INVALID: respondent must be self or evaluator';
  end if;
  result:=to_jsonb(a)-'snapshot';
  return public._idem_put(_idem,'submit_evaluation',_hash,result);
end $$;

create or replace function public.review_evaluation(_assignment uuid,_decision text,_comments text,_idem uuid,_hash text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare prev jsonb; a public.evaluation_assignments; emp public.employees; result jsonb; me uuid:=public.my_employee_id();
  rule text; thresholds jsonb; threshold jsonb; approved_score numeric; supervisor_factor_score numeric;
  class_label text;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  prev:=public._idem_get(_idem,'review_evaluation',_hash); if prev is not null then return prev; end if;
  if not public.has_perm('perf.approve') then raise exception 'FORBIDDEN: you do not hold a performance-approval role'; end if;
  select * into a from public.evaluation_assignments where id=_assignment for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if a.evaluator_id=me or a.employee_id=me then raise exception 'FORBIDDEN: you cannot approve an evaluation you submitted or that is about you'; end if;
  select * into emp from public.employees where id=a.employee_id;
  if _decision='approve' then
    perform public.assert_transition('evaluation',a.status,'approved');
    if jsonb_array_length(coalesce(a.snapshot->'performance_factors','[]'::jsonb))>0 then
      supervisor_factor_score:=public.compute_performance_factor_score(a.id,'evaluator');
      rule:=coalesce(a.snapshot->>'final_score_rule','supervisor');
      if rule='self' then approved_score:=a.self_score;
      elsif rule='average' then
        if a.self_score is null or supervisor_factor_score is null then
          raise exception 'RULE: both scores are required by the configured final score rule'; end if;
        approved_score:=round((a.self_score+supervisor_factor_score)/2,2);
      else approved_score:=supervisor_factor_score;
      end if;
      if approved_score is null or supervisor_factor_score is null then
        raise exception 'RULE: the configured final score is unavailable'; end if;
    end if;
    thresholds:=coalesce(a.snapshot->'classification_thresholds','[]'::jsonb);
    for threshold in select * from jsonb_array_elements(thresholds) loop
      if approved_score between (threshold->>'min')::numeric and (threshold->>'max')::numeric then
        class_label:=threshold->>'label'; exit;
      end if;
    end loop;
    update public.evaluation_assignments set status='approved',approved_at=now(),approved_by=auth.uid(),
      supervisor_score=supervisor_factor_score,
      overall_score=case when jsonb_array_length(coalesce(a.snapshot->'performance_factors','[]'::jsonb))=0
        then overall_score else public.compute_evaluation_score(_assignment) end,
      final_score=approved_score,classification=class_label where id=_assignment returning * into a;
    insert into public.evaluation_reviews(assignment_id,decision,comments) values (a.id,'approved',_comments);
    update public.approval_tasks set status='approved',decided_by=auth.uid(),decided_at=now(),comments=_comments
      where workflow_type='evaluation' and record_id=a.id and status='pending';
    perform public._snapshot_gaps(a.employee_id);
    perform public._notify(emp.user_id,'Evaluation approved','Your evaluation was approved',
      '/performance/evaluations/'||a.id,'success');
    perform public._notify((select user_id from public.employees where id=a.evaluator_id),'Evaluation approved',
      'Evaluation for '||emp.first_name||' '||emp.last_name||' was approved','/performance/evaluations/'||a.id,'success');
  elsif _decision='return' then
    if coalesce(length(trim(_comments)),0)<5 then raise exception 'INVALID: a reason is required when returning an evaluation'; end if;
    perform public.assert_transition('evaluation',a.status,'reopened');
    update public.evaluation_assignments set status='reopened',reopen_reason=_comments where id=_assignment returning * into a;
    insert into public.evaluation_reviews(assignment_id,decision,comments) values (a.id,'returned',_comments);
    update public.approval_tasks set status='rejected',decided_by=auth.uid(),decided_at=now(),comments=_comments
      where workflow_type='evaluation' and record_id=a.id and status='pending';
    perform public._notify((select user_id from public.employees where id=a.evaluator_id),'Evaluation returned',
      'Returned with comments: '||_comments,'/performance/evaluations/'||a.id,'warning');
  else raise exception 'INVALID: unknown decision'; end if;
  result:=to_jsonb(a)-'snapshot';
  return public._idem_put(_idem,'review_evaluation',_hash,result);
end $$;

create or replace function public.add_performance_factor_evidence(_assignment uuid,_factor_code text,_file uuid,
  _note text,_idem uuid,_hash text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare a public.evaluation_assignments; r public.evaluation_evidence; me uuid:=public.my_employee_id(); prior jsonb;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  prior:=public._idem_get(_idem,'add_performance_factor_evidence',_hash);
  if prior is not null then return prior; end if;
  select * into a from public.evaluation_assignments where id=_assignment for update;
  if not found or not (a.employee_id=me or a.evaluator_id=me) then raise exception 'NOT_FOUND'; end if;
  if a.status in ('submitted','under_review','approved') then
    raise exception 'RULE: evidence cannot be added to a % evaluation',a.status; end if;
  if not exists(select 1 from jsonb_array_elements(a.snapshot->'performance_factors') f
    where f->>'factor_code'=_factor_code) then raise exception 'INVALID: unknown performance factor'; end if;
  if a.employee_id=me and a.self_submitted_at is not null and a.status<>'reopened' then
    raise exception 'RULE: evidence cannot be changed after self-evaluation submission'; end if;
  if _file is null and coalesce(length(trim(_note)),0)=0 then raise exception 'INVALID: provide a file or evidence note'; end if;
  if _file is not null and not exists(select 1 from public.file_metadata where id=_file and uploaded_by=auth.uid()) then
    raise exception 'NOT_FOUND: file'; end if;
  insert into public.evaluation_evidence(assignment_id,file_id,note,factor_code)
    values (_assignment,_file,nullif(_note,''),_factor_code) returning * into r;
  return public._idem_put(_idem,'add_performance_factor_evidence',_hash,to_jsonb(r));
end $$;

-- Existing published profiles receive a new version rather than rewriting the
-- profile snapshots that earlier assignments already hold.
do $$
declare oldv public.evaluation_profile_versions; newv public.evaluation_profile_versions;
  s record; new_section uuid; next_version int;
begin
  for oldv in select * from public.evaluation_profile_versions where status='active' loop
    select coalesce(max(version_number),0)+1 into next_version
      from public.evaluation_profile_versions where profile_id=oldv.profile_id;
    insert into public.evaluation_profile_versions(profile_id,position_id,version_number,status,effective_date,
      rating_scale_max,instructions,scoring_method,final_score_rule,classification_thresholds)
      values (oldv.profile_id,oldv.position_id,next_version,'draft',current_date,oldv.rating_scale_max,
        oldv.instructions,'equal','supervisor','[]'::jsonb) returning * into newv;
    for s in select * from public.evaluation_sections where version_id=oldv.id order by sort_order loop
      insert into public.evaluation_sections(version_id,title,description,sort_order)
        values (newv.id,s.title,s.description,s.sort_order) returning id into new_section;
      insert into public.evaluation_items(version_id,section_id,label,help_text,item_type,weight,options,kpi_target,kpi_unit,
        competency_id,evidence_required,is_required,sort_order)
        select newv.id,new_section,label,help_text,item_type,weight,options,kpi_target,kpi_unit,competency_id,
          evidence_required,is_required,sort_order from public.evaluation_items where section_id=s.id;
    end loop;
    perform public._seed_performance_factors(newv.id);
    update public.evaluation_profile_versions set status='archived' where id=oldv.id;
    update public.evaluation_profile_versions set status='active',activated_at=now(),activated_by=oldv.activated_by
      where id=newv.id;
  end loop;
  for oldv in select * from public.evaluation_profile_versions where status='draft' loop
    perform public._seed_performance_factors(oldv.id);
  end loop;
end $$;

revoke all on function public._default_performance_factors() from public, authenticated;
revoke all on function public._seed_performance_factors(uuid) from public, authenticated;
revoke all on function public.compute_performance_factor_score(uuid,text) from public, authenticated;
grant execute on function public.create_profile(uuid,text,text) to authenticated;
grant execute on function public.new_profile_version(uuid) to authenticated;
grant execute on function public.save_profile_version(uuid,jsonb,int) to authenticated;
grant execute on function public.activate_profile_version(uuid) to authenticated;
grant execute on function public.save_evaluation(uuid,text,jsonb,text,int) to authenticated;
grant execute on function public.submit_evaluation(uuid,text,uuid,text) to authenticated;
grant execute on function public.review_evaluation(uuid,text,text,uuid,text) to authenticated;
grant execute on function public.add_performance_factor_evidence(uuid,text,uuid,text,uuid,text) to authenticated;

alter table public.ai_recommendations add column assessment_method text;
alter table public.development_plan_items add column assessment_method text;

create or replace function public.prepare_ai_context(_employee uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare gaps jsonb; resources jsonb; emp jsonb; performance jsonb; comments jsonb; history jsonb;
begin
  if not public.has_perm('ai.generate') then raise exception 'FORBIDDEN'; end if;
  if not public.can_view_comp(_employee) then raise exception 'NOT_FOUND'; end if;
  select jsonb_build_object('id',e.id,'name',e.first_name||' '||e.last_name,'position',p.title,'department',d.name)
    into emp from public.employees e join public.positions p on p.id=e.position_id
    join public.departments d on d.id=e.department_id where e.id=_employee;
  if emp is null then raise exception 'NOT_FOUND'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('competency_id',g.competency_id,'competency',g.competency_name,
    'required_level',g.required_level,'current_level',g.current_level,'gap',g.gap,'is_mandatory',g.is_mandatory,
    'is_safety_critical',g.is_safety_critical)),'[]'::jsonb)
    into gaps from public.competency_gaps(_employee,null,null,null,'gap',50,0) g;
  if public.can_view_perf(_employee) then
    select jsonb_build_object('cycle',c.name,'score',a.final_score,'classification',a.classification,
      'factors',coalesce((
        select jsonb_agg(jsonb_build_object('factor_code',f->>'factor_code','title',f->>'title',
          'employee_rating',sr.rating,'supervisor_rating',er.rating,
          'employee_comment',sr.comment,'supervisor_comment',er.comment) order by f->>'factor_code')
        from jsonb_array_elements(a.snapshot->'performance_factors') f
        left join public.evaluation_factor_responses sr on sr.assignment_id=a.id
          and sr.factor_code=f->>'factor_code' and sr.respondent='self'
        left join public.evaluation_factor_responses er on er.assignment_id=a.id
          and er.factor_code=f->>'factor_code' and er.respondent='evaluator'
      ),'[]'::jsonb))
    into performance from public.evaluation_assignments a
      join public.evaluation_cycles c on c.id=a.cycle_id
    where a.employee_id=_employee and a.status='approved'
    order by a.approved_at desc limit 1;
    select coalesce(jsonb_agg(comment_text),'[]'::jsonb) into comments from (
      select recent_comments.comment_text from (
        select a.overall_comment as comment_text from public.evaluation_assignments a
        where a.employee_id=_employee and a.status='approved' and a.overall_comment is not null
        order by a.approved_at desc limit 10
      ) recent_comments
      union all
      select recent_factor_comments.comment_text from (
        select fr.comment as comment_text from public.evaluation_factor_responses fr
        join public.evaluation_assignments a on a.id=fr.assignment_id
        where a.employee_id=_employee and a.status='approved' and fr.respondent='evaluator'
          and fr.comment is not null
        order by a.approved_at desc limit 30
      ) recent_factor_comments
    ) recent_development_comments;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('title',h.title,'type',h.type,'status',h.status,
    'completed_at',h.completed_at) order by h.completed_at desc),'[]'::jsonb)
    into history from (
      select c.title,'course'::text as type,ce.status::text as status,ce.completed_at::text as completed_at
      from public.course_enrollments ce join public.courses c on c.id=ce.course_id
      where ce.employee_id=_employee
      union all
      select ts.title,'training'::text,
        coalesce(tr.outcome,tp.status)::text,
        coalesce(tr.created_at,tp.updated_at)::text
      from public.training_participants tp join public.training_sessions ts on ts.id=tp.session_id
      left join public.training_results tr on tr.session_id=tp.session_id and tr.employee_id=tp.employee_id
      where tp.employee_id=_employee
    ) h;
  select coalesce(jsonb_agg(distinct jsonb_build_object('type','course','id',c.id,'title',c.title,
    'summary',left(coalesce(c.description,''),300),'competency_id',m.competency_id)),'[]'::jsonb)
    into resources from public.course_competency_mappings m
      join public.courses c on c.id=m.course_id and c.status='approved'
    where m.competency_id in (select (g->>'competency_id')::uuid from jsonb_array_elements(gaps) g);
  resources:=coalesce(resources,'[]'::jsonb)||coalesce((
    select jsonb_agg(distinct jsonb_build_object('type','learning_path','id',lp.id,'title',lp.title,
      'summary',left(coalesce(lp.description,''),300),'competency_id',lp.competency_id))
    from public.learning_paths lp where lp.status='active'
      and lp.competency_id in (select (g->>'competency_id')::uuid from jsonb_array_elements(gaps) g)
  ),'[]'::jsonb);
  resources:=coalesce(resources,'[]'::jsonb)||coalesce((
    select jsonb_agg(distinct jsonb_build_object('type','training','id',ts.id,'title',ts.title,
      'summary',left(coalesce(ts.venue,''),100)||' '||to_char(ts.starts_at,'YYYY-MM-DD'),
      'competency_id',ts.related_competency_id))
    from public.training_sessions ts where ts.status='planned'
      and ts.related_competency_id in (select (g->>'competency_id')::uuid from jsonb_array_elements(gaps) g)
  ),'[]'::jsonb);
  return jsonb_build_object('employee',emp,'performance_results',performance,
    'development_comments',coalesce(comments,'[]'::jsonb),'learning_history',coalesce(history,'[]'::jsonb),
    'gaps',gaps,'resources',resources);
end $$;

create or replace function public.save_ai_recommendations(_employee uuid,_items jsonb,_model text,_idem uuid,_hash text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare item jsonb; saved int:=0; rejected int:=0; resp jsonb; gid uuid; req int; cur int; gp int; ok boolean;
begin
  if not public.has_perm('ai.generate') then raise exception 'FORBIDDEN'; end if;
  if not public.can_view_comp(_employee) then raise exception 'NOT_FOUND'; end if;
  resp:=public._idem_get(_idem,'save_ai_recommendations',_hash); if resp is not null then return resp; end if;
  for item in select * from jsonb_array_elements(_items) loop
    ok:=false;
    select g.competency_id,g.required_level,g.current_level,g.gap into gid,req,cur,gp
      from public.competency_gaps(_employee,null,null,null,'gap',50,0) g
      where g.competency_id=(item->>'competency_id')::uuid;
    if gid is not null then
      if item->>'recommendation_type'='course' then
        select exists(select 1 from public.course_competency_mappings m join public.courses c on c.id=m.course_id
          where m.course_id=(item->>'resource_id')::uuid and m.competency_id=gid and c.status='approved') into ok;
      elsif item->>'recommendation_type'='learning_path' then
        select exists(select 1 from public.learning_paths lp where lp.id=(item->>'resource_id')::uuid
          and lp.competency_id=gid and lp.status='active') into ok;
      elsif item->>'recommendation_type'='training' then
        select exists(select 1 from public.training_sessions ts where ts.id=(item->>'resource_id')::uuid
          and ts.related_competency_id=gid and ts.status='planned') into ok;
      end if;
    end if;
    if ok then
      insert into public.ai_recommendations(employee_id,competency_id,required_level,current_level,gap,
        recommendation_type,resource_id,rationale,expected_outcome,assessment_method,priority,model,generated_by,sources)
      values (_employee,gid,req,cur,gp,item->>'recommendation_type',(item->>'resource_id')::uuid,
        left(item->>'rationale',4000),left(item->>'expected_outcome',4000),left(item->>'assessment_method',4000),
        case when item->>'priority' in ('high','medium','low') then item->>'priority' else 'medium' end,
        left(_model,120),auth.uid(),coalesce(item->'sources','[]'::jsonb));
      saved:=saved+1;
    else rejected:=rejected+1;
    end if;
  end loop;
  return public._idem_put(_idem,'save_ai_recommendations',_hash,
    jsonb_build_object('saved',saved,'rejected',rejected));
end $$;

create or replace function public.review_ai_recommendation(_id uuid,_decision text,_comments text,_edited jsonb,
  _idem uuid,_hash text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.ai_recommendations; resp jsonb; new_status text; plan_id uuid; item_id uuid; eff jsonb;
begin
  if not public.can_review_ai() then raise exception 'FORBIDDEN'; end if;
  if _decision not in ('accept','edit','reject') then raise exception 'INVALID: decision must be accept, edit or reject'; end if;
  resp:=public._idem_get(_idem,'review_ai_recommendation',_hash); if resp is not null then return resp; end if;
  select * into r from public.ai_recommendations where id=_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  if r.generated_by=auth.uid() then raise exception 'RULE: you cannot review a recommendation you generated'; end if;
  new_status:=case _decision when 'accept' then 'accepted' when 'edit' then 'edited' else 'rejected' end;
  perform public.assert_transition('ai_recommendation',r.status,new_status);
  eff:=case when _decision='edit' then coalesce(_edited,'{}'::jsonb) else '{}'::jsonb end;
  update public.ai_recommendations set status=new_status,updated_by=auth.uid(),
    priority=coalesce(case when eff->>'priority' in ('high','medium','low') then eff->>'priority' end,priority),
    expected_outcome=coalesce(nullif(eff->>'expected_outcome',''),expected_outcome),
    assessment_method=coalesce(nullif(eff->>'assessment_method',''),assessment_method)
    where id=_id;
  insert into public.ai_recommendation_reviews(recommendation_id,reviewer_id,decision,comments,edited)
    values (_id,auth.uid(),_decision,nullif(_comments,''),nullif(eff,'{}'::jsonb));
  if _decision in ('accept','edit') then
    select id into plan_id from public.development_plans
      where employee_id=r.employee_id and status in ('draft','active') order by created_at desc limit 1;
    if plan_id is null then
      insert into public.development_plans(employee_id,title,objectives,status)
        values (r.employee_id,'Development plan','Created from human-approved learning recommendations.','active')
        returning id into plan_id;
    end if;
    insert into public.development_plan_items(plan_id,item_type,title,description,assessment_method,competency_id,
      course_id,learning_path_id,training_session_id,ai_recommendation_id,priority)
    values (plan_id,r.recommendation_type,coalesce(nullif(eff->>'title',''),'AI-recommended '||r.recommendation_type),
      r.rationale,coalesce(nullif(eff->>'assessment_method',''),r.assessment_method),r.competency_id,
      case when r.recommendation_type='course' then r.resource_id end,
      case when r.recommendation_type='learning_path' then r.resource_id end,
      case when r.recommendation_type='training' then r.resource_id end,r.id,r.priority)
    returning id into item_id;
    if r.recommendation_type='course' then
      insert into public.course_enrollments(course_id,employee_id,source,development_plan_item_id)
        values (r.resource_id,r.employee_id,'development_plan',item_id)
        on conflict (course_id,employee_id) do nothing;
    elsif r.recommendation_type='training' then
      insert into public.training_participants(session_id,employee_id,development_plan_item_id)
        values (r.resource_id,r.employee_id,item_id)
        on conflict (session_id,employee_id) do nothing;
    end if;
    perform public._notify((select user_id from public.employees where id=r.employee_id),
      'New development activity','A human-approved development activity was added to your plan.',
      '/training/plans/'||plan_id,'assignment');
  end if;
  perform public.log_audit('ai_review','ai_recommendations',_id,jsonb_build_object('decision',_decision));
  return public._idem_put(_idem,'review_ai_recommendation',_hash,
    jsonb_build_object('id',_id,'status',new_status,'plan_item',item_id));
end $$;

grant execute on function public.prepare_ai_context(uuid) to authenticated;
grant execute on function public.save_ai_recommendations(uuid,jsonb,text,uuid,text) to authenticated;
grant execute on function public.review_ai_recommendation(uuid,text,text,jsonb,uuid,text) to authenticated;
