CREATE OR REPLACE FUNCTION public.reset_demo_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  DELETE FROM public.ai_recommendation_reviews WHERE is_demo;
  DELETE FROM public.ai_recommendations WHERE is_demo;
  DELETE FROM public.recognition_publications WHERE is_demo;
  DELETE FROM public.recognition_reviews WHERE is_demo;
  DELETE FROM public.recognition_nominations WHERE is_demo;
  DELETE FROM public.succession_development_activities WHERE is_demo;
  DELETE FROM public.succession_readiness_assessments WHERE is_demo;
  DELETE FROM public.succession_candidates WHERE is_demo;
  DELETE FROM public.critical_positions WHERE is_demo;
  DELETE FROM public.succession_access_grants WHERE is_demo;
  DELETE FROM public.competency_reassessments WHERE is_demo;
  DELETE FROM public.training_effectiveness_reviews WHERE is_demo;
  DELETE FROM public.training_results WHERE is_demo;
  DELETE FROM public.training_attendance WHERE is_demo;
  DELETE FROM public.training_participants WHERE is_demo;
  DELETE FROM public.training_sessions WHERE is_demo;
  DELETE FROM public.trainers WHERE is_demo;
  DELETE FROM public.development_plan_items WHERE is_demo;
  DELETE FROM public.development_plans WHERE is_demo;
  DELETE FROM public.course_completions WHERE is_demo;
  DELETE FROM public.quiz_attempts WHERE is_demo;
  DELETE FROM public.lesson_progress
   WHERE enrollment_id IN (SELECT id FROM public.course_enrollments WHERE is_demo);
  DELETE FROM public.course_enrollments WHERE is_demo;
  DELETE FROM public.learning_path_courses
   WHERE path_id IN (SELECT id FROM public.learning_paths WHERE is_demo);
  DELETE FROM public.learning_paths WHERE is_demo;
  DELETE FROM public.quiz_questions
   WHERE quiz_id IN (
     SELECT q.id FROM public.quizzes q
     JOIN public.courses c ON c.id = q.course_id
     WHERE c.is_demo
   );
  DELETE FROM public.quizzes WHERE course_id IN (SELECT id FROM public.courses WHERE is_demo);
  DELETE FROM public.lessons
   WHERE section_id IN (
     SELECT s.id FROM public.course_sections s
     JOIN public.courses c ON c.id = s.course_id
     WHERE c.is_demo
   );
  DELETE FROM public.course_sections WHERE course_id IN (SELECT id FROM public.courses WHERE is_demo);
  DELETE FROM public.course_competency_mappings
   WHERE course_id IN (SELECT id FROM public.courses WHERE is_demo);
  DELETE FROM public.courses WHERE is_demo;
  DELETE FROM public.approval_tasks
   WHERE is_demo OR employee_id IN (SELECT id FROM public.employees WHERE is_demo);
  DELETE FROM public.evaluation_reviews
   WHERE assignment_id IN (SELECT id FROM public.evaluation_assignments WHERE is_demo);
  DELETE FROM public.evaluation_evidence
   WHERE assignment_id IN (SELECT id FROM public.evaluation_assignments WHERE is_demo);
  DELETE FROM public.evaluation_responses
   WHERE assignment_id IN (SELECT id FROM public.evaluation_assignments WHERE is_demo);
  DELETE FROM public.evaluation_assignments WHERE is_demo;
  DELETE FROM public.competency_assessment_evidence
   WHERE assessment_id IN (SELECT id FROM public.competency_assessments WHERE is_demo);
  DELETE FROM public.competency_assessments WHERE is_demo;
  DELETE FROM public.competency_gap_snapshots
   WHERE employee_id IN (SELECT id FROM public.employees WHERE is_demo);
  DELETE FROM public.notifications
   WHERE user_id IN (SELECT id FROM public.profiles WHERE is_demo);
  DELETE FROM public.outbox_events
   WHERE payload->>'user_id' IN (SELECT id::text FROM public.profiles WHERE is_demo);

  RETURN jsonb_build_object('ok', true, 'action', 'cleared_mutable_demo_rows');
END
$$;

REVOKE EXECUTE ON FUNCTION public.reset_demo_data() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_demo_data() TO authenticated;
