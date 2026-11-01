-- Repair verified PL/pgSQL errors without changing function authorization or workflow rules.
DO $$
DECLARE
  target_function regprocedure;
  definition text;
  updated_definition text;
  old_fragment text;
BEGIN
  target_function := to_regprocedure('public.set_supervisor(uuid,uuid,date)');
  IF target_function IS NULL THEN
    RAISE EXCEPTION 'Expected public.set_supervisor(uuid,uuid,date) to exist';
  END IF;
  definition := pg_get_functiondef(target_function);
  old_fragment := 'select r.supervisor_id from public.reporting_relationships r join chain c on r.employee_id=c.s where r.is_current';
  IF length(definition) - length(replace(definition, old_fragment, '')) <> length(old_fragment) THEN
    RAISE EXCEPTION 'Unexpected set_supervisor definition; refusing an unsafe rewrite';
  END IF;
  updated_definition := replace(
    definition,
    old_fragment,
    'select rr.supervisor_id from public.reporting_relationships rr join chain c on rr.employee_id=c.s where rr.is_current'
  );
  EXECUTE updated_definition;

  FOREACH target_function IN ARRAY ARRAY[
    to_regprocedure('public._remove_demo_data_before_personal_goals()'),
    to_regprocedure('public._reset_demo_data_before_personal_goals()')
  ]
  LOOP
    IF target_function IS NULL THEN
      RAISE EXCEPTION 'Expected both demo lifecycle functions to exist';
    END IF;
    definition := pg_get_functiondef(target_function);
    old_fragment := 'select id from public.quizzes q join public.courses c on c.id=q.course_id where c.is_demo';
    IF length(definition) - length(replace(definition, old_fragment, '')) <> length(old_fragment) THEN
      RAISE EXCEPTION 'Unexpected demo lifecycle definition; refusing an unsafe rewrite';
    END IF;
    updated_definition := replace(
      definition,
      old_fragment,
      'select q.id from public.quizzes q join public.courses c on c.id=q.course_id where c.is_demo'
    );
    EXECUTE updated_definition;
  END LOOP;

  target_function := to_regprocedure('public.submit_development_plan(uuid,integer,uuid,text)');
  IF target_function IS NULL THEN
    RAISE EXCEPTION 'Expected public.submit_development_plan(uuid,integer,uuid,text) to exist';
  END IF;
  definition := pg_get_functiondef(target_function);
  old_fragment := '''/approvals'',''approval''';
  IF length(definition) - length(replace(definition, old_fragment, '')) <> length(old_fragment) THEN
    RAISE EXCEPTION 'Unexpected submit_development_plan notification call; refusing an unsafe rewrite';
  END IF;
  updated_definition := replace(definition, old_fragment, '''/approvals''');
  EXECUTE updated_definition;
END
$$;
