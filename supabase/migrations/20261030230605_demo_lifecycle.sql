-- Demo data removal/reset functions; no fixture records are inserted by migration.

-- remove_demo_data now covers Phase 5 and 6 demo rows too
create or replace function public.remove_demo_data() returns jsonb
language plpgsql security definer set search_path=public as $$
begin
  if not public.has_role(auth.uid(),'super_admin') then raise exception 'FORBIDDEN'; end if;
  if exists(select 1 from public.profiles where id=auth.uid() and is_demo) then raise exception 'RULE: sign in with a non-demo Super Admin to remove demo data'; end if;
  -- phase 6
  delete from public.recognition_publications where is_demo;
  delete from public.recognition_reviews where is_demo;
  delete from public.recognition_nominations where is_demo;
  delete from public.succession_development_activities where is_demo;
  delete from public.succession_readiness_assessments where is_demo;
  delete from public.succession_candidates where is_demo;
  delete from public.critical_positions where is_demo;
  delete from public.succession_access_grants where is_demo;
  -- phase 5
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
  delete from public.lesson_progress where enrollment_id in (select id from public.course_enrollments where is_demo);
  delete from public.course_enrollments where is_demo;
  delete from public.learning_path_courses where path_id in (select id from public.learning_paths where is_demo);
  delete from public.learning_paths where is_demo;
  delete from public.quiz_questions where quiz_id in (select id from public.quizzes q join public.courses c on c.id=q.course_id where c.is_demo);
  delete from public.quizzes where course_id in (select id from public.courses where is_demo);
  delete from public.learning_materials where course_id in (select id from public.courses where is_demo);
  delete from public.lessons where section_id in (select id from public.course_sections s join public.courses c on c.id=s.course_id where c.is_demo);
  delete from public.course_sections where course_id in (select id from public.courses where is_demo);
  delete from public.course_competency_mappings where course_id in (select id from public.courses where is_demo);
  delete from public.courses where is_demo;
  -- phases 1-4 (existing order)
  delete from public.approval_tasks where employee_id in (select id from public.employees where is_demo);
  delete from public.evaluation_reviews where assignment_id in (select id from public.evaluation_assignments where is_demo);
  delete from public.evaluation_evidence where assignment_id in (select id from public.evaluation_assignments where is_demo);
  delete from public.evaluation_responses where assignment_id in (select id from public.evaluation_assignments where is_demo);
  delete from public.evaluation_assignments where is_demo or employee_id in (select id from public.employees where is_demo);
  delete from public.evaluation_cycles where is_demo;
  delete from public.evaluation_profile_versions where is_demo;
  delete from public.evaluation_profiles where is_demo;
  delete from public.competency_gap_snapshots where employee_id in (select id from public.employees where is_demo);
  delete from public.competency_assessment_evidence where assessment_id in (select id from public.competency_assessments where employee_id in (select id from public.employees where is_demo));
  delete from public.competency_assessments where employee_id in (select id from public.employees where is_demo);
  delete from public.position_competency_requirements where is_demo;
  delete from public.competencies where is_demo;
  delete from public.competency_categories where is_demo;
  delete from public.file_metadata where employee_id in (select id from public.employees where is_demo);
  delete from public.notifications where user_id in (select id from public.profiles where is_demo);
  delete from public.outbox_events where payload->>'user_id' in (select id::text from public.profiles where is_demo);
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

-- reset_demo_data: repeatable live tests. Deletes and re-seeds the mutable demo rows (phases 3-6)
-- without touching demo accounts or organization reference data. Super Admin only; demo callers allowed.
create or replace function public.reset_demo_data() returns jsonb
language plpgsql security definer set search_path=public as $$
begin
  if not public.has_role(auth.uid(),'super_admin') then raise exception 'FORBIDDEN'; end if;
  -- clear mutable demo rows (children first)
  delete from public.ai_recommendation_reviews where is_demo;
  delete from public.ai_recommendations where is_demo;
  delete from public.recognition_publications where is_demo;
  delete from public.recognition_reviews where is_demo;
  delete from public.recognition_nominations where is_demo;
  delete from public.succession_development_activities where is_demo;
  delete from public.succession_readiness_assessments where is_demo;
  delete from public.succession_candidates where is_demo;
  delete from public.critical_positions where is_demo;
  delete from public.succession_access_grants where is_demo;
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
  delete from public.lesson_progress where enrollment_id in (select id from public.course_enrollments where is_demo);
  delete from public.course_enrollments where is_demo;
  delete from public.learning_path_courses where path_id in (select id from public.learning_paths where is_demo);
  delete from public.learning_paths where is_demo;
  delete from public.quiz_questions where quiz_id in (select id from public.quizzes q join public.courses c on c.id=q.course_id where c.is_demo);
  delete from public.quizzes where course_id in (select id from public.courses where is_demo);
  delete from public.lessons where section_id in (select id from public.course_sections s join public.courses c on c.id=s.course_id where c.is_demo);
  delete from public.course_sections where course_id in (select id from public.courses where is_demo);
  delete from public.course_competency_mappings where course_id in (select id from public.courses where is_demo);
  delete from public.courses where is_demo;
  delete from public.approval_tasks where is_demo or employee_id in (select id from public.employees where is_demo);
  delete from public.evaluation_reviews where assignment_id in (select id from public.evaluation_assignments where is_demo);
  delete from public.evaluation_evidence where assignment_id in (select id from public.evaluation_assignments where is_demo);
  delete from public.evaluation_responses where assignment_id in (select id from public.evaluation_assignments where is_demo);
  delete from public.evaluation_assignments where is_demo;
  delete from public.competency_assessment_evidence where assessment_id in (select id from public.competency_assessments where is_demo);
  delete from public.competency_assessments where is_demo;
  delete from public.competency_gap_snapshots where employee_id in (select id from public.employees where is_demo);
  delete from public.notifications where user_id in (select id from public.profiles where is_demo);
  delete from public.outbox_events where payload->>'user_id' in (select id::text from public.profiles where is_demo);
  -- re-seed phase 3-4 mutable demo rows
  insert into public.competency_assessments(employee_id,competency_id,assessor_id,assessment_date,current_level,evidence_summary,status,reviewer_id,reviewed_at,is_demo) values
    ('00000000-0000-4000-d000-000000000003','00000000-0000-4000-f000-000000000001','00000000-0000-4000-a000-000000000005','2026-08-14',3,'Observed 6 load inspections; all compliant.','approved','00000000-0000-4000-a000-000000000003',now(),true),
    ('00000000-0000-4000-d000-000000000003','00000000-0000-4000-f000-000000000002','00000000-0000-4000-a000-000000000005','2026-08-14',2,'Route plans needed correction on 3 of 10 multi-stop jobs.','approved','00000000-0000-4000-a000-000000000003',now(),true),
    ('00000000-0000-4000-d000-000000000003','00000000-0000-4000-f000-000000000006','00000000-0000-4000-a000-000000000005','2026-08-14',4,'Customer feedback scores above target for two quarters.','approved','00000000-0000-4000-a000-000000000003',now(),true),
    ('00000000-0000-4000-d000-000000000004','00000000-0000-4000-f000-000000000001','00000000-0000-4000-a000-000000000005','2026-08-20',2,'Missed load-securing check on two occasions.','approved','00000000-0000-4000-a000-000000000003',now(),true);
  insert into public.evaluation_assignments(cycle_id,employee_id,evaluator_id,profile_version_id,snapshot,self_evaluation,is_demo)
  select '00000000-0000-4000-9300-000000000001', e, '00000000-0000-4000-d000-000000000002','00000000-0000-4000-9100-000000000001',
    public._build_snapshot('00000000-0000-4000-9100-000000000001'), true, true
  from unnest(array['00000000-0000-4000-d000-000000000003'::uuid,'00000000-0000-4000-d000-000000000004'::uuid]) e;
  perform public._snapshot_gaps('00000000-0000-4000-d000-000000000003');
  perform public._snapshot_gaps('00000000-0000-4000-d000-000000000004');
  -- re-seed phase 5 demo rows
  insert into public.courses(id,code,title,description,category,objectives,owner_id,duration_minutes,difficulty,status,completion_rule,is_demo) values
    ('00000000-0000-4000-c100-000000000001','RPF-101','Route Planning Fundamentals','Plan efficient, compliant multi-stop routes.','Freight Operations','Build routes balancing cost, time windows and capacity.','00000000-0000-4000-d000-000000000008',240,'intermediate','approved','all_lessons_and_quiz',true),
    ('00000000-0000-4000-c100-000000000002','LSR-201','Load Securing & DG Safety Refresher','Refresher on load securing and dangerous goods rules.','Safety & Compliance','Apply load securing and DG rules without prompting.','00000000-0000-4000-d000-000000000008',180,'beginner','approved','all_lessons',true),
    ('00000000-0000-4000-c100-000000000003','CDM-301','Customs Documentation Masterclass','Accurate export and customs documentation.','Freight Operations','Prepare standard export documents without errors.','00000000-0000-4000-d000-000000000008',300,'advanced','pending_review','all_lessons',true);
  insert into public.course_sections(id,course_id,title,description,sort_order) values
    ('00000000-0000-4000-c200-000000000001','00000000-0000-4000-c100-000000000001','Route basics','Cost, time windows, capacity',0),
    ('00000000-0000-4000-c200-000000000002','00000000-0000-4000-c100-000000000001','Multi-stop planning','Sequencing and constraints',1),
    ('00000000-0000-4000-c200-000000000003','00000000-0000-4000-c100-000000000002','Load securing','Straps, blocking, inspections',0);
  insert into public.lessons(id,section_id,title,content,duration_minutes,sort_order) values
    ('00000000-0000-4000-c300-000000000001','00000000-0000-4000-c200-000000000001','Reading the route brief','Understand delivery windows, vehicle capacity and cost drivers before planning.',30,0),
    ('00000000-0000-4000-c300-000000000002','00000000-0000-4000-c200-000000000001','Compliance constraints','Driving-hour rules and restricted zones that shape every route.',45,1),
    ('00000000-0000-4000-c300-000000000003','00000000-0000-4000-c200-000000000002','Sequencing stops','Order stops to meet windows with the fewest kilometres.',60,0),
    ('00000000-0000-4000-c300-000000000004','00000000-0000-4000-c200-000000000003','Pre-trip load inspection','The 7-point load securing check every coordinator must verify.',40,0);
  insert into public.course_competency_mappings(course_id,competency_id,target_level) values
    ('00000000-0000-4000-c100-000000000001','00000000-0000-4000-f000-000000000002',3),
    ('00000000-0000-4000-c100-000000000002','00000000-0000-4000-f000-000000000001',3),
    ('00000000-0000-4000-c100-000000000003','00000000-0000-4000-f000-000000000003',4);
  insert into public.quizzes(id,course_id,title,pass_score,max_attempts) values
    ('00000000-0000-4000-c400-000000000001','00000000-0000-4000-c100-000000000001','Route planning check',70,3);
  insert into public.quiz_questions(id,quiz_id,question,options,correct_index,sort_order) values
    ('00000000-0000-4000-c500-000000000001','00000000-0000-4000-c400-000000000001','What comes first when planning a multi-stop route?','["Assign vehicles","Read the delivery windows and constraints","Book carriers","Print manifests"]',1,0),
    ('00000000-0000-4000-c500-000000000002','00000000-0000-4000-c400-000000000001','Which rule can change a route plan late in the day?','["Office seating plan","Driving-hour limits","Canteen menu","Parking layout"]',1,1);
  insert into public.learning_paths(id,title,description,competency_id,status,is_demo) values
    ('00000000-0000-4000-c600-000000000001','Logistics Coordinator Foundations','Core operations learning for new coordinators.','00000000-0000-4000-f000-000000000002','active',true);
  insert into public.learning_path_courses(path_id,course_id,sort_order) values
    ('00000000-0000-4000-c600-000000000001','00000000-0000-4000-c100-000000000001',0),
    ('00000000-0000-4000-c600-000000000001','00000000-0000-4000-c100-000000000002',1);
  insert into public.course_enrollments(id,course_id,employee_id,source,status,assigned_by,is_demo) values
    ('00000000-0000-4000-c700-000000000001','00000000-0000-4000-c100-000000000001','00000000-0000-4000-d000-000000000003','development_plan','in_progress','00000000-0000-4000-a000-000000000007',true),
    ('00000000-0000-4000-c700-000000000002','00000000-0000-4000-c100-000000000002','00000000-0000-4000-d000-000000000004','direct','assigned','00000000-0000-4000-a000-000000000007',true);
  insert into public.lesson_progress(enrollment_id,lesson_id,completed_at) values
    ('00000000-0000-4000-c700-000000000001','00000000-0000-4000-c300-000000000001',now());
  insert into public.development_plans(id,employee_id,title,objectives,responsible_id,target_date,status,is_demo) values
    ('00000000-0000-4000-c800-000000000001','00000000-0000-4000-d000-000000000003','Ana Cruz development plan','Close the route planning gap and prepare for customs documentation.','00000000-0000-4000-d000-000000000002','2026-12-31','active',true),
    ('00000000-0000-4000-c800-000000000002','00000000-0000-4000-d000-000000000004','Paolo Garcia development plan','Address the mandatory safety gap.','00000000-0000-4000-d000-000000000002','2026-11-30','active',true);
  insert into public.development_plan_items(id,plan_id,item_type,title,description,competency_id,course_id,priority,target_date,status,is_demo) values
    ('00000000-0000-4000-c900-000000000001','00000000-0000-4000-c800-000000000001','course','Complete Route Planning Fundamentals','Close the route planning gap (required 3, current 2).','00000000-0000-4000-f000-000000000002','00000000-0000-4000-c100-000000000001','high','2026-11-30','in_progress',true),
    ('00000000-0000-4000-c900-000000000002','00000000-0000-4000-c800-000000000002','course','Complete Load Securing refresher','Mandatory safety-critical gap.','00000000-0000-4000-f000-000000000001','00000000-0000-4000-c100-000000000002','high','2026-10-31','pending',true);
  insert into public.trainers(id,name,email,specialty,is_external,is_demo) values
    ('00000000-0000-4000-ca00-000000000001','Carlo Bautista','ops@priorityhandling.demo','Learning & development',false,true),
    ('00000000-0000-4000-ca00-000000000002','SafeHaul Training Partners','bookings@safehaul.example','Dangerous goods and load securing',true,true);
  insert into public.training_sessions(id,code,title,type,starts_at,ends_at,venue,delivery_method,trainer_id,capacity,status,related_competency_id,is_demo) values
    ('00000000-0000-4000-cb00-000000000001','DG-2026-11','Dangerous Goods Awareness Drill','drill','2026-11-12 09:00+00','2026-11-12 16:00+00','Depot 2 training room','in_person','00000000-0000-4000-ca00-000000000002',12,'planned','00000000-0000-4000-f000-000000000001',true),
    ('00000000-0000-4000-cb00-000000000002','RP-2026-09','Route Planning Workshop','workshop','2026-09-08 09:00+00','2026-09-08 17:00+00','Head office','in_person','00000000-0000-4000-ca00-000000000001',10,'completed','00000000-0000-4000-f000-000000000002',true);
  insert into public.training_participants(session_id,employee_id,status,is_demo) values
    ('00000000-0000-4000-cb00-000000000001','00000000-0000-4000-d000-000000000003','registered',true),
    ('00000000-0000-4000-cb00-000000000001','00000000-0000-4000-d000-000000000004','registered',true),
    ('00000000-0000-4000-cb00-000000000002','00000000-0000-4000-d000-000000000003','attended',true);
  insert into public.training_attendance(session_id,employee_id,status,remarks,recorded_by,is_demo) values
    ('00000000-0000-4000-cb00-000000000002','00000000-0000-4000-d000-000000000003','present',null,'00000000-0000-4000-a000-000000000007',true);
  insert into public.training_results(session_id,employee_id,score,outcome,feedback,recorded_by,is_demo) values
    ('00000000-0000-4000-cb00-000000000002','00000000-0000-4000-d000-000000000003',82,'passed','Good progress; route sequencing improved.','00000000-0000-4000-a000-000000000007',true);
  insert into public.ai_recommendations(id,employee_id,competency_id,required_level,current_level,gap,recommendation_type,resource_id,
    rationale,expected_outcome,priority,status,model,generated_by,sources,is_demo) values
    ('00000000-0000-4000-cc00-000000000001','00000000-0000-4000-d000-000000000003','00000000-0000-4000-f000-000000000002',3,2,1,'course',
    '00000000-0000-4000-c100-000000000001','Route Planning Fundamentals directly targets the level 3 requirement for Route Planning & Optimization.',
    'Employee plans multi-stop routes that meet delivery windows without correction.','high','pending_review','seeded-demo','00000000-0000-4000-a000-000000000003','["competency_gaps","course_competency_mappings"]',true);
  -- re-seed phase 6 demo rows
  insert into public.succession_access_grants(department_id,user_id,is_demo) values
    ('00000000-0000-4000-b000-000000000001','00000000-0000-4000-a000-000000000004',true);
  insert into public.critical_positions(id,position_id,department_id,criticality,business_impact,incumbent_employee_id,status,review_date,is_demo) values
    ('00000000-0000-4000-d100-000000000001','00000000-0000-4000-c000-000000000001','00000000-0000-4000-b000-000000000001','high',
    'Leads all freight operations; vacancy would halt dispatch coordination.','00000000-0000-4000-d000-000000000001','active','2027-01-15',true);
  insert into public.succession_candidates(id,critical_position_id,employee_id,readiness_class_id,notes,is_demo) values
    ('00000000-0000-4000-d200-000000000001','00000000-0000-4000-d100-000000000001','00000000-0000-4000-d000-000000000002',
    (select id from public.readiness_classes where code='ready_1_2'),'Strong supervisor; needs broader commercial exposure.',true);
  insert into public.succession_readiness_assessments(candidate_id,assessor_id,assessment_date,summary,readiness_class_id,is_demo) values
    ('00000000-0000-4000-d200-000000000001','00000000-0000-4000-d000-000000000005','2026-09-15',
    'Ready in 1-2 years: solid team leadership, gap in commercial planning.',(select id from public.readiness_classes where code='ready_1_2'),true);
  insert into public.succession_development_activities(candidate_id,title,description,status,target_date,is_demo) values
    ('00000000-0000-4000-d200-000000000001','Shadow the Operations Head on quarterly planning','Commercial planning exposure.','in_progress','2026-12-31',true);
  insert into public.recognition_nominations(id,nominator_id,recipient_id,category_id,message,supporting_info,status,reviewer_id,reviewed_at,visibility,show_nominator,is_demo) values
    ('00000000-0000-4000-d300-000000000001','00000000-0000-4000-d000-000000000002','00000000-0000-4000-d000-000000000003',
    (select id from public.recognition_categories where name='Safety Champion'),
    'Ana caught a mis-declared dangerous goods shipment before loading and stopped the dispatch until paperwork was corrected.',
    'Incident log 2026-08-221','approved','00000000-0000-4000-a000-000000000003',now(),'company',true,true),
    ('00000000-0000-4000-d300-000000000002','00000000-0000-4000-d000-000000000003','00000000-0000-4000-d000-000000000002',
    (select id from public.recognition_categories where name='Team Player'),
    'Jose covered two extra shifts during the port congestion week and coached the new coordinators through it.',
    null,'submitted',null,null,'company',true,true);
  insert into public.recognition_reviews(nomination_id,reviewer_id,decision,comments,is_demo) values
    ('00000000-0000-4000-d300-000000000001','00000000-0000-4000-a000-000000000003','approve','Verified against the incident log.',true);
  insert into public.recognition_publications(nomination_id,visibility,published_by,is_demo) values
    ('00000000-0000-4000-d300-000000000001','company','00000000-0000-4000-a000-000000000003',true);
  perform public.log_audit('reset_demo_data','system',null,'{}'::jsonb);
  return jsonb_build_object('ok',true);
end $$;
revoke execute on function public.reset_demo_data() from public, anon;
grant execute on function public.reset_demo_data() to authenticated;
