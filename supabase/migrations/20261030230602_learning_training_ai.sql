-- Learning, training, AI/outbox schema and operations, with the Gemini-only provider configuration.

-- Phase 5, stage 1: learning management schema, permissions, settings, scope helpers, RLS.
insert into public.role_permissions(role, permission) values
 ('ops_manager','learn.manage'),('ops_manager','train.manage'),('ops_manager','ai.generate'),('ops_manager','ai.review'),
 ('hr_admin','learn.manage'),('hr_admin','learn.approve'),('hr_admin','train.manage'),('hr_admin','ai.generate'),('hr_admin','ai.review'),
 ('supervisor','ai.generate'),('dept_head','ai.generate');

insert into public.status_transitions(entity, from_status, to_status) values
 ('course','draft','pending_review'),('course','pending_review','approved'),('course','pending_review','draft'),
 ('course','approved','archived'),('course','draft','archived'),
 ('ai_recommendation','pending_review','accepted'),('ai_recommendation','pending_review','edited'),('ai_recommendation','pending_review','rejected'),
 ('development_plan','draft','active'),('development_plan','active','completed'),('development_plan','active','cancelled'),('development_plan','draft','cancelled'),
 ('plan_item','pending','in_progress'),('plan_item','in_progress','completed'),('plan_item','pending','cancelled'),('plan_item','in_progress','cancelled'),
 ('training_session','planned','in_progress'),('training_session','planned','cancelled'),('training_session','in_progress','completed'),('training_session','in_progress','cancelled');

alter table public.approval_tasks drop constraint approval_tasks_workflow_type_check;
alter table public.approval_tasks add constraint approval_tasks_workflow_type_check
  check (workflow_type in ('evaluation','competency_assessment','course_publication','ai_recommendation','recognition_nomination'));

insert into public.system_settings(key, value, description) values
 ('learning.publication_route', '"ops_submits_hr_approves"', 'Default - requires organizational validation. Operations Manager submits courses; HR Administrator approves publication.'),
 ('learning.quiz_max_attempts_default', '3', 'Default - requires organizational validation. Default maximum quiz attempts.'),
 ('ai.provider', '"gemini"', 'Gemini is the required AI provider. Credentials are server-side only.'),
 ('ai.model', '"gemini-2.5-flash"', 'Default model for development recommendations.'),
 ('ai.max_items_per_run', '10', 'Default - requires organizational validation. Maximum recommendations per generation run.'),
 ('training.attendance_recorders', '"ops_manager_or_hr"', 'Default - requires organizational validation. Who may record attendance.');

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (length(code) between 1 and 20),
  title text not null check (length(title) between 3 and 160),
  description text check (length(description) <= 4000),
  category text check (length(category) <= 80),
  objectives text check (length(objectives) <= 4000),
  owner_id uuid references public.employees(id) on delete set null,
  duration_minutes int check (duration_minutes between 1 and 100000),
  difficulty text not null default 'beginner' check (difficulty in ('beginner','intermediate','advanced')),
  status text not null default 'draft' check (status in ('draft','pending_review','approved','archived')),
  enrollment_open boolean not null default true,
  completion_rule text not null default 'all_lessons' check (completion_rule in ('all_lessons','quiz_pass','all_lessons_and_quiz')),
  reviewed_by uuid, reviewed_at timestamptz, review_comments text,
  version int not null default 1,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid
);
create index on public.courses(status);

create table public.course_sections (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null check (length(title) between 1 and 160),
  description text check (length(description) <= 2000),
  sort_order int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid
);
create index on public.course_sections(course_id, sort_order);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.course_sections(id) on delete cascade,
  title text not null check (length(title) between 1 and 200),
  content text check (length(content) <= 20000),
  duration_minutes int check (duration_minutes between 1 and 10000),
  sort_order int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid
);
create index on public.lessons(section_id, sort_order);

create table public.learning_materials (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete cascade,
  file_id uuid references public.file_metadata(id) on delete set null,
  label text not null check (length(label) between 1 and 200),
  url text check (length(url) <= 1000),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid
);
create index on public.learning_materials(course_id);

create table public.course_competency_mappings (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  competency_id uuid not null references public.competencies(id) on delete cascade,
  target_level int not null check (target_level between 1 and 5),
  unique (course_id, competency_id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid
);
create index on public.course_competency_mappings(competency_id);

create table public.learning_paths (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 3 and 160),
  description text check (length(description) <= 4000),
  competency_id uuid references public.competencies(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','active','archived')),
  version int not null default 1,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid
);

create table public.learning_path_courses (
  id uuid primary key default gen_random_uuid(),
  path_id uuid not null references public.learning_paths(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  sort_order int not null default 0,
  unique (path_id, course_id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid
);

create table public.course_enrollments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  source text not null default 'direct' check (source in ('direct','development_plan','learning_path')),
  development_plan_item_id uuid,
  status text not null default 'assigned' check (status in ('assigned','in_progress','completed')),
  assigned_by uuid default auth.uid(),
  assigned_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (course_id, employee_id),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid
);
create index on public.course_enrollments(employee_id, status);

create table public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.course_enrollments(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  completed_at timestamptz,
  unique (enrollment_id, lesson_id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid
);

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null check (length(title) between 3 and 160),
  pass_score int not null default 70 check (pass_score between 1 and 100),
  max_attempts int not null default 3 check (max_attempts between 1 and 20),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid
);
create index on public.quizzes(course_id);

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  question text not null check (length(question) between 3 and 2000),
  options jsonb not null,
  correct_index int not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid
);
create index on public.quiz_questions(quiz_id, sort_order);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete restrict,
  enrollment_id uuid not null references public.course_enrollments(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  attempt_no int not null,
  answers jsonb not null,
  score int not null check (score between 0 and 100),
  passed boolean not null,
  started_at timestamptz not null default now(),
  submitted_at timestamptz not null default now(),
  unique (quiz_id, employee_id, attempt_no),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid
);
create index on public.quiz_attempts(employee_id);

create table public.course_completions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  enrollment_id uuid not null references public.course_enrollments(id) on delete restrict,
  score int,
  completed_at timestamptz not null default now(),
  unique (course_id, employee_id),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid
);

create or replace function public.can_manage_learning() returns boolean
language sql stable security definer set search_path=public as $$
  select public.has_perm('learn.manage') or public.has_perm('learn.approve')
$$;

create or replace function public.can_manage_training() returns boolean
language sql stable security definer set search_path=public as $$
  select public.has_perm('train.manage')
$$;

create or replace function public.can_review_ai() returns boolean
language sql stable security definer set search_path=public as $$
  select public.has_perm('ai.review')
$$;

create or replace function public.can_view_development(_emp uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select _emp = public.my_employee_id()
    or public.is_supervisor_of(_emp) or public.is_dept_head_of(_emp)
    or public.has_perm('hr.employees') or public.has_perm('train.manage') or public.has_perm('learn.manage')
$$;

create or replace function public.course_visible(_course uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.courses c where c.id=_course and (c.status='approved' or public.can_manage_learning()))
$$;

grant select on public.courses, public.course_sections, public.lessons, public.learning_materials,
  public.course_competency_mappings, public.learning_paths, public.learning_path_courses,
  public.course_enrollments, public.lesson_progress, public.quizzes, public.quiz_questions,
  public.quiz_attempts, public.course_completions to authenticated;
grant all on public.courses, public.course_sections, public.lessons, public.learning_materials,
  public.course_competency_mappings, public.learning_paths, public.learning_path_courses,
  public.course_enrollments, public.lesson_progress, public.quizzes, public.quiz_questions,
  public.quiz_attempts, public.course_completions to service_role;

do $$ declare t text; begin
  foreach t in array array['courses','course_sections','lessons','learning_materials','course_competency_mappings',
    'learning_paths','learning_path_courses','course_enrollments','lesson_progress','quizzes','quiz_questions',
    'quiz_attempts','course_completions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create trigger touch before update on public.%I for each row execute function public.tg_touch()', t);
  end loop;
  foreach t in array array['courses','learning_paths','course_enrollments','quizzes','quiz_attempts','course_completions'] loop
    execute format('create trigger audit after insert or update or delete on public.%I for each row execute function public.tg_audit()', t);
  end loop;
end $$;

create policy "courses visible" on public.courses for select to authenticated
  using (status='approved' or public.can_manage_learning());
create policy "sections via course" on public.course_sections for select to authenticated
  using (public.course_visible(course_id));
create policy "lessons via course" on public.lessons for select to authenticated
  using (exists(select 1 from public.course_sections s where s.id=section_id and public.course_visible(s.course_id)));
create policy "materials via course" on public.learning_materials for select to authenticated
  using (public.course_visible(course_id));
create policy "mappings via course" on public.course_competency_mappings for select to authenticated
  using (public.course_visible(course_id));
create policy "paths visible" on public.learning_paths for select to authenticated
  using (status='active' or public.can_manage_learning());
create policy "path courses via path" on public.learning_path_courses for select to authenticated
  using (exists(select 1 from public.learning_paths p where p.id=path_id and (p.status='active' or public.can_manage_learning())));
create policy "enrollments scoped" on public.course_enrollments for select to authenticated
  using (employee_id=public.my_employee_id() or public.can_manage_learning() or public.can_manage_training()
    or public.is_supervisor_of(employee_id) or public.is_dept_head_of(employee_id));
create policy "lesson progress scoped" on public.lesson_progress for select to authenticated
  using (exists(select 1 from public.course_enrollments e where e.id=enrollment_id and
    (e.employee_id=public.my_employee_id() or public.can_manage_learning() or public.can_manage_training()
     or public.is_supervisor_of(e.employee_id) or public.is_dept_head_of(e.employee_id))));
create policy "quizzes via course" on public.quizzes for select to authenticated
  using (public.course_visible(course_id));
create policy "questions manage only" on public.quiz_questions for select to authenticated
  using (public.can_manage_learning());
create policy "attempts scoped" on public.quiz_attempts for select to authenticated
  using (employee_id=public.my_employee_id() or public.can_manage_learning() or public.can_manage_training());
create policy "completions scoped" on public.course_completions for select to authenticated
  using (employee_id=public.my_employee_id() or public.can_manage_learning() or public.can_manage_training()
    or public.is_supervisor_of(employee_id) or public.is_dept_head_of(employee_id));
-- Phase 5, stage 2: training & development, AI, and outbox tables with grants, RLS, policies, triggers.
create table public.development_plans (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  title text not null check (length(title) between 3 and 160),
  objectives text check (length(objectives) <= 4000),
  responsible_id uuid references public.employees(id) on delete set null,
  target_date date,
  status text not null default 'draft' check (status in ('draft','active','completed','cancelled')),
  notes text check (length(notes) <= 4000),
  version int not null default 1,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid
);
create index on public.development_plans(employee_id, status);

create table public.development_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.development_plans(id) on delete cascade,
  item_type text not null check (item_type in ('course','learning_path','training','other')),
  title text not null check (length(title) between 3 and 200),
  description text check (length(description) <= 4000),
  competency_id uuid references public.competencies(id) on delete set null,
  course_id uuid references public.courses(id) on delete set null,
  learning_path_id uuid references public.learning_paths(id) on delete set null,
  training_session_id uuid,
  gap_snapshot_id uuid,
  ai_recommendation_id uuid,
  priority text not null default 'medium' check (priority in ('high','medium','low')),
  target_date date,
  status text not null default 'pending' check (status in ('pending','in_progress','completed','cancelled')),
  completed_at timestamptz,
  evidence text check (length(evidence) <= 4000),
  version int not null default 1,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid
);
create index on public.development_plan_items(plan_id);

create table public.trainers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 160),
  email text check (length(email) <= 200),
  specialty text check (length(specialty) <= 200),
  is_external boolean not null default false,
  status text not null default 'active' check (status in ('active','inactive')),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid
);

create table public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (length(code) between 1 and 20),
  title text not null check (length(title) between 3 and 160),
  type text not null default 'workshop' check (type in ('workshop','seminar','on_the_job','e_learning','drill')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  venue text check (length(venue) <= 200),
  delivery_method text not null default 'in_person' check (delivery_method in ('in_person','virtual','hybrid')),
  trainer_id uuid references public.trainers(id) on delete set null,
  capacity int check (capacity between 1 and 10000),
  status text not null default 'planned' check (status in ('planned','in_progress','completed','cancelled')),
  related_competency_id uuid references public.competencies(id) on delete set null,
  version int not null default 1,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid,
  check (ends_at > starts_at)
);
create index on public.training_sessions(starts_at);
create index on public.training_sessions(status);

create table public.training_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  development_plan_item_id uuid references public.development_plan_items(id) on delete set null,
  status text not null default 'registered' check (status in ('registered','attended','absent','excused')),
  unique (session_id, employee_id),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid
);
create index on public.training_participants(employee_id);

create table public.training_attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  status text not null check (status in ('present','absent','late','excused')),
  remarks text check (length(remarks) <= 2000),
  recorded_by uuid default auth.uid(),
  recorded_at timestamptz not null default now(),
  unique (session_id, employee_id),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid
);

create table public.training_results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  score numeric(5,2) check (score between 0 and 100),
  outcome text not null check (outcome in ('passed','failed','completed','incomplete')),
  feedback text check (length(feedback) <= 4000),
  evidence text check (length(evidence) <= 4000),
  recorded_by uuid default auth.uid(),
  unique (session_id, employee_id),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid
);

create table public.training_effectiveness_reviews (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  reviewer_id uuid references public.employees(id) on delete set null,
  summary text not null check (length(summary) between 3 and 4000),
  follow_up_required boolean not null default false,
  follow_up_notes text check (length(follow_up_notes) <= 4000),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid
);

create table public.competency_reassessments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  competency_id uuid not null references public.competencies(id) on delete restrict,
  session_id uuid references public.training_sessions(id) on delete set null,
  assessment_id uuid not null references public.competency_assessments(id) on delete restrict,
  notes text check (length(notes) <= 2000),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid
);

create table public.ai_recommendations (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  competency_id uuid not null references public.competencies(id) on delete restrict,
  required_level int not null check (required_level between 1 and 5),
  current_level int check (current_level between 1 and 5),
  gap int not null check (gap between 0 and 4),
  gap_snapshot_id uuid,
  recommendation_type text not null check (recommendation_type in ('course','learning_path','training')),
  resource_id uuid not null,
  rationale text not null check (length(rationale) between 3 and 4000),
  expected_outcome text check (length(expected_outcome) <= 4000),
  priority text not null default 'medium' check (priority in ('high','medium','low')),
  status text not null default 'pending_review' check (status in ('pending_review','accepted','edited','rejected')),
  model text not null,
  generated_by uuid not null,
  sources jsonb not null default '[]'::jsonb,
  version int not null default 1,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid
);
create index on public.ai_recommendations(status);
create index on public.ai_recommendations(employee_id);

create table public.ai_recommendation_reviews (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null references public.ai_recommendations(id) on delete cascade,
  reviewer_id uuid not null,
  decision text not null check (decision in ('accept','edit','reject')),
  comments text check (length(comments) <= 4000),
  edited jsonb,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid
);

create table public.ai_generation_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  employee_id uuid,
  model text not null,
  status text not null check (status in ('success','error','invalid')),
  error text,
  latency_ms int,
  created_at timestamptz not null default now()
);
create index on public.ai_generation_logs(created_at desc);

create table public.ai_integration_settings (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'gemini' check (provider = 'gemini'),
  model text not null default 'gemini-2.5-flash',
  last_status text check (last_status in ('ok','error')),
  last_error text,
  last_checked_at timestamptz,
  version int not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid
);
insert into public.ai_integration_settings(provider, model) values ('gemini','gemini-2.5-flash');

create table public.outbox_events (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('notification','email','ai_call')),
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','processing','sent','dead')),
  attempts int not null default 0,
  last_error text,
  next_retry_at timestamptz not null default now(),
  processed_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid
);
create index on public.outbox_events(status, next_retry_at) where status in ('pending','processing');

grant select on public.development_plans, public.development_plan_items,
  public.trainers, public.training_sessions, public.training_participants, public.training_attendance,
  public.training_results, public.training_effectiveness_reviews, public.competency_reassessments,
  public.ai_recommendations, public.ai_recommendation_reviews, public.ai_generation_logs,
  public.ai_integration_settings to authenticated;
grant all on public.development_plans, public.development_plan_items,
  public.trainers, public.training_sessions, public.training_participants, public.training_attendance,
  public.training_results, public.training_effectiveness_reviews, public.competency_reassessments,
  public.ai_recommendations, public.ai_recommendation_reviews, public.ai_generation_logs,
  public.ai_integration_settings, public.outbox_events to service_role;

do $$ declare t text; begin
  foreach t in array array['development_plans','development_plan_items','trainers','training_sessions',
    'training_participants','training_attendance','training_results','training_effectiveness_reviews',
    'competency_reassessments','ai_recommendations','ai_recommendation_reviews',
    'ai_integration_settings','outbox_events'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create trigger touch before update on public.%I for each row execute function public.tg_touch()', t);
  end loop;
  execute format('alter table public.%I enable row level security', 'ai_generation_logs');
  foreach t in array array['development_plans','development_plan_items','trainers','training_sessions','training_participants',
    'training_attendance','training_results','training_effectiveness_reviews','competency_reassessments',
    'ai_recommendations','ai_recommendation_reviews','ai_integration_settings'] loop
    execute format('create trigger audit after insert or update or delete on public.%I for each row execute function public.tg_audit()', t);
  end loop;
end $$;

create policy "plans scoped" on public.development_plans for select to authenticated
  using (public.can_view_development(employee_id));
create policy "plan items scoped" on public.development_plan_items for select to authenticated
  using (exists(select 1 from public.development_plans p where p.id=plan_id and public.can_view_development(p.employee_id)));
create policy "trainers visible" on public.trainers for select to authenticated
  using (status='active' or public.can_manage_training());
create policy "sessions scoped" on public.training_sessions for select to authenticated
  using (public.can_manage_training() or public.has_perm('hr.employees')
    or exists(select 1 from public.training_participants tp where tp.session_id=id and
      (tp.employee_id=public.my_employee_id() or public.is_supervisor_of(tp.employee_id) or public.is_dept_head_of(tp.employee_id))));
create policy "participants scoped" on public.training_participants for select to authenticated
  using (employee_id=public.my_employee_id() or public.can_manage_training() or public.has_perm('hr.employees')
    or public.is_supervisor_of(employee_id) or public.is_dept_head_of(employee_id));
create policy "attendance scoped" on public.training_attendance for select to authenticated
  using (employee_id=public.my_employee_id() or public.can_manage_training() or public.has_perm('hr.employees')
    or public.is_supervisor_of(employee_id) or public.is_dept_head_of(employee_id));
create policy "results scoped" on public.training_results for select to authenticated
  using (employee_id=public.my_employee_id() or public.can_manage_training() or public.has_perm('hr.employees')
    or public.is_supervisor_of(employee_id) or public.is_dept_head_of(employee_id));
create policy "effectiveness manage" on public.training_effectiveness_reviews for select to authenticated
  using (public.can_manage_training() or public.has_perm('hr.employees'));
create policy "reassessments scoped" on public.competency_reassessments for select to authenticated
  using (public.can_view_comp(employee_id));
create policy "ai recs scoped" on public.ai_recommendations for select to authenticated
  using (public.can_review_ai() or public.has_perm('ai.generate')
    or public.is_supervisor_of(employee_id) or public.is_dept_head_of(employee_id));
create policy "ai reviews scoped" on public.ai_recommendation_reviews for select to authenticated
  using (public.can_review_ai());
create policy "ai logs scoped" on public.ai_generation_logs for select to authenticated
  using (public.can_review_ai() or public.has_perm('admin.audit'));
create policy "ai settings scoped" on public.ai_integration_settings for select to authenticated
  using (public.has_perm('admin.settings') or public.can_review_ai());

create or replace function public._notify(_user uuid, _title text, _body text, _link text, _kind text default 'info') returns void
language plpgsql security definer set search_path=public as $$
begin
  if _user is not null then
    insert into public.notifications(user_id,title,body,link,kind) values (_user,_title,_body,_link,_kind);
    insert into public.outbox_events(kind,payload) values ('email', jsonb_build_object('user_id',_user,'title',_title,'body',_body,'link',_link));
  end if;
end $$;
-- Phase 5, stage 3: self-authorizing write operations for learning, training, development plans, AI, outbox.
create or replace function public.upsert_course(_id uuid, _d jsonb, _version int) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.courses;
begin
  if not public.has_perm('learn.manage') then raise exception 'FORBIDDEN'; end if;
  if _id is null then
    insert into public.courses(code,title,description,category,objectives,owner_id,duration_minutes,difficulty,enrollment_open,completion_rule)
    values (_d->>'code',_d->>'title',nullif(_d->>'description',''),nullif(_d->>'category',''),nullif(_d->>'objectives',''),
      nullif(_d->>'owner_id','')::uuid,nullif(_d->>'duration_minutes','')::int,coalesce(_d->>'difficulty','beginner'),
      coalesce((_d->>'enrollment_open')::boolean,true),coalesce(_d->>'completion_rule','all_lessons')) returning * into r;
  else
    update public.courses set code=_d->>'code',title=_d->>'title',description=nullif(_d->>'description',''),
      category=nullif(_d->>'category',''),objectives=nullif(_d->>'objectives',''),owner_id=nullif(_d->>'owner_id','')::uuid,
      duration_minutes=nullif(_d->>'duration_minutes','')::int,difficulty=coalesce(_d->>'difficulty',difficulty),
      enrollment_open=coalesce((_d->>'enrollment_open')::boolean,enrollment_open),
      completion_rule=coalesce(_d->>'completion_rule',completion_rule)
    where id=_id and version=_version and status in ('draft','pending_review') returning * into r;
    if not found then
      if exists(select 1 from public.courses where id=_id and status in ('draft','pending_review')) then
        raise exception 'CONFLICT: this course was changed by someone else'; end if;
      if exists(select 1 from public.courses where id=_id) then
        raise exception 'RULE: only draft or pending courses can be edited'; end if;
      raise exception 'NOT_FOUND';
    end if;
  end if;
  return to_jsonb(r);
end $$;

create or replace function public.save_course_content(_course uuid, _sections jsonb, _version int) returns jsonb
language plpgsql security definer set search_path=public as $$
declare s jsonb; l jsonb; sec_id uuid; n int;
begin
  if not public.has_perm('learn.manage') then raise exception 'FORBIDDEN'; end if;
  update public.courses set id=id where id=_course and version=_version and status in ('draft','pending_review');
  if not found then
    if exists(select 1 from public.courses where id=_course and status in ('draft','pending_review')) then
      raise exception 'CONFLICT: this course was changed by someone else'; end if;
    if exists(select 1 from public.courses where id=_course) then
      raise exception 'RULE: only draft or pending courses can be edited'; end if;
    raise exception 'NOT_FOUND';
  end if;
  delete from public.course_sections where course_id=_course;
  n := 0;
  for s in select * from jsonb_array_elements(_sections) loop
    insert into public.course_sections(course_id,title,description,sort_order)
    values (_course, s->>'title', nullif(s->>'description',''), n) returning id into sec_id;
    n := n + 1;
    for l in select * from jsonb_array_elements(coalesce(s->'lessons','[]'::jsonb)) loop
      insert into public.lessons(section_id,title,content,duration_minutes,sort_order)
      values (sec_id, l->>'title', nullif(l->>'content',''), nullif(l->>'duration_minutes','')::int,
        coalesce((l->>'sort_order')::int,0));
    end loop;
  end loop;
  update public.courses set version=version+1, updated_by=auth.uid() where id=_course;
  return jsonb_build_object('id',_course,'sections',n);
end $$;

create or replace function public.set_course_competencies(_course uuid, _mappings jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare m jsonb; n int := 0;
begin
  if not public.has_perm('learn.manage') then raise exception 'FORBIDDEN'; end if;
  if not exists(select 1 from public.courses where id=_course and status in ('draft','pending_review')) then
    raise exception 'RULE: only draft or pending courses can be edited'; end if;
  delete from public.course_competency_mappings where course_id=_course;
  for m in select * from jsonb_array_elements(_mappings) loop
    insert into public.course_competency_mappings(course_id,competency_id,target_level)
    values (_course,(m->>'competency_id')::uuid,(m->>'target_level')::int);
    n := n + 1;
  end loop;
  return jsonb_build_object('id',_course,'mappings',n);
end $$;

create or replace function public.submit_course(_id uuid, _idem uuid, _hash text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.courses; resp jsonb;
begin
  if not public.has_perm('learn.manage') then raise exception 'FORBIDDEN'; end if;
  resp := public._idem_get(_idem,'submit_course',_hash);
  if resp is not null then return resp; end if;
  select * into r from public.courses where id=_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  perform public.assert_transition('course',r.status,'pending_review');
  if not exists(select 1 from public.course_sections where course_id=_id) then
    raise exception 'RULE: add at least one section before submitting'; end if;
  update public.courses set status='pending_review', updated_by=auth.uid() where id=_id;
  insert into public.approval_tasks(workflow_type,record_id,record_label,employee_id,submitted_by,assignee_role)
  values ('course_publication',_id,'Course publication: '||r.title,null,auth.uid(),'hr_admin');
  perform public._notify_role('hr_admin','Course awaiting approval','"'||r.title||'" was submitted for publication.','/approvals');
  return public._idem_put(_idem,'submit_course',_hash,jsonb_build_object('id',_id,'status','pending_review'));
end $$;

create or replace function public.archive_course(_id uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.courses;
begin
  if not public.has_perm('learn.manage') then raise exception 'FORBIDDEN'; end if;
  select * into r from public.courses where id=_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  perform public.assert_transition('course',r.status,'archived');
  update public.courses set status='archived', updated_by=auth.uid() where id=_id;
  return jsonb_build_object('id',_id,'status','archived');
end $$;

create or replace function public.enroll_course(_course uuid, _employee uuid, _source text, _plan_item uuid, _idem uuid, _hash text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare c public.courses; e public.course_enrollments; resp jsonb;
begin
  resp := public._idem_get(_idem,'enroll_course',_hash);
  if resp is not null then return resp; end if;
  select * into c from public.courses where id=_course;
  if not found then raise exception 'NOT_FOUND'; end if;
  if _employee = public.my_employee_id() then
    if not (c.status='approved' and c.enrollment_open) then raise exception 'RULE: this course is not open for self-enrollment'; end if;
  elsif not (public.can_manage_learning() or public.can_manage_training()
      or public.is_supervisor_of(_employee) or public.is_dept_head_of(_employee) or public.has_perm('hr.employees')) then
    raise exception 'FORBIDDEN';
  end if;
  if c.status <> 'approved' then raise exception 'RULE: only published courses can be assigned'; end if;
  insert into public.course_enrollments(course_id,employee_id,source,development_plan_item_id)
  values (_course,_employee,coalesce(_source,'direct'),_plan_item)
  on conflict (course_id,employee_id) do nothing returning * into e;
  if not found then
    select * into e from public.course_enrollments where course_id=_course and employee_id=_employee;
    return public._idem_put(_idem,'enroll_course',_hash,jsonb_build_object('id',e.id,'status',e.status,'existing',true));
  end if;
  perform public._notify((select user_id from public.employees where id=_employee),
    'New course assigned','You were enrolled in "'||c.title||'".','/learning/course/'||_course,'assignment');
  return public._idem_put(_idem,'enroll_course',_hash,jsonb_build_object('id',e.id,'status',e.status));
end $$;

-- completion check: all lessons done and quiz passed when required. NEVER touches competency levels (rule 9).
create or replace function public._maybe_complete_course(_enrollment uuid) returns void
language plpgsql security definer set search_path=public as $$
declare e public.course_enrollments; c public.courses; lessons_done boolean; quiz_ok boolean; best_score int;
begin
  select * into e from public.course_enrollments where id=_enrollment;
  if not found or e.status='completed' then return; end if;
  select * into c from public.courses where id=e.course_id;
  select not exists(
    select 1 from public.lessons l join public.course_sections s on s.id=l.section_id
    where s.course_id=c.id and not exists(
      select 1 from public.lesson_progress lp where lp.enrollment_id=e.id and lp.lesson_id=l.id and lp.completed_at is not null))
  into lessons_done;
  select case when qz.id is null then true else exists(
      select 1 from public.quiz_attempts qa where qa.quiz_id=qz.id and qa.employee_id=e.employee_id and qa.passed)
    end into quiz_ok
  from (select id from public.quizzes where course_id=c.id order by created_at limit 1) qz;
  quiz_ok := coalesce(quiz_ok, true);
  if (c.completion_rule='all_lessons' and lessons_done)
     or (c.completion_rule='quiz_pass' and quiz_ok)
     or (c.completion_rule='all_lessons_and_quiz' and lessons_done and quiz_ok) then
    select max(score) into best_score from public.quiz_attempts qa
      join public.quizzes q on q.id=qa.quiz_id where q.course_id=c.id and qa.employee_id=e.employee_id;
    update public.course_enrollments set status='completed', completed_at=now(), updated_by=auth.uid() where id=e.id;
    insert into public.course_completions(course_id,employee_id,enrollment_id,score)
    values (c.id,e.employee_id,e.id,best_score) on conflict (course_id,employee_id) do nothing;
    perform public._notify((select user_id from public.employees where id=e.employee_id),
      'Course completed','You completed "'||c.title||'". A reassessment with evidence is still needed before any competency gap closes.','/learning/course/'||c.id,'success');
  else
    update public.course_enrollments set status='in_progress', updated_by=auth.uid()
    where id=e.id and status='assigned';
  end if;
end $$;

create or replace function public.save_lesson_progress(_enrollment uuid, _lesson uuid, _completed boolean) returns jsonb
language plpgsql security definer set search_path=public as $$
declare e public.course_enrollments;
begin
  select * into e from public.course_enrollments where id=_enrollment;
  if not found then raise exception 'NOT_FOUND'; end if;
  if e.employee_id <> public.my_employee_id() then raise exception 'FORBIDDEN: only the enrolled learner records progress'; end if;
  if e.status='completed' then raise exception 'RULE: this course is already completed'; end if;
  if not exists(select 1 from public.lessons l join public.course_sections s on s.id=l.section_id
    where l.id=_lesson and s.course_id=e.course_id) then raise exception 'NOT_FOUND'; end if;
  insert into public.lesson_progress(enrollment_id,lesson_id,completed_at)
  values (_enrollment,_lesson,case when _completed then now() end)
  on conflict (enrollment_id,lesson_id) do update set completed_at=case when _completed then now() else null end, updated_by=auth.uid();
  if _completed then perform public._maybe_complete_course(_enrollment); end if;
  return jsonb_build_object('enrollment',_enrollment,'lesson',_lesson,'completed',_completed);
end $$;

create or replace function public.get_quiz_questions(_quiz uuid) returns jsonb
language sql stable security definer set search_path=public as $$
  select case
    when not (public.can_manage_learning() or exists(
      select 1 from public.quizzes q join public.course_enrollments e on e.course_id=q.course_id
      where q.id=_quiz and e.employee_id=public.my_employee_id())) then null
    else (select jsonb_agg(jsonb_build_object('id',qq.id,'question',qq.question,'options',qq.options) order by qq.sort_order)
          from public.quiz_questions qq where qq.quiz_id=_quiz)
  end
$$;

create or replace function public.submit_quiz_attempt(_quiz uuid, _enrollment uuid, _answers jsonb, _idem uuid, _hash text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare q public.quizzes; e public.course_enrollments; total int; correct int; score int; passed boolean; attempt int; resp jsonb;
begin
  resp := public._idem_get(_idem,'submit_quiz_attempt',_hash);
  if resp is not null then return resp; end if;
  select * into q from public.quizzes where id=_quiz;
  if not found then raise exception 'NOT_FOUND'; end if;
  select * into e from public.course_enrollments where id=_enrollment and course_id=q.course_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  if e.employee_id <> public.my_employee_id() then raise exception 'FORBIDDEN: only the enrolled learner takes the quiz'; end if;
  select count(*) into total from public.quiz_questions where quiz_id=_quiz;
  if total = 0 then raise exception 'RULE: this quiz has no questions'; end if;
  select coalesce(max(attempt_no),0)+1 into attempt from public.quiz_attempts where quiz_id=_quiz and employee_id=e.employee_id;
  if attempt > q.max_attempts then raise exception 'RULE: maximum attempts reached'; end if;
  select count(*) into correct from public.quiz_questions qq
  where qq.quiz_id=_quiz and (_answers->>qq.id::text)::int = qq.correct_index;
  score := round(correct::numeric * 100 / total);
  passed := score >= q.pass_score;
  insert into public.quiz_attempts(quiz_id,enrollment_id,employee_id,attempt_no,answers,score,passed)
  values (_quiz,_enrollment,e.employee_id,attempt,_answers,score,passed);
  if passed then perform public._maybe_complete_course(_enrollment); end if;
  return public._idem_put(_idem,'submit_quiz_attempt',_hash,
    jsonb_build_object('score',score,'passed',passed,'attempt',attempt,'max_attempts',q.max_attempts));
end $$;

create or replace function public.upsert_learning_path(_id uuid, _d jsonb, _version int) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.learning_paths;
begin
  if not public.has_perm('learn.manage') then raise exception 'FORBIDDEN'; end if;
  if _id is null then
    insert into public.learning_paths(title,description,competency_id,status)
    values (_d->>'title',nullif(_d->>'description',''),nullif(_d->>'competency_id','')::uuid,coalesce(_d->>'status','draft'))
    returning * into r;
  else
    update public.learning_paths set title=_d->>'title',description=nullif(_d->>'description',''),
      competency_id=nullif(_d->>'competency_id','')::uuid,status=coalesce(_d->>'status',status)
    where id=_id and version=_version returning * into r;
    if not found then
      if exists(select 1 from public.learning_paths where id=_id) then raise exception 'CONFLICT: this path was changed by someone else'; end if;
      raise exception 'NOT_FOUND';
    end if;
  end if;
  return to_jsonb(r);
end $$;

create or replace function public.set_path_courses(_path uuid, _course_ids jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare c jsonb; n int := 0;
begin
  if not public.has_perm('learn.manage') then raise exception 'FORBIDDEN'; end if;
  if not exists(select 1 from public.learning_paths where id=_path) then raise exception 'NOT_FOUND'; end if;
  delete from public.learning_path_courses where path_id=_path;
  for c in select * from jsonb_array_elements(_course_ids) loop
    insert into public.learning_path_courses(path_id,course_id,sort_order) values (_path,(c#>>'{}')::uuid,n);
    n := n + 1;
  end loop;
  return jsonb_build_object('id',_path,'courses',n);
end $$;

create or replace function public.upsert_development_plan(_id uuid, _d jsonb, _version int) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.development_plans; emp uuid;
begin
  emp := coalesce((_d->>'employee_id')::uuid, (select employee_id from public.development_plans where id=_id));
  if not (public.can_manage_training() or public.has_perm('hr.employees')
      or public.is_supervisor_of(emp) or public.is_dept_head_of(emp)) then raise exception 'FORBIDDEN'; end if;
  if _id is null then
    insert into public.development_plans(employee_id,title,objectives,responsible_id,target_date,status,notes)
    values (emp,_d->>'title',nullif(_d->>'objectives',''),nullif(_d->>'responsible_id','')::uuid,
      nullif(_d->>'target_date','')::date,coalesce(_d->>'status','draft'),nullif(_d->>'notes','')) returning * into r;
  else
    update public.development_plans set title=_d->>'title',objectives=nullif(_d->>'objectives',''),
      responsible_id=nullif(_d->>'responsible_id','')::uuid,target_date=nullif(_d->>'target_date','')::date,
      status=coalesce(_d->>'status',status),notes=nullif(_d->>'notes','')
    where id=_id and version=_version returning * into r;
    if not found then
      if exists(select 1 from public.development_plans where id=_id) then raise exception 'CONFLICT: this plan was changed by someone else'; end if;
      raise exception 'NOT_FOUND';
    end if;
  end if;
  return to_jsonb(r);
end $$;

create or replace function public.save_plan_item(_id uuid, _plan uuid, _d jsonb, _version int) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.development_plan_items; p public.development_plans;
begin
  select * into p from public.development_plans where id=_plan;
  if not found then raise exception 'NOT_FOUND'; end if;
  if not (public.can_manage_training() or public.has_perm('hr.employees')
      or public.is_supervisor_of(p.employee_id) or public.is_dept_head_of(p.employee_id)) then raise exception 'FORBIDDEN'; end if;
  if _id is null then
    insert into public.development_plan_items(plan_id,item_type,title,description,competency_id,course_id,learning_path_id,
      training_session_id,gap_snapshot_id,priority,target_date)
    values (_plan,_d->>'item_type',_d->>'title',nullif(_d->>'description',''),nullif(_d->>'competency_id','')::uuid,
      nullif(_d->>'course_id','')::uuid,nullif(_d->>'learning_path_id','')::uuid,nullif(_d->>'training_session_id','')::uuid,
      nullif(_d->>'gap_snapshot_id','')::uuid,coalesce(_d->>'priority','medium'),nullif(_d->>'target_date','')::date)
    returning * into r;
  else
    update public.development_plan_items set title=_d->>'title',description=nullif(_d->>'description',''),
      priority=coalesce(_d->>'priority',priority),target_date=nullif(_d->>'target_date','')::date
    where id=_id and plan_id=_plan and version=_version returning * into r;
    if not found then
      if exists(select 1 from public.development_plan_items where id=_id) then raise exception 'CONFLICT: this item was changed by someone else'; end if;
      raise exception 'NOT_FOUND';
    end if;
  end if;
  return to_jsonb(r);
end $$;

create or replace function public.set_plan_item_status(_item uuid, _status text, _evidence text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.development_plan_items; p public.development_plans;
begin
  select * into r from public.development_plan_items where id=_item;
  if not found then raise exception 'NOT_FOUND'; end if;
  select * into p from public.development_plans where id=r.plan_id;
  if p.employee_id = public.my_employee_id() then
    if _status not in ('in_progress','completed') then raise exception 'RULE: you can only start or complete your own items'; end if;
  elsif not (public.can_manage_training() or public.has_perm('hr.employees')
      or public.is_supervisor_of(p.employee_id) or public.is_dept_head_of(p.employee_id)) then
    raise exception 'FORBIDDEN';
  end if;
  perform public.assert_transition('plan_item',r.status,_status);
  update public.development_plan_items set status=_status,
    completed_at=case when _status='completed' then now() end,
    evidence=coalesce(nullif(_evidence,''),evidence), updated_by=auth.uid()
  where id=_item returning * into r;
  return to_jsonb(r);
end $$;

create or replace function public.upsert_trainer(_id uuid, _d jsonb, _version int) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.trainers;
begin
  if not public.can_manage_training() then raise exception 'FORBIDDEN'; end if;
  if _id is null then
    insert into public.trainers(name,email,specialty,is_external)
    values (_d->>'name',nullif(_d->>'email',''),nullif(_d->>'specialty',''),coalesce((_d->>'is_external')::boolean,false))
    returning * into r;
  else
    update public.trainers set name=_d->>'name',email=nullif(_d->>'email',''),specialty=nullif(_d->>'specialty',''),
      is_external=coalesce((_d->>'is_external')::boolean,is_external),status=coalesce(_d->>'status',status)
    where id=_id returning * into r;
    if not found then raise exception 'NOT_FOUND'; end if;
  end if;
  return to_jsonb(r);
end $$;

create or replace function public.upsert_training_session(_id uuid, _d jsonb, _version int) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.training_sessions;
begin
  if not public.can_manage_training() then raise exception 'FORBIDDEN'; end if;
  if _id is null then
    insert into public.training_sessions(code,title,type,starts_at,ends_at,venue,delivery_method,trainer_id,capacity,related_competency_id)
    values (_d->>'code',_d->>'title',coalesce(_d->>'type','workshop'),(_d->>'starts_at')::timestamptz,(_d->>'ends_at')::timestamptz,
      nullif(_d->>'venue',''),coalesce(_d->>'delivery_method','in_person'),nullif(_d->>'trainer_id','')::uuid,
      nullif(_d->>'capacity','')::int,nullif(_d->>'related_competency_id','')::uuid) returning * into r;
  else
    update public.training_sessions set code=_d->>'code',title=_d->>'title',type=coalesce(_d->>'type',type),
      starts_at=(_d->>'starts_at')::timestamptz,ends_at=(_d->>'ends_at')::timestamptz,venue=nullif(_d->>'venue',''),
      delivery_method=coalesce(_d->>'delivery_method',delivery_method),trainer_id=nullif(_d->>'trainer_id','')::uuid,
      capacity=nullif(_d->>'capacity','')::int,related_competency_id=nullif(_d->>'related_competency_id','')::uuid
    where id=_id and version=_version returning * into r;
    if not found then
      if exists(select 1 from public.training_sessions where id=_id) then raise exception 'CONFLICT: this session was changed by someone else'; end if;
      raise exception 'NOT_FOUND';
    end if;
  end if;
  return to_jsonb(r);
end $$;

create or replace function public.set_session_status(_id uuid, _status text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.training_sessions;
begin
  if not public.can_manage_training() then raise exception 'FORBIDDEN'; end if;
  select * into r from public.training_sessions where id=_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  perform public.assert_transition('training_session',r.status,_status);
  update public.training_sessions set status=_status, updated_by=auth.uid() where id=_id;
  return jsonb_build_object('id',_id,'status',_status);
end $$;

create or replace function public.register_participant(_session uuid, _employee uuid, _plan_item uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare s public.training_sessions; n int;
begin
  if not (public.can_manage_training() or public.has_perm('hr.employees')
      or public.is_supervisor_of(_employee) or public.is_dept_head_of(_employee)) then raise exception 'FORBIDDEN'; end if;
  select * into s from public.training_sessions where id=_session;
  if not found then raise exception 'NOT_FOUND'; end if;
  if s.status not in ('planned','in_progress') then raise exception 'RULE: registration is closed for this session'; end if;
  select count(*) into n from public.training_participants where session_id=_session;
  if s.capacity is not null and n >= s.capacity then raise exception 'RULE: this session is full'; end if;
  insert into public.training_participants(session_id,employee_id,development_plan_item_id)
  values (_session,_employee,_plan_item) on conflict (session_id,employee_id) do nothing;
  perform public._notify((select user_id from public.employees where id=_employee),
    'Training session assigned','You are registered for "'||s.title||'" on '||to_char(s.starts_at,'DD Mon YYYY HH24:MI')||'.',
    '/training/sessions/'||_session,'assignment');
  return jsonb_build_object('session',_session,'employee',_employee);
end $$;

create or replace function public.save_attendance(_session uuid, _rows jsonb, _idem uuid, _hash text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare rw jsonb; n int := 0; resp jsonb;
begin
  if not public.can_manage_training() then raise exception 'FORBIDDEN'; end if;
  if not exists(select 1 from public.training_sessions where id=_session) then raise exception 'NOT_FOUND'; end if;
  resp := public._idem_get(_idem,'save_attendance',_hash);
  if resp is not null then return resp; end if;
  for rw in select * from jsonb_array_elements(_rows) loop
    if not exists(select 1 from public.training_participants where session_id=_session and employee_id=(rw->>'employee_id')::uuid) then
      raise exception 'RULE: every attendee must be a registered participant';
    end if;
    insert into public.training_attendance(session_id,employee_id,status,remarks,recorded_by,recorded_at)
    values (_session,(rw->>'employee_id')::uuid,rw->>'status',nullif(rw->>'remarks',''),auth.uid(),now())
    on conflict (session_id,employee_id) do update set status=excluded.status,remarks=excluded.remarks,
      recorded_by=auth.uid(),recorded_at=now(),updated_by=auth.uid();
    update public.training_participants set status=case rw->>'status'
      when 'present' then 'attended' when 'late' then 'attended' when 'absent' then 'absent' when 'excused' then 'excused' end,
      updated_by=auth.uid()
    where session_id=_session and employee_id=(rw->>'employee_id')::uuid;
    n := n + 1;
  end loop;
  return public._idem_put(_idem,'save_attendance',_hash,jsonb_build_object('session',_session,'recorded',n));
end $$;

create or replace function public.save_training_result(_session uuid, _employee uuid, _d jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.training_results;
begin
  if not public.can_manage_training() then raise exception 'FORBIDDEN'; end if;
  if not exists(select 1 from public.training_participants where session_id=_session and employee_id=_employee) then
    raise exception 'RULE: results can only be recorded for registered participants'; end if;
  insert into public.training_results(session_id,employee_id,score,outcome,feedback,evidence,recorded_by)
  values (_session,_employee,nullif(_d->>'score','')::numeric,_d->>'outcome',nullif(_d->>'feedback',''),nullif(_d->>'evidence',''),auth.uid())
  on conflict (session_id,employee_id) do update set score=excluded.score,outcome=excluded.outcome,
    feedback=excluded.feedback,evidence=excluded.evidence,recorded_by=auth.uid(),updated_by=auth.uid()
  returning * into r;
  return to_jsonb(r);
end $$;

create or replace function public.save_effectiveness_review(_session uuid, _summary text, _follow_up boolean, _notes text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.training_effectiveness_reviews;
begin
  if not public.can_manage_training() then raise exception 'FORBIDDEN'; end if;
  if not exists(select 1 from public.training_sessions where id=_session and status='completed') then
    raise exception 'RULE: effectiveness is reviewed after the session is completed'; end if;
  insert into public.training_effectiveness_reviews(session_id,reviewer_id,summary,follow_up_required,follow_up_notes)
  values (_session,public.my_employee_id(),_summary,coalesce(_follow_up,false),nullif(_notes,'')) returning * into r;
  return to_jsonb(r);
end $$;

create or replace function public.link_reassessment(_employee uuid, _competency uuid, _session uuid, _assessment uuid, _notes text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare a public.competency_assessments; r public.competency_reassessments;
begin
  if not (public.can_manage_training() or public.has_perm('comp.assess')) then raise exception 'FORBIDDEN'; end if;
  select * into a from public.competency_assessments where id=_assessment and employee_id=_employee and competency_id=_competency;
  if not found then raise exception 'NOT_FOUND'; end if;
  if not a.is_reassessment then raise exception 'RULE: link only reassessments'; end if;
  if a.status <> 'approved' then raise exception 'RULE: the reassessment must be approved with evidence before it counts'; end if;
  insert into public.competency_reassessments(employee_id,competency_id,session_id,assessment_id,notes)
  values (_employee,_competency,_session,_assessment,nullif(_notes,'')) returning * into r;
  return to_jsonb(r);
end $$;

create or replace function public.prepare_ai_context(_employee uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare gaps jsonb; resources jsonb; emp jsonb;
begin
  if not public.has_perm('ai.generate') then raise exception 'FORBIDDEN'; end if;
  if not public.can_view_comp(_employee) then raise exception 'NOT_FOUND'; end if;
  select jsonb_build_object('id',e.id,'name',e.first_name||' '||e.last_name,'position',p.title,'department',d.name)
  into emp from public.employees e join public.positions p on p.id=e.position_id join public.departments d on d.id=e.department_id
  where e.id=_employee;
  if emp is null then raise exception 'NOT_FOUND'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('competency_id',g.competency_id,'competency',g.competency_name,
      'required_level',g.required_level,'current_level',g.current_level,'gap',g.gap,
      'is_mandatory',g.is_mandatory,'is_safety_critical',g.is_safety_critical)),'[]'::jsonb)
  into gaps from public.competency_gaps(_employee,null,null,null,'gap',50,0) g;
  select coalesce(jsonb_agg(distinct jsonb_build_object('type','course','id',c.id,'title',c.title,'summary',left(coalesce(c.description,''),300),'competency_id',m.competency_id)),'[]'::jsonb)
  into resources
  from public.course_competency_mappings m join public.courses c on c.id=m.course_id and c.status='approved'
  where m.competency_id in (select (g->>'competency_id')::uuid from jsonb_array_elements(gaps) g);
  resources := coalesce(resources,'[]'::jsonb) || coalesce((
    select jsonb_agg(distinct jsonb_build_object('type','learning_path','id',lp.id,'title',lp.title,'summary',left(coalesce(lp.description,''),300),'competency_id',lp.competency_id))
    from public.learning_paths lp where lp.status='active'
      and lp.competency_id in (select (g->>'competency_id')::uuid from jsonb_array_elements(gaps) g)),'[]'::jsonb);
  resources := coalesce(resources,'[]'::jsonb) || coalesce((
    select jsonb_agg(distinct jsonb_build_object('type','training','id',ts.id,'title',ts.title,'summary',left(coalesce(ts.venue,''),100)||' '||to_char(ts.starts_at,'YYYY-MM-DD'),'competency_id',ts.related_competency_id))
    from public.training_sessions ts where ts.status='planned'
      and ts.related_competency_id in (select (g->>'competency_id')::uuid from jsonb_array_elements(gaps) g)),'[]'::jsonb);
  return jsonb_build_object('employee',emp,'gaps',gaps,'resources',resources);
end $$;

create or replace function public.save_ai_recommendations(_employee uuid, _items jsonb, _model text, _idem uuid, _hash text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare item jsonb; saved int := 0; rejected int := 0; resp jsonb; gid uuid; req int; cur int; gp int; ok boolean;
begin
  if not public.has_perm('ai.generate') then raise exception 'FORBIDDEN'; end if;
  if not public.can_view_comp(_employee) then raise exception 'NOT_FOUND'; end if;
  resp := public._idem_get(_idem,'save_ai_recommendations',_hash);
  if resp is not null then return resp; end if;
  for item in select * from jsonb_array_elements(_items) loop
    ok := false;
    select g.competency_id, g.required_level, g.current_level, g.gap into gid, req, cur, gp
    from public.competency_gaps(_employee,null,null,null,'gap',50,0) g
    where g.competency_id = (item->>'competency_id')::uuid;
    if gid is not null then
      if item->>'recommendation_type' = 'course' then
        select exists(select 1 from public.course_competency_mappings m join public.courses c on c.id=m.course_id
          where m.course_id=(item->>'resource_id')::uuid and m.competency_id=gid and c.status='approved') into ok;
      elsif item->>'recommendation_type' = 'learning_path' then
        select exists(select 1 from public.learning_paths lp
          where lp.id=(item->>'resource_id')::uuid and lp.competency_id=gid and lp.status='active') into ok;
      elsif item->>'recommendation_type' = 'training' then
        select exists(select 1 from public.training_sessions ts
          where ts.id=(item->>'resource_id')::uuid and ts.related_competency_id=gid and ts.status='planned') into ok;
      end if;
    end if;
    if ok then
      insert into public.ai_recommendations(employee_id,competency_id,required_level,current_level,gap,
        recommendation_type,resource_id,rationale,expected_outcome,priority,model,generated_by,sources)
      values (_employee,gid,req,cur,gp,item->>'recommendation_type',(item->>'resource_id')::uuid,
        left(item->>'rationale',4000),left(coalesce(item->>'expected_outcome',''),4000),
        case when item->>'priority' in ('high','medium','low') then item->>'priority' else 'medium' end,
        left(_model,120),auth.uid(),coalesce(item->'sources','[]'::jsonb));
      saved := saved + 1;
    else
      rejected := rejected + 1;
    end if;
  end loop;
  return public._idem_put(_idem,'save_ai_recommendations',_hash,jsonb_build_object('saved',saved,'rejected',rejected));
end $$;

create or replace function public.log_ai_generation(_employee uuid, _model text, _status text, _error text, _latency int) returns jsonb
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  insert into public.ai_generation_logs(user_id,employee_id,model,status,error,latency_ms)
  values (auth.uid(),_employee,left(_model,120),_status,left(coalesce(_error,''),500),_latency);
  update public.ai_integration_settings set last_status=case when _status='success' then 'ok' else 'error' end,
    last_error=case when _status='success' then null else left(coalesce(_error,''),500) end, last_checked_at=now()
  where id=(select id from public.ai_integration_settings order by created_at limit 1);
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.review_ai_recommendation(_id uuid, _decision text, _comments text, _edited jsonb, _idem uuid, _hash text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.ai_recommendations; resp jsonb; new_status text; plan_id uuid; item_id uuid; eff jsonb;
begin
  if not public.can_review_ai() then raise exception 'FORBIDDEN'; end if;
  if _decision not in ('accept','edit','reject') then raise exception 'INVALID: decision must be accept, edit or reject'; end if;
  resp := public._idem_get(_idem,'review_ai_recommendation',_hash);
  if resp is not null then return resp; end if;
  select * into r from public.ai_recommendations where id=_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  if r.generated_by = auth.uid() then raise exception 'RULE: you cannot review a recommendation you generated'; end if;
  new_status := case _decision when 'accept' then 'accepted' when 'edit' then 'edited' else 'rejected' end;
  perform public.assert_transition('ai_recommendation',r.status,new_status);
  eff := case when _decision='edit' then coalesce(_edited,'{}'::jsonb) else '{}'::jsonb end;
  update public.ai_recommendations set status=new_status, updated_by=auth.uid(),
    priority=coalesce(case when eff->>'priority' in ('high','medium','low') then eff->>'priority' end, priority),
    expected_outcome=coalesce(nullif(eff->>'expected_outcome',''), expected_outcome)
  where id=_id;
  insert into public.ai_recommendation_reviews(recommendation_id,reviewer_id,decision,comments,edited)
  values (_id,auth.uid(),_decision,nullif(_comments,''),nullif(eff,'{}'::jsonb));
  if _decision in ('accept','edit') then
    select id into plan_id from public.development_plans
    where employee_id=r.employee_id and status in ('draft','active') order by created_at desc limit 1;
    if plan_id is null then
      insert into public.development_plans(employee_id,title,objectives,status)
      values (r.employee_id,'Development plan','Created from accepted AI recommendations.','active') returning id into plan_id;
    end if;
    insert into public.development_plan_items(plan_id,item_type,title,description,competency_id,course_id,learning_path_id,
      training_session_id,ai_recommendation_id,priority)
    values (plan_id, r.recommendation_type,
      coalesce(nullif(eff->>'title',''), 'AI-recommended '||r.recommendation_type),
      r.rationale, r.competency_id,
      case when r.recommendation_type='course' then r.resource_id end,
      case when r.recommendation_type='learning_path' then r.resource_id end,
      case when r.recommendation_type='training' then r.resource_id end,
      r.id, r.priority) returning id into item_id;
    if r.recommendation_type='course' then
      insert into public.course_enrollments(course_id,employee_id,source,development_plan_item_id)
      values (r.resource_id,r.employee_id,'development_plan',item_id) on conflict (course_id,employee_id) do nothing;
    elsif r.recommendation_type='training' then
      insert into public.training_participants(session_id,employee_id,development_plan_item_id)
      values (r.resource_id,r.employee_id,item_id) on conflict (session_id,employee_id) do nothing;
    end if;
    perform public._notify((select user_id from public.employees where id=r.employee_id),
      'New development activity','A development activity was added to your plan.','/training/plans/'||plan_id,'assignment');
  end if;
  perform public.log_audit('ai_review','ai_recommendations',_id,jsonb_build_object('decision',_decision));
  return public._idem_put(_idem,'review_ai_recommendation',_hash,
    jsonb_build_object('id',_id,'status',new_status,'plan_item',item_id));
end $$;

create or replace function public.process_outbox(_limit int default 50) returns jsonb
language plpgsql security definer set search_path=public as $$
declare ev record; sent int := 0; deferred int := 0; dead int := 0;
begin
  if auth.uid() is not null then raise exception 'FORBIDDEN'; end if;
  for ev in select * from public.outbox_events
    where status='pending' and next_retry_at <= now() order by created_at limit least(_limit,200) for update skip locked loop
    if ev.kind = 'notification' then
      update public.outbox_events set status='sent', processed_at=now(), updated_by=null where id=ev.id;
      sent := sent + 1;
    elsif ev.kind = 'email' then
      if ev.attempts >= 7 then
        update public.outbox_events set status='dead', last_error='no email provider configured', processed_at=now() where id=ev.id;
        dead := dead + 1;
      else
        update public.outbox_events set attempts=attempts+1, last_error='no email provider configured',
          next_retry_at=now() + (interval '1 minute' * power(2, attempts)) where id=ev.id;
        deferred := deferred + 1;
      end if;
    else
      update public.outbox_events set status='dead', last_error='unknown kind', processed_at=now() where id=ev.id;
      dead := dead + 1;
    end if;
  end loop;
  return jsonb_build_object('sent',sent,'deferred',deferred,'dead',dead);
end $$;
revoke execute on function public.process_outbox(int) from public, anon, authenticated;
grant execute on function public.process_outbox(int) to service_role;

do $$ declare f record; begin
  for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated, service_role', f.sig);
  end loop;
end $$;
revoke execute on function public.process_outbox(int) from authenticated;
create or replace function public.update_ai_settings(_provider text, _model text, _version int)
returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.ai_integration_settings;
begin
  if not public.has_perm('admin.settings') then raise exception 'FORBIDDEN'; end if;
  if _provider <> 'gemini' then raise exception 'INVALID: provider must be gemini'; end if;
  update public.ai_integration_settings set provider=_provider, model=left(_model,120)
  where id=(select id from public.ai_integration_settings order by created_at limit 1) and version=_version
  returning * into r;
  if not found then raise exception 'CONFLICT: settings were changed by someone else'; end if;
  return to_jsonb(r);
end $$;

revoke execute on function public.update_ai_settings(text, text, int) from public, anon;
grant execute on function public.update_ai_settings(text, text, int) to authenticated, service_role;
