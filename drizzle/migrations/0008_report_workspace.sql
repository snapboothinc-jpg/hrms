create table public.saved_report_definitions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (length(name) between 2 and 120),
  report_kind text not null check (report_kind in ('performance','gaps','learning','training','recognition','succession','audit')),
  filters jsonb not null default '{}'::jsonb check (jsonb_typeof(filters)='object'),
  selected_columns text[] not null default '{}',
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_by uuid,
  unique (user_id,name)
);
create index saved_reports_owner on public.saved_report_definitions(user_id,updated_at desc);
alter table public.saved_report_definitions enable row level security;
grant select on public.saved_report_definitions to authenticated;
grant all on public.saved_report_definitions to service_role;
create policy "saved report definitions owner" on public.saved_report_definitions for select to authenticated
  using (user_id=auth.uid());
create trigger saved_report_definitions_touch before update on public.saved_report_definitions
  for each row execute function public.tg_touch();
create trigger saved_report_definitions_audit after insert or update or delete on public.saved_report_definitions
  for each row execute function public.tg_audit();

create table public.report_export_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  report_name text not null check (length(report_name) between 2 and 120),
  report_kind text not null check (report_kind in ('performance','gaps','learning','training','recognition','succession','audit')),
  scope jsonb not null default '{}'::jsonb check (jsonb_typeof(scope)='object'),
  format text not null check (format in ('csv')),
  result text not null check (result in ('success','failed')),
  row_count int not null check (row_count between 0 and 5000),
  download_available boolean not null default false,
  requested_at timestamptz not null default now(),
  is_demo boolean not null default false,
  created_by uuid default auth.uid()
);
create index report_export_history_owner on public.report_export_history(user_id,requested_at desc);
alter table public.report_export_history enable row level security;
grant select on public.report_export_history to authenticated;
grant all on public.report_export_history to service_role;
create policy "report export history scoped" on public.report_export_history for select to authenticated
  using (user_id=auth.uid() or public.has_perm('reports.hr'));
create trigger report_export_history_audit after insert or update or delete on public.report_export_history
  for each row execute function public.tg_audit();

create or replace function public._assert_report_access(_kind text) returns void
language plpgsql stable security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if _kind='performance' and not (public.has_perm('reports.hr') or public.has_perm('perf.evaluate') or public.has_perm('perf.manage')) then
    raise exception 'FORBIDDEN';
  elsif _kind='gaps' and not (public.has_perm('reports.hr') or public.has_perm('comp.view_all') or public.has_perm('comp.manage') or public.has_perm('team.view')) then
    raise exception 'FORBIDDEN';
  elsif _kind='learning' and not (public.has_perm('reports.hr') or public.can_manage_learning() or public.has_perm('team.view')) then
    raise exception 'FORBIDDEN';
  elsif _kind='training' and not (public.has_perm('reports.hr') or public.can_manage_training() or public.has_perm('team.view')) then
    raise exception 'FORBIDDEN';
  elsif _kind='recognition' and not (public.has_perm('reports.hr') or public.has_perm('recognition.review') or public.has_perm('team.view')) then
    raise exception 'FORBIDDEN';
  elsif _kind='succession' and not (public.has_perm('succession.manage') or public.has_perm('succession.dept')) then
    raise exception 'FORBIDDEN';
  elsif _kind='audit' and not (public.has_perm('admin.audit') or public.has_perm('hr.employees')) then
    raise exception 'FORBIDDEN';
  elsif _kind not in ('performance','gaps','learning','training','recognition','succession','audit') then
    raise exception 'INVALID: unknown report kind';
  end if;
end $$;

create or replace function public.log_report_view(_kind text, _filters jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
begin
  perform public._assert_report_access(_kind);
  if jsonb_typeof(_filters)<>'object' then raise exception 'INVALID'; end if;
  perform public.log_audit('report_view','report:'||_kind,null,_filters);
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.upsert_saved_report(
  _id uuid, _name text, _kind text, _filters jsonb, _columns text[],
  _version int, _idem uuid, _hash text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.saved_report_definitions; resp jsonb;
begin
  perform public._assert_report_access(_kind);
  resp := public._idem_get(_idem,'upsert_saved_report',_hash);
  if resp is not null then return resp; end if;
  if length(trim(_name)) not between 2 and 120 or jsonb_typeof(_filters)<>'object'
    or coalesce(array_length(_columns,1),0)>50 then raise exception 'INVALID'; end if;
  if _id is null then
    insert into public.saved_report_definitions(user_id,name,report_kind,filters,selected_columns)
    values(auth.uid(),trim(_name),_kind,_filters,coalesce(_columns,'{}')) returning * into r;
  else
    update public.saved_report_definitions set name=trim(_name),report_kind=_kind,filters=_filters,
      selected_columns=coalesce(_columns,'{}'),version=version+1,updated_by=auth.uid()
    where id=_id and user_id=auth.uid() and version=_version returning * into r;
    if not found then
      if exists(select 1 from public.saved_report_definitions where id=_id and user_id=auth.uid()) then
        raise exception 'CONFLICT: this definition was changed by someone else';
      end if;
      raise exception 'NOT_FOUND';
    end if;
  end if;
  return public._idem_put(_idem,'upsert_saved_report',_hash,to_jsonb(r));
end $$;

create or replace function public.delete_saved_report(_id uuid, _version int, _idem uuid, _hash text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare resp jsonb;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  resp := public._idem_get(_idem,'delete_saved_report',_hash);
  if resp is not null then return resp; end if;
  delete from public.saved_report_definitions where id=_id and user_id=auth.uid() and version=_version;
  if not found then
    if exists(select 1 from public.saved_report_definitions where id=_id and user_id=auth.uid()) then
      raise exception 'CONFLICT: this definition was changed by someone else';
    end if;
    raise exception 'NOT_FOUND';
  end if;
  return public._idem_put(_idem,'delete_saved_report',_hash,jsonb_build_object('ok',true));
end $$;

create or replace function public.record_report_export(
  _name text, _kind text, _scope jsonb, _format text, _result text, _row_count int, _idem uuid, _hash text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.report_export_history; resp jsonb;
begin
  perform public._assert_report_access(_kind);
  resp := public._idem_get(_idem,'record_report_export',_hash);
  if resp is not null then return resp; end if;
  if length(trim(_name)) not between 2 and 120 or jsonb_typeof(_scope)<>'object'
    or _format<>'csv' or _result not in ('success','failed') or _row_count not between 0 and 5000 then
    raise exception 'INVALID';
  end if;
  insert into public.report_export_history(user_id,report_name,report_kind,scope,format,result,row_count)
  values(auth.uid(),trim(_name),_kind,_scope,_format,_result,_row_count) returning * into r;
  return public._idem_put(_idem,'record_report_export',_hash,to_jsonb(r));
end $$;

do $$ declare f record; begin
  for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in
      ('_assert_report_access','log_report_view','upsert_saved_report','delete_saved_report','record_report_export')
  loop
    execute format('revoke execute on function %s from public, anon',f.sig);
    execute format('grant execute on function %s to authenticated, service_role',f.sig);
  end loop;
end $$;
