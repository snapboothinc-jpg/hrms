-- Qualify both sides of the joined demo-cleanup subqueries to avoid ambiguous id references.
DO $$
DECLARE
  target_function regprocedure;
  definition text;
  updated_definition text;
  old_fragment text;
BEGIN
  target_function := to_regprocedure('public._remove_demo_data_before_personal_goals()');
  IF target_function IS NULL THEN
    RAISE EXCEPTION 'Expected the demo removal function to exist';
  END IF;
  definition := pg_get_functiondef(target_function);
  old_fragment := 'select id from public.course_sections s join public.courses c on c.id=s.course_id where c.is_demo';
  IF length(definition) - length(replace(definition, old_fragment, '')) <> length(old_fragment) THEN
    RAISE EXCEPTION 'Unexpected demo removal definition; refusing an unsafe rewrite';
  END IF;
  updated_definition := replace(
    definition,
    old_fragment,
    'select s.id from public.course_sections s join public.courses c on c.id=s.course_id where c.is_demo'
  );
  EXECUTE updated_definition;
END
$$;
