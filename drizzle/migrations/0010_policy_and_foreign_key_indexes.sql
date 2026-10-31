-- Cover foreign keys that had no valid, full B-tree index with the FK columns leading.
CREATE INDEX IF NOT EXISTS fk_reporting_relationships_supervisor_id_idx ON public.reporting_relationships (supervisor_id);
CREATE INDEX IF NOT EXISTS fk_evaluation_profile_versions_position_id_idx ON public.evaluation_profile_versions (position_id);
CREATE INDEX IF NOT EXISTS fk_reporting_relationships_employee_id_idx ON public.reporting_relationships (employee_id);
CREATE INDEX IF NOT EXISTS fk_position_competency_requirements_position_id_idx ON public.position_competency_requirements (position_id);
CREATE INDEX IF NOT EXISTS fk_courses_owner_id_idx ON public.courses (owner_id);
CREATE INDEX IF NOT EXISTS fk_competency_gap_snapshots_position_id_idx ON public.competency_gap_snapshots (position_id);
CREATE INDEX IF NOT EXISTS fk_competency_gap_snapshots_assessment_id_idx ON public.competency_gap_snapshots (assessment_id);
CREATE INDEX IF NOT EXISTS fk_learning_materials_lesson_id_idx ON public.learning_materials (lesson_id);
CREATE INDEX IF NOT EXISTS fk_learning_materials_file_id_idx ON public.learning_materials (file_id);
CREATE INDEX IF NOT EXISTS fk_learning_paths_competency_id_idx ON public.learning_paths (competency_id);
CREATE INDEX IF NOT EXISTS fk_learning_path_courses_course_id_idx ON public.learning_path_courses (course_id);
CREATE INDEX IF NOT EXISTS fk_lesson_progress_lesson_id_idx ON public.lesson_progress (lesson_id);
CREATE INDEX IF NOT EXISTS fk_quiz_attempts_enrollment_id_idx ON public.quiz_attempts (enrollment_id);
CREATE INDEX IF NOT EXISTS fk_course_completions_employee_id_idx ON public.course_completions (employee_id);
CREATE INDEX IF NOT EXISTS fk_course_completions_enrollment_id_idx ON public.course_completions (enrollment_id);
CREATE INDEX IF NOT EXISTS fk_development_plans_responsible_id_idx ON public.development_plans (responsible_id);
CREATE INDEX IF NOT EXISTS fk_development_plan_items_competency_id_idx ON public.development_plan_items (competency_id);
CREATE INDEX IF NOT EXISTS fk_development_plan_items_course_id_idx ON public.development_plan_items (course_id);
CREATE INDEX IF NOT EXISTS fk_development_plan_items_learning_path_id_idx ON public.development_plan_items (learning_path_id);
CREATE INDEX IF NOT EXISTS fk_ai_recommendation_reviews_recommendation_id_idx ON public.ai_recommendation_reviews (recommendation_id);
CREATE INDEX IF NOT EXISTS fk_training_sessions_trainer_id_idx ON public.training_sessions (trainer_id);
CREATE INDEX IF NOT EXISTS fk_training_sessions_related_competency_id_idx ON public.training_sessions (related_competency_id);
CREATE INDEX IF NOT EXISTS fk_training_participants_development_plan_item_id_idx ON public.training_participants (development_plan_item_id);
CREATE INDEX IF NOT EXISTS fk_training_attendance_employee_id_idx ON public.training_attendance (employee_id);
CREATE INDEX IF NOT EXISTS fk_training_results_employee_id_idx ON public.training_results (employee_id);
CREATE INDEX IF NOT EXISTS fk_succession_candidates_readiness_class_id_idx ON public.succession_candidates (readiness_class_id);
CREATE INDEX IF NOT EXISTS fk_training_effectiveness_reviews_session_id_idx ON public.training_effectiveness_reviews (session_id);
CREATE INDEX IF NOT EXISTS fk_training_effectiveness_reviews_reviewer_id_idx ON public.training_effectiveness_reviews (reviewer_id);
CREATE INDEX IF NOT EXISTS fk_competency_reassessments_employee_id_idx ON public.competency_reassessments (employee_id);
CREATE INDEX IF NOT EXISTS fk_competency_reassessments_competency_id_idx ON public.competency_reassessments (competency_id);
CREATE INDEX IF NOT EXISTS fk_competency_reassessments_session_id_idx ON public.competency_reassessments (session_id);
CREATE INDEX IF NOT EXISTS fk_competency_reassessments_assessment_id_idx ON public.competency_reassessments (assessment_id);
CREATE INDEX IF NOT EXISTS fk_ai_recommendations_competency_id_idx ON public.ai_recommendations (competency_id);
CREATE INDEX IF NOT EXISTS fk_succession_access_grants_user_id_idx ON public.succession_access_grants (user_id);
CREATE INDEX IF NOT EXISTS fk_critical_positions_position_id_idx ON public.critical_positions (position_id);
CREATE INDEX IF NOT EXISTS fk_critical_positions_incumbent_employee_id_idx ON public.critical_positions (incumbent_employee_id);
CREATE INDEX IF NOT EXISTS fk_succession_readiness_assessments_assessor_id_idx ON public.succession_readiness_assessments (assessor_id);
CREATE INDEX IF NOT EXISTS fk_succession_readiness_assessments_readiness_class_id_idx ON public.succession_readiness_assessments (readiness_class_id);
CREATE INDEX IF NOT EXISTS fk_succession_development_activities_candidate_id_idx ON public.succession_development_activities (candidate_id);
CREATE INDEX IF NOT EXISTS fk_succession_development_activity_item_idx ON public.succession_development_activities (development_plan_item_id);
CREATE INDEX IF NOT EXISTS fk_recognition_nominations_nominator_id_idx ON public.recognition_nominations (nominator_id);
CREATE INDEX IF NOT EXISTS fk_recognition_nominations_category_id_idx ON public.recognition_nominations (category_id);
CREATE INDEX IF NOT EXISTS fk_recognition_reviews_nomination_id_idx ON public.recognition_reviews (nomination_id);
CREATE INDEX IF NOT EXISTS fk_personal_goals_evaluation_assignment_id_idx ON public.personal_goals (evaluation_assignment_id);
CREATE INDEX IF NOT EXISTS fk_personal_goals_reviewer_id_idx ON public.personal_goals (reviewer_id);
CREATE INDEX IF NOT EXISTS fk_development_plans_submitted_by_idx ON public.development_plans (submitted_by);
CREATE INDEX IF NOT EXISTS fk_development_plans_reviewed_by_idx ON public.development_plans (reviewed_by);
CREATE INDEX IF NOT EXISTS fk_succession_plans_owner_user_id_idx ON public.succession_plans (owner_user_id);
CREATE INDEX IF NOT EXISTS fk_succession_plans_submitted_by_idx ON public.succession_plans (submitted_by);
CREATE INDEX IF NOT EXISTS fk_succession_plans_reviewed_by_idx ON public.succession_plans (reviewed_by);
CREATE INDEX IF NOT EXISTS fk_succession_candidate_qual_assessor_idx ON public.succession_candidate_qualifications (assessor_id);
CREATE INDEX IF NOT EXISTS fk_succession_candidate_qual_candidate_position_idx ON public.succession_candidate_qualifications (candidate_id, critical_position_id);
CREATE INDEX IF NOT EXISTS fk_succession_candidate_qual_requirement_position_idx ON public.succession_candidate_qualifications (requirement_id, critical_position_id);

-- Wrap request-constant auth functions so PostgreSQL may evaluate them once per statement.
DO $$
DECLARE
  policy_row record;
  optimized_using text;
  optimized_check text;
BEGIN
  FOR policy_row IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        coalesce(qual, '') ~ 'auth[.]([a-z_]+)[[:space:]]*[(][[:space:]]*[)]'
        OR coalesce(with_check, '') ~ 'auth[.]([a-z_]+)[[:space:]]*[(][[:space:]]*[)]'
      )
      AND coalesce(qual, '') !~ '[(][[:space:]]*select[[:space:]]+auth[.]'
      AND coalesce(with_check, '') !~ '[(][[:space:]]*select[[:space:]]+auth[.]'
  LOOP
    optimized_using := regexp_replace(
      policy_row.qual,
      'auth[.]([a-z_]+)[[:space:]]*[(][[:space:]]*[)]',
      '(select auth.\1())',
      'g'
    );
    optimized_check := regexp_replace(
      policy_row.with_check,
      'auth[.]([a-z_]+)[[:space:]]*[(][[:space:]]*[)]',
      '(select auth.\1())',
      'g'
    );

    IF optimized_using IS DISTINCT FROM policy_row.qual THEN
      EXECUTE format(
        'ALTER POLICY %I ON %I.%I USING (%s)',
        policy_row.policyname,
        policy_row.schemaname,
        policy_row.tablename,
        optimized_using
      );
    END IF;
    IF optimized_check IS DISTINCT FROM policy_row.with_check THEN
      EXECUTE format(
        'ALTER POLICY %I ON %I.%I WITH CHECK (%s)',
        policy_row.policyname,
        policy_row.schemaname,
        policy_row.tablename,
        optimized_check
      );
    END IF;
  END LOOP;
END
$$;

-- These were permissive policies for the same role and command; combine their exact OR logic.
DROP POLICY IF EXISTS "approvals assignee" ON public.approval_tasks;
DROP POLICY IF EXISTS "succession plan reviewers may see tasks" ON public.approval_tasks;
CREATE POLICY "approval tasks scoped readers"
  ON public.approval_tasks
  FOR SELECT
  TO authenticated
  USING (
    assignee_user = (SELECT auth.uid())
    OR submitted_by = (SELECT auth.uid())
    OR (assignee_role IS NOT NULL AND has_role((SELECT auth.uid()), assignee_role))
    OR (workflow_type = 'succession_plan' AND has_perm('succession.manage'))
  );

DROP POLICY IF EXISTS "audit admins" ON public.audit_logs;
DROP POLICY IF EXISTS "hr reads employee history" ON public.audit_logs;
CREATE POLICY "audit logs scoped readers"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (
    has_perm('admin.audit')
    OR (
      has_perm('hr.employees')
      AND table_name = ANY (ARRAY['employees', 'reporting_relationships'])
    )
  );
