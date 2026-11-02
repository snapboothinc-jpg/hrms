CREATE OR REPLACE FUNCTION public.bootstrap_initial_super_admin(_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  account_email text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('bootstrap_initial_super_admin', 0));

  SELECT u.email
    INTO account_email
    FROM auth.users u
    JOIN public.profiles p ON p.id = u.id
   WHERE u.id = _user
     AND u.email_confirmed_at IS NOT NULL
     AND p.is_active
     AND NOT p.is_demo;

  IF account_email IS NULL THEN
    RAISE EXCEPTION 'INVALID: bootstrap account must be active and email-confirmed';
  END IF;

  IF (SELECT count(*) FROM auth.users) <> 1
     OR EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'super_admin')
     OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user) THEN
    RAISE EXCEPTION 'CONFLICT: initial super admin can only be bootstrapped once on an empty project';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user, 'super_admin');

  INSERT INTO public.audit_logs (actor_id, action, table_name, record_id, after_data)
  VALUES (
    NULL,
    'bootstrap_initial_super_admin',
    'user_roles',
    _user,
    jsonb_build_object('role', 'super_admin', 'email', account_email)
  );

  RETURN jsonb_build_object('ok', true, 'user_id', _user);
END
$$;

REVOKE ALL ON FUNCTION public.bootstrap_initial_super_admin(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_initial_super_admin(uuid) TO service_role;
