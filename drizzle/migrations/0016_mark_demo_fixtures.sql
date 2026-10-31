CREATE OR REPLACE FUNCTION public.mark_demo_fixtures(
  _users uuid[],
  _employees uuid[],
  _departments uuid[],
  _positions uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  user_count integer;
  employee_count integer;
  department_count integer;
  position_count integer;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF cardinality(_users) IS DISTINCT FROM cardinality(ARRAY(SELECT DISTINCT unnest(_users)))
     OR cardinality(_employees) IS DISTINCT FROM cardinality(ARRAY(SELECT DISTINCT unnest(_employees)))
     OR cardinality(_departments) IS DISTINCT FROM cardinality(ARRAY(SELECT DISTINCT unnest(_departments)))
     OR cardinality(_positions) IS DISTINCT FROM cardinality(ARRAY(SELECT DISTINCT unnest(_positions))) THEN
    RAISE EXCEPTION 'INVALID: duplicate fixture identifiers';
  END IF;

  UPDATE public.profiles
     SET is_demo = true
   WHERE id = ANY(_users)
     AND email LIKE '%@priorityhandling.demo'
     AND NOT EXISTS (
       SELECT 1 FROM public.user_roles
        WHERE user_id = profiles.id AND role = 'super_admin'
     );
  GET DIAGNOSTICS user_count = ROW_COUNT;
  IF user_count <> cardinality(_users) THEN
    RAISE EXCEPTION 'CONFLICT: every demo login must be a non-super-admin synthetic account';
  END IF;

  UPDATE public.employees
     SET is_demo = true
   WHERE id = ANY(_employees)
     AND (user_id IS NULL OR user_id = ANY(_users));
  GET DIAGNOSTICS employee_count = ROW_COUNT;
  IF employee_count <> cardinality(_employees) THEN
    RAISE EXCEPTION 'CONFLICT: employee fixture is missing or linked to an unrelated account';
  END IF;

  UPDATE public.departments
     SET is_demo = true
   WHERE id = ANY(_departments)
     AND code LIKE 'DEMO-%';
  GET DIAGNOSTICS department_count = ROW_COUNT;
  IF department_count <> cardinality(_departments) THEN
    RAISE EXCEPTION 'CONFLICT: department fixture is missing or not marked as demo';
  END IF;

  UPDATE public.positions
     SET is_demo = true
   WHERE id = ANY(_positions)
     AND code LIKE 'DEMO-%'
     AND department_id = ANY(_departments);
  GET DIAGNOSTICS position_count = ROW_COUNT;
  IF position_count <> cardinality(_positions) THEN
    RAISE EXCEPTION 'CONFLICT: position fixture is missing or outside the demo departments';
  END IF;

  RETURN jsonb_build_object(
    'users', user_count,
    'employees', employee_count,
    'departments', department_count,
    'positions', position_count
  );
END
$$;

REVOKE ALL ON FUNCTION public.mark_demo_fixtures(uuid[], uuid[], uuid[], uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_demo_fixtures(uuid[], uuid[], uuid[], uuid[]) TO service_role;
