-- Performance and competency tables, workflow functions, score logic and permission helpers.


-- ============ COMPETENCY ============
create table public.competency_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(name) between 2 and 80),
  description text check (length(description) <= 1000),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid
);

create table public.proficiency_levels (
  id uuid primary key default gen_random_uuid(),
  level int not null unique check (level between 1 and 5),
  label text not null check (length(label) between 2 and 60),
  description text not null check (length(description) <= 1000),
  requires_validation boolean not null default true,
  version int not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid
);

create table public.competencies (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (length(code) between 1 and 20),
  name text not null check (length(name) between 2 and 120),
  description text check (length(description) <= 2000),
  definition text check (length(definition) <= 4000),
  category_id uuid not null references public.competency_categories(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft','active','retired')),
  is_mandatory boolean not null default false,
  is_safety_critical boolean not null default false,
  version int not null default 1,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid
);
create index on public.competencies(category_id);
create index on public.competencies(status);

create table public.behavioral_indicators (
  id uuid primary key default gen_random_uuid(),
  competency_id uuid not null references public.competencies(id) on delete cascade,
  level int not null check (level between 1 and 5),
  indicator text not null check (length(indicator) between 2 and 1000),
  sort_order int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid
);
create index on public.behavioral_indicators(competency_id, level);

create table public.position_competency_requirements (
  id uuid primary key default gen_random_uuid(),
  position_id uuid not null references public.positions(id) on delete restrict,
  competency_id uuid not null references public.competencies(id) on delete restrict,
  required_level int not null check (required_level between 1 and 5),
  is_mandatory boolean not null default false,
  is_safety_critical boolean not null default false,
  effective_from date not null default current_date,
  effective_to date,
  is_current boolean not null default true,
  change_reason text check (length(change_reason) <= 1000),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid,
  check (effective_to is null or effective_to >= effective_from)
);
create unique index pcr_one_current on public.position_competency_requirements(position_id, competency_id) where is_current;
create index on public.position_competency_requirements(competency_id);

-- ============ PERFORMANCE ============
create table public.evaluation_cycles (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 3 and 120),
  description text check (length(description) <= 2000),
  period_start date not null,
  period_end date not null,
  due_date date,
  self_evaluation boolean not null default true,
  status text not null default 'draft' check (status in ('draft','open','closed')),
  version int not null default 1,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid,
  check (period_end >= period_start)
);

create table public.evaluation_profiles (
  id uuid primary key default gen_random_uuid(),
  position_id uuid not null references public.positions(id) on delete restrict,
  name text not null check (length(name) between 3 and 120),
  description text check (length(description) <= 2000),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid
);
create index on public.evaluation_profiles(position_id);

create table public.evaluation_profile_versions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.evaluation_profiles(id) on delete restrict,
  position_id uuid not null references public.positions(id) on delete restrict,
  version_number int not null check (version_number >= 1),
  status text not null default 'draft' check (status in ('draft','active','archived')),
  effective_date date,
  rating_scale_max int not null default 5 check (rating_scale_max between 3 and 10),
  instructions text check (length(instructions) <= 4000),
  activated_at timestamptz, activated_by uuid,
  version int not null default 1,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid,
  unique (profile_id, version_number)
);
create unique index epv_one_active_per_position on public.evaluation_profile_versions(position_id) where status='active';
create index on public.evaluation_profile_versions(profile_id);

create table public.evaluation_sections (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.evaluation_profile_versions(id) on delete cascade,
  title text not null check (length(title) between 1 and 160),
  description text check (length(description) <= 2000),
  sort_order int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid
);
create index on public.evaluation_sections(version_id);

create table public.evaluation_items (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.evaluation_profile_versions(id) on delete cascade,
  section_id uuid not null references public.evaluation_sections(id) on delete cascade,
  label text not null check (length(label) between 1 and 300),
  help_text text check (length(help_text) <= 2000),
  item_type text not null check (item_type in ('rating','short_text','long_text','single_choice','multi_choice','yes_no','kpi')),
  weight numeric(5,2) not null default 0 check (weight between 0 and 100),
  options jsonb not null default '[]'::jsonb,
  kpi_target numeric,
  kpi_unit text check (length(kpi_unit) <= 30),
  competency_id uuid references public.competencies(id) on delete restrict,
  evidence_required boolean not null default false,
  is_required boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid,
  check (item_type in ('rating','kpi') or weight = 0),
  check (item_type <> 'kpi' or kpi_target is not null)
);
create index on public.evaluation_items(version_id);
create index on public.evaluation_items(section_id);
create index on public.evaluation_items(competency_id);

create table public.evaluation_assignments (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.evaluation_cycles(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  evaluator_id uuid not null references public.employees(id) on delete restrict,
  profile_version_id uuid not null references public.evaluation_profile_versions(id) on delete restrict,
  snapshot jsonb not null,
  self_evaluation boolean not null default true,
  status text not null default 'not_started' check (status in ('not_started','in_progress','submitted','under_review','approved','reopened')),
  self_submitted_at timestamptz,
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid,
  overall_score numeric(5,2) check (overall_score between 0 and 100),
  overall_comment text check (length(overall_comment) <= 8000),
  reopen_reason text check (length(reopen_reason) <= 2000),
  version int not null default 1,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid,
  unique (cycle_id, employee_id),
  check (employee_id <> evaluator_id)
);
create index on public.evaluation_assignments(employee_id);
create index on public.evaluation_assignments(evaluator_id);
create index on public.evaluation_assignments(profile_version_id);
create index on public.evaluation_assignments(status);

create table public.evaluation_responses (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.evaluation_assignments(id) on delete restrict,
  item_id uuid not null,
  respondent text not null check (respondent in ('self','evaluator')),
  rating numeric check (rating between 0 and 10),
  text_value text check (length(text_value) <= 8000),
  choice_values jsonb,
  kpi_actual numeric,
  comment text check (length(comment) <= 4000),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid,
  unique (assignment_id, item_id, respondent)
);
create index on public.evaluation_responses(assignment_id);

create table public.evaluation_evidence (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.evaluation_assignments(id) on delete restrict,
  file_id uuid references public.file_metadata(id) on delete restrict,
  item_id uuid,
  note text check (length(note) <= 2000),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid,
  check (file_id is not null or note is not null)
);
create index on public.evaluation_evidence(assignment_id);
create index on public.evaluation_evidence(file_id);

create table public.evaluation_reviews (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.evaluation_assignments(id) on delete restrict,
  reviewer_id uuid not null default auth.uid(),
  decision text not null check (decision in ('approved','returned','reopened','comment')),
  comments text check (length(comments) <= 4000),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid
);
create index on public.evaluation_reviews(assignment_id);

-- ============ ASSESSMENTS ============
create table public.competency_assessments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  competency_id uuid not null references public.competencies(id) on delete restrict,
  assessor_id uuid not null default auth.uid(),
  cycle_id uuid references public.evaluation_cycles(id) on delete restrict,
  assessment_date date not null default current_date,
  current_level int check (current_level between 1 and 5),
  evidence_summary text check (length(evidence_summary) <= 4000),
  comments text check (length(comments) <= 4000),
  is_reassessment boolean not null default false,
  status text not null default 'draft' check (status in ('draft','submitted','approved','rejected')),
  reviewer_id uuid,
  reviewed_at timestamptz,
  review_comments text check (length(review_comments) <= 4000),
  version int not null default 1,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid
);
create unique index ca_one_open on public.competency_assessments(employee_id, competency_id, coalesce(cycle_id,'00000000-0000-0000-0000-000000000000'::uuid)) where status in ('draft','submitted');
create index on public.competency_assessments(employee_id, competency_id, status);
create index on public.competency_assessments(competency_id);
create index on public.competency_assessments(cycle_id);

create table public.competency_assessment_evidence (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.competency_assessments(id) on delete restrict,
  file_id uuid references public.file_metadata(id) on delete restrict,
  note text check (length(note) <= 2000),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid,
  check (file_id is not null or note is not null)
);
create index on public.competency_assessment_evidence(assessment_id);
create index on public.competency_assessment_evidence(file_id);

create table public.competency_gap_snapshots (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  competency_id uuid not null references public.competencies(id) on delete restrict,
  position_id uuid not null references public.positions(id) on delete restrict,
  required_level int not null,
  current_level int,
  gap int,
  gap_status text not null check (gap_status in ('not_assessed','met','gap')),
  is_mandatory boolean not null,
  is_safety_critical boolean not null,
  assessment_id uuid references public.competency_assessments(id) on delete restrict,
  snapshot_at timestamptz not null default now(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid
);
create index on public.competency_gap_snapshots(employee_id, snapshot_at desc);
create index on public.competency_gap_snapshots(competency_id);

-- grants / RLS
grant select on public.competency_categories, public.proficiency_levels, public.competencies, public.behavioral_indicators,
  public.position_competency_requirements, public.evaluation_cycles, public.evaluation_profiles, public.evaluation_profile_versions,
  public.evaluation_sections, public.evaluation_items, public.evaluation_assignments, public.evaluation_responses,
  public.evaluation_evidence, public.evaluation_reviews, public.competency_assessments, public.competency_assessment_evidence,
  public.competency_gap_snapshots to authenticated;
grant all on public.competency_categories, public.proficiency_levels, public.competencies, public.behavioral_indicators,
  public.position_competency_requirements, public.evaluation_cycles, public.evaluation_profiles, public.evaluation_profile_versions,
  public.evaluation_sections, public.evaluation_items, public.evaluation_assignments, public.evaluation_responses,
  public.evaluation_evidence, public.evaluation_reviews, public.competency_assessments, public.competency_assessment_evidence,
  public.competency_gap_snapshots to service_role;

do $$ declare t text; begin
  foreach t in array array['competency_categories','proficiency_levels','competencies','behavioral_indicators','position_competency_requirements','evaluation_cycles','evaluation_profiles','evaluation_profile_versions','evaluation_sections','evaluation_items','evaluation_assignments','evaluation_responses','evaluation_evidence','evaluation_reviews','competency_assessments','competency_assessment_evidence','competency_gap_snapshots'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create trigger touch before update on public.%I for each row execute function public.tg_touch()', t);
  end loop;
  foreach t in array array['competency_categories','proficiency_levels','competencies','behavioral_indicators','position_competency_requirements','evaluation_cycles','evaluation_profiles','evaluation_profile_versions','evaluation_items','evaluation_assignments','evaluation_reviews','competency_assessments','competency_assessment_evidence','evaluation_evidence'] loop
    execute format('create trigger audit after insert or update or delete on public.%I for each row execute function public.tg_audit()', t);
  end loop;
end $$;

-- library / config readable by all signed-in users
create policy "read" on public.competency_categories for select to authenticated using (auth.uid() is not null);
create policy "read" on public.proficiency_levels for select to authenticated using (auth.uid() is not null);
create policy "read" on public.competencies for select to authenticated using (status='active' or public.has_perm('comp.manage'));
create policy "read" on public.behavioral_indicators for select to authenticated using (auth.uid() is not null);
create policy "read" on public.position_competency_requirements for select to authenticated using (auth.uid() is not null);
create policy "read" on public.evaluation_cycles for select to authenticated using (auth.uid() is not null);
create policy "read" on public.evaluation_profiles for select to authenticated using (public.has_perm('perf.manage') or public.has_perm('perf.evaluate'));
create policy "read" on public.evaluation_profile_versions for select to authenticated using (public.has_perm('perf.manage') or public.has_perm('perf.evaluate'));
create policy "read" on public.evaluation_sections for select to authenticated using (public.has_perm('perf.manage') or public.has_perm('perf.evaluate'));
create policy "read" on public.evaluation_items for select to authenticated using (public.has_perm('perf.manage') or public.has_perm('perf.evaluate'));
-- employee-scoped
create policy "scoped" on public.evaluation_assignments for select to authenticated
  using (public.can_view_perf(employee_id) or evaluator_id = public.my_employee_id());
create policy "scoped" on public.evaluation_responses for select to authenticated
  using (exists (select 1 from public.evaluation_assignments a where a.id=assignment_id and (public.can_view_perf(a.employee_id) or a.evaluator_id=public.my_employee_id())));
create policy "scoped" on public.evaluation_evidence for select to authenticated
  using (exists (select 1 from public.evaluation_assignments a where a.id=assignment_id and (public.can_view_perf(a.employee_id) or a.evaluator_id=public.my_employee_id())));
create policy "scoped" on public.evaluation_reviews for select to authenticated
  using (exists (select 1 from public.evaluation_assignments a where a.id=assignment_id and (public.can_view_perf(a.employee_id) or a.evaluator_id=public.my_employee_id())));
create policy "scoped" on public.competency_assessments for select to authenticated
  using (public.can_view_comp(employee_id) or assessor_id = auth.uid());
create policy "scoped" on public.competency_assessment_evidence for select to authenticated
  using (exists (select 1 from public.competency_assessments a where a.id=assessment_id and (public.can_view_comp(a.employee_id) or a.assessor_id=auth.uid())));
create policy "scoped" on public.competency_gap_snapshots for select to authenticated using (public.can_view_comp(employee_id));

-- immutability of non-draft profile content
create or replace function public.tg_profile_content_locked() returns trigger language plpgsql set search_path=public as $$
declare st text;
begin
  select status into st from public.evaluation_profile_versions where id = coalesce(new.version_id, old.version_id);
  if st is not null and st <> 'draft' then
    raise exception 'RULE: only draft profile versions can be edited; create a new version instead';
  end if;
  return coalesce(new, old);
end $$;
create trigger lock_sections before insert or update or delete on public.evaluation_sections for each row execute function public.tg_profile_content_locked();
create trigger lock_items before insert or update or delete on public.evaluation_items for each row execute function public.tg_profile_content_locked();

-- snapshot is immutable once created
create or replace function public.tg_snapshot_immutable() returns trigger language plpgsql as $$
begin
  if new.snapshot is distinct from old.snapshot or new.profile_version_id is distinct from old.profile_version_id then
    raise exception 'RULE: the evaluation profile snapshot cannot be changed';
  end if;
  return new;
end $$;
create trigger snapshot_immutable before update on public.evaluation_assignments for each row execute function public.tg_snapshot_immutable();

insert into public.proficiency_levels(level,label,description) values
 (1,'Awareness','Default - requires organizational validation. Basic awareness; needs close guidance.'),
 (2,'Developing','Default - requires organizational validation. Applies with support in routine situations.'),
 (3,'Proficient','Default - requires organizational validation. Applies independently in most situations.'),
 (4,'Advanced','Default - requires organizational validation. Handles complex situations and guides others.'),
 (5,'Expert','Default - requires organizational validation. Recognised authority; shapes practice.');


-- ================= ADMIN =================
create or replace function public.admin_set_role(_user uuid, _role public.app_role) returns jsonb
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.has_perm('admin.users') then raise exception 'FORBIDDEN: you cannot manage user roles'; end if;
  if _role in ('super_admin','admin') and not public.has_perm('admin.roles') then raise exception 'FORBIDDEN: only a Super Admin can grant administrative roles'; end if;
  if _user = auth.uid() then raise exception 'RULE: you cannot change your own role'; end if;
  if not exists(select 1 from public.profiles where id=_user) then raise exception 'NOT_FOUND'; end if;
  if exists(select 1 from public.user_roles where user_id=_user and role in ('super_admin','admin')) and not public.has_perm('admin.roles') then
    raise exception 'FORBIDDEN: only a Super Admin can change an administrator'; end if;
  insert into public.user_roles(user_id, role) values (_user,_role) on conflict (user_id) do update set role=excluded.role;
  perform public._notify(_user,'Your role was updated','Your account role is now '||_role,'/dashboard');
  return jsonb_build_object('user_id',_user,'role',_role);
end $$;

create or replace function public.admin_set_active(_user uuid, _active boolean) returns jsonb
language plpgsql security definer set search_path=public as $$
begin
  if not public.has_perm('admin.users') then raise exception 'FORBIDDEN'; end if;
  if _user = auth.uid() then raise exception 'RULE: you cannot deactivate your own account'; end if;
  update public.profiles set is_active=_active where id=_user;
  if not found then raise exception 'NOT_FOUND'; end if;
  perform public.log_audit(case when _active then 'activate_user' else 'deactivate_user' end,'profiles',_user,jsonb_build_object('is_active',_active));
  return jsonb_build_object('user_id',_user,'is_active',_active);
end $$;

create or replace function public.admin_link_employee(_user uuid, _employee uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
begin
  if not public.has_perm('admin.users') then raise exception 'FORBIDDEN'; end if;
  update public.employees set user_id=null where user_id=_user and (_employee is null or id<>_employee);
  if _employee is not null then
    update public.employees set user_id=_user where id=_employee;
    if not found then raise exception 'NOT_FOUND'; end if;
  end if;
  return jsonb_build_object('user_id',_user,'employee_id',_employee);
end $$;

-- ================= ORGANIZATION =================
create or replace function public.upsert_department(_id uuid, _code text, _name text, _parent uuid, _head uuid, _status text, _version int) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.departments;
begin
  if not public.has_perm('admin.org') then raise exception 'FORBIDDEN'; end if;
  if _parent is not null and _parent = _id then raise exception 'RULE: a department cannot be its own parent'; end if;
  if _id is null then
    insert into public.departments(code,name,parent_id,head_employee_id,status) values (_code,_name,_parent,_head,coalesce(_status,'active')) returning * into r;
  else
    update public.departments set code=_code,name=_name,parent_id=_parent,head_employee_id=_head,status=coalesce(_status,status)
      where id=_id and version=_version returning * into r;
    if not found then
      if exists(select 1 from public.departments where id=_id) then raise exception 'CONFLICT: this department was changed by someone else'; end if;
      raise exception 'NOT_FOUND';
    end if;
  end if;
  return to_jsonb(r);
end $$;

create or replace function public.upsert_position(_id uuid, _code text, _title text, _dept uuid, _desc text, _status text, _version int) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.positions;
begin
  if not (public.has_perm('admin.org') or public.has_perm('hr.employees')) then raise exception 'FORBIDDEN'; end if;
  if _id is null then
    insert into public.positions(code,title,department_id,description,status) values (_code,_title,_dept,_desc,coalesce(_status,'active')) returning * into r;
  else
    update public.positions set code=_code,title=_title,department_id=_dept,description=_desc,status=coalesce(_status,status)
      where id=_id and version=_version returning * into r;
    if not found then
      if exists(select 1 from public.positions where id=_id) then raise exception 'CONFLICT: this position was changed by someone else'; end if;
      raise exception 'NOT_FOUND';
    end if;
  end if;
  return to_jsonb(r);
end $$;

create or replace function public.upsert_employee(_id uuid, _d jsonb, _version int) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.employees;
begin
  if not (public.has_perm('hr.employees') or public.has_perm('admin.org')) then raise exception 'FORBIDDEN'; end if;
  if _id is null then
    insert into public.employees(employee_code,first_name,last_name,email,phone,department_id,position_id,employment_status,hire_date,job_notes)
    values (_d->>'employee_code',_d->>'first_name',_d->>'last_name',nullif(_d->>'email',''),nullif(_d->>'phone',''),(_d->>'department_id')::uuid,(_d->>'position_id')::uuid,
      coalesce(_d->>'employment_status','active'),nullif(_d->>'hire_date','')::date,nullif(_d->>'job_notes','')) returning * into r;
  else
    update public.employees set employee_code=_d->>'employee_code',first_name=_d->>'first_name',last_name=_d->>'last_name',
      email=nullif(_d->>'email',''),phone=nullif(_d->>'phone',''),department_id=(_d->>'department_id')::uuid,position_id=(_d->>'position_id')::uuid,
      employment_status=coalesce(_d->>'employment_status',employment_status),hire_date=nullif(_d->>'hire_date','')::date,job_notes=nullif(_d->>'job_notes','')
    where id=_id and version=_version returning * into r;
    if not found then
      if exists(select 1 from public.employees where id=_id) then raise exception 'CONFLICT: this employee record was changed by someone else'; end if;
      raise exception 'NOT_FOUND';
    end if;
  end if;
  return to_jsonb(r);
end $$;

-- employees may edit only their own phone
create or replace function public.update_my_contact(_phone text, _version int) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.employees;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if length(_phone) > 40 then raise exception 'INVALID: phone too long'; end if;
  update public.employees set phone=_phone where id=public.my_employee_id() and version=_version returning * into r;
  if not found then raise exception 'CONFLICT: your profile was changed elsewhere; reload and try again'; end if;
  return to_jsonb(r);
end $$;

create or replace function public.set_supervisor(_emp uuid, _sup uuid, _from date) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.reporting_relationships;
begin
  if not (public.has_perm('admin.org') or public.has_perm('hr.employees')) then raise exception 'FORBIDDEN'; end if;
  if _emp = _sup then raise exception 'RULE: an employee cannot supervise themselves'; end if;
  if exists (with recursive chain as (select supervisor_id s from public.reporting_relationships where employee_id=_sup and is_current
      union select r.supervisor_id from public.reporting_relationships r join chain c on r.employee_id=c.s where r.is_current) select 1 from chain where s=_emp) then
    raise exception 'RULE: this would create a circular reporting line';
  end if;
  update public.reporting_relationships set is_current=false, effective_to=greatest(effective_from, coalesce(_from,current_date)) where employee_id=_emp and is_current;
  if _sup is not null then
    insert into public.reporting_relationships(employee_id,supervisor_id,effective_from) values (_emp,_sup,coalesce(_from,current_date)) returning * into r;
  end if;
  return coalesce(to_jsonb(r),'{}'::jsonb);
end $$;

-- ================= PERFORMANCE =================
create or replace function public.upsert_cycle(_id uuid, _d jsonb, _version int) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.evaluation_cycles;
begin
  if not public.has_perm('perf.manage') then raise exception 'FORBIDDEN'; end if;
  if _id is null then
    insert into public.evaluation_cycles(name,description,period_start,period_end,due_date,self_evaluation)
    values (_d->>'name',nullif(_d->>'description',''),(_d->>'period_start')::date,(_d->>'period_end')::date,nullif(_d->>'due_date','')::date,coalesce((_d->>'self_evaluation')::boolean,true)) returning * into r;
  else
    update public.evaluation_cycles set name=_d->>'name',description=nullif(_d->>'description',''),period_start=(_d->>'period_start')::date,
      period_end=(_d->>'period_end')::date,due_date=nullif(_d->>'due_date','')::date,self_evaluation=coalesce((_d->>'self_evaluation')::boolean,self_evaluation)
    where id=_id and version=_version returning * into r;
    if not found then
      if exists(select 1 from public.evaluation_cycles where id=_id) then raise exception 'CONFLICT: this cycle was changed by someone else'; end if;
      raise exception 'NOT_FOUND';
    end if;
  end if;
  return to_jsonb(r);
end $$;

create or replace function public.set_cycle_status(_id uuid, _status text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare cur text; r public.evaluation_cycles;
begin
  if not public.has_perm('perf.manage') then raise exception 'FORBIDDEN'; end if;
  select status into cur from public.evaluation_cycles where id=_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  perform public.assert_transition('cycle',cur,_status);
  update public.evaluation_cycles set status=_status where id=_id returning * into r;
  return to_jsonb(r);
end $$;

create or replace function public.create_profile(_position uuid, _name text, _desc text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare p public.evaluation_profiles; v public.evaluation_profile_versions;
begin
  if not public.has_perm('perf.manage') then raise exception 'FORBIDDEN'; end if;
  insert into public.evaluation_profiles(position_id,name,description) values (_position,_name,_desc) returning * into p;
  insert into public.evaluation_profile_versions(profile_id,position_id,version_number) values (p.id,_position,1) returning * into v;
  return jsonb_build_object('profile',to_jsonb(p),'version',to_jsonb(v));
end $$;

create or replace function public.save_profile_version(_version_id uuid, _c jsonb, _expected int) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v public.evaluation_profile_versions; s jsonb; it jsonb; sid uuid; si int := 0; ii int;
begin
  if not public.has_perm('perf.manage') then raise exception 'FORBIDDEN'; end if;
  select * into v from public.evaluation_profile_versions where id=_version_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v.status <> 'draft' then raise exception 'RULE: only draft versions can be edited; create a new version instead'; end if;
  if v.version <> _expected then raise exception 'CONFLICT: this profile version was changed by someone else'; end if;
  delete from public.evaluation_items where version_id=_version_id;
  delete from public.evaluation_sections where version_id=_version_id;
  for s in select * from jsonb_array_elements(coalesce(_c->'sections','[]'::jsonb)) loop
    insert into public.evaluation_sections(version_id,title,description,sort_order) values (_version_id,s->>'title',nullif(s->>'description',''),si) returning id into sid;
    si := si+1; ii := 0;
    for it in select * from jsonb_array_elements(coalesce(s->'items','[]'::jsonb)) loop
      insert into public.evaluation_items(version_id,section_id,label,help_text,item_type,weight,options,kpi_target,kpi_unit,competency_id,evidence_required,is_required,sort_order)
      values (_version_id,sid,it->>'label',nullif(it->>'help_text',''),it->>'item_type',coalesce((it->>'weight')::numeric,0),coalesce(it->'options','[]'::jsonb),
        nullif(it->>'kpi_target','')::numeric,nullif(it->>'kpi_unit',''),nullif(it->>'competency_id','')::uuid,coalesce((it->>'evidence_required')::boolean,false),coalesce((it->>'is_required')::boolean,true),ii);
      ii := ii+1;
    end loop;
  end loop;
  update public.evaluation_profile_versions set rating_scale_max=coalesce((_c->>'rating_scale_max')::int,rating_scale_max),
    instructions=nullif(_c->>'instructions',''), effective_date=nullif(_c->>'effective_date','')::date where id=_version_id returning * into v;
  return to_jsonb(v);
end $$;

create or replace function public.profile_weight_total(_version_id uuid) returns numeric
language sql stable security definer set search_path=public as $$
  select coalesce(sum(weight),0) from public.evaluation_items where version_id=_version_id
$$;

create or replace function public.activate_profile_version(_version_id uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v public.evaluation_profile_versions; total numeric; n int;
begin
  if not public.has_perm('perf.manage') then raise exception 'FORBIDDEN'; end if;
  select * into v from public.evaluation_profile_versions where id=_version_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  perform public.assert_transition('profile_version',v.status,'active');
  select count(*) into n from public.evaluation_items where version_id=_version_id;
  if n = 0 then raise exception 'RULE: add at least one item before activating'; end if;
  total := public.profile_weight_total(_version_id);
  if total <> 100 then raise exception 'RULE: item weights must total 100 percent (currently %)', total; end if;
  update public.evaluation_profile_versions set status='archived' where position_id=v.position_id and status='active';
  update public.evaluation_profile_versions set status='active', activated_at=now(), activated_by=auth.uid(), effective_date=coalesce(effective_date,current_date)
    where id=_version_id returning * into v;
  return to_jsonb(v);
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
  insert into public.evaluation_profile_versions(profile_id,position_id,version_number,rating_scale_max,instructions)
    values (_profile,src.position_id,src.version_number+1,src.rating_scale_max,src.instructions) returning * into v;
  for s in select * from public.evaluation_sections where version_id=src.id order by sort_order loop
    insert into public.evaluation_sections(version_id,title,description,sort_order) values (v.id,s.title,s.description,s.sort_order) returning id into nsid;
    insert into public.evaluation_items(version_id,section_id,label,help_text,item_type,weight,options,kpi_target,kpi_unit,competency_id,evidence_required,is_required,sort_order)
      select v.id,nsid,label,help_text,item_type,weight,options,kpi_target,kpi_unit,competency_id,evidence_required,is_required,sort_order from public.evaluation_items where section_id=s.id;
  end loop;
  return to_jsonb(v);
end $$;

create or replace function public._build_snapshot(_version_id uuid) returns jsonb
language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
    'version_id', v.id, 'profile_id', p.id, 'profile_name', p.name, 'version_number', v.version_number,
    'position_id', v.position_id, 'rating_scale_max', v.rating_scale_max, 'instructions', v.instructions,
    'sections', coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'description',s.description,
       'items', coalesce((select jsonb_agg(to_jsonb(i) - 'created_at' - 'updated_at' - 'created_by' - 'updated_by' order by i.sort_order) from public.evaluation_items i where i.section_id=s.id),'[]'::jsonb))
       order by s.sort_order) from public.evaluation_sections s where s.version_id=v.id),'[]'::jsonb))
  from public.evaluation_profile_versions v join public.evaluation_profiles p on p.id=v.profile_id where v.id=_version_id
$$;

create or replace function public.create_assignments(_cycle uuid, _employees uuid[], _idem uuid, _hash text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare prev jsonb; e record; sup uuid; ver uuid; created int := 0; skipped jsonb := '[]'::jsonb; cyc public.evaluation_cycles; aid uuid; res jsonb;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.has_perm('perf.manage') then raise exception 'FORBIDDEN'; end if;
  prev := public._idem_get(_idem,'create_assignments',_hash); if prev is not null then return prev; end if;
  select * into cyc from public.evaluation_cycles where id=_cycle;
  if not found then raise exception 'NOT_FOUND'; end if;
  if cyc.status = 'closed' then raise exception 'RULE: the cycle is closed'; end if;
  if coalesce(array_length(_employees,1),0) > 500 then raise exception 'INVALID: at most 500 employees per request'; end if;
  for e in select * from public.employees where id = any(_employees) loop
    select supervisor_id into sup from public.reporting_relationships where employee_id=e.id and is_current;
    select id into ver from public.evaluation_profile_versions where position_id=e.position_id and status='active';
    if e.employment_status <> 'active' then skipped := skipped || jsonb_build_object('employee_id',e.id,'reason','Employee is not active');
    elsif sup is null then skipped := skipped || jsonb_build_object('employee_id',e.id,'reason','No current supervisor');
    elsif ver is null then skipped := skipped || jsonb_build_object('employee_id',e.id,'reason','No active evaluation profile for position');
    elsif exists(select 1 from public.evaluation_assignments where cycle_id=_cycle and employee_id=e.id) then skipped := skipped || jsonb_build_object('employee_id',e.id,'reason','Already assigned');
    else
      insert into public.evaluation_assignments(cycle_id,employee_id,evaluator_id,profile_version_id,snapshot,self_evaluation)
        values (_cycle,e.id,sup,ver,public._build_snapshot(ver),cyc.self_evaluation) returning id into aid;
      created := created+1;
      perform public._notify((select user_id from public.employees where id=sup),'New evaluation to complete','Evaluate '||e.first_name||' '||e.last_name||' for '||cyc.name,'/performance/evaluations/'||aid,'task');
      if cyc.self_evaluation then perform public._notify(e.user_id,'Self-evaluation assigned','Complete your self-evaluation for '||cyc.name,'/performance/evaluations/'||aid,'task'); end if;
    end if;
  end loop;
  res := jsonb_build_object('created',created,'skipped',skipped);
  return public._idem_put(_idem,'create_assignments',_hash,res);
end $$;

create or replace function public.save_evaluation(_assignment uuid, _respondent text, _responses jsonb, _overall_comment text, _expected int) returns jsonb
language plpgsql security definer set search_path=public as $$
declare a public.evaluation_assignments; r jsonb; me uuid := public.my_employee_id(); valid_ids uuid[];
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into a from public.evaluation_assignments where id=_assignment for update;
  if not found or not (public.can_view_perf(a.employee_id) or a.evaluator_id=me) then raise exception 'NOT_FOUND'; end if;
  if _respondent='evaluator' and a.evaluator_id is distinct from me then raise exception 'FORBIDDEN: only the assigned evaluator can complete this form'; end if;
  if _respondent='self' then
    if a.employee_id is distinct from me then raise exception 'FORBIDDEN: only the employee can complete the self-evaluation'; end if;
    if not a.self_evaluation then raise exception 'RULE: self-evaluation is not configured for this cycle'; end if;
    if a.self_submitted_at is not null and a.status <> 'reopened' then raise exception 'RULE: self-evaluation already submitted'; end if;
  end if;
  if a.status in ('submitted','under_review','approved') then raise exception 'RULE: the evaluation is % and cannot be edited', a.status; end if;
  if a.version <> _expected then raise exception 'CONFLICT: this evaluation was changed by someone else'; end if;
  select array_agg((i->>'id')::uuid) into valid_ids from jsonb_array_elements(a.snapshot->'sections') s, jsonb_array_elements(s->'items') i;
  for r in select * from jsonb_array_elements(coalesce(_responses,'[]'::jsonb)) loop
    if not ((r->>'item_id')::uuid = any(valid_ids)) then raise exception 'INVALID: unknown item in response'; end if;
    if (r->>'rating') is not null and ((r->>'rating')::numeric < 1 or (r->>'rating')::numeric > (a.snapshot->>'rating_scale_max')::numeric) then
      raise exception 'INVALID: rating out of range'; end if;
    insert into public.evaluation_responses(assignment_id,item_id,respondent,rating,text_value,choice_values,kpi_actual,comment)
    values (_assignment,(r->>'item_id')::uuid,_respondent,nullif(r->>'rating','')::numeric,nullif(r->>'text_value',''),r->'choice_values',nullif(r->>'kpi_actual','')::numeric,nullif(r->>'comment',''))
    on conflict (assignment_id,item_id,respondent) do update set rating=excluded.rating,text_value=excluded.text_value,choice_values=excluded.choice_values,kpi_actual=excluded.kpi_actual,comment=excluded.comment;
  end loop;
  if _respondent='evaluator' then
    perform public.assert_transition('evaluation',a.status,'in_progress');
    update public.evaluation_assignments set status='in_progress', overall_comment=coalesce(_overall_comment,overall_comment) where id=_assignment returning * into a;
  else
    update public.evaluation_assignments set status=case when status='not_started' then 'in_progress' else status end where id=_assignment returning * into a;
  end if;
  return to_jsonb(a) - 'snapshot';
end $$;

create or replace function public.compute_evaluation_score(_assignment uuid) returns numeric
language sql stable security definer set search_path=public as $$
  with items as (
    select (i->>'id')::uuid id, i->>'item_type' t, (i->>'weight')::numeric w, nullif(i->>'kpi_target','')::numeric tgt, (a.snapshot->>'rating_scale_max')::numeric mx
    from public.evaluation_assignments a, jsonb_array_elements(a.snapshot->'sections') s, jsonb_array_elements(s->'items') i
    where a.id=_assignment)
  select round(coalesce(sum(case
     when it.t='rating' then it.w * coalesce(r.rating,0)/it.mx
     when it.t='kpi' and it.tgt > 0 then it.w * least(greatest(coalesce(r.kpi_actual,0),0)/it.tgt, 1)
     else 0 end),0),2)
  from items it left join public.evaluation_responses r on r.assignment_id=_assignment and r.item_id=it.id and r.respondent='evaluator'
  where it.w > 0
$$;

create or replace function public.submit_evaluation(_assignment uuid, _respondent text, _idem uuid, _hash text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare prev jsonb; a public.evaluation_assignments; me uuid := public.my_employee_id(); missing int; emp public.employees; res jsonb;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  prev := public._idem_get(_idem,'submit_evaluation',_hash); if prev is not null then return prev; end if;
  select * into a from public.evaluation_assignments where id=_assignment for update;
  if not found or not (public.can_view_perf(a.employee_id) or a.evaluator_id=me) then raise exception 'NOT_FOUND'; end if;
  select * into emp from public.employees where id=a.employee_id;
  if _respondent='self' then
    if a.employee_id is distinct from me then raise exception 'FORBIDDEN'; end if;
    if a.self_submitted_at is not null and a.status <> 'reopened' then raise exception 'RULE: already submitted'; end if;
    update public.evaluation_assignments set self_submitted_at=now() where id=_assignment returning * into a;
    perform public._notify((select user_id from public.employees where id=a.evaluator_id),'Self-evaluation submitted',emp.first_name||' '||emp.last_name||' submitted a self-evaluation','/performance/evaluations/'||a.id);
  else
    if a.evaluator_id is distinct from me then raise exception 'FORBIDDEN: only the assigned evaluator can submit'; end if;
    perform public.assert_transition('evaluation',a.status,'submitted');
    select count(*) into missing from jsonb_array_elements(a.snapshot->'sections') s, jsonb_array_elements(s->'items') i
      left join public.evaluation_responses r on r.assignment_id=a.id and r.item_id=(i->>'id')::uuid and r.respondent='evaluator'
      where coalesce((i->>'is_required')::boolean,true) and (r.id is null or (r.rating is null and r.text_value is null and r.kpi_actual is null and r.choice_values is null));
    if missing > 0 then raise exception 'RULE: % required item(s) are not answered', missing; end if;
    update public.evaluation_assignments set status='submitted', submitted_at=now(), overall_score=public.compute_evaluation_score(_assignment) where id=_assignment returning * into a;
    update public.approval_tasks set status='cancelled' where workflow_type='evaluation' and record_id=a.id and status='pending';
    insert into public.approval_tasks(workflow_type,record_id,record_label,employee_id,submitted_by,assignee_role)
      values ('evaluation',a.id,'Evaluation: '||emp.first_name||' '||emp.last_name,a.employee_id,auth.uid(),'hr_admin');
    perform public._notify_role('hr_admin','Evaluation awaiting approval',emp.first_name||' '||emp.last_name||' evaluation was submitted','/approvals');
    perform public._notify(emp.user_id,'Your evaluation was submitted','Your evaluator submitted your evaluation for review','/performance/evaluations/'||a.id);
  end if;
  res := to_jsonb(a) - 'snapshot';
  return public._idem_put(_idem,'submit_evaluation',_hash,res);
end $$;

create or replace function public.review_evaluation(_assignment uuid, _decision text, _comments text, _idem uuid, _hash text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare prev jsonb; a public.evaluation_assignments; emp public.employees; res jsonb; me uuid := public.my_employee_id();
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  prev := public._idem_get(_idem,'review_evaluation',_hash); if prev is not null then return prev; end if;
  if not public.has_perm('perf.approve') then raise exception 'FORBIDDEN: you do not hold a performance-approval role'; end if;
  select * into a from public.evaluation_assignments where id=_assignment for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if a.evaluator_id = me or a.employee_id = me then raise exception 'FORBIDDEN: you cannot approve an evaluation you submitted or that is about you'; end if;
  select * into emp from public.employees where id=a.employee_id;
  if _decision='approve' then
    perform public.assert_transition('evaluation',a.status,'approved');
    update public.evaluation_assignments set status='approved', approved_at=now(), approved_by=auth.uid() where id=_assignment returning * into a;
    insert into public.evaluation_reviews(assignment_id,decision,comments) values (a.id,'approved',_comments);
    update public.approval_tasks set status='approved',decided_by=auth.uid(),decided_at=now(),comments=_comments where workflow_type='evaluation' and record_id=a.id and status='pending';
    perform public._notify(emp.user_id,'Evaluation approved','Your evaluation was approved','/performance/evaluations/'||a.id,'success');
    perform public._notify((select user_id from public.employees where id=a.evaluator_id),'Evaluation approved','Evaluation for '||emp.first_name||' '||emp.last_name||' was approved','/performance/evaluations/'||a.id,'success');
  elsif _decision='return' then
    if coalesce(length(trim(_comments)),0) < 5 then raise exception 'INVALID: a reason is required when returning an evaluation'; end if;
    perform public.assert_transition('evaluation',a.status,'reopened');
    update public.evaluation_assignments set status='reopened', reopen_reason=_comments where id=_assignment returning * into a;
    insert into public.evaluation_reviews(assignment_id,decision,comments) values (a.id,'returned',_comments);
    update public.approval_tasks set status='rejected',decided_by=auth.uid(),decided_at=now(),comments=_comments where workflow_type='evaluation' and record_id=a.id and status='pending';
    perform public._notify((select user_id from public.employees where id=a.evaluator_id),'Evaluation returned','Returned with comments: '||_comments,'/performance/evaluations/'||a.id,'warning');
  else raise exception 'INVALID: unknown decision'; end if;
  res := to_jsonb(a) - 'snapshot';
  return public._idem_put(_idem,'review_evaluation',_hash,res);
end $$;

create or replace function public.add_evaluation_evidence(_assignment uuid, _file uuid, _note text, _item uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare a public.evaluation_assignments; r public.evaluation_evidence; me uuid := public.my_employee_id();
begin
  select * into a from public.evaluation_assignments where id=_assignment;
  if not found or not (a.evaluator_id=me or a.employee_id=me) then raise exception 'NOT_FOUND'; end if;
  if a.status in ('submitted','under_review','approved') then raise exception 'RULE: evidence cannot be added to a % evaluation', a.status; end if;
  if _file is not null and not exists(select 1 from public.file_metadata where id=_file and uploaded_by=auth.uid()) then raise exception 'NOT_FOUND: file'; end if;
  insert into public.evaluation_evidence(assignment_id,file_id,note,item_id) values (_assignment,_file,nullif(_note,''),_item) returning * into r;
  return to_jsonb(r);
end $$;

-- ================= COMPETENCY =================
create or replace function public.upsert_category(_id uuid, _name text, _desc text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.competency_categories;
begin
  if not public.has_perm('comp.manage') then raise exception 'FORBIDDEN'; end if;
  if _id is null then insert into public.competency_categories(name,description) values (_name,_desc) returning * into r;
  else update public.competency_categories set name=_name, description=_desc where id=_id returning * into r;
    if not found then raise exception 'NOT_FOUND'; end if; end if;
  return to_jsonb(r);
end $$;

create or replace function public.upsert_competency(_id uuid, _d jsonb, _version int) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.competencies; ind jsonb;
begin
  if not public.has_perm('comp.manage') then raise exception 'FORBIDDEN'; end if;
  if _id is null then
    insert into public.competencies(code,name,description,definition,category_id,status,is_mandatory,is_safety_critical)
    values (_d->>'code',_d->>'name',nullif(_d->>'description',''),nullif(_d->>'definition',''),(_d->>'category_id')::uuid,coalesce(_d->>'status','draft'),
      coalesce((_d->>'is_mandatory')::boolean,false),coalesce((_d->>'is_safety_critical')::boolean,false)) returning * into r;
  else
    update public.competencies set code=_d->>'code',name=_d->>'name',description=nullif(_d->>'description',''),definition=nullif(_d->>'definition',''),
      category_id=(_d->>'category_id')::uuid,status=coalesce(_d->>'status',status),is_mandatory=coalesce((_d->>'is_mandatory')::boolean,false),
      is_safety_critical=coalesce((_d->>'is_safety_critical')::boolean,false)
    where id=_id and version=_version returning * into r;
    if not found then
      if exists(select 1 from public.competencies where id=_id) then raise exception 'CONFLICT: this competency was changed by someone else'; end if;
      raise exception 'NOT_FOUND';
    end if;
  end if;
  if _d ? 'indicators' then
    delete from public.behavioral_indicators where competency_id=r.id;
    for ind in select * from jsonb_array_elements(_d->'indicators') loop
      insert into public.behavioral_indicators(competency_id,level,indicator) values (r.id,(ind->>'level')::int,ind->>'indicator');
    end loop;
  end if;
  return to_jsonb(r);
end $$;

create or replace function public.update_proficiency_level(_level int, _label text, _desc text, _version int) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.proficiency_levels;
begin
  if not public.has_perm('comp.manage') then raise exception 'FORBIDDEN'; end if;
  update public.proficiency_levels set label=_label, description=_desc where level=_level and version=_version returning * into r;
  if not found then raise exception 'CONFLICT: this level was changed by someone else'; end if;
  return to_jsonb(r);
end $$;

create or replace function public.update_setting(_key text, _value jsonb, _version int) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.system_settings;
begin
  if not (public.has_perm('admin.settings') or public.has_perm('perf.manage')) then raise exception 'FORBIDDEN'; end if;
  update public.system_settings set value=_value where key=_key and version=_version returning * into r;
  if not found then raise exception 'CONFLICT: this setting was changed by someone else'; end if;
  return to_jsonb(r);
end $$;

create or replace function public.set_position_requirement(_position uuid, _competency uuid, _level int, _mandatory boolean, _safety boolean, _reason text, _remove boolean) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.position_competency_requirements;
begin
  if not public.has_perm('comp.manage') then raise exception 'FORBIDDEN'; end if;
  update public.position_competency_requirements set is_current=false, effective_to=current_date
    where position_id=_position and competency_id=_competency and is_current;
  if not coalesce(_remove,false) then
    if _level not between 1 and 5 then raise exception 'INVALID: required level must be 1 to 5'; end if;
    insert into public.position_competency_requirements(position_id,competency_id,required_level,is_mandatory,is_safety_critical,change_reason)
      values (_position,_competency,_level,coalesce(_mandatory,false),coalesce(_safety,false),_reason) returning * into r;
  end if;
  return coalesce(to_jsonb(r),jsonb_build_object('removed',true));
end $$;

create or replace function public.save_assessment(_id uuid, _employee uuid, _competency uuid, _level int, _evidence text, _comments text, _reassess boolean, _version int) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.competency_assessments;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.has_perm('comp.assess') then raise exception 'FORBIDDEN: you are not an authorized assessor'; end if;
  if not (public.can_manage_team_member(_employee) or public.has_perm('comp.manage')) then raise exception 'NOT_FOUND'; end if;
  if _employee = public.my_employee_id() then raise exception 'FORBIDDEN: you cannot assess yourself'; end if;
  if not exists(select 1 from public.competencies where id=_competency and status='active') then raise exception 'RULE: competency is not active'; end if;
  if _id is null then
    insert into public.competency_assessments(employee_id,competency_id,current_level,evidence_summary,comments,is_reassessment)
    values (_employee,_competency,_level,nullif(_evidence,''),nullif(_comments,''),coalesce(_reassess,false)) returning * into r;
  else
    update public.competency_assessments set current_level=_level, evidence_summary=nullif(_evidence,''), comments=nullif(_comments,''), is_reassessment=coalesce(_reassess,is_reassessment)
      where id=_id and assessor_id=auth.uid() and status='draft' and version=_version returning * into r;
    if not found then
      if exists(select 1 from public.competency_assessments where id=_id and assessor_id=auth.uid() and status='draft') then raise exception 'CONFLICT: this assessment was changed elsewhere'; end if;
      raise exception 'NOT_FOUND';
    end if;
  end if;
  return to_jsonb(r);
end $$;

create or replace function public.add_assessment_evidence(_assessment uuid, _file uuid, _note text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.competency_assessment_evidence;
begin
  if not exists(select 1 from public.competency_assessments where id=_assessment and assessor_id=auth.uid() and status='draft') then raise exception 'NOT_FOUND'; end if;
  if _file is not null and not exists(select 1 from public.file_metadata where id=_file and uploaded_by=auth.uid()) then raise exception 'NOT_FOUND: file'; end if;
  insert into public.competency_assessment_evidence(assessment_id,file_id,note) values (_assessment,_file,nullif(_note,'')) returning * into r;
  return to_jsonb(r);
end $$;

create or replace function public.submit_assessment(_id uuid, _idem uuid, _hash text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare prev jsonb; a public.competency_assessments; emp public.employees; head_user uuid; comp_name text; res jsonb;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  prev := public._idem_get(_idem,'submit_assessment',_hash); if prev is not null then return prev; end if;
  select * into a from public.competency_assessments where id=_id and assessor_id=auth.uid() for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  perform public.assert_transition('assessment',a.status,'submitted');
  if a.current_level is null then raise exception 'RULE: select the current proficiency level'; end if;
  if coalesce(length(trim(a.evidence_summary)),0) = 0 and not exists(select 1 from public.competency_assessment_evidence where assessment_id=a.id) then
    raise exception 'RULE: evidence is required before submitting an assessment'; end if;
  update public.competency_assessments set status='submitted' where id=_id returning * into a;
  select * into emp from public.employees where id=a.employee_id;
  select name into comp_name from public.competencies where id=a.competency_id;
  select e.user_id into head_user from public.departments d join public.employees e on e.id=d.head_employee_id where d.id=emp.department_id;
  if head_user = auth.uid() then head_user := null; end if;
  insert into public.approval_tasks(workflow_type,record_id,record_label,employee_id,submitted_by,assignee_role,assignee_user)
    values ('competency_assessment',a.id,comp_name||': '||emp.first_name||' '||emp.last_name,a.employee_id,auth.uid(),'hr_admin',head_user);
  perform public._notify(head_user,'Assessment awaiting approval',comp_name||' for '||emp.first_name||' '||emp.last_name,'/approvals','approval');
  perform public._notify_role('hr_admin','Assessment awaiting approval',comp_name||' for '||emp.first_name||' '||emp.last_name,'/approvals');
  res := to_jsonb(a);
  return public._idem_put(_idem,'submit_assessment',_hash,res);
end $$;

create or replace function public.competency_gaps(_employee uuid default null, _department uuid default null, _position uuid default null, _category uuid default null, _status text default null, _limit int default 200, _offset int default 0)
returns table(employee_id uuid, employee_name text, employee_code text, department_id uuid, department_name text, position_id uuid, position_title text,
  competency_id uuid, competency_name text, category_id uuid, category_name text, required_level int, current_level int, gap int, gap_status text,
  is_mandatory boolean, is_safety_critical boolean, assessment_id uuid, assessment_date date, evidence_summary text)
language sql stable security definer set search_path=public as $$
  select e.id, e.first_name||' '||e.last_name, e.employee_code, d.id, d.name, p.id, p.title, c.id, c.name, cc.id, cc.name,
    req.required_level, la.current_level,
    case when la.id is null then null else greatest(0, req.required_level - la.current_level) end,
    case when la.id is null then 'not_assessed' when la.current_level >= req.required_level then 'met' else 'gap' end,
    req.is_mandatory or c.is_mandatory, req.is_safety_critical or c.is_safety_critical, la.id, la.assessment_date, la.evidence_summary
  from public.employees e
  join public.departments d on d.id=e.department_id
  join public.positions p on p.id=e.position_id
  join public.position_competency_requirements req on req.position_id=e.position_id and req.is_current
  join public.competencies c on c.id=req.competency_id
  join public.competency_categories cc on cc.id=c.category_id
  left join lateral (select ca.* from public.competency_assessments ca where ca.employee_id=e.id and ca.competency_id=c.id and ca.status='approved'
     order by ca.assessment_date desc, ca.reviewed_at desc nulls last limit 1) la on true
  where public.can_view_comp(e.id) and e.employment_status <> 'terminated'
    and (_employee is null or e.id=_employee) and (_department is null or e.department_id=_department)
    and (_position is null or e.position_id=_position) and (_category is null or c.category_id=_category)
    and (_status is null or (case when la.id is null then 'not_assessed' when la.current_level >= req.required_level then 'met' else 'gap' end)=_status)
  order by e.last_name, c.name
  limit least(greatest(_limit,1),500) offset greatest(_offset,0)
$$;

create or replace function public._snapshot_gaps(_employee uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
  insert into public.competency_gap_snapshots(employee_id,competency_id,position_id,required_level,current_level,gap,gap_status,is_mandatory,is_safety_critical,assessment_id)
  select e.id, c.id, e.position_id, req.required_level, la.current_level,
    case when la.id is null then null else greatest(0, req.required_level - la.current_level) end,
    case when la.id is null then 'not_assessed' when la.current_level >= req.required_level then 'met' else 'gap' end,
    req.is_mandatory or c.is_mandatory, req.is_safety_critical or c.is_safety_critical, la.id
  from public.employees e
  join public.position_competency_requirements req on req.position_id=e.position_id and req.is_current
  join public.competencies c on c.id=req.competency_id
  left join lateral (select ca.* from public.competency_assessments ca where ca.employee_id=e.id and ca.competency_id=c.id and ca.status='approved'
     order by ca.assessment_date desc, ca.reviewed_at desc nulls last limit 1) la on true
  where e.id=_employee;
end $$;

create or replace function public.snapshot_gaps(_employee uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
begin
  if not (public.has_perm('comp.manage') or public.can_manage_team_member(_employee)) then raise exception 'NOT_FOUND'; end if;
  perform public._snapshot_gaps(_employee);
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.review_assessment(_id uuid, _decision text, _comments text, _idem uuid, _hash text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare prev jsonb; a public.competency_assessments; emp public.employees; res jsonb;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  prev := public._idem_get(_idem,'review_assessment',_hash); if prev is not null then return prev; end if;
  if not public.has_perm('comp.approve') then raise exception 'FORBIDDEN: you cannot approve assessments'; end if;
  select * into a from public.competency_assessments where id=_id for update;
  if not found or not (public.has_perm('comp.manage') or public.is_dept_head_of(a.employee_id)) then raise exception 'NOT_FOUND'; end if;
  if a.assessor_id = auth.uid() then raise exception 'FORBIDDEN: the assessor cannot approve their own assessment'; end if;
  if a.employee_id = public.my_employee_id() then raise exception 'FORBIDDEN: you cannot approve your own assessment'; end if;
  select * into emp from public.employees where id=a.employee_id;
  if _decision='approve' then
    perform public.assert_transition('assessment',a.status,'approved');
    update public.competency_assessments set status='approved', reviewer_id=auth.uid(), reviewed_at=now(), review_comments=_comments where id=_id returning * into a;
    update public.approval_tasks set status='approved',decided_by=auth.uid(),decided_at=now(),comments=_comments where workflow_type='competency_assessment' and record_id=a.id and status='pending';
    perform public._snapshot_gaps(a.employee_id);
    perform public._notify(emp.user_id,'Competency assessment approved','A competency assessment was approved','/competency/gaps','success');
  elsif _decision='reject' then
    if coalesce(length(trim(_comments)),0) < 5 then raise exception 'INVALID: a reason is required when rejecting'; end if;
    perform public.assert_transition('assessment',a.status,'rejected');
    update public.competency_assessments set status='rejected', reviewer_id=auth.uid(), reviewed_at=now(), review_comments=_comments where id=_id returning * into a;
    update public.approval_tasks set status='rejected',decided_by=auth.uid(),decided_at=now(),comments=_comments where workflow_type='competency_assessment' and record_id=a.id and status='pending';
  else raise exception 'INVALID: unknown decision'; end if;
  perform public._notify(a.assessor_id,'Assessment '||a.status, coalesce(_comments,''),'/competency/history','info');
  res := to_jsonb(a);
  return public._idem_put(_idem,'review_assessment',_hash,res);
end $$;

-- ================= SHARED =================
create or replace function public.mark_notifications_read(_ids uuid[]) returns jsonb
language plpgsql security definer set search_path=public as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  update public.notifications set read_at=now() where user_id=auth.uid() and read_at is null and (_ids is null or id = any(_ids));
  get diagnostics n = row_count;
  return jsonb_build_object('updated',n);
end $$;

create or replace function public.register_file(_path text, _name text, _mime text, _size int, _employee uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.file_metadata;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if split_part(_path,'/',1) <> auth.uid()::text then raise exception 'FORBIDDEN'; end if;
  if _mime not in ('application/pdf','image/png','image/jpeg','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain') then raise exception 'INVALID: file type not allowed'; end if;
  if _employee is not null and not (public.can_view_perf(_employee) or public.can_view_comp(_employee)) then raise exception 'NOT_FOUND'; end if;
  insert into public.file_metadata(object_path,original_name,mime_type,size_bytes,employee_id) values (_path,left(_name,255),_mime,_size,_employee) returning * into r;
  return to_jsonb(r);
end $$;

create or replace function public.can_access_file(_file uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.file_metadata f where f.id=_file and (f.uploaded_by=auth.uid()
    or (f.employee_id is not null and (public.can_view_perf(f.employee_id) or public.can_view_comp(f.employee_id)))))
$$;

create or replace function public.global_search(_q text) returns table(kind text, id uuid, label text, sublabel text, link text)
language plpgsql stable security definer set search_path=public as $$
declare q text;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if length(trim(_q)) < 2 then return; end if;
  q := '%'||replace(replace(replace(left(trim(_q),60),'\','\\'),'%','\%'),'_','\_')||'%';
  return query
  (select 'employee'::text, e.id, e.first_name||' '||e.last_name, e.employee_code||' · '||p.title, '/people/employees/'||e.id
    from public.employees e join public.positions p on p.id=e.position_id
    where (public.can_view_employee(e.id) or public.has_perm('admin.org')) and (e.first_name||' '||e.last_name ilike q or e.employee_code ilike q) limit 8)
  union all
  (select 'competency', c.id, c.name, c.code, '/competency/library/'||c.id from public.competencies c
    where (c.status='active' or public.has_perm('comp.manage')) and (c.name ilike q or c.code ilike q) limit 8)
  union all
  (select 'position', p.id, p.title, p.code, '/org/positions' from public.positions p where p.title ilike q or p.code ilike q limit 5)
  union all
  (select 'department', d.id, d.name, d.code, '/org/departments' from public.departments d where d.name ilike q or d.code ilike q limit 5)
  union all
  (select 'evaluation', a.id, e.first_name||' '||e.last_name||' — '||c.name, a.status, '/performance/evaluations/'||a.id
    from public.evaluation_assignments a join public.employees e on e.id=a.employee_id join public.evaluation_cycles c on c.id=a.cycle_id
    where (public.can_view_perf(a.employee_id) or a.evaluator_id=public.my_employee_id()) and (e.first_name||' '||e.last_name ilike q or c.name ilike q) limit 8);
end $$;

-- lock down function execution
do $$ declare f record; begin
  for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated, service_role', f.sig);
  end loop;
end $$;
-- internal helpers not callable by clients
revoke execute on function public._idem_put(uuid,text,text,jsonb) from authenticated;
revoke execute on function public._idem_get(uuid,text,text) from authenticated;
revoke execute on function public._notify(uuid,text,text,text,text) from authenticated;
revoke execute on function public._notify_role(public.app_role,text,text,text) from authenticated;
revoke execute on function public._snapshot_gaps(uuid) from authenticated;
revoke execute on function public._build_snapshot(uuid) from authenticated;
