/**
 * Read layer: browser Supabase client with the user's session, so Row Level
 * Security scopes every row. Writes never go through here — they use server
 * functions in lib/api/actions.functions.ts.
 */
import { supabase } from "@/integrations/supabase/client";

function check<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}

export type Department = {
  id: string;
  code: string;
  name: string;
  parent_id: string | null;
  head_employee_id: string | null;
  status: string;
  version: number;
};
export type Position = {
  id: string;
  code: string;
  title: string;
  department_id: string;
  description: string | null;
  status: string;
  version: number;
};
export type EmployeeRow = {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  department_id: string;
  position_id: string;
  employment_status: string;
  hire_date: string | null;
  job_notes: string | null;
  user_id: string | null;
  version: number;
  department: { name: string } | null;
  position: { title: string } | null;
};

export const fetchDepartments = async () =>
  check(await supabase.from("departments").select("*").order("name")) as Department[];
export const fetchPositions = async () =>
  check(await supabase.from("positions").select("*").order("title")) as Position[];

export const EMPLOYEE_SELECT =
  "*, department:departments!employees_department_id_fkey(name), position:positions!employees_position_id_fkey(title)";

export interface Page {
  limit?: number;
  offset?: number;
}
const pageOf = (p?: Page) => ({
  limit: Math.min(p?.limit ?? 50, 200),
  offset: Math.max(p?.offset ?? 0, 0),
});

/** Full list for picker dropdowns (bounded by the 1,000-row safety cap). */
export const fetchEmployees = async () =>
  check(
    await supabase.from("employees").select(EMPLOYEE_SELECT).order("last_name").limit(1000),
  ) as unknown as EmployeeRow[];

/** Server-side paginated list for the employees page. */
export const fetchEmployeesPage = async (p?: Page) => {
  const { limit, offset } = pageOf(p);
  return check(
    await supabase
      .from("employees")
      .select(EMPLOYEE_SELECT)
      .order("last_name")
      .range(offset, offset + limit - 1),
  ) as unknown as EmployeeRow[];
};

export const countEmployees = async () =>
  (await supabase.from("employees").select("id", { count: "exact", head: true })).count ?? 0;

export const fetchEmployee = async (id: string) => {
  const r = await supabase.from("employees").select(EMPLOYEE_SELECT).eq("id", id).maybeSingle();
  return check(r) as unknown as EmployeeRow | null;
};

export const fetchCurrentSupervisors = async () =>
  check(
    await supabase
      .from("reporting_relationships")
      .select(
        "employee_id, supervisor_id, effective_from, supervisor:employees!reporting_relationships_supervisor_id_fkey(first_name,last_name)",
      )
      .eq("is_current", true),
  ) as unknown as {
    employee_id: string;
    supervisor_id: string;
    effective_from: string;
    supervisor: { first_name: string; last_name: string } | null;
  }[];

export const empName = (e?: { first_name: string; last_name: string } | null) =>
  e ? `${e.first_name} ${e.last_name}` : "—";

export const fetchLevels = async () =>
  check(await supabase.from("proficiency_levels").select("*").order("level")) as {
    id: string;
    level: number;
    label: string;
    description: string;
    version: number;
  }[];

export const fetchCompetencies = async () =>
  check(
    await supabase
      .from("competencies")
      .select("*, category:competency_categories(name)")
      .order("name"),
  ) as unknown as {
    id: string;
    code: string;
    name: string;
    description: string | null;
    definition: string | null;
    category_id: string;
    status: string;
    is_mandatory: boolean;
    is_safety_critical: boolean;
    version: number;
    category: { name: string } | null;
  }[];

export const fetchCategories = async () =>
  check(await supabase.from("competency_categories").select("*").order("name")) as {
    id: string;
    name: string;
    description: string | null;
  }[];

export const fetchRequirements = async (positionId?: string) => {
  let q = supabase
    .from("position_competency_requirements")
    .select("*, competency:competencies(name, code, status), position:positions(title)")
    .eq("is_current", true);
  if (positionId) q = q.eq("position_id", positionId);
  return check(await q) as unknown as {
    id: string;
    position_id: string;
    competency_id: string;
    required_level: number;
    is_mandatory: boolean;
    is_safety_critical: boolean;
    effective_from: string;
    competency: { name: string; code: string; status: string } | null;
    position: { title: string } | null;
  }[];
};

export const fetchApprovedCompetencyAssessments = async (employeeId: string) =>
  check(
    await supabase
      .from("competency_assessments")
      .select(
        "competency_id,current_level,evidence_summary,assessment_date,evidence:competency_assessment_evidence(id)",
      )
      .eq("employee_id", employeeId)
      .eq("status", "approved")
      .order("assessment_date", { ascending: false }),
  ) as unknown as {
    competency_id: string;
    current_level: number | null;
    evidence_summary: string | null;
    assessment_date: string;
    evidence: { id: string }[] | null;
  }[];

export type GapRow = {
  employee_id: string;
  employee_name: string;
  employee_code: string;
  department_id: string;
  department_name: string;
  position_id: string;
  position_title: string;
  competency_id: string;
  competency_name: string;
  category_id: string;
  category_name: string;
  required_level: number;
  current_level: number | null;
  gap: number | null;
  gap_status: "not_assessed" | "met" | "gap";
  is_mandatory: boolean;
  is_safety_critical: boolean;
  assessment_id: string | null;
  assessment_date: string | null;
  evidence_summary: string | null;
};

export const fetchGaps = async (
  f: {
    employee?: string;
    department?: string;
    position?: string;
    category?: string;
    status?: string;
  } = {},
) =>
  check(
    await supabase.rpc("competency_gaps", {
      _employee: f.employee || undefined,
      _department: f.department || undefined,
      _position: f.position || undefined,
      _category: f.category || undefined,
      _status: f.status || undefined,
      _limit: 500,
      _offset: 0,
    }),
  ) as unknown as GapRow[];

export type AssignmentRow = {
  id: string;
  cycle_id: string;
  employee_id: string;
  evaluator_id: string;
  status: string;
  overall_score: number | null;
  submitted_at: string | null;
  approved_at: string | null;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  acknowledgement_comment: string | null;
  self_submitted_at: string | null;
  self_evaluation: boolean;
  created_at: string;
  version: number;
  profile_version_id: string;
  employee: {
    first_name: string;
    last_name: string;
    employee_code: string;
    department_id: string;
  } | null;
  evaluator: { first_name: string; last_name: string } | null;
  cycle: { name: string; status: string; due_date: string | null } | null;
  profile_version: { version_number: number } | null;
};

export const ASSIGNMENT_SELECT =
  "id, cycle_id, employee_id, evaluator_id, status, overall_score, submitted_at, approved_at, acknowledged_at, acknowledged_by, acknowledgement_comment, self_submitted_at, self_evaluation, created_at, version, profile_version_id, employee:employees!evaluation_assignments_employee_id_fkey(first_name,last_name,employee_code,department_id), evaluator:employees!evaluation_assignments_evaluator_id_fkey(first_name,last_name), cycle:evaluation_cycles(name,status,due_date), profile_version:evaluation_profile_versions(version_number)";

export const fetchAssignments = async (
  f: { cycle?: string; employee?: string; evaluator?: string } & Page = {},
) => {
  const { limit, offset } = pageOf(f);
  let q = supabase
    .from("evaluation_assignments")
    .select(ASSIGNMENT_SELECT)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (f.cycle) q = q.eq("cycle_id", f.cycle);
  if (f.employee) q = q.eq("employee_id", f.employee);
  if (f.evaluator) q = q.eq("evaluator_id", f.evaluator);
  return check(await q) as unknown as AssignmentRow[];
};

export const fetchAllAssignmentsForDashboard = async () => {
  const pageSize = 200;
  const maxRows = 5000;
  const rows: AssignmentRow[] = [];
  for (let offset = 0; offset < maxRows; offset += pageSize) {
    const page = await fetchAssignments({ limit: pageSize, offset });
    rows.push(...page);
    if (page.length < pageSize) return { rows, complete: true };
  }
  const extra = await fetchAssignments({ limit: 1, offset: maxRows });
  return { rows, complete: extra.length === 0 };
};

export const fetchCycles = async () =>
  check(
    await supabase
      .from("evaluation_cycles")
      .select("*")
      .order("period_start", { ascending: false }),
  ) as {
    id: string;
    name: string;
    description: string | null;
    period_start: string;
    period_end: string;
    due_date: string | null;
    self_evaluation: boolean;
    status: string;
    version: number;
  }[];

export type AssessmentRow = {
  id: string;
  employee_id: string;
  competency_id: string;
  assessor_id: string;
  assessment_date: string;
  current_level: number | null;
  evidence_summary: string | null;
  comments: string | null;
  is_reassessment: boolean;
  status: string;
  reviewer_id: string | null;
  reviewed_at: string | null;
  review_comments: string | null;
  version: number;
  created_at: string;
  employee: { first_name: string; last_name: string } | null;
  competency: { name: string; code: string } | null;
};

export const fetchAssessments = async (
  f: { employee?: string; competency?: string; status?: string; mine?: string } & Page = {},
) => {
  const { limit, offset } = pageOf(f);
  let q = supabase
    .from("competency_assessments")
    .select("*, employee:employees(first_name,last_name), competency:competencies(name,code)")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (f.employee) q = q.eq("employee_id", f.employee);
  if (f.competency) q = q.eq("competency_id", f.competency);
  if (f.status) q = q.eq("status", f.status);
  if (f.mine) q = q.eq("assessor_id", f.mine);
  return check(await q) as unknown as AssessmentRow[];
};

export { check };

// ---------------- Phase 5: learning ----------------
export type CourseRow = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  category: string | null;
  objectives: string | null;
  duration_minutes: number | null;
  difficulty: string;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_comments: string | null;
  enrollment_open: boolean;
  completion_rule: string;
  version: number;
  created_by: string | null;
  owner: { first_name: string; last_name: string } | null;
};
export const fetchCourses = async (status?: string) => {
  let q = supabase
    .from("courses")
    .select("*, owner:employees!courses_owner_id_fkey(first_name,last_name)")
    .order("title");
  if (status) q = q.eq("status", status);
  return check(await q) as unknown as CourseRow[];
};
export const fetchCourse = async (id: string) =>
  check(
    await supabase
      .from("courses")
      .select("*, owner:employees!courses_owner_id_fkey(first_name,last_name)")
      .eq("id", id)
      .maybeSingle(),
  ) as unknown as CourseRow | null;
export const fetchCourseContent = async (courseId: string) =>
  check(
    await supabase
      .from("course_sections")
      .select("*, lessons(*)")
      .eq("course_id", courseId)
      .order("sort_order"),
  ) as unknown as {
    id: string;
    title: string;
    description: string | null;
    sort_order: number;
    lessons: {
      id: string;
      title: string;
      content: string | null;
      duration_minutes: number | null;
      sort_order: number;
    }[];
  }[];
export const fetchCourseMappings = async (courseId: string) =>
  check(
    await supabase
      .from("course_competency_mappings")
      .select("*, competency:competencies(name,code)")
      .eq("course_id", courseId),
  ) as unknown as {
    id: string;
    competency_id: string;
    target_level: number;
    competency: { name: string; code: string } | null;
  }[];
export type EnrollmentRow = {
  id: string;
  course_id: string;
  employee_id: string;
  source: string;
  status: string;
  assigned_at: string;
  completed_at: string | null;
  due_date: string | null;
  course: { title: string; code: string } | null;
  employee: { first_name: string; last_name: string; employee_code: string } | null;
};
export const fetchEnrollments = async (f: { course?: string; employee?: string } = {}) => {
  let q = supabase
    .from("course_enrollments")
    .select("*, course:courses(title,code), employee:employees(first_name,last_name,employee_code)")
    .order("assigned_at", { ascending: false });
  if (f.course) q = q.eq("course_id", f.course);
  if (f.employee) q = q.eq("employee_id", f.employee);
  return check(await q) as unknown as EnrollmentRow[];
};
export const fetchLearningDashboardCounts = async () => {
  const today = new Date().toISOString().slice(0, 10);
  const upcomingDate = new Date(`${today}T00:00:00.000Z`);
  upcomingDate.setUTCDate(upcomingDate.getUTCDate() + 7);
  const upcomingThrough = upcomingDate.toISOString().slice(0, 10);
  const responses = await Promise.all([
    supabase.from("courses").select("id", { count: "exact", head: true }).eq("status", "approved"),
    supabase
      .from("courses")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending_review"),
    supabase.from("course_enrollments").select("id", { count: "exact", head: true }),
    supabase
      .from("course_enrollments")
      .select("id", { count: "exact", head: true })
      .eq("status", "in_progress"),
    supabase
      .from("course_enrollments")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed"),
    supabase
      .from("course_enrollments")
      .select("id", { count: "exact", head: true })
      .lt("due_date", today)
      .neq("status", "completed"),
    supabase
      .from("course_enrollments")
      .select("id", { count: "exact", head: true })
      .gte("due_date", today)
      .lte("due_date", upcomingThrough)
      .neq("status", "completed"),
  ]);
  const count = (response: (typeof responses)[number]) => {
    if (response.error) throw new Error(response.error.message);
    if (response.count === null) throw new Error("A scoped learning count was not returned.");
    return response.count;
  };
  return {
    publishedCourses: count(responses[0]),
    awaitingApproval: count(responses[1]),
    assignedEnrollments: count(responses[2]),
    inProgress: count(responses[3]),
    completed: count(responses[4]),
    overdue: count(responses[5]),
    upcomingDeadlines: count(responses[6]),
  };
};
export const fetchLessonProgress = async (enrollmentId: string) =>
  check(await supabase.from("lesson_progress").select("*").eq("enrollment_id", enrollmentId)) as {
    id: string;
    lesson_id: string;
    completed_at: string | null;
  }[];
export const fetchCourseQuiz = async (courseId: string) =>
  check(
    await supabase
      .from("quizzes")
      .select("*")
      .eq("course_id", courseId)
      .order("created_at")
      .limit(1)
      .maybeSingle(),
  ) as {
    id: string;
    course_id: string;
    title: string;
    pass_score: number;
    max_attempts: number;
  } | null;
export const fetchQuizAttempts = async (quizId: string, employeeId?: string) => {
  let q = supabase
    .from("quiz_attempts")
    .select("*")
    .eq("quiz_id", quizId)
    .order("attempt_no", { ascending: false });
  if (employeeId) q = q.eq("employee_id", employeeId);
  return check(await q) as unknown as {
    id: string;
    attempt_no: number;
    score: number;
    passed: boolean;
    submitted_at: string;
    employee_id: string;
  }[];
};
export type PathRow = {
  id: string;
  title: string;
  description: string | null;
  competency_id: string | null;
  status: string;
  version: number;
  competency: { name: string } | null;
};
export const fetchLearningPaths = async () =>
  check(
    await supabase.from("learning_paths").select("*, competency:competencies(name)").order("title"),
  ) as unknown as PathRow[];
export const fetchPathCourses = async (pathId: string) =>
  check(
    await supabase
      .from("learning_path_courses")
      .select("*, course:courses(id,title,code,status)")
      .eq("path_id", pathId)
      .order("sort_order"),
  ) as unknown as {
    id: string;
    course_id: string;
    sort_order: number;
    course: { id: string; title: string; code: string; status: string } | null;
  }[];

// ---------------- Phase 5: training & development ----------------
export type PlanRow = {
  id: string;
  employee_id: string;
  title: string;
  objectives: string | null;
  status: string;
  approval_status: string;
  submitted_by: string | null;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_comments: string | null;
  target_date: string | null;
  reassessment_due_date: string | null;
  notes: string | null;
  version: number;
  employee: { first_name: string; last_name: string; employee_code: string } | null;
  responsible: { first_name: string; last_name: string } | null;
};
export const fetchPlans = async (employee?: string) => {
  let q = supabase
    .from("development_plans")
    .select(
      "*, employee:employees!development_plans_employee_id_fkey(first_name,last_name,employee_code), responsible:employees!development_plans_responsible_id_fkey(first_name,last_name)",
    )
    .order("created_at", { ascending: false });
  if (employee) q = q.eq("employee_id", employee);
  return check(await q) as unknown as PlanRow[];
};
export const fetchPlan = async (id: string) =>
  check(
    await supabase
      .from("development_plans")
      .select(
        "*, employee:employees!development_plans_employee_id_fkey(first_name,last_name,employee_code), responsible:employees!development_plans_responsible_id_fkey(first_name,last_name)",
      )
      .eq("id", id)
      .maybeSingle(),
  ) as unknown as PlanRow | null;
export type PlanItemRow = {
  id: string;
  plan_id: string;
  item_type: string;
  title: string;
  description: string | null;
  competency_id: string | null;
  course_id: string | null;
  learning_path_id: string | null;
  training_session_id: string | null;
  ai_recommendation_id: string | null;
  priority: string;
  target_date: string | null;
  status: string;
  completed_at: string | null;
  evidence: string | null;
  version: number;
  competency: { name: string } | null;
  course: { title: string } | null;
};
export const fetchPlanItems = async (planId: string) =>
  check(
    await supabase
      .from("development_plan_items")
      .select("*, competency:competencies(name), course:courses(title)")
      .eq("plan_id", planId)
      .order("created_at"),
  ) as unknown as PlanItemRow[];

export type PersonalGoalRow = {
  id: string;
  employee_id: string;
  evaluation_assignment_id: string | null;
  title: string;
  description: string | null;
  success_criteria: string | null;
  target_date: string | null;
  progress: number;
  progress_comment: string | null;
  status: string;
  reviewer_id: string | null;
  review_comment: string | null;
  reviewed_at: string | null;
  version: number;
  created_at: string;
};
export const fetchPersonalGoals = async () =>
  check(
    await supabase
      .from("personal_goals")
      .select("*")
      .order("target_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }),
  ) as PersonalGoalRow[];
export const fetchTrainers = async () =>
  check(await supabase.from("trainers").select("*").order("name")) as {
    id: string;
    name: string;
    email: string | null;
    specialty: string | null;
    is_external: boolean;
    status: string;
  }[];
export type SessionRow = {
  id: string;
  code: string;
  title: string;
  type: string;
  starts_at: string;
  ends_at: string;
  venue: string | null;
  delivery_method: string;
  capacity: number | null;
  status: string;
  version: number;
  trainer: { name: string } | null;
  related_competency: { name: string } | null;
};
export const fetchSessions = async (status?: string) => {
  let q = supabase
    .from("training_sessions")
    .select("*, trainer:trainers(name), related_competency:competencies(name)")
    .order("starts_at", { ascending: false })
    .limit(1001);
  if (status) q = q.eq("status", status);
  return check(await q) as unknown as SessionRow[];
};

export const fetchTrainingDashboardCounts = async () => {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const responses = await Promise.all([
    supabase
      .from("development_plans")
      .select("id", { count: "exact", head: true })
      .eq("approval_status", "pending_review"),
    supabase
      .from("training_sessions")
      .select("id", { count: "exact", head: true })
      .in("status", ["planned", "in_progress"])
      .gte("starts_at", now),
    supabase
      .from("training_participants")
      .select("id", { count: "exact", head: true })
      .eq("status", "registered"),
    supabase
      .from("training_participants")
      .select("id, session:training_sessions!inner(id)", { count: "exact", head: true })
      .eq("status", "registered")
      .eq("session.status", "completed"),
    supabase
      .from("training_sessions")
      .select("id", { count: "exact", head: true })
      .eq("status", "in_progress"),
    supabase
      .from("development_plans")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("development_plans")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .lte("reassessment_due_date", today),
  ]);
  const count = (response: (typeof responses)[number]) => {
    if (response.error) throw new Error(response.error.message);
    if (response.count === null) throw new Error("A scoped training count was not returned.");
    return response.count;
  };

  let gapCount = 0;
  let gapsComplete = true;
  for (let offset = 0; offset < 5000; offset += 500) {
    const page = check(
      await supabase.rpc("competency_gaps", {
        _status: "gap",
        _limit: 500,
        _offset: offset,
      }),
    );
    gapCount += page.length;
    if (page.length < 500) break;
    if (offset === 4500) {
      const extra = check(
        await supabase.rpc("competency_gaps", {
          _status: "gap",
          _limit: 1,
          _offset: 5000,
        }),
      );
      if (extra.length) gapsComplete = false;
    }
  }
  return {
    plansAwaitingApproval: count(responses[0]),
    upcomingSessions: count(responses[1]),
    scheduledParticipants: count(responses[2]),
    attendanceMissing: count(responses[3]),
    sessionsInProgress: count(responses[4]),
    activeDevelopmentPlans: count(responses[5]),
    reassessmentsDue: count(responses[6]),
    gapsAwaitingFollowUp: gapsComplete ? gapCount : null,
  };
};
export const fetchSession = async (id: string) =>
  check(
    await supabase
      .from("training_sessions")
      .select("*, trainer:trainers(name), related_competency:competencies(name)")
      .eq("id", id)
      .maybeSingle(),
  ) as unknown as SessionRow | null;
export const fetchParticipants = async (sessionId: string) =>
  check(
    await supabase
      .from("training_participants")
      .select("*, employee:employees(first_name,last_name,employee_code)")
      .eq("session_id", sessionId),
  ) as unknown as {
    id: string;
    employee_id: string;
    status: string;
    employee: { first_name: string; last_name: string; employee_code: string } | null;
  }[];
export const fetchAttendance = async (sessionId: string) =>
  check(await supabase.from("training_attendance").select("*").eq("session_id", sessionId)) as {
    id: string;
    employee_id: string;
    status: string;
    remarks: string | null;
    recorded_at: string;
  }[];
export const fetchTrainingResults = async (sessionId: string) =>
  check(
    await supabase
      .from("training_results")
      .select("*, employee:employees(first_name,last_name)")
      .eq("session_id", sessionId),
  ) as unknown as {
    id: string;
    employee_id: string;
    score: number | null;
    outcome: string;
    feedback: string | null;
    employee: { first_name: string; last_name: string } | null;
  }[];
export const fetchEffectiveness = async (sessionId?: string) => {
  let q = supabase
    .from("training_effectiveness_reviews")
    .select("*, session:training_sessions(title,code)")
    .order("created_at", { ascending: false });
  if (sessionId) q = q.eq("session_id", sessionId);
  return check(await q) as unknown as {
    id: string;
    session_id: string;
    summary: string;
    follow_up_required: boolean;
    follow_up_notes: string | null;
    created_at: string;
    session: { title: string; code: string } | null;
  }[];
};

// ---------------- Phase 5: AI ----------------
export type AiRecRow = {
  id: string;
  employee_id: string;
  competency_id: string;
  required_level: number;
  current_level: number | null;
  gap: number;
  recommendation_type: string;
  resource_id: string;
  rationale: string;
  expected_outcome: string | null;
  priority: string;
  status: string;
  model: string;
  created_at: string;
  generated_by: string;
  employee: { first_name: string; last_name: string; employee_code: string } | null;
  competency: { name: string; code: string } | null;
};
export const fetchAiRecommendations = async (status?: string) => {
  let q = supabase
    .from("ai_recommendations")
    .select(
      "*, employee:employees(first_name,last_name,employee_code), competency:competencies(name,code)",
    )
    .order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  return check(await q) as unknown as AiRecRow[];
};
export const fetchAiReviews = async (recId: string) =>
  check(
    await supabase
      .from("ai_recommendation_reviews")
      .select("*")
      .eq("recommendation_id", recId)
      .order("created_at"),
  ) as {
    id: string;
    decision: string;
    comments: string | null;
    created_at: string;
    reviewer_id: string;
  }[];
export const fetchAiLogs = async () =>
  check(
    await supabase
      .from("ai_generation_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
  ) as {
    id: string;
    model: string;
    status: string;
    error: string | null;
    latency_ms: number | null;
    created_at: string;
  }[];

// ---------------- Phase 6: succession ----------------
export type CriticalPositionRow = {
  id: string;
  position_id: string;
  department_id: string;
  criticality: string;
  business_impact: string | null;
  incumbent_employee_id: string | null;
  status: string;
  review_date: string | null;
  version: number;
  position: { title: string } | null;
  department: { name: string } | null;
  incumbent: { first_name: string; last_name: string } | null;
};
export const fetchCriticalPositions = async () =>
  check(
    await supabase
      .from("critical_positions")
      .select(
        "*, position:positions(title), department:departments(name), incumbent:employees!critical_positions_incumbent_employee_id_fkey(first_name,last_name)",
      )
      .order("created_at", { ascending: false }),
  ) as unknown as CriticalPositionRow[];
export type SuccessionPlanRow = {
  id: string;
  critical_position_id: string;
  owner_user_id: string | null;
  status: string;
  submitted_by: string | null;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_comments: string | null;
  version: number;
};
export const fetchSuccessionPlans = async () =>
  check(
    await supabase.from("succession_plans").select("*").order("updated_at", { ascending: false }),
  ) as SuccessionPlanRow[];
export type SuccessionRequirementRow = {
  id: string;
  critical_position_id: string;
  name: string;
  description: string | null;
  is_mandatory: boolean;
  active: boolean;
  version: number;
};
export const fetchSuccessionRequirements = async (criticalPositionId: string) =>
  check(
    await supabase
      .from("succession_qualification_requirements")
      .select("*")
      .eq("critical_position_id", criticalPositionId)
      .order("name"),
  ) as SuccessionRequirementRow[];
export type SuccessionQualificationRow = {
  id: string;
  candidate_id: string;
  critical_position_id: string;
  requirement_id: string;
  status: "met" | "gap" | "missing_evidence" | "unassessed";
  evidence_summary: string | null;
  evidence_date: string | null;
  expires_on: string | null;
  assessor_id: string | null;
  verified_at: string | null;
  version: number;
  requirement: { name: string; is_mandatory: boolean } | null;
};
export const fetchSuccessionQualifications = async (candidateId: string) =>
  check(
    await supabase
      .from("succession_candidate_qualifications")
      .select("*, requirement:succession_qualification_requirements(name,is_mandatory)")
      .eq("candidate_id", candidateId),
  ) as unknown as SuccessionQualificationRow[];
export type CandidateRow = {
  id: string;
  critical_position_id: string;
  employee_id: string;
  readiness_class_id: string | null;
  notes: string | null;
  status: string;
  version: number;
  employee: { first_name: string; last_name: string; employee_code: string } | null;
  readiness_class: { label: string; code: string } | null;
  critical_position: {
    id: string;
    position_id: string;
    position: { title: string } | null;
    department: { name: string } | null;
  } | null;
};
export const fetchCandidates = async (positionId?: string) => {
  let q = supabase
    .from("succession_candidates")
    .select(
      "*, employee:employees(first_name,last_name,employee_code), readiness_class:readiness_classes(label,code), critical_position:critical_positions(id,position_id,position:positions(title),department:departments(name))",
    )
    .order("created_at", { ascending: false });
  if (positionId) q = q.eq("critical_position_id", positionId);
  return check(await q) as unknown as CandidateRow[];
};
export const fetchReadinessClasses = async () =>
  check(await supabase.from("readiness_classes").select("*").order("sort_order")) as {
    id: string;
    code: string;
    label: string;
    description: string | null;
    sort_order: number;
    requires_validation: boolean;
    version: number;
  }[];
export const fetchReadinessAssessments = async (candidateId: string) =>
  check(
    await supabase
      .from("succession_readiness_assessments")
      .select(
        "*, readiness_class:readiness_classes(label), assessor:employees!succession_readiness_assessments_assessor_id_fkey(first_name,last_name)",
      )
      .eq("candidate_id", candidateId)
      .order("assessment_date", { ascending: false }),
  ) as unknown as {
    id: string;
    assessment_date: string;
    summary: string;
    readiness_class: { label: string } | null;
    assessor: { first_name: string; last_name: string } | null;
  }[];
export const fetchSuccessionActivities = async (candidateId: string) =>
  check(
    await supabase
      .from("succession_development_activities")
      .select("*")
      .eq("candidate_id", candidateId)
      .order("created_at"),
  ) as {
    id: string;
    title: string;
    description: string | null;
    status: string;
    target_date: string | null;
  }[];
export const fetchAccessGrants = async () =>
  check(
    await supabase
      .from("succession_access_grants")
      .select(
        "*, department:departments(name), profile:profiles!succession_access_grants_user_id_fkey(full_name,email)",
      ),
  ) as unknown as {
    id: string;
    department_id: string;
    user_id: string;
    department: { name: string } | null;
    profile: { full_name: string | null; email: string } | null;
  }[];
export const fetchSuccessionDashboardCounts = async () => {
  const date = new Date().toISOString().slice(0, 10);
  const responses = await Promise.all([
    supabase.from("critical_positions").select("id", { count: "exact", head: true }),
    supabase
      .from("critical_positions")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    supabase.from("succession_candidates").select("id", { count: "exact", head: true }),
    supabase
      .from("succession_candidates")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("critical_positions")
      .select("id", { count: "exact", head: true })
      .neq("status", "closed")
      .lte("review_date", date),
    supabase
      .from("succession_candidates")
      .select("id,activities:succession_development_activities!inner(id)", {
        count: "exact",
        head: true,
      })
      .eq("status", "active"),
    supabase.from("succession_access_grants").select("id", { count: "exact", head: true }),
    supabase
      .from("succession_plans")
      .select("id", { count: "exact", head: true })
      .is("reviewed_at", null),
    supabase
      .from("succession_plans")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending_review"),
  ]);
  const count = (response: (typeof responses)[number]) => {
    if (response.error) throw new Error(response.error.message);
    if (response.count === null) throw new Error("A scoped succession count was not returned.");
    return response.count;
  };
  return {
    totalPositions: count(responses[0]),
    activePositions: count(responses[1]),
    totalCandidates: count(responses[2]),
    activeCandidates: count(responses[3]),
    reviewsDue: count(responses[4]),
    candidatesWithActivities: count(responses[5]),
    accessGrants: count(responses[6]),
    positionsWithoutReviewedPlans: count(responses[7]),
    plansAwaitingReview: count(responses[8]),
  };
};

// ---------------- Phase 6: recognition ----------------
export const fetchRecognitionCategories = async () =>
  check(await supabase.from("recognition_categories").select("*").order("name")) as {
    id: string;
    name: string;
    description: string | null;
    active: boolean;
    version: number;
  }[];
export type NominationRow = {
  id: string;
  nominator_id: string;
  recipient_id: string;
  category_id: string;
  message: string;
  supporting_info: string | null;
  status: string;
  review_comments: string | null;
  visibility: string;
  show_nominator: boolean;
  created_at: string;
  version: number;
  nominator: { first_name: string; last_name: string } | null;
  recipient: { first_name: string; last_name: string; department_id: string } | null;
  category: { name: string } | null;
};
const NOM_SELECT =
  "*, nominator:employees!recognition_nominations_nominator_id_fkey(first_name,last_name), recipient:employees!recognition_nominations_recipient_id_fkey(first_name,last_name,department_id), category:recognition_categories(name)";
export const fetchNominations = async (status?: string) => {
  let q = supabase
    .from("recognition_nominations")
    .select(NOM_SELECT)
    .order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  return check(await q) as unknown as NominationRow[];
};

export type ReportKind =
  "performance" | "gaps" | "learning" | "training" | "recognition" | "succession" | "audit";
export type ReportFilters = {
  from?: string;
  to?: string;
  department?: string;
  position?: string;
  supervisor?: string;
  cycle?: string;
  status?: string;
  course?: string;
  trainer?: string;
  competency?: string;
  category?: string;
  criticality?: "mandatory" | "safety_critical";
  activity?: string;
  actor?: string;
  action?: string;
  tableName?: string;
};
export type ReportRowsResult = {
  rows: Record<string, unknown>[];
  total: number;
  truncated: boolean;
};

const REPORT_PAGE_SIZE = 5000;
const reportDateStart = (value?: string) => (value ? `${value}T00:00:00.000Z` : undefined);
const reportDateEnd = (value?: string) => (value ? `${value}T23:59:59.999Z` : undefined);

export async function fetchReportRows(
  kind: ReportKind,
  filters: ReportFilters,
): Promise<ReportRowsResult> {
  const start = reportDateStart(filters.from);
  const end = reportDateEnd(filters.to);
  if (kind === "performance") {
    let q = supabase
      .from("evaluation_assignments")
      .select(
        "id,status,overall_score,submitted_at,created_at,employee:employees!inner(id,employee_code,first_name,last_name,department_id,position_id),evaluator:employees!evaluation_assignments_evaluator_id_fkey(first_name,last_name),cycle:evaluation_cycles!inner(name)",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(0, REPORT_PAGE_SIZE - 1);
    if (start) q = q.gte("created_at", start);
    if (end) q = q.lte("created_at", end);
    if (filters.department) q = q.eq("employee.department_id", filters.department);
    if (filters.position) q = q.eq("employee.position_id", filters.position);
    if (filters.supervisor) q = q.eq("evaluator_id", filters.supervisor);
    if (filters.cycle) q = q.eq("cycle_id", filters.cycle);
    if (filters.status) q = q.eq("status", filters.status);
    const { data, count } = await (async () => {
      const response = await q;
      if (response.error) throw new Error(response.error.message);
      return response;
    })();
    const total = count ?? data.length;
    return {
      rows: data as unknown as Record<string, unknown>[],
      total,
      truncated: total > data.length,
    };
  }
  if (kind === "gaps") {
    const rows: GapRow[] = [];
    for (let offset = 0; offset < REPORT_PAGE_SIZE; offset += 500) {
      const page = check(
        await supabase.rpc("competency_gaps", {
          _department: filters.department || undefined,
          _position: filters.position || undefined,
          _category: filters.category || undefined,
          _status: filters.status || undefined,
          _limit: 500,
          _offset: offset,
        }),
      ) as GapRow[];
      rows.push(...page);
      if (page.length < 500) break;
    }
    let result = rows;
    if (filters.competency) {
      result = result.filter((row) => row.competency_id === filters.competency);
    }
    if (filters.criticality === "mandatory") {
      result = result.filter((row) => row.is_mandatory);
    } else if (filters.criticality === "safety_critical") {
      result = result.filter((row) => row.is_safety_critical);
    }
    if (start)
      result = result.filter((row) => row.assessment_date && row.assessment_date >= filters.from!);
    if (end)
      result = result.filter((row) => row.assessment_date && row.assessment_date <= filters.to!);
    return {
      rows: result as unknown as Record<string, unknown>[],
      total: result.length,
      truncated: rows.length === REPORT_PAGE_SIZE,
    };
  }
  if (kind === "learning") {
    let q = supabase
      .from("course_enrollments")
      .select(
        "id,status,source,assigned_at,due_date,completed_at,course:courses!inner(id,code,title),employee:employees!inner(id,employee_code,first_name,last_name,department_id,position_id),quiz_attempts(id,score,passed,attempt_no,submitted_at)",
        { count: "exact" },
      )
      .order("assigned_at", { ascending: false })
      .range(0, REPORT_PAGE_SIZE - 1);
    if (start) q = q.gte("assigned_at", start);
    if (end) q = q.lte("assigned_at", end);
    if (filters.department) q = q.eq("employee.department_id", filters.department);
    if (filters.position) q = q.eq("employee.position_id", filters.position);
    if (filters.course) q = q.eq("course_id", filters.course);
    if (filters.status) q = q.eq("status", filters.status);
    const response = await q;
    if (response.error) throw new Error(response.error.message);
    const total = response.count ?? response.data.length;
    return {
      rows: response.data as unknown as Record<string, unknown>[],
      total,
      truncated: total > response.data.length,
    };
  }
  if (kind === "training") {
    let q = supabase
      .from("training_participants")
      .select(
        "id,attendance_status:status,created_at,session_id,employee_id,session:training_sessions!inner(id,code,title,starts_at,trainer_id,status),employee:employees!inner(id,employee_code,first_name,last_name,department_id,position_id)",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(0, REPORT_PAGE_SIZE - 1);
    if (start) q = q.gte("session.starts_at", start);
    if (end) q = q.lte("session.starts_at", end);
    if (filters.department) q = q.eq("employee.department_id", filters.department);
    if (filters.position) q = q.eq("employee.position_id", filters.position);
    if (filters.trainer) q = q.eq("session.trainer_id", filters.trainer);
    if (filters.activity) q = q.eq("session_id", filters.activity);
    if (filters.status) q = q.eq("session.status", filters.status);
    const response = await q;
    if (response.error) throw new Error(response.error.message);
    const total = response.count ?? response.data.length;
    let resultQuery = supabase
      .from("training_results")
      .select(
        "session_id,employee_id,score,outcome,session:training_sessions!inner(starts_at,trainer_id),employee:employees!inner(department_id,position_id)",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(0, REPORT_PAGE_SIZE - 1);
    if (start) resultQuery = resultQuery.gte("session.starts_at", start);
    if (end) resultQuery = resultQuery.lte("session.starts_at", end);
    if (filters.department)
      resultQuery = resultQuery.eq("employee.department_id", filters.department);
    if (filters.position) resultQuery = resultQuery.eq("employee.position_id", filters.position);
    if (filters.trainer) resultQuery = resultQuery.eq("session.trainer_id", filters.trainer);
    if (filters.activity) resultQuery = resultQuery.eq("session_id", filters.activity);
    const resultResponse = await resultQuery;
    if (resultResponse.error) throw new Error(resultResponse.error.message);
    const outcomes = new Map(
      resultResponse.data.map((row) => [
        `${row.session_id}:${row.employee_id}`,
        { score: row.score, outcome: row.outcome },
      ]),
    );
    return {
      rows: response.data.map((row) => ({
        ...row,
        result: outcomes.get(`${row.session_id}:${row.employee_id}`) ?? null,
      })) as unknown as Record<string, unknown>[],
      total,
      truncated:
        total > response.data.length ||
        (resultResponse.count ?? resultResponse.data.length) > resultResponse.data.length,
    };
  }
  if (kind === "recognition") {
    let q = supabase
      .from("recognition_nominations")
      .select(
        "id,status,message,supporting_info,created_at,reviewed_at,review_comments,visibility,recipient:employees!recognition_nominations_recipient_id_fkey!inner(first_name,last_name,department_id),nominator:employees!recognition_nominations_nominator_id_fkey(first_name,last_name),category:recognition_categories!inner(name)",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(0, REPORT_PAGE_SIZE - 1);
    if (start) q = q.gte("created_at", start);
    if (end) q = q.lte("created_at", end);
    if (filters.department) q = q.eq("recipient.department_id", filters.department);
    if (filters.category) q = q.eq("category_id", filters.category);
    if (filters.status) q = q.eq("status", filters.status);
    const response = await q;
    if (response.error) throw new Error(response.error.message);
    const total = response.count ?? response.data.length;
    return {
      rows: response.data as unknown as Record<string, unknown>[],
      total,
      truncated: total > response.data.length,
    };
  }
  if (kind === "audit") {
    let q = supabase
      .from("audit_logs")
      .select("id,actor_id,action,table_name,record_id,created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(0, REPORT_PAGE_SIZE - 1);
    if (start) q = q.gte("created_at", start);
    if (end) q = q.lte("created_at", end);
    if (filters.actor) q = q.eq("actor_id", filters.actor);
    if (filters.action) q = q.eq("action", filters.action);
    if (filters.tableName) q = q.eq("table_name", filters.tableName);
    const response = await q;
    if (response.error) throw new Error(response.error.message);
    const total = response.count ?? response.data.length;
    return {
      rows: response.data as unknown as Record<string, unknown>[],
      total,
      truncated: total > response.data.length,
    };
  }
  let q = supabase
    .from("critical_positions")
    .select(
      "id,status,criticality,review_date,position:positions!inner(id,title),department:departments!inner(id,name),candidates:succession_candidates(id,status,employee:employees(first_name,last_name,employee_code),activities:succession_development_activities(status,target_date))",
      { count: "exact" },
    )
    .order("review_date", { ascending: true, nullsFirst: false })
    .range(0, REPORT_PAGE_SIZE - 1);
  if (filters.department) q = q.eq("department_id", filters.department);
  if (filters.position) q = q.eq("position_id", filters.position);
  if (filters.status) q = q.eq("status", filters.status);
  if (start) q = q.gte("review_date", filters.from!);
  if (end) q = q.lte("review_date", filters.to!);
  const response = await q;
  if (response.error) throw new Error(response.error.message);
  const total = response.count ?? response.data.length;
  return {
    rows: response.data as unknown as Record<string, unknown>[],
    total,
    truncated: total > response.data.length,
  };
}

export const fetchSavedReportDefinitions = async () =>
  check(
    await supabase
      .from("saved_report_definitions")
      .select("*")
      .order("updated_at", { ascending: false }),
  ) as {
    id: string;
    name: string;
    report_kind: ReportKind;
    filters: ReportFilters;
    selected_columns: string[];
    version: number;
  }[];

export const fetchReportExportHistory = async () => {
  const response = await supabase
    .from("report_export_history")
    .select(
      "id,user_id,report_name,report_kind,scope,format,result,row_count,requested_at,download_available,requester:profiles!report_export_history_user_id_fkey(full_name,email)",
      { count: "exact" },
    )
    .order("requested_at", { ascending: false })
    .range(0, 199);
  if (response.error) throw new Error(response.error.message);
  return {
    rows: response.data as {
      id: string;
      user_id: string;
      report_name: string;
      report_kind: ReportKind;
      scope: ReportFilters;
      format: string;
      result: string;
      row_count: number;
      requested_at: string;
      download_available: boolean;
      requester: { full_name: string | null; email: string } | null;
    }[],
    total: response.count ?? response.data.length,
    truncated: (response.count ?? response.data.length) > 200,
  };
};
export const fetchRecognitionFeed = async () =>
  check(
    await supabase
      .from("recognition_publications")
      .select(
        "id, visibility, published_at, nomination:recognition_nominations(id, message, show_nominator, category:recognition_categories(name), nominator:employees!recognition_nominations_nominator_id_fkey(first_name,last_name), recipient:employees!recognition_nominations_recipient_id_fkey(first_name,last_name))",
      )
      .order("published_at", { ascending: false }),
  ) as unknown as {
    id: string;
    visibility: string;
    published_at: string;
    nomination: {
      id: string;
      message: string;
      show_nominator: boolean;
      category: { name: string } | null;
      nominator: { first_name: string; last_name: string } | null;
      recipient: { first_name: string; last_name: string } | null;
    } | null;
  }[];
