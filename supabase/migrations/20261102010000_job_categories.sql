create table public.job_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (length(code) between 1 and 30),
  name text not null check (length(name) between 2 and 120),
  description text check (length(description) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_by uuid
);

create table public.department_job_categories (
  department_id uuid not null references public.departments(id) on delete cascade,
  category_id uuid not null references public.job_categories(id) on delete cascade,
  primary key (department_id, category_id)
);

create table public.job_category_positions (
  category_id uuid not null references public.job_categories(id) on delete cascade,
  position_id uuid not null unique references public.positions(id) on delete cascade,
  primary key (category_id, position_id)
);

create index department_job_categories_category_idx
  on public.department_job_categories(category_id);
create index job_category_positions_category_idx
  on public.job_category_positions(category_id);

alter table public.job_categories enable row level security;
alter table public.department_job_categories enable row level security;
alter table public.job_category_positions enable row level security;

grant select on public.job_categories, public.department_job_categories, public.job_category_positions
  to authenticated;
grant all on public.job_categories, public.department_job_categories, public.job_category_positions
  to service_role;

create policy "job categories readable" on public.job_categories
  for select to authenticated using (auth.uid() is not null);
create policy "department job categories readable" on public.department_job_categories
  for select to authenticated using (auth.uid() is not null);
create policy "job category positions readable" on public.job_category_positions
  for select to authenticated using (auth.uid() is not null);

create trigger job_categories_touch before update on public.job_categories
  for each row execute function public.tg_touch();
create trigger job_categories_audit after insert or update or delete on public.job_categories
  for each row execute function public.tg_audit();
