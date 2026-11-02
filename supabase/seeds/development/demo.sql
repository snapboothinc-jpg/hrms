-- Minimal development fixtures for the Logistics Department. Never run in production.
do $$
declare
  pw text := extensions.crypt('Test1234!', extensions.gen_salt('bf'));
  u record;
  route_gap_snapshot uuid;
  account_ids uuid[] := ARRAY[
    '00000000-0000-4000-a000-000000000001','00000000-0000-4000-a000-000000000002',
    '00000000-0000-4000-a000-000000000003','00000000-0000-4000-a000-000000000004',
    '00000000-0000-4000-a000-000000000005','00000000-0000-4000-a000-000000000006',
    '00000000-0000-4000-a000-000000000007'
  ]::uuid[];
  employee_ids uuid[] := ARRAY[
    '00000000-0000-4000-d000-000000000001','00000000-0000-4000-d000-000000000002',
    '00000000-0000-4000-d000-000000000003','00000000-0000-4000-d000-000000000004',
    '00000000-0000-4000-d000-000000000005','00000000-0000-4000-d000-000000000006',
    '00000000-0000-4000-d000-000000000007','00000000-0000-4000-d000-000000000008'
  ]::uuid[];
  position_ids uuid[] := ARRAY[
    '00000000-0000-4000-c000-000000000001','00000000-0000-4000-c000-000000000002',
    '00000000-0000-4000-c000-000000000003','00000000-0000-4000-c000-000000000004',
    '00000000-0000-4000-c000-000000000005','00000000-0000-4000-c000-000000000006'
  ]::uuid[];
  existing_accounts integer;
  existing_profiles integer;
  existing_employees integer;
  existing_departments integer;
  existing_positions integer;
begin
  IF EXISTS (
    SELECT 1 FROM auth.users
     WHERE id = ANY(account_ids)
        OR email = ANY(ARRAY[
          'victor.superadmin+priority@gmail.com','nina.admin+priority@gmail.com',
          'liza.hradmin+priority@gmail.com','maria.depthead+priority@gmail.com',
          'jose.supervisor+priority@gmail.com','ana.employee+priority@gmail.com',
          'carlo.opsmanager+priority@gmail.com'
        ])
  ) OR EXISTS (SELECT 1 FROM public.profiles WHERE id = ANY(account_ids))
    OR EXISTS (SELECT 1 FROM public.employees WHERE id = ANY(employee_ids))
    OR EXISTS (SELECT 1 FROM public.departments WHERE id = '00000000-0000-4000-b000-000000000001')
    OR EXISTS (SELECT 1 FROM public.positions WHERE id = ANY(position_ids)) THEN
    SELECT count(*) INTO existing_accounts FROM auth.users WHERE id = ANY(account_ids);
    SELECT count(*) INTO existing_profiles FROM public.profiles WHERE id = ANY(account_ids) AND is_demo;
    SELECT count(*) INTO existing_employees FROM public.employees WHERE id = ANY(employee_ids) AND is_demo;
    SELECT count(*) INTO existing_departments FROM public.departments
     WHERE id = '00000000-0000-4000-b000-000000000001' AND is_demo;
    SELECT count(*) INTO existing_positions FROM public.positions WHERE id = ANY(position_ids) AND is_demo;

    IF existing_accounts = 7 AND existing_profiles = 7 AND existing_employees = 8
       AND existing_departments = 1 AND existing_positions = 6 THEN
      RETURN;
    END IF;
    RAISE EXCEPTION 'Demo fixtures partially exist; refusing to overwrite or duplicate existing records';
  END IF;

  for u in
    select * from (values
      ('00000000-0000-4000-a000-000000000001'::uuid,'victor.superadmin+priority@gmail.com','Victor Tan','super_admin'::public.app_role),
      ('00000000-0000-4000-a000-000000000002'::uuid,'nina.admin+priority@gmail.com','Nina Ramos','admin'),
      ('00000000-0000-4000-a000-000000000003'::uuid,'liza.hradmin+priority@gmail.com','Liza Mendoza','hr_admin'),
      ('00000000-0000-4000-a000-000000000004'::uuid,'maria.depthead+priority@gmail.com','Maria Santos','dept_head'),
      ('00000000-0000-4000-a000-000000000005'::uuid,'jose.supervisor+priority@gmail.com','Jose Reyes','supervisor'),
      ('00000000-0000-4000-a000-000000000006'::uuid,'ana.employee+priority@gmail.com','Ana Cruz','employee'),
      ('00000000-0000-4000-a000-000000000007'::uuid,'carlo.opsmanager+priority@gmail.com','Carlo Bautista','ops_manager')
    ) as accounts(id,email,name,role)
  loop
    insert into auth.users(
      instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
      raw_app_meta_data,raw_user_meta_data,created_at,updated_at,
      confirmation_token,recovery_token,email_change_token_new,email_change
    )
    values (
      '00000000-0000-0000-0000-000000000000',u.id,'authenticated','authenticated',
      u.email,pw,now(),'{"provider":"email","providers":["email"]}',
      jsonb_build_object('full_name',u.name),now(),now(),'','','',''
    );
    insert into auth.identities(
      id,user_id,provider_id,identity_data,provider,last_sign_in_at,created_at,updated_at
    )
    values (
      gen_random_uuid(),u.id,u.id::text,
      jsonb_build_object('sub',u.id::text,'email',u.email,'email_verified',true),
      'email',now(),now(),now()
    );
    update public.profiles set is_demo=true,full_name=u.name where id=u.id;
    insert into public.user_roles(user_id,role) values (u.id,u.role);
  end loop;

  insert into public.departments(id,code,name,is_demo) values
    ('00000000-0000-4000-b000-000000000001','LOG','Logistics Department',true);
  insert into public.positions(id,code,title,department_id,description,is_demo) values
    ('00000000-0000-4000-c000-000000000001','LDH','Logistics Department Head','00000000-0000-4000-b000-000000000001','Leads the department and succession planning.',true),
    ('00000000-0000-4000-c000-000000000002','DSP','Dispatch Supervisor','00000000-0000-4000-b000-000000000001','Supervises dispatch and employee development.',true),
    ('00000000-0000-4000-c000-000000000003','LC','Logistics Coordinator','00000000-0000-4000-b000-000000000001','Coordinates shipments, documents and carriers.',true),
    ('00000000-0000-4000-c000-000000000004','HRP','People and Development Partner','00000000-0000-4000-b000-000000000001','Supports performance, learning and recognition workflows.',true),
    ('00000000-0000-4000-c000-000000000005','SYS','Systems Administrator','00000000-0000-4000-b000-000000000001','Supports HRMS administration.',true),
    ('00000000-0000-4000-c000-000000000006','OPS','Logistics Operations Manager','00000000-0000-4000-b000-000000000001','Owns logistics learning and training operations.',true);
  insert into public.employees(
    id,employee_code,first_name,last_name,email,department_id,position_id,hire_date,user_id,is_demo
  ) values
    ('00000000-0000-4000-d000-000000000001','E001','Maria','Santos','maria.depthead+priority@gmail.com','00000000-0000-4000-b000-000000000001','00000000-0000-4000-c000-000000000001','2015-03-02','00000000-0000-4000-a000-000000000004',true),
    ('00000000-0000-4000-d000-000000000002','E002','Jose','Reyes','jose.supervisor+priority@gmail.com','00000000-0000-4000-b000-000000000001','00000000-0000-4000-c000-000000000002','2018-06-11','00000000-0000-4000-a000-000000000005',true),
    ('00000000-0000-4000-d000-000000000003','E003','Ana','Cruz','ana.employee+priority@gmail.com','00000000-0000-4000-b000-000000000001','00000000-0000-4000-c000-000000000003','2022-01-17','00000000-0000-4000-a000-000000000006',true),
    ('00000000-0000-4000-d000-000000000004','E004','Paolo','Garcia',null,'00000000-0000-4000-b000-000000000001','00000000-0000-4000-c000-000000000003','2023-09-04',null,true),
    ('00000000-0000-4000-d000-000000000005','E005','Liza','Mendoza','liza.hradmin+priority@gmail.com','00000000-0000-4000-b000-000000000001','00000000-0000-4000-c000-000000000004','2016-02-01','00000000-0000-4000-a000-000000000003',true),
    ('00000000-0000-4000-d000-000000000006','E006','Nina','Ramos','nina.admin+priority@gmail.com','00000000-0000-4000-b000-000000000001','00000000-0000-4000-c000-000000000005','2020-10-05','00000000-0000-4000-a000-000000000002',true),
    ('00000000-0000-4000-d000-000000000007','E007','Victor','Tan','victor.superadmin+priority@gmail.com','00000000-0000-4000-b000-000000000001','00000000-0000-4000-c000-000000000005','2014-01-06','00000000-0000-4000-a000-000000000001',true),
    ('00000000-0000-4000-d000-000000000008','E008','Carlo','Bautista','carlo.opsmanager+priority@gmail.com','00000000-0000-4000-b000-000000000001','00000000-0000-4000-c000-000000000006','2019-08-19','00000000-0000-4000-a000-000000000007',true);
  update public.departments
    set head_employee_id='00000000-0000-4000-d000-000000000001'
    where id='00000000-0000-4000-b000-000000000001';
  insert into public.reporting_relationships(employee_id,supervisor_id,effective_from,is_demo) values
    ('00000000-0000-4000-d000-000000000002','00000000-0000-4000-d000-000000000001','2018-06-11',true),
    ('00000000-0000-4000-d000-000000000003','00000000-0000-4000-d000-000000000002','2022-01-17',true),
    ('00000000-0000-4000-d000-000000000004','00000000-0000-4000-d000-000000000002','2023-09-04',true),
    ('00000000-0000-4000-d000-000000000008','00000000-0000-4000-d000-000000000001','2019-08-19',true);

  insert into public.competency_categories(id,name,description,is_demo) values
    ('00000000-0000-4000-e000-000000000001','Logistics Operations & Safety','Core freight planning and safe cargo handling.',true);
  insert into public.competencies(
    id,code,name,description,definition,category_id,status,is_mandatory,is_safety_critical,is_demo
  ) values
    ('00000000-0000-4000-f000-000000000001','SAF-01','Road & Cargo Safety Compliance','Applies safety rules to vehicles, loads and dangerous goods.','Checks load securing, dangerous goods documentation and driving-hour requirements.','00000000-0000-4000-e000-000000000001','active',true,true,true),
    ('00000000-0000-4000-f000-000000000002','OPS-01','Route Planning & Optimization','Plans efficient, compliant routes.','Balances delivery windows, vehicle capacity, cost and driving-hour requirements.','00000000-0000-4000-e000-000000000001','active',true,false,true);
  insert into public.behavioral_indicators(competency_id,level,indicator) values
    ('00000000-0000-4000-f000-000000000001',3,'Checks load securing and paperwork without prompting.'),
    ('00000000-0000-4000-f000-000000000002',2,'Plans routine routes but needs help resolving delivery-window conflicts.'),
    ('00000000-0000-4000-f000-000000000002',3,'Plans multi-stop routes that meet delivery windows without correction.');
  insert into public.position_competency_requirements(
    position_id,competency_id,required_level,is_mandatory,is_safety_critical,is_demo
  ) values
    ('00000000-0000-4000-c000-000000000003','00000000-0000-4000-f000-000000000001',3,true,true,true),
    ('00000000-0000-4000-c000-000000000003','00000000-0000-4000-f000-000000000002',3,true,false,true);

  insert into public.evaluation_profiles(id,position_id,name,description,is_demo) values
    ('00000000-0000-4000-9000-000000000001','00000000-0000-4000-c000-000000000003','Logistics Coordinator Evaluation','Annual review of safe and effective logistics coordination.',true);
  insert into public.evaluation_profile_versions(
    id,profile_id,position_id,version_number,status,effective_date,instructions,activated_at,is_demo
  ) values
    ('00000000-0000-4000-9100-000000000001','00000000-0000-4000-9000-000000000001','00000000-0000-4000-c000-000000000003',1,'draft','2026-01-01','Rate each competency against the proficiency framework and attach evidence.',null,true);
  perform public._seed_performance_factors('00000000-0000-4000-9100-000000000001');
  insert into public.evaluation_sections(id,version_id,title,description,sort_order) values
    ('00000000-0000-4000-9200-000000000001','00000000-0000-4000-9100-000000000001','Operational competencies','Performance against current logistics role requirements.',0);
  insert into public.evaluation_items(
    version_id,section_id,label,item_type,weight,competency_id,evidence_required,is_required,sort_order
  ) values
    ('00000000-0000-4000-9100-000000000001','00000000-0000-4000-9200-000000000001','Route planning','rating',50,'00000000-0000-4000-f000-000000000002',true,true,0),
    ('00000000-0000-4000-9100-000000000001','00000000-0000-4000-9200-000000000001','Cargo safety','rating',50,'00000000-0000-4000-f000-000000000001',true,true,1);
  update public.evaluation_profile_versions
     set status='active',activated_at=now()
   where id='00000000-0000-4000-9100-000000000001';
  insert into public.evaluation_cycles(
    id,name,description,period_start,period_end,due_date,self_evaluation,status,is_demo
  ) values
    ('00000000-0000-4000-9300-000000000001','2026 Logistics Performance Review','Annual review for Logistics Department employees.','2026-01-01','2026-12-31','2026-12-15',true,'open',true);
  insert into public.competency_assessments(
    id,employee_id,competency_id,assessor_id,cycle_id,assessment_date,current_level,evidence_summary,
    status,reviewer_id,reviewed_at,is_demo
  ) values
    ('00000000-0000-4000-fa00-000000000001','00000000-0000-4000-d000-000000000003','00000000-0000-4000-f000-000000000002','00000000-0000-4000-a000-000000000005','00000000-0000-4000-9300-000000000001','2026-08-14',2,'Route plans needed correction on 3 of 10 multi-stop jobs.','approved','00000000-0000-4000-a000-000000000003',now(),true),
    ('00000000-0000-4000-fa00-000000000002','00000000-0000-4000-d000-000000000003','00000000-0000-4000-f000-000000000001','00000000-0000-4000-a000-000000000005','00000000-0000-4000-9300-000000000001','2026-08-14',3,'All observed load inspections met the required safety checks.','approved','00000000-0000-4000-a000-000000000003',now(),true),
    ('00000000-0000-4000-fa00-000000000003','00000000-0000-4000-d000-000000000004','00000000-0000-4000-f000-000000000001','00000000-0000-4000-a000-000000000005','00000000-0000-4000-9300-000000000001','2026-08-20',2,'Missed load-securing checks required supervisor follow-up.','approved','00000000-0000-4000-a000-000000000003',now(),true);
  insert into public.evaluation_assignments(
    id,cycle_id,employee_id,evaluator_id,profile_version_id,snapshot,self_evaluation,status,is_demo
  ) values
    ('00000000-0000-4000-9400-000000000001','00000000-0000-4000-9300-000000000001','00000000-0000-4000-d000-000000000003','00000000-0000-4000-d000-000000000002','00000000-0000-4000-9100-000000000001',public._build_snapshot('00000000-0000-4000-9100-000000000001'),true,'in_progress',true),
    ('00000000-0000-4000-9400-000000000002','00000000-0000-4000-9300-000000000001','00000000-0000-4000-d000-000000000004','00000000-0000-4000-d000-000000000002','00000000-0000-4000-9100-000000000001',public._build_snapshot('00000000-0000-4000-9100-000000000001'),true,'not_started',true);
  perform public._snapshot_gaps('00000000-0000-4000-d000-000000000003');
  perform public._snapshot_gaps('00000000-0000-4000-d000-000000000004');
  select id into route_gap_snapshot
    from public.competency_gap_snapshots
   where employee_id='00000000-0000-4000-d000-000000000003'
     and competency_id='00000000-0000-4000-f000-000000000002'
     and assessment_id='00000000-0000-4000-fa00-000000000001'
   order by snapshot_at desc
   limit 1;

  insert into public.courses(
    id,code,title,description,category,objectives,owner_id,duration_minutes,difficulty,status,completion_rule,is_demo
  ) values
    ('00000000-0000-4000-c100-000000000001','RPF-101','Route Planning Fundamentals','Plan efficient, compliant multi-stop routes.','Logistics Operations','Balance delivery windows, capacity and driving-hour rules when planning freight routes.','00000000-0000-4000-d000-000000000008',120,'intermediate','approved','all_lessons',true);
  insert into public.course_sections(id,course_id,title,description,sort_order) values
    ('00000000-0000-4000-c200-000000000001','00000000-0000-4000-c100-000000000001','Route planning essentials','Core route constraints and sequencing.',0);
  insert into public.lessons(id,section_id,title,content,duration_minutes,sort_order) values
    ('00000000-0000-4000-c300-000000000001','00000000-0000-4000-c200-000000000001','Plan a compliant multi-stop route','Review delivery windows, vehicle capacity and driving-hour constraints before selecting a route.',120,0);
  insert into public.course_competency_mappings(course_id,competency_id,target_level) values
    ('00000000-0000-4000-c100-000000000001','00000000-0000-4000-f000-000000000002',3);
  insert into public.learning_paths(id,title,description,competency_id,status,is_demo) values
    ('00000000-0000-4000-c600-000000000001','Logistics Route Planning','Learning path for the Route Planning & Optimization competency.','00000000-0000-4000-f000-000000000002','active',true);
  insert into public.learning_path_courses(path_id,course_id,sort_order) values
    ('00000000-0000-4000-c600-000000000001','00000000-0000-4000-c100-000000000001',0);
  insert into public.ai_recommendations(
    id,employee_id,competency_id,required_level,current_level,gap,gap_snapshot_id,recommendation_type,resource_id,
    rationale,expected_outcome,priority,status,model,generated_by,sources,is_demo
  ) values
    ('00000000-0000-4000-cc00-000000000001','00000000-0000-4000-d000-000000000003','00000000-0000-4000-f000-000000000002',3,2,1,route_gap_snapshot,'course','00000000-0000-4000-c100-000000000001',
    'The route-planning course directly addresses the employee''s assessed level-2 gap against the position''s level-3 requirement.','Plan multi-stop routes that meet delivery windows without correction.','high','accepted','seeded-fixture','00000000-0000-4000-a000-000000000003','["competency_gaps","course_competency_mappings"]',true);
  insert into public.ai_recommendation_reviews(recommendation_id,reviewer_id,decision,comments,is_demo) values
    ('00000000-0000-4000-cc00-000000000001','00000000-0000-4000-a000-000000000003','accept','Approved for the current route-planning competency gap.',true);

  insert into public.development_plans(
    id,employee_id,title,objectives,responsible_id,target_date,status,is_demo
  ) values
    ('00000000-0000-4000-c800-000000000001','00000000-0000-4000-d000-000000000003','Route Planning Development Plan','Close the route-planning gap through targeted learning and supervised practice.','00000000-0000-4000-d000-000000000002','2026-09-30','draft',true);
  insert into public.development_plan_items(
    id,plan_id,item_type,title,description,competency_id,course_id,training_session_id,
    gap_snapshot_id,ai_recommendation_id,priority,target_date,status,completed_at,evidence,is_demo
  ) values
    ('00000000-0000-4000-c900-000000000001','00000000-0000-4000-c800-000000000001','course','Complete Route Planning Fundamentals','Complete the recommended course for the identified level-2 to level-3 competency gap.','00000000-0000-4000-f000-000000000002','00000000-0000-4000-c100-000000000001',null,route_gap_snapshot,'00000000-0000-4000-cc00-000000000001','high','2026-09-20','completed',now(),'Course completed and competency reassessed.',true),
    ('00000000-0000-4000-c900-000000000002','00000000-0000-4000-c800-000000000001','training','Attend Route Planning Workshop','Apply route-planning techniques with the operations team.','00000000-0000-4000-f000-000000000002',null,'00000000-0000-4000-cb00-000000000001',route_gap_snapshot,'00000000-0000-4000-cc00-000000000001','high','2026-09-25','completed',now(),'Attended and passed the practical workshop.',true);
  update public.development_plans
     set status='completed',approval_status='approved',
         reviewed_by='00000000-0000-4000-a000-000000000003',reviewed_at=now()
   where id='00000000-0000-4000-c800-000000000001';
  insert into public.course_enrollments(
    id,course_id,employee_id,source,development_plan_item_id,status,assigned_by,assigned_at,completed_at,is_demo
  ) values
    ('00000000-0000-4000-c700-000000000001','00000000-0000-4000-c100-000000000001','00000000-0000-4000-d000-000000000003','development_plan','00000000-0000-4000-c900-000000000001','completed','00000000-0000-4000-a000-000000000007','2026-09-01',now(),true);
  insert into public.lesson_progress(enrollment_id,lesson_id,completed_at) values
    ('00000000-0000-4000-c700-000000000001','00000000-0000-4000-c300-000000000001',now());
  insert into public.course_completions(course_id,employee_id,enrollment_id,score,completed_at,is_demo) values
    ('00000000-0000-4000-c100-000000000001','00000000-0000-4000-d000-000000000003','00000000-0000-4000-c700-000000000001',88,now(),true);
  insert into public.trainers(id,name,email,specialty,is_external,is_demo) values
    ('00000000-0000-4000-ca00-000000000001','Carlo Bautista','carlo.opsmanager+priority@gmail.com','Logistics operations and route planning',false,true);
  insert into public.training_sessions(
    id,code,title,type,starts_at,ends_at,venue,delivery_method,trainer_id,capacity,status,related_competency_id,is_demo
  ) values
    ('00000000-0000-4000-cb00-000000000001','RP-2026-09','Route Planning Workshop','workshop','2026-09-22 09:00+00','2026-09-22 16:00+00','Logistics Department training room','in_person','00000000-0000-4000-ca00-000000000001',12,'completed','00000000-0000-4000-f000-000000000002',true);
  insert into public.training_participants(session_id,employee_id,development_plan_item_id,status,is_demo) values
    ('00000000-0000-4000-cb00-000000000001','00000000-0000-4000-d000-000000000003','00000000-0000-4000-c900-000000000002','attended',true);
  insert into public.training_attendance(session_id,employee_id,status,remarks,recorded_by,is_demo) values
    ('00000000-0000-4000-cb00-000000000001','00000000-0000-4000-d000-000000000003','present','Completed all route-planning exercises.','00000000-0000-4000-a000-000000000007',true);
  insert into public.training_results(session_id,employee_id,score,outcome,feedback,recorded_by,is_demo) values
    ('00000000-0000-4000-cb00-000000000001','00000000-0000-4000-d000-000000000003',88,'passed','Route sequencing met delivery windows and vehicle constraints.','00000000-0000-4000-a000-000000000007',true);
  insert into public.competency_assessments(
    id,employee_id,competency_id,assessor_id,cycle_id,assessment_date,current_level,evidence_summary,
    is_reassessment,status,reviewer_id,reviewed_at,is_demo
  ) values
    ('00000000-0000-4000-fa00-000000000004','00000000-0000-4000-d000-000000000003','00000000-0000-4000-f000-000000000002','00000000-0000-4000-a000-000000000005','00000000-0000-4000-9300-000000000001','2026-09-26',3,'After course completion and workshop, planned multi-stop routes met delivery windows without correction.',true,'approved','00000000-0000-4000-a000-000000000003',now(),true),
    ('00000000-0000-4000-fa00-000000000005','00000000-0000-4000-d000-000000000004','00000000-0000-4000-f000-000000000001','00000000-0000-4000-a000-000000000005','00000000-0000-4000-9300-000000000001','2026-08-20',2,'Initial load-securing assessment identifies a safety gap.',false,'approved','00000000-0000-4000-a000-000000000003',now(),true);
  insert into public.competency_reassessments(employee_id,competency_id,session_id,assessment_id,notes,is_demo) values
    ('00000000-0000-4000-d000-000000000003','00000000-0000-4000-f000-000000000002','00000000-0000-4000-cb00-000000000001','00000000-0000-4000-fa00-000000000004','Level 3 was verified after the linked course and training workshop.',true);
  perform public._snapshot_gaps('00000000-0000-4000-d000-000000000003');

  insert into public.succession_access_grants(department_id,user_id,is_demo) values
    ('00000000-0000-4000-b000-000000000001','00000000-0000-4000-a000-000000000004',true);
  insert into public.critical_positions(
    id,position_id,department_id,criticality,business_impact,incumbent_employee_id,status,review_date,is_demo
  ) values
    ('00000000-0000-4000-d100-000000000001','00000000-0000-4000-c000-000000000001','00000000-0000-4000-b000-000000000001','high','Leads Logistics Department operations and dispatch coordination.','00000000-0000-4000-d000-000000000001','active','2027-01-15',true);
  insert into public.succession_candidates(id,critical_position_id,employee_id,readiness_class_id,notes,is_demo) values
    ('00000000-0000-4000-d200-000000000001','00000000-0000-4000-d100-000000000001','00000000-0000-4000-d000-000000000002',(select id from public.readiness_classes where code='ready_1_2'),'Strong dispatch supervisor with continued commercial planning development.',true);
  insert into public.succession_readiness_assessments(candidate_id,assessor_id,assessment_date,summary,readiness_class_id,is_demo) values
    ('00000000-0000-4000-d200-000000000001','00000000-0000-4000-d000-000000000005','2026-09-28','Ready in 1-2 years; demonstrate broader departmental planning experience.',(select id from public.readiness_classes where code='ready_1_2'),true);
  insert into public.succession_development_activities(candidate_id,title,description,status,target_date,is_demo) values
    ('00000000-0000-4000-d200-000000000001','Shadow quarterly logistics planning','Build commercial planning experience for the next leadership role.','in_progress','2026-12-31',true);
  insert into public.recognition_nominations(
    id,nominator_id,recipient_id,category_id,message,supporting_info,status,reviewer_id,reviewed_at,
    visibility,show_nominator,is_demo
  ) values
    ('00000000-0000-4000-d300-000000000001','00000000-0000-4000-d000-000000000002','00000000-0000-4000-d000-000000000003',(select id from public.recognition_categories where name='Safety Champion'),
    'Ana caught a mis-declared dangerous goods shipment before loading and ensured the paperwork was corrected.','Verified by the dispatch supervisor.','approved','00000000-0000-4000-a000-000000000003',now(),'company',true,true);
  insert into public.recognition_reviews(nomination_id,reviewer_id,decision,comments,is_demo) values
    ('00000000-0000-4000-d300-000000000001','00000000-0000-4000-a000-000000000003','approve','Reviewed and approved by the HR Administrator.',true);
  insert into public.recognition_publications(nomination_id,visibility,published_by,is_demo) values
    ('00000000-0000-4000-d300-000000000001','company','00000000-0000-4000-a000-000000000003',true);
end $$;
