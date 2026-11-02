-- Performance evaluations use one position-specific profile and retain each
-- submitted response set while routing the same assignment through reviewers.

alter table public.evaluation_assignments
  drop constraint if exists evaluation_assignments_status_check;

alter table public.evaluation_assignments
  add constraint evaluation_assignments_status_check check (status in (
    'not_started', 'in_progress', 'employee_submitted', 'supervisor_pending',
    'supervisor_in_progress', 'supervisor_submitted', 'department_head_pending',
    'department_head_approved', 'hr_admin_pending', 'hr_admin_approved',
    'returned_for_revision', 'submitted', 'under_review', 'approved', 'reopened'
  ));

alter table public.evaluation_assignments
  add column if not exists return_to text
    check (return_to is null or return_to in ('employee', 'supervisor', 'department_head'));

-- A former one-step approval is deliberately routed back through the missing
-- department-head stage; it is not silently treated as a final approval.
update public.evaluation_assignments
set status = case
  when status in ('submitted', 'under_review', 'approved') then 'department_head_pending'
  when status = 'reopened' then 'returned_for_revision'
  else status
end,
return_to = case when status = 'reopened' then 'supervisor' else null end
where status in ('submitted', 'under_review', 'approved', 'reopened');

update public.approval_tasks t
set status = 'cancelled'
from public.evaluation_assignments a
where t.workflow_type = 'evaluation'
  and t.record_id = a.id
  and t.status = 'pending'
  and a.status = 'department_head_pending';

insert into public.approval_tasks(
  workflow_type, record_id, record_label, employee_id, assignee_role
)
select 'evaluation', a.id, 'Evaluation: ' || e.first_name || ' ' || e.last_name,
  a.employee_id, 'dept_head'
from public.evaluation_assignments a
join public.employees e on e.id = a.employee_id
where a.status = 'department_head_pending'
  and not exists (
    select 1 from public.approval_tasks t
    where t.workflow_type = 'evaluation' and t.record_id = a.id and t.status = 'pending'
  );

alter table public.evaluation_assignments
  alter column status set default 'not_started';

create table public.evaluation_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.evaluation_assignments(id) on delete restrict,
  respondent text not null check (respondent in ('self', 'evaluator')),
  submission_number int not null check (submission_number > 0),
  submitted_by uuid not null default auth.uid(),
  submitted_at timestamptz not null default now(),
  response_snapshot jsonb not null check (jsonb_typeof(response_snapshot) = 'object'),
  unique (assignment_id, respondent, submission_number)
);
create index on public.evaluation_submissions(assignment_id, submitted_at desc);
alter table public.evaluation_submissions enable row level security;
grant select on public.evaluation_submissions to authenticated;

create or replace function public.can_access_evaluation(_assignment uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.evaluation_assignments a
    where a.id = _assignment
      and (
        a.employee_id = public.my_employee_id()
        or a.evaluator_id = public.my_employee_id()
        or public.is_dept_head_of(a.employee_id)
        or public.has_perm('perf.manage')
      )
  )
$$;
revoke all on function public.can_access_evaluation(uuid) from public;
grant execute on function public.can_access_evaluation(uuid) to authenticated;

drop policy if exists "approvals assignee" on public.approval_tasks;
create policy "approvals assignee" on public.approval_tasks for select to authenticated
  using (
    assignee_user = auth.uid()
    or submitted_by = auth.uid()
    or (
      assignee_role is not null
      and public.has_role(auth.uid(), assignee_role)
      and (
        workflow_type <> 'evaluation'
        or (
          (assignee_role = 'dept_head' and public.is_dept_head_of(employee_id))
          or (assignee_role = 'hr_admin' and public.has_role(auth.uid(), 'hr_admin'))
        )
      )
    )
  );

create or replace function public._evaluation_dept_head_user(_employee uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select head.user_id
  from public.employees employee
  join public.departments department on department.id = employee.department_id
  join public.employees head on head.id = department.head_employee_id
  where employee.id = _employee
$$;
revoke all on function public._evaluation_dept_head_user(uuid) from public;

create or replace function public.can_view_employee(_emp uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    _emp = public.my_employee_id()
    or public.has_perm('employees.view_all')
    or public.has_perm('perf.manage')
    or public.is_supervisor_of(_emp)
    or public.is_dept_head_of(_emp)
    or exists (
      select 1 from public.evaluation_assignments a
      where a.employee_id = _emp and a.evaluator_id = public.my_employee_id()
    )
  )
$$;

create policy "scoped evaluation submissions" on public.evaluation_submissions
  for select to authenticated using (
    exists (
      select 1 from public.evaluation_assignments a
      where a.id = assignment_id
        and public.can_access_evaluation(a.id)
        and (
          public.has_perm('perf.approve')
          or
          public.my_employee_id() is null
          or a.employee_id <> public.my_employee_id()
          or respondent = 'self'
          or a.status = 'approved'
        )
    )
  );
create trigger audit after insert or update or delete on public.evaluation_submissions
  for each row execute function public.tg_audit();

create or replace function public.reject_evaluation_history_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'FORBIDDEN: evaluation history cannot be changed or deleted';
end $$;
create trigger evaluation_submissions_immutable
  before update or delete on public.evaluation_submissions
  for each row execute function public.reject_evaluation_history_mutation();

alter table public.evaluation_reviews
  add column if not exists stage text
    check (stage is null or stage in ('department_head', 'hr_admin'));
alter table public.evaluation_reviews
  add column if not exists return_to text
    check (return_to is null or return_to in ('employee', 'supervisor', 'department_head'));
alter table public.evaluation_reviews
  add column if not exists reviewer_name text;
create trigger evaluation_reviews_immutable
  before update or delete on public.evaluation_reviews
  for each row execute function public.reject_evaluation_history_mutation();

insert into public.role_permissions(role, permission)
values ('dept_head', 'perf.approve')
on conflict (role, permission) do nothing;

delete from public.status_transitions where entity = 'evaluation';

insert into public.status_transitions(entity, from_status, to_status) values
  ('evaluation', 'not_started', 'in_progress'),
  ('evaluation', 'in_progress', 'in_progress'),
  ('evaluation', 'in_progress', 'supervisor_pending'),
  ('evaluation', 'not_started', 'supervisor_pending'),
  ('evaluation', 'returned_for_revision', 'supervisor_pending'),
  ('evaluation', 'not_started', 'supervisor_in_progress'),
  ('evaluation', 'not_started', 'department_head_pending'),
  ('evaluation', 'returned_for_revision', 'in_progress'),
  ('evaluation', 'returned_for_revision', 'supervisor_in_progress'),
  ('evaluation', 'supervisor_pending', 'supervisor_in_progress'),
  ('evaluation', 'supervisor_in_progress', 'supervisor_in_progress'),
  ('evaluation', 'supervisor_pending', 'department_head_pending'),
  ('evaluation', 'supervisor_in_progress', 'department_head_pending'),
  ('evaluation', 'returned_for_revision', 'department_head_pending'),
  ('evaluation', 'department_head_pending', 'returned_for_revision'),
  ('evaluation', 'hr_admin_pending', 'returned_for_revision'),
  ('evaluation', 'department_head_pending', 'hr_admin_pending'),
  ('evaluation', 'hr_admin_pending', 'department_head_pending'),
  ('evaluation', 'hr_admin_pending', 'approved');

-- New profile versions no longer inject the conceptual ten factors. Criteria
-- are the versioned profile rating items and are specific to the position.
create or replace function public.create_profile(_position uuid, _name text, _desc text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p public.evaluation_profiles; v public.evaluation_profile_versions;
begin
  if not public.has_perm('perf.manage') then raise exception 'FORBIDDEN'; end if;
  insert into public.evaluation_profiles(position_id, name, description)
    values (_position, _name, _desc) returning * into p;
  insert into public.evaluation_profile_versions(profile_id, position_id, version_number, scoring_method)
    values (p.id, _position, 1, 'weighted') returning * into v;
  return jsonb_build_object('profile', to_jsonb(p), 'version', to_jsonb(v));
end $$;

create or replace function public.new_profile_version(_profile uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare src public.evaluation_profile_versions; v public.evaluation_profile_versions;
  s record; nsid uuid;
begin
  if not public.has_perm('perf.manage') then raise exception 'FORBIDDEN'; end if;
  if exists(select 1 from public.evaluation_profile_versions where profile_id = _profile and status = 'draft') then
    raise exception 'RULE: this profile already has a draft version';
  end if;
  select * into src from public.evaluation_profile_versions
    where profile_id = _profile order by version_number desc limit 1;
  if not found then raise exception 'NOT_FOUND'; end if;
  insert into public.evaluation_profile_versions(
    profile_id, position_id, version_number, rating_scale_max, instructions,
    effective_date, scoring_method, final_score_rule, classification_thresholds
  ) values (
    _profile, src.position_id, src.version_number + 1, src.rating_scale_max, src.instructions,
    src.effective_date, src.scoring_method, src.final_score_rule, src.classification_thresholds
  ) returning * into v;
  for s in select * from public.evaluation_sections where version_id = src.id order by sort_order loop
    insert into public.evaluation_sections(version_id, title, description, sort_order)
      values (v.id, s.title, s.description, s.sort_order) returning id into nsid;
    insert into public.evaluation_items(
      version_id, section_id, label, help_text, item_type, weight, options, kpi_target,
      kpi_unit, competency_id, evidence_required, is_required, sort_order
    )
    select v.id, nsid, label, help_text, item_type, weight, options, kpi_target, kpi_unit,
      competency_id, evidence_required, is_required, sort_order
    from public.evaluation_items where section_id = s.id;
  end loop;
  insert into public.evaluation_profile_factors(
    version_id, factor_code, title, description, indicators, weight, evidence_required, sort_order
  )
  select v.id, factor_code, title, description, indicators, weight, evidence_required, sort_order
  from public.evaluation_profile_factors where version_id = src.id;
  return to_jsonb(v);
end $$;

create or replace function public.save_profile_version(_version_id uuid, _c jsonb, _expected int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.evaluation_profile_versions; s jsonb; it jsonb; f jsonb;
  sid uuid; si int := 0; ii int;
begin
  if not public.has_perm('perf.manage') then raise exception 'FORBIDDEN'; end if;
  select * into v from public.evaluation_profile_versions where id = _version_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v.status <> 'draft' then raise exception 'RULE: only draft versions can be edited'; end if;
  if v.version <> _expected then raise exception 'CONFLICT: this profile version was changed by someone else'; end if;
  if jsonb_typeof(_c->'sections') is distinct from 'array' then
    raise exception 'INVALID: sections must be an array';
  end if;
  if jsonb_array_length(_c->'sections') = 0 then
    raise exception 'INVALID: add at least one section with job-specific criteria';
  end if;
  if exists (
    select 1 from jsonb_array_elements(_c->'sections') s
    where jsonb_typeof(s->'items') is distinct from 'array'
      or nullif(trim(s->>'title'), '') is null
      or length(coalesce(s->>'description', '')) > 2000
  ) then
    raise exception 'INVALID: every profile section needs a title and an array of criteria';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(_c->'sections') s,
         jsonb_array_elements(coalesce(s->'items', '[]'::jsonb)) i
    where i->>'item_type' <> 'rating'
       or nullif(trim(i->>'label'), '') is null
       or nullif(trim(i->>'help_text'), '') is null
       or length(coalesce(i->>'help_text', '')) > 2000
  ) then raise exception 'INVALID: each job-specific criterion needs a name, description, and 1-5 rating'; end if;
  if not exists (
    select 1 from jsonb_array_elements(_c->'sections') s,
      jsonb_array_elements(coalesce(s->'items', '[]'::jsonb)) i
  ) then raise exception 'INVALID: add at least one job-specific criterion'; end if;
  if jsonb_typeof(coalesce(_c->'performance_factors', '[]'::jsonb)) is distinct from 'array' then
    raise exception 'INVALID: legacy factor configuration must be an array';
  end if;
  if jsonb_array_length(coalesce(_c->'performance_factors', '[]'::jsonb)) > 10 then
    raise exception 'INVALID: invalid legacy factor configuration';
  end if;
  delete from public.evaluation_items where version_id = _version_id;
  delete from public.evaluation_sections where version_id = _version_id;
  for s in select * from jsonb_array_elements(_c->'sections') loop
    insert into public.evaluation_sections(version_id, title, description, sort_order)
      values (_version_id, s->>'title', nullif(s->>'description', ''), si) returning id into sid;
    si := si + 1;
    ii := 0;
    for it in select * from jsonb_array_elements(coalesce(s->'items', '[]'::jsonb)) loop
      insert into public.evaluation_items(
        version_id, section_id, label, help_text, item_type, weight, options, kpi_target,
        kpi_unit, competency_id, evidence_required, is_required, sort_order
      ) values (
        _version_id, sid, trim(it->>'label'), nullif(it->>'help_text', ''), 'rating',
        coalesce((it->>'weight')::numeric, 0), '[]'::jsonb, null, null, null,
        coalesce((it->>'evidence_required')::boolean, false),
        true, ii
      );
      ii := ii + 1;
    end loop;
  end loop;
  delete from public.evaluation_profile_factors where version_id = _version_id;
  for f in select * from jsonb_array_elements(coalesce(_c->'performance_factors', '[]'::jsonb)) loop
    insert into public.evaluation_profile_factors(
      version_id, factor_code, title, description, indicators, weight, evidence_required, sort_order
    ) values (
      _version_id, f->>'factor_code', f->>'title', f->>'description', f->'indicators',
      coalesce((f->>'weight')::numeric, 0), coalesce((f->>'evidence_required')::boolean, false),
      coalesce((f->>'sort_order')::int, 0)
    );
  end loop;
  update public.evaluation_profile_versions
  set rating_scale_max = 5, instructions = nullif(_c->>'instructions', ''),
      effective_date = nullif(_c->>'effective_date', '')::date,
      scoring_method = coalesce(_c->>'scoring_method', 'weighted'),
      final_score_rule = coalesce(_c->>'final_score_rule', 'supervisor'),
      classification_thresholds = coalesce(_c->'classification_thresholds', '[]'::jsonb)
  where id = _version_id returning * into v;
  return to_jsonb(v);
end $$;

create or replace function public.activate_profile_version(_version_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.evaluation_profile_versions; total numeric; item_count int; weighted_count int;
begin
  if not public.has_perm('perf.manage') then raise exception 'FORBIDDEN'; end if;
  select * into v from public.evaluation_profile_versions where id = _version_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  perform public.assert_transition('profile_version', v.status, 'active');
  select count(*), count(*) filter (where weight > 0), coalesce(sum(weight), 0)
    into item_count, weighted_count, total
  from public.evaluation_items where version_id = _version_id and item_type = 'rating';
  if item_count = 0 then raise exception 'RULE: add at least one job-specific rating criterion'; end if;
  if exists (select 1 from public.evaluation_items where version_id = _version_id and item_type <> 'rating') then
    raise exception 'RULE: evaluation criteria must use the configured 1-5 rating scale';
  end if;
  if exists (
    select 1 from public.evaluation_items
    where version_id = _version_id
      and (length(trim(label)) = 0 or length(trim(coalesce(help_text, ''))) = 0)
  ) then
    raise exception 'RULE: every criterion needs a name, description, and observable indicators';
  end if;
  if weighted_count > 0 and total <> 100 then
    raise exception 'RULE: configured criterion weights must total 100 percent (currently %)', total;
  end if;
  update public.evaluation_profile_versions set status = 'archived'
    where position_id = v.position_id and status = 'active';
  update public.evaluation_profile_versions
    set status = 'active', activated_at = now(), activated_by = auth.uid(),
        effective_date = coalesce(effective_date, current_date)
    where id = _version_id returning * into v;
  return to_jsonb(v);
end $$;

create or replace function public._build_snapshot(_version_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'version_id', v.id, 'profile_id', p.id, 'profile_name', p.name,
    'version_number', v.version_number, 'position_id', v.position_id,
    'rating_scale_max', v.rating_scale_max, 'instructions', v.instructions,
    'scoring_method', v.scoring_method, 'final_score_rule', v.final_score_rule,
    'classification_thresholds', v.classification_thresholds,
    'performance_factors', '[]'::jsonb,
    'sections', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'title', s.title, 'description', s.description,
        'items', coalesce((
          select jsonb_agg(to_jsonb(i) - 'created_at' - 'updated_at' - 'created_by' - 'updated_by'
            order by i.sort_order)
          from public.evaluation_items i where i.section_id = s.id
        ), '[]'::jsonb)
      ) order by s.sort_order)
      from public.evaluation_sections s where s.version_id = v.id
    ), '[]'::jsonb)
  )
  from public.evaluation_profile_versions v
  join public.evaluation_profiles p on p.id = v.profile_id
  where v.id = _version_id
$$;

create or replace function public.validate_evaluation_assignment_snapshot()
returns trigger language plpgsql security definer set search_path = public as $$
declare cycle_self boolean; criterion_count int;
begin
  if jsonb_typeof(new.snapshot->'sections') is distinct from 'array' then
    raise exception 'RULE: an evaluation must use a versioned profile snapshot';
  end if;
  select count(*) into criterion_count
  from jsonb_array_elements(new.snapshot->'sections') s,
       jsonb_array_elements(coalesce(s->'items', '[]'::jsonb)) i
  where i->>'item_type' = 'rating';
  if criterion_count = 0 then raise exception 'RULE: an evaluation profile needs job-specific rating criteria'; end if;
  select self_evaluation into cycle_self from public.evaluation_cycles where id = new.cycle_id;
  if coalesce(new.snapshot->>'final_score_rule', 'supervisor') in ('self', 'average') and not cycle_self then
    raise exception 'RULE: this profile final-score rule requires employee self-evaluation';
  end if;
  return new;
end $$;

create or replace function public._evaluation_criterion_score(_assignment uuid, _respondent text)
returns numeric language sql stable security definer set search_path = public as $$
  with assignment_data as (
    select a.snapshot from public.evaluation_assignments a where a.id = _assignment
  ), criteria as (
    select (i->>'id')::uuid as item_id, nullif(i->>'weight', '')::numeric as weight
    from public.evaluation_assignments a
    cross join lateral jsonb_array_elements(a.snapshot->'sections') s
    cross join lateral jsonb_array_elements(s->'items') i
    where a.id = _assignment and i->>'item_type' = 'rating'
  ), response_stats as (
    select count(*) as criterion_count,
      count(*) filter (where c.weight > 0) as weighted_count,
      count(r.rating) as rated_count,
      coalesce(sum(c.weight), 0) as total_weight,
      sum(r.rating * c.weight) as weighted_score,
      round(avg(r.rating), 2) as equal_score
    from criteria c
    left join public.evaluation_responses r
      on r.assignment_id = _assignment and r.item_id = c.item_id and r.respondent = _respondent
  )
  select case
    when coalesce((select snapshot->>'scoring_method' from assignment_data), 'weighted') = 'equal'
      then case when response_stats.criterion_count = 0
        or response_stats.rated_count <> response_stats.criterion_count
        then null else response_stats.equal_score end
    when response_stats.criterion_count = 0
      or response_stats.weighted_count <> response_stats.criterion_count
      or response_stats.rated_count <> response_stats.criterion_count
      or response_stats.total_weight <> 100
      then null
    else round(response_stats.weighted_score / nullif(response_stats.total_weight, 0), 2)
  end
  from response_stats
$$;

create or replace function public.save_evaluation(
  _assignment uuid, _respondent text, _responses jsonb, _overall_comment text, _expected int
) returns jsonb language plpgsql security definer set search_path = public as $$
declare a public.evaluation_assignments; r jsonb; fr jsonb; me uuid := public.my_employee_id();
  valid_ids uuid[]; allowed boolean := false; previous_status text; next_status text;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into a from public.evaluation_assignments where id = _assignment for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if a.version <> _expected then raise exception 'CONFLICT: this evaluation was changed by someone else'; end if;
  if _respondent = 'self' then
    allowed := a.employee_id = me and (
      a.status in ('not_started', 'in_progress')
      or (a.status = 'returned_for_revision' and a.return_to = 'employee')
    );
    if not a.self_evaluation then raise exception 'RULE: self-evaluation is not configured for this cycle'; end if;
  elsif _respondent = 'evaluator' then
    allowed := a.evaluator_id = me and (
      a.status in ('supervisor_pending', 'supervisor_in_progress')
      or (a.status = 'not_started' and not a.self_evaluation)
      or (a.status = 'returned_for_revision' and a.return_to = 'supervisor')
    );
  else
    raise exception 'INVALID: respondent must be self or evaluator';
  end if;
  previous_status := a.status;
  next_status := case
    when _respondent = 'self' and a.status in ('not_started', 'returned_for_revision') then 'in_progress'
    when _respondent = 'evaluator' then 'supervisor_in_progress'
    else a.status
  end;
  if previous_status is distinct from next_status then
    perform public.assert_transition('evaluation', previous_status, next_status);
  end if;
  if not allowed then raise exception 'FORBIDDEN: this assessment is not editable in the current workflow stage'; end if;
  select array_agg((i->>'id')::uuid) into valid_ids
  from jsonb_array_elements(a.snapshot->'sections') s, jsonb_array_elements(s->'items') i;
  for r in select * from jsonb_array_elements(coalesce(_responses->'items', '[]'::jsonb)) loop
    if not ((r->>'item_id')::uuid = any(coalesce(valid_ids, array[]::uuid[]))) then
      raise exception 'INVALID: unknown criterion in response';
    end if;
    if (r->>'rating') is not null and ((r->>'rating')::numeric < 1 or (r->>'rating')::numeric > 5) then
      raise exception 'INVALID: rating must be between 1 and 5';
    end if;
    insert into public.evaluation_responses(
      assignment_id, item_id, respondent, rating, text_value, choice_values, kpi_actual, comment
    ) values (
      _assignment, (r->>'item_id')::uuid, _respondent, nullif(r->>'rating', '')::numeric,
      nullif(r->>'text_value', ''), r->'choice_values', nullif(r->>'kpi_actual', '')::numeric,
      nullif(r->>'comment', '')
    )
    on conflict (assignment_id, item_id, respondent) do update
      set rating = excluded.rating, text_value = excluded.text_value,
          choice_values = excluded.choice_values, kpi_actual = excluded.kpi_actual,
          comment = excluded.comment;
  end loop;
  -- Legacy factor responses remain supported for pre-migration assignments only.
  for fr in select * from jsonb_array_elements(coalesce(_responses->'performance_factors', '[]'::jsonb)) loop
    if not exists(select 1 from jsonb_array_elements(coalesce(a.snapshot->'performance_factors', '[]'::jsonb)) f
      where f->>'factor_code' = fr->>'factor_code') then
      raise exception 'INVALID: unknown performance factor';
    end if;
    insert into public.evaluation_factor_responses(assignment_id, factor_code, respondent, rating, comment)
    values (_assignment, fr->>'factor_code', _respondent, nullif(fr->>'rating', '')::int, fr->>'comment')
    on conflict (assignment_id, factor_code, respondent) do update
      set rating = excluded.rating, comment = excluded.comment;
  end loop;
  update public.evaluation_assignments
  set status = next_status,
      return_to = null,
      overall_comment = case when _respondent = 'evaluator'
        then coalesce(_overall_comment, overall_comment) else overall_comment end
  where id = _assignment returning * into a;
  return to_jsonb(a) - 'snapshot';
end $$;

create or replace function public.submit_evaluation(
  _assignment uuid, _respondent text, _idem uuid, _hash text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare prev jsonb; a public.evaluation_assignments; me uuid := public.my_employee_id();
  missing int; missing_evidence int; next_status text; submit_count int; emp public.employees;
  snapshot_data jsonb; score numeric; result jsonb;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  prev := public._idem_get(_idem, 'submit_evaluation', _hash);
  if prev is not null then return prev; end if;
  select * into a from public.evaluation_assignments where id = _assignment for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  select * into emp from public.employees where id = a.employee_id;
  if _respondent = 'self' then
    if a.employee_id <> me or not a.self_evaluation then raise exception 'FORBIDDEN'; end if;
    if a.status not in ('not_started', 'in_progress')
       and not (a.status = 'returned_for_revision' and a.return_to = 'employee') then
      raise exception 'RULE: employee self-evaluation cannot be submitted at this stage';
    end if;
    next_status := 'supervisor_pending';
  elsif _respondent = 'evaluator' then
    if a.evaluator_id <> me then raise exception 'FORBIDDEN'; end if;
    if a.status not in ('supervisor_pending', 'supervisor_in_progress')
       and not (a.status = 'not_started' and not a.self_evaluation)
       and not (a.status = 'returned_for_revision' and a.return_to = 'supervisor') then
      raise exception 'RULE: supervisor evaluation cannot be submitted at this stage';
    end if;
    if a.self_evaluation and a.self_submitted_at is null then
      raise exception 'RULE: employee self-evaluation must be submitted first';
    end if;
    next_status := 'department_head_pending';
  else
    raise exception 'INVALID: respondent must be self or evaluator';
  end if;
  perform public.assert_transition('evaluation', a.status, next_status);
  select count(*) into missing
  from jsonb_array_elements(a.snapshot->'sections') s,
       jsonb_array_elements(s->'items') i
  left join public.evaluation_responses r
    on r.assignment_id = a.id and r.item_id = (i->>'id')::uuid and r.respondent = _respondent
  where i->>'item_type' = 'rating'
    and (r.id is null or r.rating is null);
  if missing > 0 then raise exception 'RULE: rate all required job-specific criteria before submission'; end if;
  select count(*) into missing_evidence
  from jsonb_array_elements(a.snapshot->'sections') s,
       jsonb_array_elements(s->'items') i
  where coalesce((i->>'evidence_required')::boolean, false)
    and not exists (
      select 1 from public.evaluation_evidence ev
      where ev.assignment_id = a.id and ev.item_id = (i->>'id')::uuid
        and ev.created_by = auth.uid()
    );
  if missing_evidence > 0 then raise exception 'RULE: attach evidence to all required criteria'; end if;
  select count(*) + 1 into submit_count
  from public.evaluation_submissions
  where assignment_id = a.id and respondent = _respondent;
  select jsonb_build_object(
    'responses', coalesce((
      select jsonb_agg(to_jsonb(r) - 'id' - 'created_at' - 'updated_at' - 'created_by' - 'updated_by')
      from public.evaluation_responses r
      where r.assignment_id = a.id and r.respondent = _respondent
    ), '[]'::jsonb),
    'evidence', coalesce((
      select jsonb_agg(to_jsonb(ev) - 'updated_at' - 'updated_by')
      from public.evaluation_evidence ev
      where ev.assignment_id = a.id and ev.created_by = auth.uid()
    ), '[]'::jsonb),
    'overall_comment', case when _respondent = 'evaluator' then a.overall_comment else null end
  ) into snapshot_data;
  insert into public.evaluation_submissions(
    assignment_id, respondent, submission_number, response_snapshot
  ) values (a.id, _respondent, submit_count, snapshot_data);
  if _respondent = 'self' then
    score := public._evaluation_criterion_score(a.id, 'self');
    update public.evaluation_assignments
      set status = next_status, self_submitted_at = now(), self_score = score,
          submitted_at = coalesce(submitted_at, now()), return_to = null
      where id = a.id returning * into a;
    perform public._notify(
      (select user_id from public.employees where id = a.evaluator_id),
      'Self-evaluation submitted',
      emp.first_name || ' ' || emp.last_name || ' submitted a self-evaluation',
      '/performance/evaluations/' || a.id, 'task'
    );
  else
    score := public._evaluation_criterion_score(a.id, 'evaluator');
    update public.evaluation_assignments
      set status = next_status, supervisor_score = score, submitted_at = now(), return_to = null
      where id = a.id returning * into a;
    update public.approval_tasks set status = 'cancelled'
      where workflow_type = 'evaluation' and record_id = a.id and status = 'pending';
    insert into public.approval_tasks(
      workflow_type, record_id, record_label, employee_id, submitted_by, assignee_role
    ) values (
      'evaluation', a.id, 'Evaluation: ' || emp.first_name || ' ' || emp.last_name,
      a.employee_id, auth.uid(), 'dept_head'
    );
    perform public._notify(
      public._evaluation_dept_head_user(a.employee_id),
      'Evaluation awaiting department review',
      emp.first_name || ' ' || emp.last_name || ' evaluation was submitted',
      '/approvals', 'approval'
    );
  end if;
  result := to_jsonb(a) - 'snapshot';
  return public._idem_put(_idem, 'submit_evaluation', _hash, result);
end $$;

create or replace function public.review_evaluation(
  _assignment uuid, _decision text, _comments text, _idem uuid, _hash text, _return_to text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare prev jsonb; a public.evaluation_assignments; emp public.employees;
  me uuid := public.my_employee_id(); stage text; target_status text; result jsonb;
  final_score_value numeric; class_label text; threshold jsonb; return_target text;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  prev := public._idem_get(_idem, 'review_evaluation', _hash);
  if prev is not null then return prev; end if;
  if not public.has_perm('perf.approve') then raise exception 'FORBIDDEN'; end if;
  select * into a from public.evaluation_assignments where id = _assignment for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  select * into emp from public.employees where id = a.employee_id;
  if a.employee_id = me or a.evaluator_id = me then
    raise exception 'FORBIDDEN: you cannot approve your own assessment';
  end if;
  if a.status = 'department_head_pending' then
    if not public.is_dept_head_of(a.employee_id) then raise exception 'FORBIDDEN'; end if;
    stage := 'department_head';
  elsif a.status = 'hr_admin_pending' then
    if not public.has_role(auth.uid(), 'hr_admin') then raise exception 'FORBIDDEN'; end if;
    if not exists (
      select 1 from public.evaluation_reviews sr
      where sr.assignment_id = a.id and sr.stage = 'department_head' and sr.decision = 'approved'
    ) then raise exception 'RULE: department-head approval is required before HR review'; end if;
    stage := 'hr_admin';
  else
    raise exception 'RULE: this evaluation is not awaiting an approval';
  end if;
  if _decision not in ('approve', 'return') then raise exception 'INVALID: unknown decision'; end if;
  if _decision = 'return' then
    if coalesce(length(trim(_comments)), 0) < 5 then
      raise exception 'INVALID: a reason of at least 5 characters is required';
    end if;
    if stage = 'department_head' and coalesce(_return_to, 'supervisor') not in ('employee', 'supervisor') then
      raise exception 'INVALID: department review must return the evaluation to the employee or supervisor';
    end if;
    if stage = 'department_head' and coalesce(_return_to, 'supervisor') = 'employee'
      and not a.self_evaluation then
      raise exception 'RULE: this evaluation has no employee self-assessment to return';
    end if;
    if stage = 'hr_admin' and coalesce(_return_to, 'department_head') not in ('supervisor', 'department_head') then
      raise exception 'INVALID: HR review must return the evaluation to the supervisor or department head';
    end if;
    return_target := coalesce(_return_to,
      case when stage = 'department_head' then 'supervisor' else 'department_head' end);
    target_status := case
      when stage = 'hr_admin' and return_target = 'department_head' then 'department_head_pending'
      else 'returned_for_revision'
    end;
    perform public.assert_transition('evaluation', a.status, target_status);
    insert into public.evaluation_reviews(
      assignment_id, reviewer_id, decision, comments, stage, return_to, reviewer_name
    ) values (
      a.id, auth.uid(), 'returned', _comments, stage, return_target,
      coalesce((select full_name from public.profiles where id = auth.uid()), 'Reviewer')
    );
    update public.evaluation_assignments
      set status = target_status,
        return_to = case when target_status = 'returned_for_revision' then return_target else null end,
        reopen_reason = _comments
      where id = a.id returning * into a;
    update public.approval_tasks set status = 'rejected', decided_by = auth.uid(),
      decided_at = now(), comments = _comments
      where workflow_type = 'evaluation' and record_id = a.id and status = 'pending';
    if stage = 'department_head' then
      perform public._notify(
        (select user_id from public.employees
          where id = case when return_target = 'employee' then a.employee_id else a.evaluator_id end),
        'Evaluation returned for revision', _comments,
        '/performance/evaluations/' || a.id, 'warning'
      );
    else
      perform public._notify(
        case when return_target = 'department_head'
          then public._evaluation_dept_head_user(a.employee_id)
          else (
            select supervisor.user_id from public.employees supervisor
            where supervisor.id = a.evaluator_id
          )
        end,
        'Evaluation returned for revision', _comments,
        '/performance/evaluations/' || a.id, 'warning'
      );
      if stage = 'hr_admin' and return_target = 'department_head' then
        insert into public.approval_tasks(
          workflow_type, record_id, record_label, employee_id, submitted_by, assignee_role
        ) values (
          'evaluation', a.id, 'Evaluation: ' || emp.first_name || ' ' || emp.last_name,
          a.employee_id, auth.uid(), 'dept_head'
        );
      end if;
    end if;
  else
    update public.approval_tasks set status = 'approved', decided_by = auth.uid(),
      decided_at = now(), comments = _comments
      where workflow_type = 'evaluation' and record_id = a.id and status = 'pending';
    select * into emp from public.employees where id = a.employee_id;
    if stage = 'department_head' then
      perform public.assert_transition('evaluation', a.status, 'hr_admin_pending');
      update public.evaluation_assignments set status = 'hr_admin_pending', return_to = null
        where id = a.id returning * into a;
      insert into public.approval_tasks(
        workflow_type, record_id, record_label, employee_id, submitted_by, assignee_role
      ) values (
        'evaluation', a.id, 'Evaluation: ' || emp.first_name || ' ' || emp.last_name,
        a.employee_id, auth.uid(), 'hr_admin'
      );
      perform public._notify_role(
        'hr_admin', 'Evaluation awaiting HR review',
        emp.first_name || ' ' || emp.last_name || ' evaluation has department-head approval',
        '/approvals'
      );
    else
      perform public.assert_transition('evaluation', a.status, 'approved');
      final_score_value := case coalesce(a.snapshot->>'final_score_rule', 'supervisor')
        when 'self' then a.self_score
        when 'average' then case when a.self_score is not null and a.supervisor_score is not null
          then round((a.self_score + a.supervisor_score) / 2, 2) else null end
        else a.supervisor_score
      end;
      for threshold in select * from jsonb_array_elements(
        coalesce(a.snapshot->'classification_thresholds', '[]'::jsonb)
      ) loop
        if final_score_value is not null
          and final_score_value between (threshold->>'min')::numeric and (threshold->>'max')::numeric
        then class_label := threshold->>'label'; exit; end if;
      end loop;
      update public.evaluation_assignments
        set status = 'approved', approved_at = now(), approved_by = auth.uid(),
            final_score = final_score_value, classification = class_label, return_to = null
        where id = a.id returning * into a;
      perform public._notify(
        emp.user_id, 'Evaluation approved', 'Your evaluation received final HR approval',
        '/performance/evaluations/' || a.id, 'success'
      );
    end if;
    insert into public.evaluation_reviews(
      assignment_id, reviewer_id, decision, comments, stage, return_to, reviewer_name
    ) values (
      a.id, auth.uid(), 'approved', _comments, stage, null,
      coalesce((select full_name from public.profiles where id = auth.uid()), 'Reviewer')
    );
  end if;
  result := to_jsonb(a) - 'snapshot';
  return public._idem_put(_idem, 'review_evaluation', _hash, result);
end $$;

create or replace function public.add_evaluation_evidence(
  _assignment uuid, _file uuid, _note text, _item uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare a public.evaluation_assignments; r public.evaluation_evidence;
  me uuid := public.my_employee_id(); respondent text;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into a from public.evaluation_assignments where id = _assignment;
  if not found then raise exception 'NOT_FOUND'; end if;
  if a.employee_id = me and (
    a.status in ('not_started', 'in_progress')
    or (a.status = 'returned_for_revision' and a.return_to = 'employee')
  ) then respondent := 'self';
  elsif a.evaluator_id = me and (
    a.status in ('supervisor_pending', 'supervisor_in_progress')
    or (a.status = 'not_started' and not a.self_evaluation)
    or (a.status = 'returned_for_revision' and a.return_to = 'supervisor')
  ) then respondent := 'evaluator';
  else raise exception 'FORBIDDEN: evidence can only be attached to your editable assessment'; end if;
  if _item is not null and not exists (
    select 1 from jsonb_array_elements(a.snapshot->'sections') s,
      jsonb_array_elements(s->'items') i where (i->>'id')::uuid = _item
  ) then raise exception 'INVALID: unknown criterion'; end if;
  if _file is null and coalesce(length(trim(_note)), 0) = 0 then
    raise exception 'INVALID: provide a file or evidence note';
  end if;
  if _file is not null and not exists (
    select 1 from public.file_metadata fm
    where fm.id = _file and fm.employee_id = a.employee_id and fm.uploaded_by = auth.uid()
  ) then raise exception 'FORBIDDEN: evidence file is not owned by this user and employee';
  end if;
  insert into public.evaluation_evidence(assignment_id, file_id, note, item_id)
    values (_assignment, _file, nullif(trim(_note), ''), _item) returning * into r;
  return to_jsonb(r);
end $$;

create or replace function public.register_file(
  _path text, _name text, _mime text, _size int, _employee uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.file_metadata;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if split_part(_path, '/', 1) <> auth.uid()::text then raise exception 'FORBIDDEN'; end if;
  if _mime not in (
    'application/pdf', 'image/png', 'image/jpeg',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'
  ) then raise exception 'INVALID: file type not allowed'; end if;
  if _employee is not null and not (
    public.can_view_perf(_employee)
    or public.can_view_comp(_employee)
    or exists (
      select 1 from public.evaluation_assignments a
      where a.employee_id = _employee
        and a.evaluator_id = public.my_employee_id()
        and (
          a.status in ('supervisor_pending', 'supervisor_in_progress')
          or (a.status = 'not_started' and not a.self_evaluation)
          or (a.status = 'returned_for_revision' and a.return_to = 'supervisor')
        )
    )
  ) then raise exception 'NOT_FOUND'; end if;
  insert into public.file_metadata(object_path, original_name, mime_type, size_bytes, employee_id)
    values (_path, left(_name, 255), _mime, _size, _employee)
    returning * into r;
  return to_jsonb(r);
end $$;

drop policy if exists "scoped" on public.evaluation_assignments;
create policy "scoped" on public.evaluation_assignments for select to authenticated
  using (public.can_access_evaluation(id));

drop policy if exists "scoped" on public.evaluation_responses;
create policy "scoped" on public.evaluation_responses for select to authenticated
  using (exists (
    select 1 from public.evaluation_assignments a where a.id = assignment_id
      and public.can_access_evaluation(a.id)
      and (
        public.has_perm('perf.approve')
        or
        public.my_employee_id() is null
        or a.employee_id <> public.my_employee_id()
        or respondent = 'self'
        or a.status = 'approved'
      )
  ));
drop policy if exists "scoped" on public.evaluation_factor_responses;
create policy "scoped" on public.evaluation_factor_responses for select to authenticated
  using (exists (
    select 1 from public.evaluation_assignments a where a.id = assignment_id
      and public.can_access_evaluation(a.id)
      and (
        public.has_perm('perf.approve')
        or
        public.my_employee_id() is null
        or a.employee_id <> public.my_employee_id()
        or respondent = 'self'
        or a.status = 'approved'
      )
  ));
drop policy if exists "scoped" on public.evaluation_evidence;
create policy "scoped" on public.evaluation_evidence for select to authenticated
  using (exists (
    select 1 from public.evaluation_assignments a where a.id = assignment_id
      and public.can_access_evaluation(a.id)
      and (
        public.has_perm('perf.approve')
        or
        public.my_employee_id() is null
        or a.employee_id <> public.my_employee_id()
        or created_by = auth.uid()
        or a.status = 'approved'
      )
  ));
drop policy if exists "scoped" on public.evaluation_reviews;
create policy "scoped" on public.evaluation_reviews for select to authenticated
  using (exists (
    select 1 from public.evaluation_assignments a
    where a.id = assignment_id and public.can_access_evaluation(a.id)
  ));

create or replace function public.can_access_file(_file uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.file_metadata f
    where f.id = _file and (
      f.uploaded_by = auth.uid()
      or (
        f.employee_id is not null
        and (
          (
            not exists (
              select 1 from public.evaluation_evidence ev where ev.file_id = f.id
            )
            and (public.can_view_perf(f.employee_id) or public.can_view_comp(f.employee_id))
          )
          or exists (
            select 1
            from public.evaluation_evidence ev
            join public.evaluation_assignments a on a.id = ev.assignment_id
            where ev.file_id = f.id
              and public.can_access_evaluation(a.id)
              and (
              public.has_perm('perf.approve')
              or
              public.my_employee_id() is null
                or a.employee_id <> public.my_employee_id()
                or ev.created_by = auth.uid()
                or a.status = 'approved'
              )
          )
        )
      )
    )
  )
$$;

revoke all on function public.create_profile(uuid, text, text) from public;
revoke all on function public.new_profile_version(uuid) from public;
revoke all on function public.save_profile_version(uuid, jsonb, int) from public;
revoke all on function public.activate_profile_version(uuid) from public;
revoke all on function public.save_evaluation(uuid, text, jsonb, text, int) from public;
revoke all on function public.submit_evaluation(uuid, text, uuid, text) from public;
revoke all on function public.review_evaluation(uuid, text, text, uuid, text, text) from public;
revoke all on function public.add_evaluation_evidence(uuid, uuid, text, uuid) from public;
revoke all on function public.register_file(text, text, text, int, uuid) from public;
grant execute on function public.create_profile(uuid, text, text) to authenticated;
grant execute on function public.new_profile_version(uuid) to authenticated;
grant execute on function public.save_profile_version(uuid, jsonb, int) to authenticated;
grant execute on function public.activate_profile_version(uuid) to authenticated;
grant execute on function public.save_evaluation(uuid, text, jsonb, text, int) to authenticated;
grant execute on function public.submit_evaluation(uuid, text, uuid, text) to authenticated;
grant execute on function public.review_evaluation(uuid, text, text, uuid, text, text) to authenticated;
grant execute on function public.add_evaluation_evidence(uuid, uuid, text, uuid) to authenticated;
grant execute on function public.register_file(text, text, text, int, uuid) to authenticated;

drop function if exists public.review_evaluation(uuid, text, text, uuid, text);

create or replace function public.reopen_evaluation(
  _assignment uuid, _reason text, _idem uuid, _hash text
) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  raise exception 'RULE: finalized evaluations cannot bypass the sequential return-for-revision workflow';
end $$;
