-- Final performance, course review, REST PATCH, and permission-scoped navigation corrections.

-- HRMS V2 priority remediation: evaluation acknowledgement, fixed rating scale,
-- transactional course REST patching, and permission-scoped succession navigation.

do $$
declare
  profile_count int;
  snapshot_count int;
  response_count int;
begin
  select count(*) into profile_count
  from public.evaluation_profile_versions
  where rating_scale_max <> 5;

  select count(*) into snapshot_count
  from public.evaluation_assignments
  where coalesce((snapshot->>'rating_scale_max')::numeric, 0) <> 5;

  select count(*) into response_count
  from public.evaluation_responses
  where rating is not null and (rating < 1 or rating > 5 or rating <> trunc(rating));

  if profile_count > 0 or snapshot_count > 0 or response_count > 0 then
    raise exception 'RULE: rating-scale migration blocked: % profile versions, % evaluation snapshots, and % responses require review; no historical records were changed',
      profile_count, snapshot_count, response_count;
  end if;
end $$;

alter table public.evaluation_profile_versions
  alter column rating_scale_max set default 5;
alter table public.evaluation_profile_versions
  drop constraint evaluation_profile_versions_rating_scale_max_check;
alter table public.evaluation_profile_versions
  add constraint evaluation_profile_versions_rating_scale_max_check check (rating_scale_max = 5);

alter table public.evaluation_responses
  drop constraint evaluation_responses_rating_check;
alter table public.evaluation_responses
  add constraint evaluation_responses_rating_check check (
    rating is null or (rating between 1 and 5 and rating = trunc(rating))
  );

alter table public.evaluation_assignments
  add column acknowledged_at timestamptz,
  add column acknowledged_by uuid,
  add column acknowledgement_comment text check (length(acknowledgement_comment) <= 4000),
  add constraint evaluation_acknowledgement_consistent
    check (
      (acknowledged_at is null and acknowledged_by is null and acknowledgement_comment is null)
      or (acknowledged_at is not null and acknowledged_by is not null)
    ),
  add constraint evaluation_snapshot_rating_scale check (
    snapshot ? 'rating_scale_max'
    and jsonb_typeof(snapshot->'rating_scale_max') = 'number'
    and (snapshot->>'rating_scale_max')::numeric = 5
  );

alter table public.evaluation_reviews
  drop constraint evaluation_reviews_decision_check;
alter table public.evaluation_reviews
  add constraint evaluation_reviews_decision_check
  check (decision in ('approved','returned','reopened','comment','acknowledged'));

create or replace function public.acknowledge_evaluation(
  _assignment uuid,
  _comment text,
  _idem uuid,
  _hash text
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  previous jsonb;
  assignment public.evaluation_assignments;
  response jsonb;
  me uuid := public.my_employee_id();
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if me is null then raise exception 'FORBIDDEN: an employee record is required'; end if;
  if _idem is null or _hash is null or _hash !~ '^[0-9a-f]{64}$' then
    raise exception 'INVALID: a valid idempotency key and request hash are required';
  end if;

  select * into assignment
  from public.evaluation_assignments
  where id = _assignment
  for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if assignment.employee_id <> me then raise exception 'NOT_FOUND'; end if;

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':' || _idem::text, 0));
  previous := public._idem_get(_idem, 'acknowledge_evaluation', _hash);
  if previous is not null then return previous; end if;

  if assignment.status <> 'approved' then raise exception 'RULE: only a finalized evaluation can be acknowledged'; end if;
  if assignment.acknowledged_at is not null then raise exception 'RULE: this evaluation has already been acknowledged'; end if;
  if length(coalesce(_comment, '')) > 4000 then raise exception 'INVALID: acknowledgement comment is too long'; end if;

  update public.evaluation_assignments
  set acknowledged_at = now(),
      acknowledged_by = auth.uid(),
      acknowledgement_comment = nullif(trim(_comment), '')
  where id = _assignment
  returning * into assignment;

  insert into public.evaluation_reviews(assignment_id, reviewer_id, decision, comments)
  values (_assignment, auth.uid(), 'acknowledged', nullif(trim(_comment), ''));

  response := jsonb_build_object(
    'id', assignment.id,
    'status', assignment.status,
    'acknowledged_at', assignment.acknowledged_at,
    'acknowledged_by', assignment.acknowledged_by,
    'acknowledgement_comment', assignment.acknowledgement_comment
  );
  return public._idem_put(_idem, 'acknowledge_evaluation', _hash, response);
end $$;

create or replace function public.reopen_evaluation(
  _assignment uuid,
  _reason text,
  _idem uuid,
  _hash text
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  previous jsonb;
  assignment public.evaluation_assignments;
  response jsonb;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  previous := public._idem_get(_idem, 'reopen_evaluation', _hash);
  if previous is not null then return previous; end if;
  if not public.has_perm('perf.approve') then raise exception 'FORBIDDEN'; end if;
  if coalesce(length(trim(_reason)), 0) < 5 then raise exception 'INVALID: a reason of at least 5 characters is required'; end if;

  select * into assignment from public.evaluation_assignments where id = _assignment for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  perform public.assert_transition('evaluation', assignment.status, 'reopened');

  update public.evaluation_assignments
  set status = 'reopened',
      reopen_reason = _reason,
      approved_at = null,
      approved_by = null,
      acknowledged_at = null,
      acknowledged_by = null,
      acknowledgement_comment = null
  where id = _assignment
  returning * into assignment;

  insert into public.evaluation_reviews(assignment_id, decision, comments)
  values (_assignment, 'reopened', _reason);
  update public.approval_tasks
  set status = 'cancelled'
  where workflow_type = 'evaluation' and record_id = _assignment and status = 'pending';
  perform public._notify(
    (select user_id from public.employees where id = assignment.evaluator_id),
    'Evaluation reopened',
    _reason,
    '/performance/evaluations/' || assignment.id,
    'warning'
  );

  response := to_jsonb(assignment) - 'snapshot';
  return public._idem_put(_idem, 'reopen_evaluation', _hash, response);
end $$;

create or replace function public.review_course(
  _id uuid,
  _decision text,
  _comments text,
  _idem uuid,
  _hash text
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  course public.courses;
  task public.approval_tasks;
  previous jsonb;
  new_status text;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.has_perm('learn.approve') then raise exception 'FORBIDDEN'; end if;
  if _decision is null or _decision not in ('approve', 'return') then
    raise exception 'INVALID: decision must be approve or return';
  end if;
  if _idem is null or _hash is null or _hash !~ '^[0-9a-f]{64}$' then
    raise exception 'INVALID: a valid idempotency key and request hash are required';
  end if;
  if length(coalesce(_comments, '')) > 4000 then raise exception 'INVALID: review comment is too long'; end if;

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':' || _idem::text, 0));
  previous := public._idem_get(_idem, 'review_course', _hash);
  if previous is not null then return previous; end if;

  select * into course from public.courses where id = _id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if course.created_by = auth.uid() then raise exception 'FORBIDDEN: you cannot approve a course you created'; end if;

  select * into task
  from public.approval_tasks
  where workflow_type = 'course_publication' and record_id = _id and status = 'pending'
  for update;
  if not found then raise exception 'RULE: no pending publication approval task exists for this course'; end if;
  if task.submitted_by = auth.uid() then raise exception 'FORBIDDEN: you cannot approve your own submission'; end if;

  new_status := case when _decision = 'approve' then 'approved' else 'draft' end;
  perform public.assert_transition('course', course.status, new_status);
  update public.courses
  set status = new_status,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_comments = nullif(trim(_comments), ''),
      updated_by = auth.uid()
  where id = _id;

  update public.approval_tasks
  set status = case when _decision = 'approve' then 'approved' else 'rejected' end,
      decided_by = auth.uid(),
      decided_at = now(),
      comments = nullif(trim(_comments), '')
  where id = task.id and status = 'pending';
  if not found then raise exception 'CONFLICT: publication approval task is no longer pending'; end if;

  perform public._notify(
    task.submitted_by,
    case when _decision = 'approve' then 'Course approved' else 'Course returned' end,
    '"' || course.title || '"' ||
      case when _decision = 'approve' then ' was approved and published' else ' was returned to draft' end ||
      case when coalesce(trim(_comments), '') <> '' then ': ' || trim(_comments) else '' end,
    '/learning/manage',
    case when _decision = 'approve' then 'success' else 'warning' end
  );

  return public._idem_put(
    _idem,
    'review_course',
    _hash,
    jsonb_build_object('id', _id, 'status', new_status)
  );
end $$;

create or replace function public.api_patch_course(
  _id uuid,
  _patch jsonb,
  _expected_version int,
  _idem uuid,
  _hash text
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  previous jsonb;
  course public.courses;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.has_perm('learn.manage') then raise exception 'FORBIDDEN'; end if;
  if _idem is null or _hash is null or _hash !~ '^[0-9a-f]{64}$' then
    raise exception 'INVALID: a valid idempotency key and request hash are required';
  end if;
  if _expected_version is null or _expected_version < 1 then
    raise exception 'INVALID: a valid expected version is required';
  end if;
  if _patch is null or jsonb_typeof(_patch) <> 'object' or _patch = '{}'::jsonb then
    raise exception 'INVALID: patch must include at least one field';
  end if;
  if (_patch - array['title', 'description', 'duration_minutes']) <> '{}'::jsonb then
    raise exception 'INVALID: patch contains unsupported fields';
  end if;
  if _patch ? 'title' and (
    jsonb_typeof(_patch->'title') <> 'string' or
    length(trim(_patch->>'title')) < 3 or
    length(_patch->>'title') > 160
  ) then raise exception 'INVALID: title must contain 3 to 160 characters'; end if;
  if _patch ? 'description' and (
    jsonb_typeof(_patch->'description') <> 'string' or length(_patch->>'description') > 4000
  ) then raise exception 'INVALID: description must be a string up to 4000 characters'; end if;
  if _patch ? 'duration_minutes' and (
    jsonb_typeof(_patch->'duration_minutes') <> 'number' or
    (_patch->>'duration_minutes')::numeric <> trunc((_patch->>'duration_minutes')::numeric) or
    (_patch->>'duration_minutes')::numeric < 1 or
    (_patch->>'duration_minutes')::numeric > 100000
  ) then raise exception 'INVALID: duration_minutes must be an integer from 1 to 100000'; end if;

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':' || _idem::text, 0));
  previous := public._idem_get(_idem, 'api_v1_course_patch', _hash);
  if previous is not null then return previous; end if;

  select * into course from public.courses where id = _id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if course.version <> _expected_version then raise exception 'CONFLICT: the course version is stale'; end if;
  if course.status not in ('draft', 'pending_review') then raise exception 'RULE: only draft or pending courses can be edited'; end if;

  update public.courses
  set title = case when _patch ? 'title' then _patch->>'title' else title end,
      description = case when _patch ? 'description' then nullif(_patch->>'description', '') else description end,
      duration_minutes = case when _patch ? 'duration_minutes' then (_patch->>'duration_minutes')::int else duration_minutes end,
      updated_by = auth.uid()
  where id = _id
  returning * into course;

  return public._idem_put(
    _idem,
    'api_v1_course_patch',
    _hash,
    jsonb_build_object(
      'id', course.id,
      'title', course.title,
      'description', course.description,
      'status', course.status,
      'duration_minutes', course.duration_minutes,
      'created_at', course.created_at,
      'version', course.version
    )
  );
end $$;

create or replace function public.my_context() returns jsonb
language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
    'user_id', auth.uid(),
    'role', public.current_role_name(),
    'permissions', coalesce((
      select jsonb_agg(permission)
      from (
        select rp.permission
        from public.role_permissions rp
        where rp.role = public.current_role_name()
        union
        select 'succession.dept'
        where public.current_role_name() = 'dept_head'
          and exists (
            select 1 from public.succession_access_grants g
            where g.user_id = auth.uid()
          )
      ) granted
    ), '[]'::jsonb),
    'employee', (
      select jsonb_build_object(
        'id', e.id,
        'name', e.first_name || ' ' || e.last_name,
        'department_id', e.department_id,
        'position_id', e.position_id,
        'version', e.version
      )
      from public.employees e
      where e.user_id = auth.uid()
    ),
    'is_active', (select is_active from public.profiles where id = auth.uid()),
    'email', (select email from public.profiles where id = auth.uid())
  )
$$;

revoke execute on function public.acknowledge_evaluation(uuid, text, uuid, text) from public, anon;
grant execute on function public.acknowledge_evaluation(uuid, text, uuid, text) to authenticated, service_role;
revoke execute on function public.api_patch_course(uuid, jsonb, int, uuid, text) from public, anon;
grant execute on function public.api_patch_course(uuid, jsonb, int, uuid, text) to authenticated, service_role;
revoke execute on function public._idem_get(uuid, text, text) from authenticated;
revoke execute on function public._idem_put(uuid, text, text, jsonb) from authenticated;

revoke execute on function public.reopen_evaluation(uuid, text, uuid, text) from public, anon;
grant execute on function public.reopen_evaluation(uuid, text, uuid, text) to authenticated, service_role;
revoke execute on function public.review_course(uuid, text, text, uuid, text) from public, anon;
grant execute on function public.review_course(uuid, text, text, uuid, text) to authenticated, service_role;
revoke execute on function public.my_context() from public, anon;
grant execute on function public.my_context() to authenticated, service_role;
