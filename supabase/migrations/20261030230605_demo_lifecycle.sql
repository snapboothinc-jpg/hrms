-- Remove explicitly flagged demo records without recreating fixture data.
create or replace function public.remove_demo_data() returns jsonb
language plpgsql security definer set search_path=public as $$
begin
  if not public.has_role(auth.uid(),'super_admin') then raise exception 'FORBIDDEN'; end if;
  if exists(select 1 from public.profiles where id=auth.uid() and is_demo) then
    raise exception 'RULE: sign in with a non-demo Super Admin to remove demo data';
  end if;
  delete from public.recognition_publications where is_demo;
  delete from public.recognition_reviews where is_demo;
  delete from public.recognition_nominations where is_demo;
  delete from public.succession_development_activities where is_demo;
  delete from public.succession_readiness_assessments where is_demo;
  delete from public.succession_candidates where is_demo;
  delete from public.critical_positions where is_demo;
  delete from public.succession_access_grants where is_demo;
  delete from public.ai_recommendation_reviews where is_demo;
  delete from public.ai_recommendations where is_demo;
  delete from public.competency_reassessments where is_demo;
  delete from public.training_effectiveness_reviews where is_demo;
  delete from public.training_results where is_demo;
  delete from public.training_attendance where is_demo;
  delete from public.training_participants where is_demo;
  delete from public.training_sessions where is_demo;
  delete from public.trainers where is_demo;
  delete from public.development_plan_items where is_demo;
  delete from public.development_plans where is_demo;
  delete from public.course_completions where is_demo;
  delete from public.quiz_attempts where is_demo;
  delete from public.lesson_progress
    where enrollment_id in (select id from public.course_enrollments where is_demo);
  delete from public.course_enrollments where is_demo;
  delete from public.learning_path_courses
    where path_id in (select id from public.learning_paths where is_demo);
  delete from public.learning_paths where is_demo;
  delete from public.quiz_questions
    where quiz_id in (
      select q.id from public.quizzes q
      join public.courses c on c.id=q.course_id
      where c.is_demo
    );
  delete from public.quizzes where course_id in (select id from public.courses where is_demo);
  delete from public.learning_materials
    where course_id in (select id from public.courses where is_demo);
  delete from public.lessons
    where section_id in (
      select s.id from public.course_sections s
      join public.courses c on c.id=s.course_id
      where c.is_demo
    );
  delete from public.course_sections where course_id in (select id from public.courses where is_demo);
  delete from public.course_competency_mappings
    where course_id in (select id from public.courses where is_demo);
  delete from public.courses where is_demo;
  delete from public.approval_tasks
    where employee_id in (select id from public.employees where is_demo);
  delete from public.evaluation_submissions
    where assignment_id in (select id from public.evaluation_assignments where is_demo);
  delete from public.evaluation_factor_responses
    where assignment_id in (select id from public.evaluation_assignments where is_demo);
  delete from public.evaluation_reviews
    where assignment_id in (select id from public.evaluation_assignments where is_demo);
  delete from public.evaluation_evidence
    where assignment_id in (select id from public.evaluation_assignments where is_demo);
  delete from public.evaluation_responses
    where assignment_id in (select id from public.evaluation_assignments where is_demo);
  delete from public.evaluation_assignments
    where is_demo or employee_id in (select id from public.employees where is_demo);
  delete from public.evaluation_cycles where is_demo;
  delete from public.evaluation_profile_versions where is_demo;
  delete from public.evaluation_profiles where is_demo;
  delete from public.competency_gap_snapshots
    where employee_id in (select id from public.employees where is_demo);
  delete from public.competency_assessment_evidence
    where assessment_id in (
      select id from public.competency_assessments
      where employee_id in (select id from public.employees where is_demo)
    );
  delete from public.competency_assessments
    where employee_id in (select id from public.employees where is_demo);
  delete from public.position_competency_requirements where is_demo;
  delete from public.competencies where is_demo;
  delete from public.competency_categories where is_demo;
  delete from public.file_metadata
    where employee_id in (select id from public.employees where is_demo);
  delete from public.notifications
    where user_id in (select id from public.profiles where is_demo);
  delete from public.outbox_events
    where payload->>'user_id' in (select id::text from public.profiles where is_demo);
  delete from public.reporting_relationships where is_demo;
  update public.departments set head_employee_id=null where is_demo;
  delete from public.employees where is_demo;
  delete from public.positions where is_demo;
  delete from public.departments where is_demo;
  delete from auth.users where id in (select id from public.profiles where is_demo);
  perform public.log_audit('remove_demo_data','system',null,'{}'::jsonb);
  return jsonb_build_object('ok',true);
end $$;

revoke execute on function public.remove_demo_data() from public, anon;
grant execute on function public.remove_demo_data() to authenticated;
