create or replace function public.bootstrap_initial_super_admin(_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  account_email text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'FORBIDDEN';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('bootstrap_initial_super_admin', 0));

  select u.email
    into account_email
    from auth.users u
    join public.profiles p on p.id = u.id
   where u.id = _user
     and u.email_confirmed_at is not null
     and p.is_active
     and not p.is_demo;

  if not found then
    raise exception 'INVALID: bootstrap account must be active and email-confirmed';
  end if;

  if (select count(*) from auth.users) <> 1
     or exists (select 1 from public.user_roles where role = 'super_admin')
     or exists (select 1 from public.user_roles where user_id = _user) then
    raise exception 'CONFLICT: initial super admin can only be bootstrapped once on an empty project';
  end if;

  insert into public.user_roles (user_id, role)
  values (_user, 'super_admin');

  insert into public.audit_logs (actor_id, action, table_name, record_id, after_data)
  values (
    null,
    'bootstrap_initial_super_admin',
    'user_roles',
    _user,
    jsonb_build_object('role', 'super_admin', 'email', account_email)
  );

  return jsonb_build_object('ok', true, 'user_id', _user);
end
$$;

revoke all on function public.bootstrap_initial_super_admin(uuid) from public, anon, authenticated;
grant execute on function public.bootstrap_initial_super_admin(uuid) to service_role;
