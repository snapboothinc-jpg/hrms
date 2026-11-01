-- Succession, recognition and scoped reporting domain schema and operations.

-- Phase 6, stage 1: succession planning, recognition, readiness config, scoped report reader.
insert into public.role_permissions(role, permission) values
 ('hr_admin','succession.manage'),('hr_admin','recognition.review');

insert into public.status_transitions(entity, from_status, to_status) values
 ('nomination','submitted','approved'),('nomination','submitted','rejected'),
 ('succession_candidate','active','withdrawn'),('succession_candidate','active','appointed'),
 ('critical_position','active','monitoring'),('critical_position','monitoring','active'),
 ('critical_position','active','closed'),('critical_position','monitoring','closed');

insert into public.system_settings(key, value, description) values
 ('recognition.min_message_length', '20', 'Default - requires organizational validation. Minimum nomination message length.'),
 ('recognition.max_nominations_per_month', '5', 'Default - requires organizational validation. Maximum nominations one employee may submit per calendar month.'),
 ('recognition.approval_route', '"hr_admin"', 'Default - requires organizational validation. HR Administrator reviews nominations before publishing.'),
 ('succession.readiness_note', '"configurable"', 'Default - requires organizational validation. Readiness classifications are configurable defaults.');

create table public.readiness_classes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (length(code) between 1 and 30),
  label text not null check (length(label) between 2 and 80),
  description text check (length(description) <= 1000),
  sort_order int not null default 0,
  requires_validation boolean not null default true,
  version int not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid
);
insert into public.readiness_classes(code,label,description,sort_order) values
 ('ready_now','Ready now','Default - requires organizational validation. Candidate can step in immediately.',0),
 ('ready_1_2','Ready in 1-2 years','Default - requires organizational validation. Candidate needs limited further development.',1),
 ('ready_3_plus','Ready in 3+ years','Default - requires organizational validation. Candidate needs substantial development.',2),
 ('not_ready','Not ready','Default - requires organizational validation. Candidate is not currently on track.',3);

create table public.succession_access_grants (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  granted_by uuid default auth.uid(),
  unique (department_id, user_id),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid
);

create table public.critical_positions (
  id uuid primary key default gen_random_uuid(),
  position_id uuid not null references public.positions(id) on delete restrict,
  department_id uuid not null references public.departments(id) on delete restrict,
  criticality text not null default 'medium' check (criticality in ('low','medium','high','critical')),
  business_impact text check (length(business_impact) <= 4000),
  incumbent_employee_id uuid references public.employees(id) on delete set null,
  status text not null default 'active' check (status in ('active','monitoring','closed')),
  review_date date,
  version int not null default 1,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid
);
create index on public.critical_positions(department_id, status);

create table public.succession_candidates (
  id uuid primary key default gen_random_uuid(),
  critical_position_id uuid not null references public.critical_positions(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  readiness_class_id uuid references public.readiness_classes(id) on delete set null,
  notes text check (length(notes) <= 4000),
  status text not null default 'active' check (status in ('active','withdrawn','appointed')),
  version int not null default 1,
  is_demo boolean not null default false,
  unique (critical_position_id, employee_id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid
);
create index on public.succession_candidates(employee_id);

create table public.succession_readiness_assessments (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.succession_candidates(id) on delete cascade,
  assessor_id uuid references public.employees(id) on delete set null,
  assessment_date date not null default current_date,
  summary text not null check (length(summary) between 3 and 4000),
  readiness_class_id uuid references public.readiness_classes(id) on delete set null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid
);
create index on public.succession_readiness_assessments(candidate_id);

create table public.succession_development_activities (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.succession_candidates(id) on delete cascade,
  title text not null check (length(title) between 3 and 200),
  description text check (length(description) <= 4000),
  development_plan_item_id uuid references public.development_plan_items(id) on delete set null,
  status text not null default 'planned' check (status in ('planned','in_progress','completed','cancelled')),
  target_date date,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid
);

create table public.recognition_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(name) between 2 and 80),
  description text check (length(description) <= 1000),
  active boolean not null default true,
  version int not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid
);
insert into public.recognition_categories(name,description) values
 ('Safety Champion','Default - requires organizational validation. For outstanding safety behaviour.'),
 ('Customer Hero','Default - requires organizational validation. For exceptional customer service.'),
 ('Team Player','Default - requires organizational validation. For helping the team succeed.');

create table public.recognition_nominations (
  id uuid primary key default gen_random_uuid(),
  nominator_id uuid not null references public.employees(id) on delete restrict,
  recipient_id uuid not null references public.employees(id) on delete restrict,
  category_id uuid not null references public.recognition_categories(id) on delete restrict,
  message text not null check (length(message) between 1 and 4000),
  supporting_info text check (length(supporting_info) <= 4000),
  status text not null default 'submitted' check (status in ('submitted','approved','rejected')),
  reviewer_id uuid, reviewed_at timestamptz, review_comments text check (length(review_comments) <= 4000),
  visibility text not null default 'company' check (visibility in ('company','department')),
  show_nominator boolean not null default true,
  version int not null default 1,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid,
  check (nominator_id <> recipient_id)
);
create index on public.recognition_nominations(status);
create index on public.recognition_nominations(recipient_id);

create table public.recognition_reviews (
  id uuid primary key default gen_random_uuid(),
  nomination_id uuid not null references public.recognition_nominations(id) on delete cascade,
  reviewer_id uuid not null,
  decision text not null check (decision in ('approve','reject')),
  comments text check (length(comments) <= 4000),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid
);

create table public.recognition_publications (
  id uuid primary key default gen_random_uuid(),
  nomination_id uuid not null unique references public.recognition_nominations(id) on delete cascade,
  visibility text not null check (visibility in ('company','department')),
  published_by uuid,
  published_at timestamptz not null default now(),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid
);

grant select on public.readiness_classes, public.succession_access_grants, public.critical_positions,
  public.succession_candidates, public.succession_readiness_assessments, public.succession_development_activities,
  public.recognition_categories, public.recognition_nominations, public.recognition_reviews,
  public.recognition_publications to authenticated;
grant all on public.readiness_classes, public.succession_access_grants, public.critical_positions,
  public.succession_candidates, public.succession_readiness_assessments, public.succession_development_activities,
  public.recognition_categories, public.recognition_nominations, public.recognition_reviews,
  public.recognition_publications to service_role;

do $$ declare t text; begin
  foreach t in array array['readiness_classes','succession_access_grants','critical_positions','succession_candidates',
    'succession_readiness_assessments','succession_development_activities','recognition_categories',
    'recognition_nominations','recognition_reviews','recognition_publications'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create trigger touch before update on public.%I for each row execute function public.tg_touch()', t);
    execute format('create trigger audit after insert or update or delete on public.%I for each row execute function public.tg_audit()', t);
  end loop;
end $$;

create or replace function public.can_view_succession(_dept uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select public.has_perm('succession.manage') or exists(
    select 1 from public.succession_access_grants g where g.user_id=auth.uid() and g.department_id=_dept)
$$;

create policy "readiness readable" on public.readiness_classes for select to authenticated using (auth.uid() is not null);
create policy "grants scoped" on public.succession_access_grants for select to authenticated
  using (public.has_perm('succession.manage') or user_id=auth.uid());
create policy "critical positions restricted" on public.critical_positions for select to authenticated
  using (public.can_view_succession(department_id));
create policy "candidates restricted" on public.succession_candidates for select to authenticated
  using (exists(select 1 from public.critical_positions cp where cp.id=critical_position_id and public.can_view_succession(cp.department_id)));
create policy "readiness restricted" on public.succession_readiness_assessments for select to authenticated
  using (exists(select 1 from public.succession_candidates sc join public.critical_positions cp on cp.id=sc.critical_position_id
    where sc.id=candidate_id and public.can_view_succession(cp.department_id)));
create policy "activities restricted" on public.succession_development_activities for select to authenticated
  using (exists(select 1 from public.succession_candidates sc join public.critical_positions cp on cp.id=sc.critical_position_id
    where sc.id=candidate_id and public.can_view_succession(cp.department_id)));
create policy "categories readable" on public.recognition_categories for select to authenticated using (auth.uid() is not null);
create policy "nominations scoped" on public.recognition_nominations for select to authenticated
  using (nominator_id=public.my_employee_id() or recipient_id=public.my_employee_id() or public.has_perm('recognition.review'));
create policy "reviews scoped" on public.recognition_reviews for select to authenticated
  using (public.has_perm('recognition.review') or exists(select 1 from public.recognition_nominations n
    where n.id=nomination_id and n.nominator_id=public.my_employee_id()));
create policy "feed by visibility" on public.recognition_publications for select to authenticated
  using (visibility='company' or public.has_perm('recognition.review') or exists(
    select 1 from public.recognition_nominations n join public.employees e on e.id=n.recipient_id
    where n.id=nomination_id and e.department_id=(select department_id from public.employees where id=public.my_employee_id())));

create or replace function public.upsert_critical_position(_id uuid, _d jsonb, _version int) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.critical_positions;
begin
  if not public.has_perm('succession.manage') then raise exception 'FORBIDDEN'; end if;
  if _id is null then
    insert into public.critical_positions(position_id,department_id,criticality,business_impact,incumbent_employee_id,status,review_date)
    values ((_d->>'position_id')::uuid,(_d->>'department_id')::uuid,coalesce(_d->>'criticality','medium'),
      nullif(_d->>'business_impact',''),nullif(_d->>'incumbent_employee_id','')::uuid,coalesce(_d->>'status','active'),
      nullif(_d->>'review_date','')::date) returning * into r;
  else
    update public.critical_positions set position_id=(_d->>'position_id')::uuid,department_id=(_d->>'department_id')::uuid,
      criticality=coalesce(_d->>'criticality',criticality),business_impact=nullif(_d->>'business_impact',''),
      incumbent_employee_id=nullif(_d->>'incumbent_employee_id','')::uuid,status=coalesce(_d->>'status',status),
      review_date=nullif(_d->>'review_date','')::date
    where id=_id and version=_version returning * into r;
    if not found then
      if exists(select 1 from public.critical_positions where id=_id) then raise exception 'CONFLICT: this record was changed by someone else'; end if;
      raise exception 'NOT_FOUND';
    end if;
  end if;
  return to_jsonb(r);
end $$;

create or replace function public._assert_succession_write(_dept uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not public.can_view_succession(_dept) then raise exception 'FORBIDDEN'; end if;
end $$;

create or replace function public.upsert_succession_candidate(_id uuid, _d jsonb, _version int) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.succession_candidates; cp public.critical_positions;
begin
  select * into cp from public.critical_positions where id=coalesce((_d->>'critical_position_id')::uuid,(select critical_position_id from public.succession_candidates where id=_id));
  if not found then raise exception 'NOT_FOUND'; end if;
  perform public._assert_succession_write(cp.department_id);
  if _id is null then
    insert into public.succession_candidates(critical_position_id,employee_id,readiness_class_id,notes)
    values (cp.id,(_d->>'employee_id')::uuid,nullif(_d->>'readiness_class_id','')::uuid,nullif(_d->>'notes','')) returning * into r;
  else
    update public.succession_candidates set readiness_class_id=nullif(_d->>'readiness_class_id','')::uuid,
      notes=nullif(_d->>'notes',''),status=coalesce(_d->>'status',status)
    where id=_id and version=_version returning * into r;
    if not found then
      if exists(select 1 from public.succession_candidates where id=_id) then raise exception 'CONFLICT: this record was changed by someone else'; end if;
      raise exception 'NOT_FOUND';
    end if;
  end if;
  return to_jsonb(r);
end $$;

create or replace function public.save_readiness_assessment(_candidate uuid, _summary text, _class uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.succession_readiness_assessments; cp public.critical_positions;
begin
  select p.* into cp from public.succession_candidates sc join public.critical_positions p on p.id=sc.critical_position_id where sc.id=_candidate;
  if not found then raise exception 'NOT_FOUND'; end if;
  perform public._assert_succession_write(cp.department_id);
  insert into public.succession_readiness_assessments(candidate_id,assessor_id,summary,readiness_class_id)
  values (_candidate,public.my_employee_id(),_summary,_class) returning * into r;
  if _class is not null then
    update public.succession_candidates set readiness_class_id=_class, updated_by=auth.uid() where id=_candidate;
  end if;
  return to_jsonb(r);
end $$;

create or replace function public.save_succession_activity(_id uuid, _candidate uuid, _d jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.succession_development_activities; cp public.critical_positions;
begin
  select p.* into cp from public.succession_candidates sc join public.critical_positions p on p.id=sc.critical_position_id
  where sc.id=coalesce(_candidate,(select candidate_id from public.succession_development_activities where id=_id));
  if not found then raise exception 'NOT_FOUND'; end if;
  perform public._assert_succession_write(cp.department_id);
  if _id is null then
    insert into public.succession_development_activities(candidate_id,title,description,status,target_date)
    values (_candidate,_d->>'title',nullif(_d->>'description',''),coalesce(_d->>'status','planned'),nullif(_d->>'target_date','')::date)
    returning * into r;
  else
    update public.succession_development_activities set title=_d->>'title',description=nullif(_d->>'description',''),
      status=coalesce(_d->>'status',status),target_date=nullif(_d->>'target_date','')::date
    where id=_id returning * into r;
    if not found then raise exception 'NOT_FOUND'; end if;
  end if;
  return to_jsonb(r);
end $$;

create or replace function public.grant_succession_access(_user uuid, _department uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.succession_access_grants;
begin
  if not public.has_perm('succession.manage') then raise exception 'FORBIDDEN'; end if;
  if not exists(select 1 from public.user_roles where user_id=_user and role='dept_head') then
    raise exception 'RULE: succession access can only be granted to Department Head accounts'; end if;
  insert into public.succession_access_grants(department_id,user_id) values (_department,_user)
  on conflict (department_id,user_id) do nothing returning * into r;
  if not found then select * into r from public.succession_access_grants where department_id=_department and user_id=_user; end if;
  perform public._notify(_user,'Succession access granted','You can now view succession records for your department.','/succession');
  return to_jsonb(r);
end $$;

create or replace function public.revoke_succession_access(_grant uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
begin
  if not public.has_perm('succession.manage') then raise exception 'FORBIDDEN'; end if;
  delete from public.succession_access_grants where id=_grant;
  if not found then raise exception 'NOT_FOUND'; end if;
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.upsert_readiness_class(_id uuid, _d jsonb, _version int) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.readiness_classes;
begin
  if not (public.has_perm('succession.manage') or public.has_perm('admin.settings')) then raise exception 'FORBIDDEN'; end if;
  if _id is null then
    insert into public.readiness_classes(code,label,description,sort_order)
    values (_d->>'code',_d->>'label',nullif(_d->>'description',''),coalesce((_d->>'sort_order')::int,0)) returning * into r;
  else
    update public.readiness_classes set code=_d->>'code',label=_d->>'label',description=nullif(_d->>'description',''),
      sort_order=coalesce((_d->>'sort_order')::int,sort_order)
    where id=_id and version=_version returning * into r;
    if not found then
      if exists(select 1 from public.readiness_classes where id=_id) then raise exception 'CONFLICT: this record was changed by someone else'; end if;
      raise exception 'NOT_FOUND';
    end if;
  end if;
  return to_jsonb(r);
end $$;

create or replace function public.log_succession_view(_record_type text, _record uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  perform public.log_audit('succession_view', left(_record_type,60), _record, '{}'::jsonb);
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.upsert_recognition_category(_id uuid, _d jsonb, _version int) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.recognition_categories;
begin
  if not (public.has_perm('recognition.review') or public.has_perm('admin.settings')) then raise exception 'FORBIDDEN'; end if;
  if _id is null then
    insert into public.recognition_categories(name,description) values (_d->>'name',nullif(_d->>'description','')) returning * into r;
  else
    update public.recognition_categories set name=_d->>'name',description=nullif(_d->>'description',''),
      active=coalesce((_d->>'active')::boolean,active)
    where id=_id and version=_version returning * into r;
    if not found then
      if exists(select 1 from public.recognition_categories where id=_id) then raise exception 'CONFLICT: this record was changed by someone else'; end if;
      raise exception 'NOT_FOUND';
    end if;
  end if;
  return to_jsonb(r);
end $$;

create or replace function public.submit_nomination(_recipient uuid, _category uuid, _message text, _supporting text, _idem uuid, _hash text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare me uuid; r public.recognition_nominations; resp jsonb; min_len int; max_month int; n int;
begin
  me := public.my_employee_id();
  if me is null then raise exception 'FORBIDDEN: your account is not linked to an employee record'; end if;
  resp := public._idem_get(_idem,'submit_nomination',_hash);
  if resp is not null then return resp; end if;
  if _recipient = me then raise exception 'RULE: you cannot nominate yourself'; end if;
  if not exists(select 1 from public.employees where id=_recipient and employment_status='active') then
    raise exception 'RULE: the recipient must be an active employee'; end if;
  if not exists(select 1 from public.recognition_categories where id=_category and active) then
    raise exception 'INVALID: unknown or inactive category'; end if;
  select coalesce((value#>>'{}')::int,20) into min_len from public.system_settings where key='recognition.min_message_length';
  if length(trim(_message)) < coalesce(min_len,20) then
    raise exception 'INVALID: the message is too short (minimum % characters)', coalesce(min_len,20); end if;
  select coalesce((value#>>'{}')::int,5) into max_month from public.system_settings where key='recognition.max_nominations_per_month';
  select count(*) into n from public.recognition_nominations
  where nominator_id=me and created_at >= date_trunc('month', now());
  if n >= coalesce(max_month,5) then raise exception 'RULE: you have reached the monthly nomination limit'; end if;
  insert into public.recognition_nominations(nominator_id,recipient_id,category_id,message,supporting_info)
  values (me,_recipient,_category,trim(_message),nullif(_supporting,'')) returning * into r;
  insert into public.approval_tasks(workflow_type,record_id,record_label,employee_id,submitted_by,assignee_role)
  values ('recognition_nomination',r.id,'Recognition nomination',_recipient,auth.uid(),'hr_admin');
  perform public._notify_role('hr_admin','Recognition nomination to review','A nomination is waiting for review.','/recognition/queue');
  return public._idem_put(_idem,'submit_nomination',_hash,jsonb_build_object('id',r.id,'status',r.status));
end $$;

create or replace function public.review_nomination(_id uuid, _decision text, _comments text, _visibility text, _show_nominator boolean, _idem uuid, _hash text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.recognition_nominations; resp jsonb;
begin
  if not public.has_perm('recognition.review') then raise exception 'FORBIDDEN'; end if;
  if _decision not in ('approve','reject') then raise exception 'INVALID: decision must be approve or reject'; end if;
  if _visibility not in ('company','department') then raise exception 'INVALID: visibility must be company or department'; end if;
  resp := public._idem_get(_idem,'review_nomination',_hash);
  if resp is not null then return resp; end if;
  select * into r from public.recognition_nominations where id=_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  if r.created_by = auth.uid() then raise exception 'RULE: you cannot review your own nomination'; end if;
  perform public.assert_transition('nomination',r.status,case when _decision='approve' then 'approved' else 'rejected' end);
  update public.recognition_nominations set status=case when _decision='approve' then 'approved' else 'rejected' end,
    reviewer_id=auth.uid(), reviewed_at=now(), review_comments=nullif(_comments,''),
    visibility=_visibility, show_nominator=coalesce(_show_nominator,true), updated_by=auth.uid()
  where id=_id;
  insert into public.recognition_reviews(nomination_id,reviewer_id,decision,comments)
  values (_id,auth.uid(),_decision,nullif(_comments,''));
  update public.approval_tasks set status=case when _decision='approve' then 'approved' else 'rejected' end,
    decided_by=auth.uid(), decided_at=now(), comments=nullif(_comments,'')
  where workflow_type='recognition_nomination' and record_id=_id and status='pending';
  if _decision='approve' then
    insert into public.recognition_publications(nomination_id,visibility,published_by) values (_id,_visibility,auth.uid())
    on conflict (nomination_id) do nothing;
  end if;
  perform public._notify((select user_id from public.employees where id=r.nominator_id),
    'Your nomination was '||case when _decision='approve' then 'approved' else 'not approved' end,
    case when coalesce(_comments,'')<>'' then _comments else null end,'/recognition/my');
  if _decision='approve' then
    perform public._notify((select user_id from public.employees where id=r.recipient_id),
      'You were recognized','Your work was recognized. See the recognition feed.','/recognition','success');
  end if;
  return public._idem_put(_idem,'review_nomination',_hash,jsonb_build_object('id',_id,'decision',_decision));
end $$;

create or replace function public.report_data(_kind text, _from date default null, _to date default null, _department uuid default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb; me uuid := public.my_employee_id(); full_access boolean;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  full_access := public.has_perm('reports.hr');
  if _kind = 'performance' then
    if not (full_access or public.has_perm('perf.evaluate') or public.has_perm('perf.manage')) then raise exception 'FORBIDDEN'; end if;
    select jsonb_build_object('total',count(*),'approved',count(*) filter (where a.status='approved'),
      'submitted',count(*) filter (where a.status in ('submitted','under_review')),
      'avg_score',round(avg(a.overall_score) filter (where a.overall_score is not null),1))
    into result from public.evaluation_assignments a join public.employees e on e.id=a.employee_id
    where (a.created_at::date between coalesce(_from,'1970-01-01') and coalesce(_to,'2100-01-01'))
      and (_department is null or e.department_id=_department)
      and (full_access or public.is_dept_head_of(e.id) or public.is_supervisor_of(e.id) or e.id=me);
  elsif _kind = 'gaps' then
    if not (full_access or public.has_perm('comp.view_all') or public.has_perm('comp.manage') or public.has_perm('team.view')) then raise exception 'FORBIDDEN'; end if;
    select jsonb_build_object('rows',count(*),'gaps',count(*) filter (where g.gap_status='gap'),
      'not_assessed',count(*) filter (where g.gap_status='not_assessed'),
      'mandatory_gaps',count(*) filter (where g.gap_status='gap' and g.is_mandatory),
      'safety_gaps',count(*) filter (where g.gap_status='gap' and g.is_safety_critical))
    into result from public.competency_gaps(null,_department,null,null,null,10000,0) g
    where full_access or public.can_view_comp(g.employee_id);
  elsif _kind = 'learning' then
    if not (full_access or public.can_manage_learning() or public.has_perm('team.view')) then raise exception 'FORBIDDEN'; end if;
    select jsonb_build_object('enrollments',count(*),'completed',count(*) filter (where en.status='completed'),
      'in_progress',count(*) filter (where en.status='in_progress'))
    into result from public.course_enrollments en join public.employees e on e.id=en.employee_id
    where (_department is null or e.department_id=_department)
      and (full_access or public.can_manage_learning() or public.is_supervisor_of(e.id) or public.is_dept_head_of(e.id) or e.id=me);
  elsif _kind = 'training' then
    if not (full_access or public.can_manage_training() or public.has_perm('team.view')) then raise exception 'FORBIDDEN'; end if;
    select jsonb_build_object('sessions',count(distinct s.id) filter (where s.status='completed'),
      'participants',count(tp.id),'attended',count(tp.id) filter (where tp.status='attended'),
      'passed',count(tr.id) filter (where tr.outcome='passed'))
    into result from public.training_sessions s
    left join public.training_participants tp on tp.session_id=s.id
    left join public.training_results tr on tr.session_id=s.id and tr.employee_id=tp.employee_id
    where (s.starts_at::date between coalesce(_from,'1970-01-01') and coalesce(_to,'2100-01-01'));
  elsif _kind = 'recognition' then
    select jsonb_build_object('nominations',count(*),'approved',count(*) filter (where n.status='approved'),
      'pending',count(*) filter (where n.status='submitted'))
    into result from public.recognition_nominations n join public.employees e on e.id=n.recipient_id
    where (n.created_at::date between coalesce(_from,'1970-01-01') and coalesce(_to,'2100-01-01'))
      and (_department is null or e.department_id=_department)
      and (full_access or public.has_perm('recognition.review') or e.department_id=(select department_id from public.employees where id=me));
  elsif _kind = 'succession' then
    if not public.has_perm('succession.manage') then raise exception 'FORBIDDEN'; end if;
    select jsonb_build_object('critical_positions',count(*) filter (where cp.status<>'closed'),
      'with_candidates',count(*) filter (where cp.status<>'closed' and exists(select 1 from public.succession_candidates sc where sc.critical_position_id=cp.id and sc.status='active')),
      'uncovered',count(*) filter (where cp.status<>'closed' and not exists(select 1 from public.succession_candidates sc where sc.critical_position_id=cp.id and sc.status='active')))
    into result from public.critical_positions cp
    where (_department is null or cp.department_id=_department);
  else
    raise exception 'INVALID: unknown report kind';
  end if;
  perform public.log_audit('report_view','report:'||_kind,null,jsonb_build_object('from',_from,'to',_to,'department',_department));
  return coalesce(result,'{}'::jsonb);
end $$;

do $$ declare f record; begin
  for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated, service_role', f.sig);
  end loop;
end $$;
revoke execute on function public.process_outbox(int) from authenticated;
