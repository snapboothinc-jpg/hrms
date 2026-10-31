-- Explicit development/test fixture seed. Never run against production.
-- ===== DEMO DATA (clearly labeled, removable with public.remove_demo_data()) =====
do $$
declare
  pw text := extensions.crypt('Priority-Demo-2026!', extensions.gen_salt('bf'));
  u record;
begin
  for u in select * from (values
    ('00000000-0000-4000-a000-000000000001'::uuid,'superadmin@priorityhandling.demo','Victor Tan','super_admin'::public.app_role),
    ('00000000-0000-4000-a000-000000000002'::uuid,'admin@priorityhandling.demo','Nina Ramos','admin'),
    ('00000000-0000-4000-a000-000000000003'::uuid,'hr@priorityhandling.demo','Liza Mendoza','hr_admin'),
    ('00000000-0000-4000-a000-000000000004'::uuid,'depthead@priorityhandling.demo','Maria Santos','dept_head'),
    ('00000000-0000-4000-a000-000000000005'::uuid,'supervisor@priorityhandling.demo','Jose Reyes','supervisor'),
    ('00000000-0000-4000-a000-000000000006'::uuid,'employee@priorityhandling.demo','Ana Cruz','employee'),
    ('00000000-0000-4000-a000-000000000007'::uuid,'ops@priorityhandling.demo','Carlo Bautista','ops_manager')) as t(id,email,name,role)
  loop
    insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change)
    values ('00000000-0000-0000-0000-000000000000',u.id,'authenticated','authenticated',u.email,pw,now(),'{"provider":"email","providers":["email"]}',jsonb_build_object('full_name',u.name),now(),now(),'','','','');
    insert into auth.identities(id,user_id,provider_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
    values (gen_random_uuid(),u.id,u.id::text,jsonb_build_object('sub',u.id::text,'email',u.email,'email_verified',true),'email',now(),now(),now());
    update public.profiles set is_demo=true, full_name=u.name where id=u.id;
    insert into public.user_roles(user_id,role) values (u.id,u.role);
  end loop;

  insert into public.departments(id,code,name,is_demo) values
    ('00000000-0000-4000-b000-000000000001','OPS','Freight Operations',true),
    ('00000000-0000-4000-b000-000000000002','HR','Human Resources',true),
    ('00000000-0000-4000-b000-000000000003','WH','Warehousing',true);
  insert into public.positions(id,code,title,department_id,description,is_demo) values
    ('00000000-0000-4000-c000-000000000001','OPH','Operations Head','00000000-0000-4000-b000-000000000001','Leads freight operations',true),
    ('00000000-0000-4000-c000-000000000002','DSP','Dispatch Supervisor','00000000-0000-4000-b000-000000000001','Supervises dispatch and coordinators',true),
    ('00000000-0000-4000-c000-000000000003','LC','Logistics Coordinator','00000000-0000-4000-b000-000000000001','Coordinates shipments, documents and carriers',true),
    ('00000000-0000-4000-c000-000000000004','HRO','HR Officer','00000000-0000-4000-b000-000000000002','HR operations',true),
    ('00000000-0000-4000-c000-000000000005','LDO','Learning & Development Officer','00000000-0000-4000-b000-000000000002','Runs learning and training',true),
    ('00000000-0000-4000-c000-000000000006','SYS','Systems Administrator','00000000-0000-4000-b000-000000000002','Administers platforms',true),
    ('00000000-0000-4000-c000-000000000007','WHS','Warehouse Supervisor','00000000-0000-4000-b000-000000000003','Supervises warehouse shifts',true),
    ('00000000-0000-4000-c000-000000000008','WHA','Warehouse Associate','00000000-0000-4000-b000-000000000003','Picks, packs and stores goods',true);
  insert into public.employees(id,employee_code,first_name,last_name,email,department_id,position_id,hire_date,user_id,is_demo) values
    ('00000000-0000-4000-d000-000000000001','E001','Maria','Santos','depthead@priorityhandling.demo','00000000-0000-4000-b000-000000000001','00000000-0000-4000-c000-000000000001','2015-03-02','00000000-0000-4000-a000-000000000004',true),
    ('00000000-0000-4000-d000-000000000002','E002','Jose','Reyes','supervisor@priorityhandling.demo','00000000-0000-4000-b000-000000000001','00000000-0000-4000-c000-000000000002','2018-06-11','00000000-0000-4000-a000-000000000005',true),
    ('00000000-0000-4000-d000-000000000003','E003','Ana','Cruz','employee@priorityhandling.demo','00000000-0000-4000-b000-000000000001','00000000-0000-4000-c000-000000000003','2022-01-17','00000000-0000-4000-a000-000000000006',true),
    ('00000000-0000-4000-d000-000000000004','E004','Paolo','Garcia',null,'00000000-0000-4000-b000-000000000001','00000000-0000-4000-c000-000000000003','2023-09-04',null,true),
    ('00000000-0000-4000-d000-000000000005','E005','Liza','Mendoza','hr@priorityhandling.demo','00000000-0000-4000-b000-000000000002','00000000-0000-4000-c000-000000000004','2016-02-01','00000000-0000-4000-a000-000000000003',true),
    ('00000000-0000-4000-d000-000000000006','E006','Ramon','Dela Cruz',null,'00000000-0000-4000-b000-000000000003','00000000-0000-4000-c000-000000000007','2017-05-22',null,true),
    ('00000000-0000-4000-d000-000000000007','E007','Grace','Lim',null,'00000000-0000-4000-b000-000000000003','00000000-0000-4000-c000-000000000008','2024-02-12',null,true),
    ('00000000-0000-4000-d000-000000000008','E008','Carlo','Bautista','ops@priorityhandling.demo','00000000-0000-4000-b000-000000000002','00000000-0000-4000-c000-000000000005','2019-08-19','00000000-0000-4000-a000-000000000007',true),
    ('00000000-0000-4000-d000-000000000009','E009','Nina','Ramos','admin@priorityhandling.demo','00000000-0000-4000-b000-000000000002','00000000-0000-4000-c000-000000000006','2020-10-05','00000000-0000-4000-a000-000000000002',true),
    ('00000000-0000-4000-d000-000000000010','E010','Victor','Tan','superadmin@priorityhandling.demo','00000000-0000-4000-b000-000000000002','00000000-0000-4000-c000-000000000006','2014-01-06','00000000-0000-4000-a000-000000000001',true);
  update public.departments set head_employee_id='00000000-0000-4000-d000-000000000001' where id='00000000-0000-4000-b000-000000000001';
  update public.departments set head_employee_id='00000000-0000-4000-d000-000000000005' where id='00000000-0000-4000-b000-000000000002';
  update public.departments set head_employee_id='00000000-0000-4000-d000-000000000006' where id='00000000-0000-4000-b000-000000000003';
  insert into public.reporting_relationships(employee_id,supervisor_id,effective_from,is_demo) values
    ('00000000-0000-4000-d000-000000000002','00000000-0000-4000-d000-000000000001','2018-06-11',true),
    ('00000000-0000-4000-d000-000000000003','00000000-0000-4000-d000-000000000002','2022-01-17',true),
    ('00000000-0000-4000-d000-000000000004','00000000-0000-4000-d000-000000000002','2023-09-04',true),
    ('00000000-0000-4000-d000-000000000007','00000000-0000-4000-d000-000000000006','2024-02-12',true),
    ('00000000-0000-4000-d000-000000000008','00000000-0000-4000-d000-000000000005','2019-08-19',true);

  insert into public.competency_categories(id,name,description,is_demo) values
    ('00000000-0000-4000-e000-000000000001','Safety & Compliance','Road, cargo and workplace safety',true),
    ('00000000-0000-4000-e000-000000000002','Freight Operations','Planning, documentation and inventory',true),
    ('00000000-0000-4000-e000-000000000003','Leadership','Leading people and shifts',true),
    ('00000000-0000-4000-e000-000000000004','Customer','Customer communication and service',true);
  insert into public.competencies(id,code,name,description,definition,category_id,status,is_mandatory,is_safety_critical,is_demo) values
    ('00000000-0000-4000-f000-000000000001','SAF-01','Road & Cargo Safety Compliance','Applies safety rules to vehicles, loads and dangerous goods','Consistently follows and enforces load securing, dangerous goods and driving-hour rules.','00000000-0000-4000-e000-000000000001','active',true,true,true),
    ('00000000-0000-4000-f000-000000000002','OPS-01','Route Planning & Optimization','Plans efficient, compliant routes','Builds routes that balance cost, time windows and capacity.','00000000-0000-4000-e000-000000000002','active',false,false,true),
    ('00000000-0000-4000-f000-000000000003','OPS-02','Freight Documentation & Customs','Prepares accurate shipping and customs documents','Bills of lading, commercial invoices and customs declarations are complete and correct.','00000000-0000-4000-e000-000000000002','active',false,false,true),
    ('00000000-0000-4000-f000-000000000004','OPS-03','Inventory Control','Keeps stock records accurate','Cycle counts, put-away and stock reconciliation.','00000000-0000-4000-e000-000000000002','active',false,false,true),
    ('00000000-0000-4000-f000-000000000005','LDR-01','Team Leadership','Leads and develops a team','Sets direction, coaches and holds people accountable.','00000000-0000-4000-e000-000000000003','active',false,false,true),
    ('00000000-0000-4000-f000-000000000006','CUS-01','Customer Communication','Keeps customers informed','Proactive, clear updates on shipment status and exceptions.','00000000-0000-4000-e000-000000000004','active',false,false,true);
  insert into public.behavioral_indicators(competency_id,level,indicator) values
    ('00000000-0000-4000-f000-000000000001',1,'Knows the basic safety rules when reminded'),
    ('00000000-0000-4000-f000-000000000001',3,'Checks load securing and paperwork without prompting'),
    ('00000000-0000-4000-f000-000000000001',5,'Designs safety procedures and trains others'),
    ('00000000-0000-4000-f000-000000000002',3,'Plans multi-stop routes that meet delivery windows'),
    ('00000000-0000-4000-f000-000000000003',3,'Prepares standard export documents without errors');
  insert into public.position_competency_requirements(position_id,competency_id,required_level,is_mandatory,is_safety_critical,is_demo) values
    ('00000000-0000-4000-c000-000000000003','00000000-0000-4000-f000-000000000001',3,true,true,true),
    ('00000000-0000-4000-c000-000000000003','00000000-0000-4000-f000-000000000002',3,false,false,true),
    ('00000000-0000-4000-c000-000000000003','00000000-0000-4000-f000-000000000003',4,true,false,true),
    ('00000000-0000-4000-c000-000000000003','00000000-0000-4000-f000-000000000006',3,false,false,true),
    ('00000000-0000-4000-c000-000000000002','00000000-0000-4000-f000-000000000001',4,true,true,true),
    ('00000000-0000-4000-c000-000000000002','00000000-0000-4000-f000-000000000002',4,false,false,true),
    ('00000000-0000-4000-c000-000000000002','00000000-0000-4000-f000-000000000005',3,false,false,true),
    ('00000000-0000-4000-c000-000000000008','00000000-0000-4000-f000-000000000001',3,true,true,true),
    ('00000000-0000-4000-c000-000000000008','00000000-0000-4000-f000-000000000004',3,false,false,true);
  insert into public.competency_assessments(employee_id,competency_id,assessor_id,assessment_date,current_level,evidence_summary,status,reviewer_id,reviewed_at,is_demo) values
    ('00000000-0000-4000-d000-000000000003','00000000-0000-4000-f000-000000000001','00000000-0000-4000-a000-000000000005','2026-08-14',3,'Observed 6 load inspections; all compliant.','approved','00000000-0000-4000-a000-000000000003',now(),true),
    ('00000000-0000-4000-d000-000000000003','00000000-0000-4000-f000-000000000002','00000000-0000-4000-a000-000000000005','2026-08-14',2,'Route plans needed correction on 3 of 10 multi-stop jobs.','approved','00000000-0000-4000-a000-000000000003',now(),true),
    ('00000000-0000-4000-d000-000000000003','00000000-0000-4000-f000-000000000006','00000000-0000-4000-a000-000000000005','2026-08-14',4,'Customer feedback scores above target for two quarters.','approved','00000000-0000-4000-a000-000000000003',now(),true),
    ('00000000-0000-4000-d000-000000000004','00000000-0000-4000-f000-000000000001','00000000-0000-4000-a000-000000000005','2026-08-20',2,'Missed load-securing check on two occasions.','approved','00000000-0000-4000-a000-000000000003',now(),true);

  insert into public.evaluation_profiles(id,position_id,name,description,is_demo) values
    ('00000000-0000-4000-9000-000000000001','00000000-0000-4000-c000-000000000003','Logistics Coordinator Evaluation','Annual evaluation for logistics coordinators',true),
    ('00000000-0000-4000-9000-000000000002','00000000-0000-4000-c000-000000000002','Dispatch Supervisor Evaluation','Annual evaluation for dispatch supervisors',true);
  insert into public.evaluation_profile_versions(id,profile_id,position_id,version_number,status,effective_date,instructions,is_demo) values
    ('00000000-0000-4000-9100-000000000001','00000000-0000-4000-9000-000000000001','00000000-0000-4000-c000-000000000003',1,'draft','2026-01-01','Rate each item 1-5 against the proficiency framework. Attach evidence where marked.',true),
    ('00000000-0000-4000-9100-000000000002','00000000-0000-4000-9000-000000000002','00000000-0000-4000-c000-000000000002',1,'draft',null,'Draft profile - complete before activation.',true);
  insert into public.evaluation_sections(id,version_id,title,description,sort_order) values
    ('00000000-0000-4000-9200-000000000001','00000000-0000-4000-9100-000000000001','Key results','Measurable outcomes for the period',0),
    ('00000000-0000-4000-9200-000000000002','00000000-0000-4000-9100-000000000001','Behaviours & competencies','How the work was done',1),
    ('00000000-0000-4000-9200-000000000003','00000000-0000-4000-9100-000000000002','Team results',null,0);
  insert into public.evaluation_items(version_id,section_id,label,item_type,weight,kpi_target,kpi_unit,competency_id,evidence_required,is_required,sort_order) values
    ('00000000-0000-4000-9100-000000000001','00000000-0000-4000-9200-000000000001','On-time shipment rate','kpi',30,95,'%',null,true,true,0),
    ('00000000-0000-4000-9100-000000000001','00000000-0000-4000-9200-000000000001','Documentation accuracy','rating',25,null,null,'00000000-0000-4000-f000-000000000003',false,true,1),
    ('00000000-0000-4000-9100-000000000001','00000000-0000-4000-9200-000000000002','Safety compliance','rating',25,null,null,'00000000-0000-4000-f000-000000000001',false,true,0),
    ('00000000-0000-4000-9100-000000000001','00000000-0000-4000-9200-000000000002','Customer responsiveness','rating',20,null,null,'00000000-0000-4000-f000-000000000006',false,true,1),
    ('00000000-0000-4000-9100-000000000001','00000000-0000-4000-9200-000000000002','Key achievements this period','long_text',0,null,null,null,false,false,2),
    ('00000000-0000-4000-9100-000000000001','00000000-0000-4000-9200-000000000002','Completed mandatory safety refresher','yes_no',0,null,null,null,false,true,3),
    ('00000000-0000-4000-9100-000000000002','00000000-0000-4000-9200-000000000003','Team on-time dispatch rate','kpi',60,97,'%',null,false,true,0);
  update public.evaluation_profile_versions set status='active', activated_at=now() where id='00000000-0000-4000-9100-000000000001';

  insert into public.evaluation_cycles(id,name,description,period_start,period_end,due_date,self_evaluation,status,is_demo) values
    ('00000000-0000-4000-9300-000000000001','2026 Annual Review','Demo cycle','2026-01-01','2026-12-31','2026-12-15',true,'open',true);
  insert into public.evaluation_assignments(cycle_id,employee_id,evaluator_id,profile_version_id,snapshot,self_evaluation,is_demo)
  select '00000000-0000-4000-9300-000000000001', e, '00000000-0000-4000-d000-000000000002','00000000-0000-4000-9100-000000000001',
    public._build_snapshot('00000000-0000-4000-9100-000000000001'), true, true
  from unnest(array['00000000-0000-4000-d000-000000000003'::uuid,'00000000-0000-4000-d000-000000000004'::uuid]) e;
  perform public._snapshot_gaps('00000000-0000-4000-d000-000000000003');
  perform public._snapshot_gaps('00000000-0000-4000-d000-000000000004');
end $$;

-- Phase 5 demo fixtures.
-- Phase 5, stage 4: demo data (clearly labeled, removable with public.remove_demo_data()).
do $$
begin
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
end $$;

-- Phase 6 demo fixtures.
-- Phase 6, stage 2: demo data + remove_demo_data() extended to Phases 5-6 + reset_demo_data() for repeatable live tests.
do $$
begin
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
end $$;
