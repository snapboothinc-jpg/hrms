-- Base schema: identity, organization, shared primitives, foundational RLS and permissions.


-- ============ ENUMS ============
create type public.app_role as enum ('super_admin','admin','hr_admin','dept_head','supervisor','employee','ops_manager');

-- ============ GENERIC TRIGGERS ============
create or replace function public.tg_touch() returns trigger language plpgsql set search_path=public as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  if tg_op='UPDATE' and to_jsonb(old) ? 'version' then
    new.version := old.version + 1;
  end if;
  return new;
end $$;

-- ============ IDENTITY ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  is_active boolean not null default true,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid
);
grant select on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid,
  unique (user_id)  -- one primary role per user
);
create index on public.user_roles(role);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create table public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role public.app_role not null,
  permission text not null check (length(permission) between 3 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid,
  unique (role, permission)
);
grant select on public.role_permissions to authenticated;
grant all on public.role_permissions to service_role;
alter table public.role_permissions enable row level security;

-- ============ ORGANIZATION ============
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (length(code) between 1 and 20),
  name text not null check (length(name) between 2 and 120),
  parent_id uuid references public.departments(id) on delete restrict,
  head_employee_id uuid,
  status text not null default 'active' check (status in ('active','inactive')),
  version int not null default 1,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid
);
create index on public.departments(parent_id);

create table public.positions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (length(code) between 1 and 20),
  title text not null check (length(title) between 2 and 120),
  department_id uuid not null references public.departments(id) on delete restrict,
  description text check (length(description) <= 2000),
  status text not null default 'active' check (status in ('active','inactive')),
  version int not null default 1,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid
);
create index on public.positions(department_id);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  employee_code text not null unique check (length(employee_code) between 1 and 30),
  first_name text not null check (length(first_name) between 1 and 80),
  last_name text not null check (length(last_name) between 1 and 80),
  email text check (length(email) <= 200),
  phone text check (length(phone) <= 40),
  department_id uuid not null references public.departments(id) on delete restrict,
  position_id uuid not null references public.positions(id) on delete restrict,
  employment_status text not null default 'active' check (employment_status in ('active','on_leave','inactive','terminated')),
  hire_date date,
  job_notes text check (length(job_notes) <= 2000),
  user_id uuid unique references public.profiles(id) on delete set null,
  version int not null default 1,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid
);
create index on public.employees(department_id);
create index on public.employees(position_id);
create index on public.employees(employment_status) where employment_status='active';
alter table public.departments add constraint departments_head_fk foreign key (head_employee_id) references public.employees(id) on delete set null;
create index on public.departments(head_employee_id);

create table public.reporting_relationships (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  supervisor_id uuid not null references public.employees(id) on delete restrict,
  effective_from date not null default current_date,
  effective_to date,
  is_current boolean not null default true,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid,
  check (employee_id <> supervisor_id),
  check (effective_to is null or effective_to >= effective_from)
);
create unique index reporting_one_current on public.reporting_relationships(employee_id) where is_current;
create index on public.reporting_relationships(supervisor_id) where is_current;

-- ============ SHARED ============
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  table_name text not null,
  record_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);
create index on public.audit_logs(created_at desc);
create index on public.audit_logs(table_name, record_id);
create index on public.audit_logs(actor_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text,
  link text,
  kind text not null default 'info',
  read_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid
);
create index on public.notifications(user_id, created_at desc);
create index on public.notifications(user_id) where read_at is null;

create table public.approval_tasks (
  id uuid primary key default gen_random_uuid(),
  workflow_type text not null check (workflow_type in ('evaluation','competency_assessment')),
  record_id uuid not null,
  record_label text not null,
  employee_id uuid references public.employees(id) on delete restrict,
  submitted_by uuid,
  assignee_role public.app_role,
  assignee_user uuid,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  decided_by uuid,
  decided_at timestamptz,
  comments text check (length(comments) <= 4000),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid
);
create unique index approval_one_pending on public.approval_tasks(workflow_type, record_id) where status='pending';
create index on public.approval_tasks(assignee_role) where status='pending';
create index on public.approval_tasks(assignee_user) where status='pending';
create index on public.approval_tasks(employee_id);

create table public.file_metadata (
  id uuid primary key default gen_random_uuid(),
  bucket text not null default 'evidence',
  object_path text not null unique,
  original_name text not null check (length(original_name) <= 255),
  mime_type text not null,
  size_bytes int not null check (size_bytes > 0 and size_bytes <= 10485760),
  employee_id uuid references public.employees(id) on delete restrict,
  uploaded_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid
);
create index on public.file_metadata(employee_id);
create index on public.file_metadata(uploaded_by);

create table public.system_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null,
  description text,
  requires_validation boolean not null default true,
  version int not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid
);

create table public.status_transitions (
  id uuid primary key default gen_random_uuid(),
  entity text not null,
  from_status text not null,
  to_status text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid,
  unique (entity, from_status, to_status)
);

create table public.idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  key uuid not null,
  operation text not null,
  request_hash text not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid,
  unique (user_id, key)
);
create index on public.idempotency_keys(created_at);

-- grants for org/shared (reads only; writes go through SECURITY DEFINER functions)
grant select on public.departments, public.positions, public.employees, public.reporting_relationships,
  public.audit_logs, public.notifications, public.approval_tasks, public.file_metadata,
  public.system_settings, public.status_transitions to authenticated;
grant all on public.departments, public.positions, public.employees, public.reporting_relationships,
  public.audit_logs, public.notifications, public.approval_tasks, public.file_metadata,
  public.system_settings, public.status_transitions, public.idempotency_keys to service_role;
alter table public.departments enable row level security;
alter table public.positions enable row level security;
alter table public.employees enable row level security;
alter table public.reporting_relationships enable row level security;
alter table public.audit_logs enable row level security;
alter table public.notifications enable row level security;
alter table public.approval_tasks enable row level security;
alter table public.file_metadata enable row level security;
alter table public.system_settings enable row level security;
alter table public.status_transitions enable row level security;
alter table public.idempotency_keys enable row level security;

-- audit log is append-only
create or replace function public.tg_audit_immutable() returns trigger language plpgsql as $$
begin raise exception 'FORBIDDEN: audit log entries cannot be changed or deleted'; end $$;
create trigger audit_no_update before update or delete on public.audit_logs for each row execute function public.tg_audit_immutable();

-- ============ POLICY HELPERS (central policy, SQL side) ============
create or replace function public.current_role_name() returns public.app_role
language sql stable security definer set search_path=public as $$
  select role from public.user_roles ur join public.profiles p on p.id=ur.user_id
  where ur.user_id = auth.uid() and p.is_active limit 1
$$;

create or replace function public.has_role(_user_id uuid, _role public.app_role) returns boolean
language sql stable security definer set search_path=public as $$
  select exists (select 1 from public.user_roles where user_id=_user_id and role=_role)
$$;

create or replace function public.has_perm(_perm text) returns boolean
language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.user_roles ur
    join public.profiles p on p.id = ur.user_id and p.is_active
    join public.role_permissions rp on rp.role = ur.role
    where ur.user_id = auth.uid() and rp.permission = _perm)
$$;

create or replace function public.my_employee_id() returns uuid
language sql stable security definer set search_path=public as $$
  select id from public.employees where user_id = auth.uid()
$$;

create or replace function public.is_supervisor_of(_emp uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select exists (select 1 from public.reporting_relationships r
    where r.employee_id=_emp and r.is_current and r.supervisor_id = public.my_employee_id())
$$;

create or replace function public.is_dept_head_of(_emp uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select public.has_role(auth.uid(),'dept_head') and exists (
    select 1 from public.employees e join public.departments d on d.id=e.department_id
    where e.id=_emp and d.head_employee_id = public.my_employee_id() and d.head_employee_id is not null)
$$;

-- basic directory visibility
create or replace function public.can_view_employee(_emp uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select auth.uid() is not null and (
    _emp = public.my_employee_id()
    or public.has_perm('employees.view_all')
    or public.is_supervisor_of(_emp)
    or public.is_dept_head_of(_emp))
$$;

-- performance records visibility (admins/super admins excluded on purpose)
create or replace function public.can_view_perf(_emp uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select auth.uid() is not null and (
    _emp = public.my_employee_id()
    or public.has_perm('perf.manage')
    or public.is_supervisor_of(_emp)
    or public.is_dept_head_of(_emp))
$$;

-- competency records visibility (ops manager sees results for planning)
create or replace function public.can_view_comp(_emp uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select auth.uid() is not null and (
    _emp = public.my_employee_id()
    or public.has_perm('comp.manage')
    or public.has_perm('comp.view_all')
    or public.is_supervisor_of(_emp)
    or public.is_dept_head_of(_emp))
$$;

create or replace function public.can_manage_team_member(_emp uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select public.is_supervisor_of(_emp) or public.is_dept_head_of(_emp)
$$;

-- errors / transitions / idempotency
create or replace function public.assert_transition(_entity text, _from text, _to text) returns void
language plpgsql stable security definer set search_path=public as $$
begin
  if not exists (select 1 from public.status_transitions where entity=_entity and from_status=_from and to_status=_to) then
    raise exception 'RULE: % cannot move from "%" to "%"', _entity, _from, _to;
  end if;
end $$;

create or replace function public._idem_get(_key uuid, _op text, _hash text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r record;
begin
  if _key is null then return null; end if;
  delete from public.idempotency_keys where user_id=auth.uid() and key=_key and created_at < now() - interval '24 hours';
  select * into r from public.idempotency_keys where user_id=auth.uid() and key=_key;
  if not found then return null; end if;
  if r.request_hash <> _hash or r.operation <> _op then
    raise exception 'IDEMPOTENCY_CONFLICT: this key was already used with a different request';
  end if;
  return r.response;
end $$;

create or replace function public._idem_put(_key uuid, _op text, _hash text, _resp jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
begin
  if _key is not null then
    insert into public.idempotency_keys(user_id,key,operation,request_hash,response) values (auth.uid(),_key,_op,_hash,_resp);
  end if;
  return _resp;
end $$;

create or replace function public._notify(_user uuid, _title text, _body text, _link text, _kind text default 'info') returns void
language plpgsql security definer set search_path=public as $$
begin
  if _user is not null then
    insert into public.notifications(user_id,title,body,link,kind) values (_user,_title,_body,_link,_kind);
  end if;
end $$;

create or replace function public._notify_role(_role public.app_role, _title text, _body text, _link text) returns void
language plpgsql security definer set search_path=public as $$
begin
  insert into public.notifications(user_id,title,body,link,kind)
  select ur.user_id,_title,_body,_link,'approval' from public.user_roles ur join public.profiles p on p.id=ur.user_id and p.is_active where ur.role=_role;
end $$;

-- generic audit trigger
create or replace function public.tg_audit() returns trigger language plpgsql security definer set search_path=public as $$
declare rid uuid;
begin
  rid := coalesce((to_jsonb(new)->>'id')::uuid, (to_jsonb(old)->>'id')::uuid);
  insert into public.audit_logs(actor_id, action, table_name, record_id, before_data, after_data)
  values (auth.uid(), lower(tg_op), tg_table_name, rid,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

create or replace function public.log_audit(_action text, _table text, _record uuid, _details jsonb) returns void
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  insert into public.audit_logs(actor_id,action,table_name,record_id,after_data) values (auth.uid(), left(_action,60), left(_table,60), _record, _details);
end $$;

-- touch + audit triggers
do $$ declare t text; begin
  foreach t in array array['profiles','user_roles','role_permissions','departments','positions','employees','reporting_relationships','notifications','approval_tasks','file_metadata','system_settings'] loop
    execute format('create trigger touch before update on public.%I for each row execute function public.tg_touch()', t);
  end loop;
  foreach t in array array['user_roles','role_permissions','departments','positions','employees','reporting_relationships','approval_tasks','system_settings','file_metadata'] loop
    execute format('create trigger audit after insert or update or delete on public.%I for each row execute function public.tg_audit()', t);
  end loop;
end $$;

-- profiles from auth users
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,email,full_name) values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ============ RLS POLICIES (SELECT only; writes via definer functions) ============
create policy "profiles self or admin" on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_perm('admin.users') or public.has_perm('employees.view_all'));
create policy "roles self or admin" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_perm('admin.users'));
create policy "permissions readable" on public.role_permissions for select to authenticated using (auth.uid() is not null);
create policy "departments readable" on public.departments for select to authenticated using (auth.uid() is not null);
create policy "positions readable" on public.positions for select to authenticated using (auth.uid() is not null);
create policy "employees scoped" on public.employees for select to authenticated
  using (public.can_view_employee(id) or public.has_perm('admin.org'));
create policy "reporting scoped" on public.reporting_relationships for select to authenticated
  using (public.can_view_employee(employee_id) or public.has_perm('admin.org'));
create policy "audit admins" on public.audit_logs for select to authenticated using (public.has_perm('admin.audit'));
create policy "notifications own" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "approvals assignee" on public.approval_tasks for select to authenticated
  using (assignee_user = auth.uid() or submitted_by = auth.uid()
    or (assignee_role is not null and public.has_role(auth.uid(), assignee_role)));
create policy "files scoped" on public.file_metadata for select to authenticated
  using (uploaded_by = auth.uid() or (employee_id is not null and (public.can_view_perf(employee_id) or public.can_view_comp(employee_id))));
create policy "settings readable" on public.system_settings for select to authenticated using (auth.uid() is not null);
create policy "transitions readable" on public.status_transitions for select to authenticated using (auth.uid() is not null);
-- idempotency_keys: no policies (deny all to clients)

-- ============ CONFIG SEEDS (configuration, not demo data) ============
insert into public.role_permissions(role, permission) values
 ('super_admin','admin.users'),('super_admin','admin.audit'),('super_admin','admin.settings'),('super_admin','admin.org'),('super_admin','admin.roles'),
 ('admin','admin.users'),('admin','admin.audit'),('admin','admin.settings'),('admin','admin.org'),
 ('hr_admin','employees.view_all'),('hr_admin','hr.employees'),('hr_admin','perf.manage'),('hr_admin','perf.approve'),('hr_admin','comp.manage'),('hr_admin','comp.approve'),('hr_admin','comp.assess'),('hr_admin','reports.hr'),
 ('dept_head','perf.evaluate'),('dept_head','comp.assess'),('dept_head','comp.approve'),('dept_head','team.view'),
 ('supervisor','perf.evaluate'),('supervisor','comp.assess'),('supervisor','team.view'),
 ('ops_manager','comp.view_all'),
 ('employee','self.service');

insert into public.status_transitions(entity, from_status, to_status) values
 ('evaluation','not_started','in_progress'),('evaluation','in_progress','in_progress'),('evaluation','reopened','in_progress'),
 ('evaluation','in_progress','submitted'),('evaluation','not_started','submitted'),('evaluation','reopened','submitted'),
 ('evaluation','submitted','under_review'),('evaluation','submitted','approved'),('evaluation','under_review','approved'),
 ('evaluation','submitted','reopened'),('evaluation','under_review','reopened'),('evaluation','approved','reopened'),
 ('profile_version','draft','active'),('profile_version','active','archived'),('profile_version','draft','archived'),
 ('assessment','draft','submitted'),('assessment','submitted','approved'),('assessment','submitted','rejected'),('assessment','draft','draft'),
 ('cycle','draft','open'),('cycle','open','closed'),('cycle','closed','open');

insert into public.system_settings(key, value, description) values
 ('evaluation.self_evaluation_default', 'true', 'Default - requires organizational validation. Whether new cycles include a self-evaluation.'),
 ('evaluation.approval_route', '"hr_admin"', 'Default - requires organizational validation. Role that approves submitted evaluations.'),
 ('assessment.approval_route', '"supervisor_chain_or_hr"', 'Default - requires organizational validation. Department head or HR approves assessments; assessor may not approve own.'),
 ('assessment.evidence_required', 'true', 'Default - requires organizational validation. Assessments require evidence before submission.'),
 ('evaluation.rating_scale_max', '5', 'Default - requires organizational validation. Rating scale maximum for numeric items.');
