create table public.personal_goals (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  evaluation_assignment_id uuid references public.evaluation_assignments(id) on delete set null,
  title text not null check (length(title) between 3 and 160),
  description text check (length(description) <= 4000),
  success_criteria text check (length(success_criteria) <= 4000),
  target_date date,
  progress smallint not null default 0 check (progress between 0 and 100),
  progress_comment text check (length(progress_comment) <= 4000),
  status text not null default 'draft' check (status in ('draft','pending_review','approved','returned','completed','cancelled')),
  reviewer_id uuid references public.employees(id) on delete set null,
  review_comment text check (length(review_comment) <= 4000),
  reviewed_at timestamptz,
  version int not null default 1,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_by uuid,
  check (evaluation_assignment_id is null or employee_id is not null)
);

create index personal_goals_employee_status on public.personal_goals(employee_id, status);
create index personal_goals_evaluation on public.personal_goals(evaluation_assignment_id)
  where evaluation_assignment_id is not null;

alter table public.approval_tasks drop constraint approval_tasks_workflow_type_check;
alter table public.approval_tasks add constraint approval_tasks_workflow_type_check
  check (workflow_type in ('evaluation','competency_assessment','course_publication','ai_recommendation','recognition_nomination','personal_goal'));

alter table public.personal_goals enable row level security;
grant select on public.personal_goals to authenticated;
grant all on public.personal_goals to service_role;

create policy "personal goals scoped" on public.personal_goals for select to authenticated
  using (employee_id = public.my_employee_id()
    or public.is_supervisor_of(employee_id)
    or public.is_dept_head_of(employee_id)
    or public.has_perm('hr.employees')
    or public.has_perm('train.manage'));

create trigger personal_goals_touch before update on public.personal_goals
  for each row execute function public.tg_touch();
create trigger personal_goals_audit after insert or update or delete on public.personal_goals
  for each row execute function public.tg_audit();

create or replace function public.upsert_personal_goal(_id uuid, _d jsonb, _version int, _idem uuid, _hash text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  me uuid := public.my_employee_id();
  r public.personal_goals;
  resp jsonb;
begin
  if auth.uid() is null or me is null then raise exception 'FORBIDDEN: an employee profile is required'; end if;
  resp := public._idem_get(_idem,'upsert_personal_goal',_hash);
  if resp is not null then return resp; end if;
  if _id is null then
    if _d ? 'employee_id' and (_d->>'employee_id')::uuid <> me then raise exception 'FORBIDDEN'; end if;
    if nullif(_d->>'evaluation_assignment_id','') is not null and not exists (
      select 1 from public.evaluation_assignments
      where id=(_d->>'evaluation_assignment_id')::uuid and employee_id=me
    ) then raise exception 'FORBIDDEN: evaluation must belong to the employee'; end if;
    insert into public.personal_goals(employee_id,evaluation_assignment_id,title,description,success_criteria,target_date)
    values (me,nullif(_d->>'evaluation_assignment_id','')::uuid,trim(_d->>'title'),
      nullif(trim(_d->>'description'),''),nullif(trim(_d->>'success_criteria'),''),
      nullif(_d->>'target_date','')::date)
    returning * into r;
  else
    select * into r from public.personal_goals where id=_id for update;
    if not found then raise exception 'NOT_FOUND'; end if;
    if r.employee_id <> me then raise exception 'FORBIDDEN'; end if;
    if r.status not in ('draft','returned') then raise exception 'RULE: only draft or returned goals can be edited'; end if;
    if r.version <> _version then raise exception 'CONFLICT: this record was changed by someone else'; end if;
    if nullif(_d->>'evaluation_assignment_id','') is not null and not exists (
      select 1 from public.evaluation_assignments
      where id=(_d->>'evaluation_assignment_id')::uuid and employee_id=me
    ) then raise exception 'FORBIDDEN: evaluation must belong to the employee'; end if;
    update public.personal_goals set
      evaluation_assignment_id=nullif(_d->>'evaluation_assignment_id','')::uuid,
      title=trim(_d->>'title'),
      description=nullif(trim(_d->>'description'),''),
      success_criteria=nullif(trim(_d->>'success_criteria'),''),
      target_date=nullif(_d->>'target_date','')::date,
      version=version+1, updated_by=auth.uid()
    where id=_id returning * into r;
  end if;
  return public._idem_put(_idem,'upsert_personal_goal',_hash,to_jsonb(r));
end $$;

create or replace function public.submit_personal_goal(_id uuid, _version int, _idem uuid, _hash text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  me uuid := public.my_employee_id();
  r public.personal_goals;
  reviewer_user uuid;
  resp jsonb;
begin
  if auth.uid() is null or me is null then raise exception 'FORBIDDEN'; end if;
  resp := public._idem_get(_idem,'submit_personal_goal',_hash);
  if resp is not null then return resp; end if;
  select * into r from public.personal_goals where id=_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if r.employee_id <> me then raise exception 'FORBIDDEN'; end if;
  if r.version <> _version then raise exception 'CONFLICT: this record was changed by someone else'; end if;
  if r.status not in ('draft','returned') then raise exception 'RULE: goal is not ready for submission'; end if;
  select e.user_id into reviewer_user
  from public.reporting_relationships rr
  join public.employees e on e.id=rr.supervisor_id
  where rr.employee_id=me and rr.is_current
  order by rr.effective_from desc limit 1;
  update public.personal_goals set status='pending_review',reviewer_id=(
    select rr.supervisor_id from public.reporting_relationships rr
    where rr.employee_id=me and rr.is_current order by rr.effective_from desc limit 1
  ), review_comment=null, reviewed_at=null, version=version+1, updated_by=auth.uid()
  where id=_id returning * into r;
  insert into public.approval_tasks(workflow_type,record_id,record_label,employee_id,submitted_by,assignee_user,assignee_role)
  values ('personal_goal',r.id,'Personal goal: '||r.title,r.employee_id,auth.uid(),reviewer_user,'hr_admin');
  if reviewer_user is not null then
    perform public._notify(reviewer_user,'Personal goal review requested',r.title,'/approvals');
  else
    perform public._notify_role('hr_admin','Personal goal review requested',r.title,'/approvals');
  end if;
  return public._idem_put(_idem,'submit_personal_goal',_hash,to_jsonb(r));
end $$;

create or replace function public.update_personal_goal_progress(_id uuid, _progress int, _comment text, _version int, _idem uuid, _hash text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.personal_goals; resp jsonb;
begin
  if auth.uid() is null or public.my_employee_id() is null then raise exception 'FORBIDDEN'; end if;
  if _progress not between 0 and 100 or length(coalesce(_comment,'')) > 4000 then raise exception 'INVALID'; end if;
  resp := public._idem_get(_idem,'update_personal_goal_progress',_hash);
  if resp is not null then return resp; end if;
  update public.personal_goals set progress=_progress,progress_comment=nullif(trim(_comment),''),
    version=version+1,updated_by=auth.uid()
  where id=_id and employee_id=public.my_employee_id() and status='approved' and version=_version
  returning * into r;
  if not found then
    if exists(select 1 from public.personal_goals where id=_id and employee_id=public.my_employee_id() and version<>_version) then
      raise exception 'CONFLICT: this record was changed by someone else';
    end if;
    raise exception 'FORBIDDEN: only approved goals can be updated by their owner';
  end if;
  return public._idem_put(_idem,'update_personal_goal_progress',_hash,to_jsonb(r));
end $$;

create or replace function public.review_personal_goal(_id uuid, _decision text, _comments text, _idem uuid, _hash text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.personal_goals; owner_user uuid; resp jsonb;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if _decision not in ('approve','return','complete') then raise exception 'INVALID'; end if;
  select * into r from public.personal_goals where id=_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if r.employee_id=public.my_employee_id() then raise exception 'FORBIDDEN: self-review is not allowed'; end if;
  if not (public.is_supervisor_of(r.employee_id) or public.is_dept_head_of(r.employee_id) or public.has_perm('hr.employees')) then
    raise exception 'FORBIDDEN';
  end if;
  if _decision='return' and coalesce(length(trim(_comments)),0)=0 then
    raise exception 'INVALID: a reason is required when returning a goal';
  end if;
  resp := public._idem_get(_idem,'review_personal_goal',_hash);
  if resp is not null then return resp; end if;
  if (_decision in ('approve','return') and r.status<>'pending_review')
    or (_decision='complete' and (r.status<>'approved' or r.progress<100)) then
    raise exception 'RULE: goal is not in a reviewable state';
  end if;
  update public.personal_goals set status=case _decision when 'approve' then 'approved' when 'return' then 'returned' else 'completed' end,
    reviewer_id=public.my_employee_id(),review_comment=nullif(trim(_comments),''),reviewed_at=now(),
    version=version+1,updated_by=auth.uid()
  where id=_id returning * into r;
  update public.approval_tasks set status=case when _decision='return' then 'rejected' else 'approved' end,
    decided_by=auth.uid(),decided_at=now(),comments=nullif(trim(_comments),'')
  where workflow_type='personal_goal' and record_id=_id and status='pending';
  select user_id into owner_user from public.employees where id=r.employee_id;
  if owner_user is not null then perform public._notify(owner_user,'Personal goal reviewed',
    case when _decision='return' then 'Your goal was returned for revision.' else 'Your goal was reviewed.' end,
    '/goals'); end if;
  return public._idem_put(_idem,'review_personal_goal',_hash,to_jsonb(r));
end $$;

alter function public.remove_demo_data() rename to _remove_demo_data_before_personal_goals;
create function public.remove_demo_data() returns jsonb
language plpgsql security definer set search_path=public as $$
begin
  if not public.has_role(auth.uid(),'super_admin') then raise exception 'FORBIDDEN'; end if;
  if exists(select 1 from public.profiles where id=auth.uid() and is_demo) then
    raise exception 'RULE: sign in with a non-demo Super Admin to remove demo data';
  end if;
  delete from public.personal_goals
  where is_demo or employee_id in (select id from public.employees where is_demo);
  return public._remove_demo_data_before_personal_goals();
end $$;
revoke execute on function public._remove_demo_data_before_personal_goals() from public, anon, authenticated;
revoke execute on function public.remove_demo_data() from public, anon;
grant execute on function public.remove_demo_data() to authenticated;

alter function public.reset_demo_data() rename to _reset_demo_data_before_personal_goals;
create function public.reset_demo_data() returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
  if not public.has_role(auth.uid(),'super_admin') then raise exception 'FORBIDDEN'; end if;
  delete from public.personal_goals
  where is_demo or employee_id in (select id from public.employees where is_demo);
  result := public._reset_demo_data_before_personal_goals();
  return result;
end $$;
revoke execute on function public._reset_demo_data_before_personal_goals() from public, anon, authenticated;
revoke execute on function public.reset_demo_data() from public, anon;
grant execute on function public.reset_demo_data() to authenticated;

do $$ declare f record; begin
  for f in select p.oid::regprocedure sig from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in
      ('upsert_personal_goal','submit_personal_goal','update_personal_goal_progress','review_personal_goal',
       'remove_demo_data','reset_demo_data')
  loop
    execute format('revoke execute on function %s from public, anon',f.sig);
    execute format('grant execute on function %s to authenticated, service_role',f.sig);
  end loop;
end $$;
