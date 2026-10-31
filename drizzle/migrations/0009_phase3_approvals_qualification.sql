insert into public.status_transitions(entity,from_status,to_status) values
  ('development_plan','active','draft'),
  ('succession_plan','draft','pending_review'),
  ('succession_plan','returned','pending_review'),
  ('succession_plan','pending_review','approved'),
  ('succession_plan','pending_review','returned'),
  ('succession_plan','approved','draft'),
  ('succession_plan','returned','draft')
on conflict (entity,from_status,to_status) do nothing;

alter table public.approval_tasks drop constraint approval_tasks_workflow_type_check;
alter table public.approval_tasks add constraint approval_tasks_workflow_type_check
  check (workflow_type in (
    'evaluation','competency_assessment','course_publication','ai_recommendation',
    'recognition_nomination','personal_goal','development_plan','succession_plan'
  ));

alter table public.development_plans
  add column approval_status text not null default 'draft'
    check (approval_status in ('draft','pending_review','returned','approved')),
  add column submitted_by uuid references public.profiles(id) on delete set null,
  add column submitted_at timestamptz,
  add column reviewed_by uuid references public.profiles(id) on delete set null,
  add column reviewed_at timestamptz,
  add column review_comments text check (length(review_comments) <= 4000);
create index development_plans_approval on public.development_plans(approval_status,created_at desc);
alter table public.development_plans add column reassessment_due_date date;
update public.development_plans set status='draft'
where status='active' and approval_status='draft';

create or replace function public.tg_require_development_plan_approval() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if new.status='active' and new.approval_status<>'approved' then
    new.status:='draft';
  end if;
  return new;
end $$;
create trigger development_plans_require_approval
  before insert or update of status,approval_status on public.development_plans
  for each row execute function public.tg_require_development_plan_approval();

alter table public.course_enrollments add column due_date date;

drop function public.enroll_course(uuid,uuid,text,uuid,uuid,text);
create function public.enroll_course(
  _course uuid,_employee uuid,_source text,_plan_item uuid,_due_date date,_idem uuid,_hash text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.courses; e public.course_enrollments; resp jsonb;
begin
  resp:=public._idem_get(_idem,'enroll_course',_hash);
  if resp is not null then return resp; end if;
  select * into c from public.courses where id=_course;
  if not found then raise exception 'NOT_FOUND'; end if;
  if _employee=public.my_employee_id() then
    if _due_date is not null then raise exception 'FORBIDDEN: only an authorized assigner may set a due date'; end if;
    if not (c.status='approved' and c.enrollment_open) then
      raise exception 'RULE: this course is not open for self-enrollment';
    end if;
  elsif not (public.can_manage_learning() or public.can_manage_training()
      or public.is_supervisor_of(_employee) or public.is_dept_head_of(_employee)
      or public.has_perm('hr.employees')) then
    raise exception 'FORBIDDEN';
  end if;
  if c.status<>'approved' then raise exception 'RULE: only published courses can be assigned'; end if;
  insert into public.course_enrollments(course_id,employee_id,source,development_plan_item_id,due_date)
  values (_course,_employee,coalesce(_source,'direct'),_plan_item,_due_date)
  on conflict (course_id,employee_id) do nothing returning * into e;
  if not found then
    select * into e from public.course_enrollments where course_id=_course and employee_id=_employee;
    return public._idem_put(_idem,'enroll_course',_hash,
      jsonb_build_object('id',e.id,'status',e.status,'existing',true));
  end if;
  perform public._notify((select user_id from public.employees where id=_employee),
    'New course assigned','You were enrolled in "'||c.title||'".','/learning/course/'||_course,'assignment');
  return public._idem_put(_idem,'enroll_course',_hash,jsonb_build_object('id',e.id,'status',e.status));
end $$;

create table public.succession_plans (
  id uuid primary key default gen_random_uuid(),
  critical_position_id uuid not null unique references public.critical_positions(id) on delete cascade,
  owner_user_id uuid references public.profiles(id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft','pending_review','returned','approved','archived')),
  submitted_by uuid references public.profiles(id) on delete set null,
  submitted_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_comments text check (length(review_comments) <= 4000),
  version int not null default 1,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_by uuid
);
create index succession_plans_status on public.succession_plans(status,updated_at desc);
alter table public.succession_plans enable row level security;
grant select on public.succession_plans to authenticated;
grant all on public.succession_plans to service_role;
create policy "succession plans scoped" on public.succession_plans for select to authenticated
  using (exists (
    select 1 from public.critical_positions cp
    where cp.id=critical_position_id and public.can_view_succession(cp.department_id)
  ));
create trigger succession_plans_touch before update on public.succession_plans
  for each row execute function public.tg_touch();
create trigger succession_plans_audit after insert or update or delete on public.succession_plans
  for each row execute function public.tg_audit();

create or replace function public.tg_cleanup_succession_plan_tasks() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  delete from public.approval_tasks
  where workflow_type='succession_plan' and record_id=old.id;
  return old;
end $$;
create trigger succession_plans_cleanup_tasks after delete on public.succession_plans
  for each row execute function public.tg_cleanup_succession_plan_tasks();

create or replace function public._invalidate_succession_plan(_critical_position uuid) returns void
language plpgsql security definer set search_path=public as $$
declare current_status text;
begin
  if public.has_role(auth.uid(),'super_admin') and exists (
    select 1 from public.critical_positions where id=_critical_position and is_demo
  ) then
    return;
  end if;
  if not exists (select 1 from public.critical_positions where id=_critical_position) then
    return;
  end if;
  select status into current_status from public.succession_plans
    where critical_position_id=_critical_position for update;
  if current_status='pending_review' then
    raise exception 'CONFLICT: a succession plan awaiting review cannot be changed';
  end if;
  if current_status in ('approved','returned') then
    perform public.assert_transition('succession_plan',current_status,'draft');
  end if;
  update public.succession_plans set status='draft',submitted_by=null,submitted_at=null,
    reviewed_by=null,reviewed_at=null,review_comments=null
  where critical_position_id=_critical_position and status in ('approved','returned');
end $$;

create or replace function public.tg_invalidate_succession_plan_from_position() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if new.position_id is not distinct from old.position_id
    and new.department_id is not distinct from old.department_id
    and new.criticality is not distinct from old.criticality
    and new.business_impact is not distinct from old.business_impact
    and new.incumbent_employee_id is not distinct from old.incumbent_employee_id
    and new.review_date is not distinct from old.review_date then
    return new;
  end if;
  perform public._invalidate_succession_plan(new.id);
  return new;
end $$;
create trigger critical_position_reopen_plan
  after update of position_id,department_id,criticality,business_impact,incumbent_employee_id,review_date
  on public.critical_positions for each row execute function public.tg_invalidate_succession_plan_from_position();

create or replace function public.tg_create_succession_plan() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  insert into public.succession_plans(critical_position_id,owner_user_id,is_demo)
  values (new.id,coalesce(new.created_by,auth.uid()),new.is_demo)
  on conflict (critical_position_id) do nothing;
  return new;
end $$;
create trigger critical_position_create_plan after insert on public.critical_positions
  for each row execute function public.tg_create_succession_plan();

insert into public.succession_plans(critical_position_id,owner_user_id,is_demo)
select id,created_by,is_demo from public.critical_positions
on conflict (critical_position_id) do nothing;

create or replace function public.tg_invalidate_succession_plan_from_candidate() returns trigger
language plpgsql security definer set search_path=public as $$
declare position_id uuid;
begin
  if tg_op='DELETE' then
    position_id:=old.critical_position_id;
  else
    position_id:=new.critical_position_id;
    if tg_op='UPDATE' and new.critical_position_id is not distinct from old.critical_position_id
      and new.employee_id is not distinct from old.employee_id
      and new.readiness_class_id is not distinct from old.readiness_class_id
      and new.notes is not distinct from old.notes
      and new.status is not distinct from old.status then
      return new;
    end if;
  end if;
  perform public._invalidate_succession_plan(position_id);
  if tg_op='UPDATE' and new.critical_position_id is distinct from old.critical_position_id then
    perform public._invalidate_succession_plan(old.critical_position_id);
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
create trigger succession_candidate_reopen_plan
  after insert or delete or update of critical_position_id,employee_id,readiness_class_id,notes,status
  on public.succession_candidates for each row
  execute function public.tg_invalidate_succession_plan_from_candidate();

alter table public.succession_candidates
  add constraint succession_candidates_id_position_unique unique (id,critical_position_id);
create table public.succession_qualification_requirements (
  id uuid primary key default gen_random_uuid(),
  critical_position_id uuid not null references public.critical_positions(id) on delete cascade,
  name text not null check (length(name) between 2 and 160),
  description text check (length(description) <= 2000),
  is_mandatory boolean not null default false,
  active boolean not null default true,
  version int not null default 1,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_by uuid,
  constraint succession_qualification_requirement_id_position_unique
    unique (id,critical_position_id),
  unique (critical_position_id,name)
);
create index succession_qualification_requirements_position
  on public.succession_qualification_requirements(critical_position_id,active);
alter table public.succession_qualification_requirements enable row level security;
grant select on public.succession_qualification_requirements to authenticated;
grant all on public.succession_qualification_requirements to service_role;
create policy "succession qualifications scoped" on public.succession_qualification_requirements for select to authenticated
  using (exists (
    select 1 from public.critical_positions cp
    where cp.id=critical_position_id and public.can_view_succession(cp.department_id)
  ));
create trigger succession_qualification_requirements_touch before update on public.succession_qualification_requirements
  for each row execute function public.tg_touch();
create trigger succession_qualification_requirements_audit after insert or update or delete
  on public.succession_qualification_requirements for each row execute function public.tg_audit();
create or replace function public.tg_invalidate_succession_plan_from_requirement() returns trigger
language plpgsql security definer set search_path=public as $$
declare position_id uuid;
begin
  if tg_op='DELETE' then
    position_id:=old.critical_position_id;
  else
    position_id:=new.critical_position_id;
    if tg_op='UPDATE' and new.name is not distinct from old.name
      and new.description is not distinct from old.description
      and new.is_mandatory is not distinct from old.is_mandatory
      and new.active is not distinct from old.active then
      return new;
    end if;
  end if;
  perform public._invalidate_succession_plan(position_id);
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
create trigger succession_qualification_requirement_reopen_plan
  after insert or delete or update of name,description,is_mandatory,active
  on public.succession_qualification_requirements for each row
  execute function public.tg_invalidate_succession_plan_from_requirement();

create table public.succession_candidate_qualifications (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null,
  critical_position_id uuid not null,
  requirement_id uuid not null,
  status text not null default 'unassessed'
    check (status in ('met','gap','missing_evidence','unassessed')),
  evidence_summary text check (length(evidence_summary) <= 4000),
  evidence_date date,
  expires_on date,
  assessor_id uuid references public.profiles(id) on delete set null,
  verified_at timestamptz,
  version int not null default 1,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_by uuid,
  foreign key (candidate_id,critical_position_id)
    references public.succession_candidates(id,critical_position_id) on delete cascade,
  foreign key (requirement_id,critical_position_id)
    references public.succession_qualification_requirements(id,critical_position_id) on delete cascade,
  unique (candidate_id,requirement_id),
  check (status not in ('met','gap') or (length(trim(coalesce(evidence_summary,'')))>0 and evidence_date is not null)),
  check (expires_on is null or evidence_date is null or expires_on >= evidence_date)
);
create index succession_candidate_qualifications_candidate
  on public.succession_candidate_qualifications(candidate_id,status);
alter table public.succession_candidate_qualifications enable row level security;
grant select on public.succession_candidate_qualifications to authenticated;
grant all on public.succession_candidate_qualifications to service_role;
create policy "succession candidate qualifications scoped" on public.succession_candidate_qualifications
  for select to authenticated using (exists (
    select 1 from public.critical_positions cp
    where cp.id=critical_position_id and public.can_view_succession(cp.department_id)
  ));
create trigger succession_candidate_qualifications_touch before update on public.succession_candidate_qualifications
  for each row execute function public.tg_touch();
create trigger succession_candidate_qualifications_audit after insert or update or delete
  on public.succession_candidate_qualifications for each row execute function public.tg_audit();
create or replace function public.tg_invalidate_succession_plan_from_assessment() returns trigger
language plpgsql security definer set search_path=public as $$
declare position_id uuid;
begin
  if tg_op='DELETE' then
    position_id:=old.critical_position_id;
  else
    position_id:=new.critical_position_id;
    if tg_op='UPDATE' and new.status is not distinct from old.status
      and new.evidence_summary is not distinct from old.evidence_summary
      and new.evidence_date is not distinct from old.evidence_date
      and new.expires_on is not distinct from old.expires_on then
      return new;
    end if;
  end if;
  perform public._invalidate_succession_plan(position_id);
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
create trigger succession_candidate_qualification_reopen_plan
  after insert or delete or update of status,evidence_summary,evidence_date,expires_on
  on public.succession_candidate_qualifications for each row
  execute function public.tg_invalidate_succession_plan_from_assessment();

create policy "succession plan reviewers may see tasks" on public.approval_tasks for select to authenticated
  using (workflow_type='succession_plan' and public.has_perm('succession.manage'));

create or replace function public.upsert_development_plan(_id uuid, _d jsonb, _version int) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.development_plans; emp uuid; requested_status text; content_changed boolean;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  emp := coalesce((_d->>'employee_id')::uuid,
    (select employee_id from public.development_plans where id=_id));
  if not (public.can_manage_training() or public.has_perm('hr.employees')
      or public.is_supervisor_of(emp) or public.is_dept_head_of(emp)) then
    raise exception 'FORBIDDEN';
  end if;
  requested_status := nullif(_d->>'status','');
  if requested_status is not null and requested_status not in ('draft','active','completed','cancelled') then
    raise exception 'INVALID: unknown development plan status';
  end if;
  if _id is null then
    insert into public.development_plans(
      employee_id,title,objectives,responsible_id,target_date,reassessment_due_date,status,notes
    )
    values (emp,_d->>'title',nullif(_d->>'objectives',''),nullif(_d->>'responsible_id','')::uuid,
      nullif(_d->>'target_date','')::date,nullif(_d->>'reassessment_due_date','')::date,
      'draft',nullif(_d->>'notes','')) returning * into r;
  else
    select * into r from public.development_plans where id=_id for update;
    if not found then raise exception 'NOT_FOUND'; end if;
    if r.version<>_version then raise exception 'CONFLICT: this plan was changed by someone else'; end if;
    if r.approval_status='pending_review' then raise exception 'CONFLICT: a pending plan cannot be edited'; end if;
    if requested_status in ('active','completed','cancelled') and r.approval_status<>'approved' then
      raise exception 'RULE: a development plan must be approved before activation or closure';
    end if;
    content_changed := r.title is distinct from _d->>'title'
      or r.objectives is distinct from nullif(_d->>'objectives','')
      or r.responsible_id is distinct from nullif(_d->>'responsible_id','')::uuid
      or r.target_date is distinct from nullif(_d->>'target_date','')::date
      or r.reassessment_due_date is distinct from nullif(_d->>'reassessment_due_date','')::date
      or r.notes is distinct from nullif(_d->>'notes','');
    if content_changed and r.approval_status='approved' and r.status<>'draft' then
      if r.status in ('completed','cancelled') then
        raise exception 'RULE: a closed plan cannot be edited';
      end if;
      perform public.assert_transition('development_plan',r.status,'draft');
    elsif requested_status in ('completed','cancelled') and requested_status<>r.status then
      perform public.assert_transition('development_plan',r.status,requested_status);
    end if;
    update public.development_plans set title=_d->>'title',objectives=nullif(_d->>'objectives',''),
      responsible_id=nullif(_d->>'responsible_id','')::uuid,target_date=nullif(_d->>'target_date','')::date,
      reassessment_due_date=nullif(_d->>'reassessment_due_date','')::date,
      status=case when content_changed and approval_status='approved' then 'draft'
        when requested_status in ('completed','cancelled') then requested_status else status end,
      notes=nullif(_d->>'notes',''),
      approval_status=case when content_changed and approval_status='approved' then 'draft' else approval_status end,
      submitted_by=case when content_changed and approval_status='approved' then null else submitted_by end,
      submitted_at=case when content_changed and approval_status='approved' then null else submitted_at end,
      reviewed_by=case when content_changed and approval_status='approved' then null else reviewed_by end,
      reviewed_at=case when content_changed and approval_status='approved' then null else reviewed_at end,
      review_comments=case when content_changed and approval_status='approved' then null else review_comments end
    where id=_id and version=_version returning * into r;
    if not found then raise exception 'CONFLICT: this plan was changed by someone else'; end if;
  end if;
  return to_jsonb(r);
end $$;

create or replace function public.tg_reopen_development_plan_for_edit() returns trigger
language plpgsql security definer set search_path=public as $$
declare plan_id uuid; plan_status text;
begin
  if tg_op='DELETE' then
    plan_id:=old.plan_id;
    if public.has_role(auth.uid(),'super_admin') and exists (
      select 1 from public.development_plans where id=plan_id and is_demo
    ) then
      return old;
    end if;
  else
    plan_id:=new.plan_id;
    if tg_op='UPDATE' and row(new.item_type,new.title,new.description,new.competency_id,new.course_id,
      new.learning_path_id,new.training_session_id,new.gap_snapshot_id,new.ai_recommendation_id,
      new.priority,new.target_date) is not distinct from row(old.item_type,old.title,old.description,
      old.competency_id,old.course_id,old.learning_path_id,old.training_session_id,old.gap_snapshot_id,
      old.ai_recommendation_id,old.priority,old.target_date) then
      return new;
    end if;
  end if;
  if exists (
    select 1 from public.development_plans p
    where p.id=plan_id and p.approval_status='pending_review'
  ) then
    raise exception 'CONFLICT: a plan awaiting review cannot be changed';
  end if;
  select status into plan_status from public.development_plans where id=plan_id for update;
  if plan_status in ('completed','cancelled') then
    raise exception 'RULE: a closed plan cannot be edited';
  end if;
  if plan_status='active' and exists (
    select 1 from public.development_plans where id=plan_id and approval_status='approved'
  ) then
    perform public.assert_transition('development_plan','active','draft');
  end if;
  update public.development_plans set approval_status='draft',status='draft',
    submitted_by=null,submitted_at=null,reviewed_by=null,reviewed_at=null,review_comments=null
  where id=plan_id and approval_status='approved';
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
create trigger development_plan_items_reopen_plan
  after insert or delete or update of item_type,title,description,competency_id,course_id,learning_path_id,
    training_session_id,gap_snapshot_id,ai_recommendation_id,priority,target_date
  on public.development_plan_items
  for each row execute function public.tg_reopen_development_plan_for_edit();

create or replace function public.submit_development_plan(_id uuid,_version int,_idem uuid,_hash text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.development_plans; resp jsonb; emp public.employees;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  resp:=public._idem_get(_idem,'submit_development_plan',_hash);
  if resp is not null then return resp; end if;
  select * into p from public.development_plans where id=_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if p.version<>_version then raise exception 'CONFLICT: this plan was changed by someone else'; end if;
  if not (public.can_manage_training() or public.has_perm('hr.employees')
      or public.is_supervisor_of(p.employee_id) or public.is_dept_head_of(p.employee_id)) then
    raise exception 'FORBIDDEN';
  end if;
  if p.approval_status not in ('draft','returned') or p.status in ('completed','cancelled') then
    raise exception 'RULE: this plan cannot be submitted in its current state';
  end if;
  update public.development_plans set approval_status='pending_review',submitted_by=auth.uid(),
    submitted_at=now(),reviewed_by=null,reviewed_at=null,review_comments=null
  where id=_id returning * into p;
  insert into public.approval_tasks(workflow_type,record_id,record_label,employee_id,submitted_by,assignee_role)
  values ('development_plan',p.id,p.title,p.employee_id,auth.uid(),'hr_admin');
  perform public._notify_role('hr_admin','Development plan awaiting approval',p.title,
    '/approvals','approval');
  select * into emp from public.employees where id=p.employee_id;
  if emp.user_id is not null then
    perform public._notify(emp.user_id,'Development plan submitted',
      'Your development plan was submitted for review.','/training/plans/'||p.id,'approval');
  end if;
  return public._idem_put(_idem,'submit_development_plan',_hash,to_jsonb(p));
end $$;

create or replace function public.review_development_plan(
  _id uuid,_decision text,_comments text,_version int,_idem uuid,_hash text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.development_plans; resp jsonb; emp public.employees;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  resp:=public._idem_get(_idem,'review_development_plan',_hash);
  if resp is not null then return resp; end if;
  if not public.has_perm('learn.approve') and not public.has_perm('hr.employees') then
    raise exception 'FORBIDDEN: development plans require HR approval';
  end if;
  if _decision not in ('approve','return') then raise exception 'INVALID'; end if;
  if _decision='return' and coalesce(length(trim(_comments)),0)<3 then
    raise exception 'RULE: provide a reason when returning a plan';
  end if;
  select * into p from public.development_plans where id=_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if p.version<>_version then raise exception 'CONFLICT: this plan was changed by someone else'; end if;
  if p.approval_status<>'pending_review' then raise exception 'RULE: this plan is not awaiting review'; end if;
  if p.submitted_by=auth.uid() then raise exception 'FORBIDDEN: you cannot approve a plan you submitted'; end if;
  if not exists (
    select 1 from public.approval_tasks t where t.workflow_type='development_plan'
      and t.record_id=_id and t.status='pending' and t.assignee_role='hr_admin'
  ) then
    raise exception 'FORBIDDEN: this plan is not assigned to HR review';
  end if;
  if p.status='draft' and _decision='approve' then
    perform public.assert_transition('development_plan','draft','active');
  elsif p.status='active' and _decision='return' then
    perform public.assert_transition('development_plan','active','draft');
  end if;
  update public.development_plans set approval_status=case when _decision='approve' then 'approved' else 'returned' end,
    status=case when _decision='approve' and status='draft' then 'active'
      when _decision='return' then 'draft' else status end,
    reviewed_by=auth.uid(),reviewed_at=now(),review_comments=nullif(trim(_comments),'')
  where id=_id returning * into p;
  update public.approval_tasks set status=case when _decision='approve' then 'approved' else 'rejected' end,
    decided_by=auth.uid(),decided_at=now(),comments=nullif(trim(_comments),'')
  where workflow_type='development_plan' and record_id=_id and status='pending';
  select * into emp from public.employees where id=p.employee_id;
  if emp.user_id is not null then
    perform public._notify(emp.user_id,'Development plan reviewed',
      case when _decision='approve' then 'Your development plan was approved.' else 'Your development plan was returned for revision.' end,
      '/training/plans/'||p.id,'approval');
  end if;
  if p.submitted_by is not null and p.submitted_by is distinct from emp.user_id then
    perform public._notify(p.submitted_by,'Development plan reviewed',
      case when _decision='approve' then 'A development plan you submitted was approved.'
        else 'A development plan you submitted was returned for revision.' end,
      '/training/plans/'||p.id,'approval');
  end if;
  return public._idem_put(_idem,'review_development_plan',_hash,to_jsonb(p));
end $$;

create or replace function public.upsert_succession_qualification_requirement(
  _id uuid,_critical_position uuid,_name text,_description text,_mandatory boolean,_active boolean,
  _version int,_idem uuid,_hash text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.succession_qualification_requirements; dept uuid; resp jsonb;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  resp:=public._idem_get(_idem,'upsert_succession_qualification_requirement',_hash);
  if resp is not null then return resp; end if;
  select department_id into dept from public.critical_positions where id=_critical_position;
  if dept is null then raise exception 'NOT_FOUND'; end if;
  if not (public.has_perm('succession.manage') or
    (public.has_perm('succession.dept') and public.can_view_succession(dept))) then
    raise exception 'FORBIDDEN';
  end if;
  if length(trim(_name)) not between 2 and 160 then raise exception 'INVALID'; end if;
  if _id is null then
    insert into public.succession_qualification_requirements(
      critical_position_id,name,description,is_mandatory,active
    ) values (_critical_position,trim(_name),nullif(trim(_description),''),coalesce(_mandatory,false),
      coalesce(_active,true)) returning * into r;
  else
    update public.succession_qualification_requirements set name=trim(_name),
      description=nullif(trim(_description),''),is_mandatory=coalesce(_mandatory,false),
      active=coalesce(_active,true)
    where id=_id and critical_position_id=_critical_position and version=_version
    returning * into r;
    if not found then
      if exists(select 1 from public.succession_qualification_requirements where id=_id) then
        raise exception 'CONFLICT: this qualification requirement was changed by someone else';
      end if;
      raise exception 'NOT_FOUND';
    end if;
  end if;
  return public._idem_put(
    _idem,'upsert_succession_qualification_requirement',_hash,to_jsonb(r)
  );
end $$;

create or replace function public.set_succession_candidate_qualification(
  _id uuid,_candidate uuid,_requirement uuid,_status text,_evidence text,
  _evidence_date date,_expires_on date,_version int,_idem uuid,_hash text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.succession_candidate_qualifications; cp public.critical_positions;
  candidate public.succession_candidates; resp jsonb;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  resp:=public._idem_get(_idem,'set_succession_candidate_qualification',_hash);
  if resp is not null then return resp; end if;
  if _status not in ('met','gap','missing_evidence','unassessed') then raise exception 'INVALID'; end if;
  select * into candidate from public.succession_candidates where id=_candidate;
  if not found then raise exception 'NOT_FOUND'; end if;
  select * into cp from public.critical_positions where id=candidate.critical_position_id;
  if not (public.has_perm('succession.manage') or
    (public.has_perm('succession.dept') and public.can_view_succession(cp.department_id))) then
    raise exception 'FORBIDDEN';
  end if;
  if candidate.employee_id=public.my_employee_id() then
    raise exception 'FORBIDDEN: candidates cannot verify their own qualifications';
  end if;
  if _status in ('met','gap') and
    (coalesce(length(trim(_evidence)),0)=0 or _evidence_date is null) then
    raise exception 'RULE: verified evidence requires a summary and evidence date';
  end if;
  if _expires_on is not null and _evidence_date is not null and _expires_on<_evidence_date then
    raise exception 'INVALID: expiry must be on or after the evidence date';
  end if;
  if _id is null then
    insert into public.succession_candidate_qualifications(
      candidate_id,critical_position_id,requirement_id,status,evidence_summary,evidence_date,
      expires_on,assessor_id,verified_at
    ) values (_candidate,candidate.critical_position_id,_requirement,_status,
      nullif(trim(_evidence),''),_evidence_date,_expires_on,auth.uid(),now()) returning * into r;
  else
    update public.succession_candidate_qualifications set status=_status,
      evidence_summary=nullif(trim(_evidence),''),evidence_date=_evidence_date,expires_on=_expires_on,
      assessor_id=auth.uid(),verified_at=now()
    where id=_id and candidate_id=_candidate and requirement_id=_requirement and version=_version
    returning * into r;
    if not found then
      if exists(select 1 from public.succession_candidate_qualifications where id=_id) then
        raise exception 'CONFLICT: this qualification assessment was changed by someone else';
      end if;
      raise exception 'NOT_FOUND';
    end if;
  end if;
  return public._idem_put(
    _idem,'set_succession_candidate_qualification',_hash,to_jsonb(r)
  );
end $$;

create or replace function public.submit_succession_plan(_id uuid,_version int,_idem uuid,_hash text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.succession_plans; cp public.critical_positions; dept_head uuid; reviewer_role public.app_role;
  reviewer_user uuid; resp jsonb;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  resp:=public._idem_get(_idem,'submit_succession_plan',_hash);
  if resp is not null then return resp; end if;
  select * into p from public.succession_plans where id=_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if p.version<>_version then raise exception 'CONFLICT: this plan was changed by someone else'; end if;
  select * into cp from public.critical_positions where id=p.critical_position_id;
  if not (public.has_perm('succession.manage') or
    (public.has_perm('succession.dept') and public.can_view_succession(cp.department_id))) then
    raise exception 'FORBIDDEN';
  end if;
  if p.status not in ('draft','returned') then raise exception 'RULE: this plan cannot be submitted'; end if;
  perform public.assert_transition('succession_plan',p.status,'pending_review');
  select e.user_id into dept_head from public.departments d
    left join public.employees e on e.id=d.head_employee_id where d.id=cp.department_id;
  if dept_head is null or dept_head=auth.uid() then
    reviewer_role:='hr_admin'; reviewer_user:=null;
  else
    reviewer_role:=null; reviewer_user:=dept_head;
  end if;
  update public.succession_plans set status='pending_review',submitted_by=auth.uid(),
    submitted_at=now(),reviewed_by=null,reviewed_at=null,review_comments=null,
    owner_user_id=coalesce(owner_user_id,auth.uid())
  where id=_id returning * into p;
  insert into public.approval_tasks(workflow_type,record_id,record_label,submitted_by,assignee_role,assignee_user)
  values ('succession_plan',p.id,'Succession plan: '||cp.id::text,auth.uid(),reviewer_role,reviewer_user);
  if reviewer_user is not null then
    perform public._notify(reviewer_user,'Succession plan awaiting review',
      'A succession plan requires your review.','/approvals','approval');
  else
    perform public._notify_role('hr_admin','Succession plan awaiting review',
      'A succession plan requires review by HR.','/approvals');
  end if;
  return public._idem_put(_idem,'submit_succession_plan',_hash,to_jsonb(p));
end $$;

create or replace function public.review_succession_plan(
  _id uuid,_decision text,_comments text,_version int,_idem uuid,_hash text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.succession_plans; cp public.critical_positions; resp jsonb;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  resp:=public._idem_get(_idem,'review_succession_plan',_hash);
  if resp is not null then return resp; end if;
  if _decision not in ('approve','return') then raise exception 'INVALID'; end if;
  if _decision='return' and coalesce(length(trim(_comments)),0)<3 then
    raise exception 'RULE: provide a reason when returning a plan';
  end if;
  select * into p from public.succession_plans where id=_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if p.version<>_version then raise exception 'CONFLICT: this plan was changed by someone else'; end if;
  if p.status<>'pending_review' then raise exception 'RULE: this plan is not awaiting review'; end if;
  if p.submitted_by=auth.uid() then raise exception 'FORBIDDEN: you cannot approve a plan you submitted'; end if;
  select * into cp from public.critical_positions where id=p.critical_position_id;
  if not (public.has_perm('succession.manage') or
    (public.has_perm('succession.dept') and public.can_view_succession(cp.department_id))) then
    raise exception 'FORBIDDEN';
  end if;
  if not exists (
    select 1 from public.approval_tasks t where t.workflow_type='succession_plan'
      and t.record_id=_id and t.status='pending' and (
        t.assignee_user=auth.uid()
        or (t.assignee_role='hr_admin' and public.has_perm('succession.manage'))
      )
  ) then
    raise exception 'FORBIDDEN';
  end if;
  perform public.assert_transition(
    'succession_plan',p.status,case when _decision='approve' then 'approved' else 'returned' end
  );
  update public.succession_plans set status=case when _decision='approve' then 'approved' else 'returned' end,
    reviewed_by=auth.uid(),reviewed_at=now(),review_comments=nullif(trim(_comments),'')
  where id=_id returning * into p;
  update public.approval_tasks set status=case when _decision='approve' then 'approved' else 'rejected' end,
    decided_by=auth.uid(),decided_at=now(),comments=nullif(trim(_comments),'')
  where workflow_type='succession_plan' and record_id=_id and status='pending';
  if p.owner_user_id is not null then
    perform public._notify(p.owner_user_id,'Succession plan reviewed',
      case when _decision='approve' then 'Your succession plan was approved.' else 'Your succession plan was returned for revision.' end,
      '/succession/positions','approval');
  end if;
  if p.submitted_by is not null and p.submitted_by is distinct from p.owner_user_id then
    perform public._notify(p.submitted_by,'Succession plan reviewed',
      case when _decision='approve' then 'A succession plan you submitted was approved.'
        else 'A succession plan you submitted was returned for revision.' end,
      '/succession/positions','approval');
  end if;
  return public._idem_put(_idem,'review_succession_plan',_hash,to_jsonb(p));
end $$;

do $$ declare f record; begin
  for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in
      ('tg_cleanup_succession_plan_tasks','_invalidate_succession_plan','tg_invalidate_succession_plan_from_position',
       'tg_create_succession_plan','tg_invalidate_succession_plan_from_candidate',
       'tg_invalidate_succession_plan_from_requirement','tg_invalidate_succession_plan_from_assessment',
       'tg_reopen_development_plan_for_edit','tg_require_development_plan_approval')
  loop execute format('revoke execute on function %s from public, anon, authenticated',f.sig); end loop;
  for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in (
      'enroll_course','submit_development_plan','review_development_plan','upsert_succession_qualification_requirement',
      'set_succession_candidate_qualification','submit_succession_plan','review_succession_plan'
    )
  loop
    execute format('revoke execute on function %s from public, anon',f.sig);
    execute format('grant execute on function %s to authenticated, service_role',f.sig);
  end loop;
end $$;
