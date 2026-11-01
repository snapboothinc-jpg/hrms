/** Shared Zod schemas: used by forms (client) and server functions (server). */
import { z } from "zod";

export const uuid = z.string().uuid();
const optText = (max: number) => z.string().max(max).optional().nullable();
const idem = { idempotencyKey: uuid };

export const departmentSchema = z
  .object({
    id: uuid.nullable(),
    code: z.string().trim().min(1).max(20),
    name: z.string().trim().min(2).max(120),
    parent_id: uuid.nullable(),
    head_employee_id: uuid.nullable(),
    status: z.enum(["active", "inactive"]),
    version: z.number().int().nullable(),
  })
  .strict();

export const positionSchema = z
  .object({
    id: uuid.nullable(),
    code: z.string().trim().min(1).max(20),
    title: z.string().trim().min(2).max(120),
    department_id: uuid,
    description: optText(2000),
    status: z.enum(["active", "inactive"]),
    version: z.number().int().nullable(),
  })
  .strict();

export const employeeFields = z
  .object({
    employee_code: z.string().trim().min(1).max(30),
    first_name: z.string().trim().min(1).max(80),
    last_name: z.string().trim().min(1).max(80),
    email: z.union([z.string().trim().email().max(200), z.literal("")]).optional(),
    phone: z.string().trim().max(40).optional(),
    department_id: uuid,
    position_id: uuid,
    employment_status: z.enum(["active", "on_leave", "inactive", "terminated"]),
    hire_date: z.string().max(10).optional(),
    job_notes: z.string().max(2000).optional(),
  })
  .strict();
export const employeeSchema = z
  .object({ id: uuid.nullable(), version: z.number().int().nullable(), data: employeeFields })
  .strict();

export const supervisorSchema = z
  .object({
    employee_id: uuid,
    supervisor_id: uuid.nullable(),
    effective_from: z.string().max(10).nullable(),
  })
  .strict();

export const createUserSchema = z
  .object({
    email: z.string().trim().email().max(200),
    full_name: z.string().trim().min(2).max(120),
    password: z
      .string()
      .min(12, "At least 12 characters")
      .max(72)
      .regex(/[A-Z]/, "Include an uppercase letter")
      .regex(/[a-z]/, "Include a lowercase letter")
      .regex(/[0-9]/, "Include a number"),
    role: z.enum([
      "super_admin",
      "admin",
      "hr_admin",
      "dept_head",
      "supervisor",
      "employee",
      "ops_manager",
    ]),
    employee_id: uuid.nullable(),
  })
  .strict();

export const cycleFields = z
  .object({
    name: z.string().trim().min(3).max(120),
    description: z.string().max(2000).optional(),
    period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    due_date: z.string().max(10).optional(),
    self_evaluation: z.boolean(),
  })
  .strict()
  .refine((d) => d.period_end >= d.period_start, {
    message: "End must be on or after start",
    path: ["period_end"],
  });

export const itemTypes = [
  "rating",
  "short_text",
  "long_text",
  "single_choice",
  "multi_choice",
  "yes_no",
  "kpi",
] as const;
export const performanceFactorCodes = [
  "quality_of_work",
  "quantity_of_work",
  "job_knowledge",
  "ability_to_learn",
  "dependability",
  "initiative",
  "human_relations_teamwork",
  "cost_consciousness",
  "discipline",
  "safety_consciousness_equipment",
] as const;

export const performanceFactorTitles: Record<(typeof performanceFactorCodes)[number], string> = {
  quality_of_work: "Quality of Work",
  quantity_of_work: "Quantity of Work",
  job_knowledge: "Job Knowledge",
  ability_to_learn: "Ability to Learn",
  dependability: "Dependability",
  initiative: "Initiative",
  human_relations_teamwork: "Human Relations / Teamwork",
  cost_consciousness: "Cost Consciousness",
  discipline: "Discipline",
  safety_consciousness_equipment: "Safety Consciousness / Care of Equipment",
};

export const performanceFactorSchema = z
  .object({
    factor_code: z.enum(performanceFactorCodes),
    title: z.string().trim().min(2).max(120),
    description: z.string().trim().min(2).max(2000),
    indicators: z.array(z.string().trim().min(2).max(1000)).min(1).max(30),
    weight: z.coerce.number().min(0).max(100),
    evidence_required: z.boolean(),
    sort_order: z.number().int().min(0).max(9),
  })
  .strict();

export const classificationThresholdSchema = z
  .object({
    label: z.string().trim().min(1).max(120),
    min: z.coerce.number().min(1).max(5),
    max: z.coerce.number().min(1).max(5),
  })
  .strict()
  .refine((threshold) => threshold.min <= threshold.max, {
    message: "The minimum score must not exceed the maximum.",
    path: ["min"],
  });

export const ITEM_TYPE_LABELS: Record<(typeof itemTypes)[number], string> = {
  rating: "Numeric rating",
  short_text: "Short text",
  long_text: "Long text",
  single_choice: "Single choice",
  multi_choice: "Multiple choice",
  yes_no: "Yes / No",
  kpi: "KPI (target vs actual)",
};

export const profileItemSchema = z
  .object({
    label: z.string().trim().min(1).max(300),
    help_text: z.string().max(2000).optional(),
    item_type: z.enum(itemTypes),
    weight: z.coerce.number().min(0).max(100),
    options: z.array(z.string().max(120)).max(20),
    kpi_target: z
      .union([z.coerce.number(), z.literal("")])
      .optional()
      .nullable(),
    kpi_unit: z.string().max(30).optional(),
    competency_id: z
      .union([uuid, z.literal("")])
      .optional()
      .nullable(),
    evidence_required: z.boolean(),
    is_required: z.boolean(),
  })
  .strict()
  .refine((i) => ["rating", "kpi"].includes(i.item_type) || Number(i.weight) === 0, {
    message: "Only rating and KPI items carry weight",
    path: ["weight"],
  })
  .refine((i) => i.item_type !== "kpi" || (i.kpi_target !== "" && i.kpi_target != null), {
    message: "KPI items need a target",
    path: ["kpi_target"],
  });

export const profileContentSchema = z
  .object({
    rating_scale_max: z.coerce.number().int().min(5).max(5),
    instructions: z.string().max(4000).optional(),
    effective_date: z.string().max(10).optional(),
    scoring_method: z.enum(["weighted", "equal"]),
    final_score_rule: z.enum(["supervisor", "self", "average"]),
    classification_thresholds: z.array(classificationThresholdSchema).max(5),
    performance_factors: z.array(performanceFactorSchema).length(10),
    sections: z
      .array(
        z
          .object({
            title: z.string().trim().min(1).max(160),
            description: z.string().max(2000).optional(),
            items: z.array(profileItemSchema).max(60),
          })
          .strict(),
      )
      .max(20),
  })
  .strict()
  .superRefine((profile, ctx) => {
    const codes = profile.performance_factors.map((factor) => factor.factor_code);
    if (
      new Set(codes).size !== performanceFactorCodes.length ||
      performanceFactorCodes.some((code) => !codes.includes(code))
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["performance_factors"],
        message: "Configure each of the ten performance factors exactly once.",
      });
    }
    if (
      profile.performance_factors.some(
        (factor) => factor.title !== performanceFactorTitles[factor.factor_code],
      )
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["performance_factors"],
        message: "The original ten factor names must be preserved.",
      });
    }
    if (profile.scoring_method === "weighted") {
      const total = profile.performance_factors.reduce((sum, factor) => sum + factor.weight, 0);
      if (Math.round(total * 100) / 100 !== 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["performance_factors"],
          message: "Factor weights must total 100% when weighted scoring is selected.",
        });
      }
    }
    const weightedProfileItems = profile.sections
      .flatMap((section) => section.items)
      .filter((item) => item.weight > 0);
    if (weightedProfileItems.length > 0) {
      const total = weightedProfileItems.reduce((sum, item) => sum + item.weight, 0);
      if (Math.round(total * 100) / 100 !== 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sections"],
          message: "Configured position-specific rating and KPI weights must total 100%.",
        });
      }
    }
    const thresholds = profile.classification_thresholds;
    for (let index = 0; index < thresholds.length; index += 1) {
      for (let other = index + 1; other < thresholds.length; other += 1) {
        const left = thresholds[index]!;
        const right = thresholds[other]!;
        if (left.min <= right.max && right.min <= left.max) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["classification_thresholds", other],
            message: "Classification score ranges cannot overlap.",
          });
        }
      }
    }
  });

export const performanceFactorResponseSchema = z
  .object({
    factor_code: z.enum(performanceFactorCodes),
    rating: z.number().int().min(1).max(5).nullable(),
    comment: z.string().max(4000).nullable(),
  })
  .strict();

export const addPerformanceFactorEvidenceSchema = z
  .object({
    assignment_id: uuid,
    factor_code: z.enum(performanceFactorCodes),
    file_id: uuid.nullable(),
    note: z.string().max(2000).nullable(),
    ...idem,
  })
  .strict()
  .refine((data) => data.file_id !== null || Boolean(data.note?.trim()), {
    message: "Provide a file or evidence note.",
    path: ["note"],
  });

export const saveCriticalRequirementSchema = z
  .object({
    id: uuid.nullable(),
    employee_id: uuid,
    requirement_type: z.enum(["license", "certification", "qualification", "safety"]),
    name: z.string().trim().min(2).max(160),
    description: z.string().max(2000).nullable(),
    issuing_authority: z.string().max(160).nullable(),
    reference_number: z.string().max(120).nullable(),
    valid_from: z.string().date().nullable(),
    expires_on: z.string().date().nullable(),
    file_id: uuid.nullable(),
    is_safety_critical: z.boolean(),
    is_active: z.boolean(),
    ...idem,
  })
  .strict()
  .refine(
    (value) => !value.valid_from || !value.expires_on || value.expires_on >= value.valid_from,
    { message: "Expiration must be on or after the validity start date.", path: ["expires_on"] },
  );

export const reviewCriticalRequirementSchema = z
  .object({
    assignment_id: uuid,
    requirement_id: uuid,
    compliance_status: z.enum(["compliant", "needs_review", "non_compliant"]),
    comments: z.string().max(2000),
    ...idem,
  })
  .strict();

export const responseSchema = z
  .object({
    item_id: uuid,
    rating: z.number().int().min(1).max(5).nullable().optional(),
    text_value: z.string().max(8000).nullable().optional(),
    choice_values: z.array(z.string().max(120)).max(20).nullable().optional(),
    kpi_actual: z.number().nullable().optional(),
    comment: z.string().max(4000).nullable().optional(),
  })
  .strict();

export const developmentResponseSchema = z
  .object({
    strengths: z.string().max(4000).optional(),
    improvement_areas: z.string().max(4000).optional(),
    accomplishments: z.string().max(4000).optional(),
    development_needs: z.string().max(4000).optional(),
    career_interests: z.string().max(4000).optional(),
    suggested_activities: z.string().max(4000).optional(),
    personal_goals: z.string().max(4000).optional(),
    performance_weaknesses: z.string().max(4000).optional(),
    recommended_learning: z.string().max(4000).optional(),
    recommended_training: z.string().max(4000).optional(),
    competency_improvements: z.string().max(4000).optional(),
    target_outcomes: z.string().max(4000).optional(),
    next_steps: z.string().max(4000).optional(),
    advancement_considerations: z.string().max(4000).optional(),
    overall_assessment: z.string().max(4000).optional(),
    observations: z.string().max(4000).optional(),
    overall_recommendation: z.string().max(4000).optional(),
    development_recommendation: z.string().max(4000).optional(),
    improvement_priorities: z.string().max(4000).optional(),
    review_comments: z.string().max(4000).optional(),
    rating_difference_explanations: z.string().max(4000).optional(),
  })
  .strict();

export const saveEvaluationSchema = z
  .object({
    assignment_id: uuid,
    respondent: z.enum(["self", "evaluator"]),
    responses: z.array(responseSchema).max(200),
    factor_responses: z.array(performanceFactorResponseSchema).length(10),
    development: developmentResponseSchema,
    overall_comment: z.string().max(8000).nullable(),
    version: z.number().int(),
  })
  .strict();

export const submitEvaluationSchema = z
  .object({ assignment_id: uuid, respondent: z.enum(["self", "evaluator"]), ...idem })
  .strict();
export const acknowledgeEvaluationSchema = z
  .object({
    assignment_id: uuid,
    comment: z.string().max(4000).optional(),
    ...idem,
  })
  .strict();
export const reviewEvaluationSchema = z
  .object({
    assignment_id: uuid,
    decision: z.enum(["approve", "return"]),
    comments: z.string().max(4000),
    ...idem,
  })
  .strict();
export const reopenEvaluationSchema = z
  .object({ assignment_id: uuid, reason: z.string().trim().min(5).max(2000), ...idem })
  .strict();
export const createAssignmentsSchema = z
  .object({ cycle_id: uuid, employee_ids: z.array(uuid).min(1).max(500), ...idem })
  .strict();

export const competencyFields = z
  .object({
    code: z.string().trim().min(1).max(20),
    name: z.string().trim().min(2).max(120),
    description: z.string().max(2000).optional(),
    definition: z.string().max(4000).optional(),
    category_id: uuid,
    status: z.enum(["draft", "active", "retired"]),
    is_mandatory: z.boolean(),
    is_safety_critical: z.boolean(),
    indicators: z
      .array(
        z
          .object({
            level: z.number().int().min(1).max(5),
            indicator: z.string().trim().min(2).max(1000),
          })
          .strict(),
      )
      .max(50),
  })
  .strict();

export const requirementSchema = z
  .object({
    position_id: uuid,
    competency_id: uuid,
    required_level: z.number().int().min(1).max(5),
    is_mandatory: z.boolean(),
    is_safety_critical: z.boolean(),
    reason: z.string().max(1000).optional(),
    remove: z.boolean(),
  })
  .strict();

export const assessmentSchema = z
  .object({
    id: uuid.nullable(),
    employee_id: uuid,
    competency_id: uuid,
    current_level: z.number().int().min(1).max(5).nullable(),
    evidence_summary: z.string().max(4000).optional(),
    comments: z.string().max(4000).optional(),
    assessment_method: z.string().trim().max(120).optional(),
    is_reassessment: z.boolean(),
    version: z.number().int().nullable(),
  })
  .strict();

export const reviewAssessmentSchema = z
  .object({
    id: uuid,
    decision: z.enum(["approve", "reject"]),
    comments: z.string().max(4000),
    ...idem,
  })
  .strict();

export const ALLOWED_MIME = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
] as const;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

// ---------------- Phase 5: learning, training, AI ----------------
export const courseFields = z
  .object({
    code: z.string().trim().min(1).max(20),
    title: z.string().trim().min(3).max(160),
    description: z.string().max(4000).optional(),
    category: z.string().max(80).optional(),
    objectives: z.string().max(4000).optional(),
    owner_id: z.union([uuid, z.literal("")]).optional(),
    duration_minutes: z.coerce.number().int().min(1).max(100000).optional(),
    difficulty: z.enum(["beginner", "intermediate", "advanced"]),
    enrollment_open: z.boolean(),
    completion_rule: z.enum(["all_lessons", "quiz_pass", "all_lessons_and_quiz"]),
  })
  .strict();
export const courseSchema = z
  .object({ id: uuid.nullable(), version: z.number().int().nullable(), data: courseFields })
  .strict();

export const courseContentSchema = z
  .object({
    course_id: uuid,
    version: z.number().int(),
    sections: z
      .array(
        z
          .object({
            title: z.string().trim().min(1).max(160),
            description: z.string().max(2000).optional(),
            lessons: z
              .array(
                z
                  .object({
                    title: z.string().trim().min(1).max(200),
                    content: z.string().max(20000).optional(),
                    duration_minutes: z.coerce.number().int().min(1).max(10000).optional(),
                  })
                  .strict(),
              )
              .max(100),
          })
          .strict(),
      )
      .max(50),
  })
  .strict();

export const courseMappingsSchema = z
  .object({
    course_id: uuid,
    mappings: z
      .array(
        z.object({ competency_id: uuid, target_level: z.number().int().min(1).max(5) }).strict(),
      )
      .max(50),
  })
  .strict();

export const idemAction = z.object({ id: uuid, ...idem }).strict();
export const reviewCourseSchema = z
  .object({
    id: uuid,
    decision: z.enum(["approve", "return"]),
    comments: z.string().max(4000),
    ...idem,
  })
  .strict();
export const enrollSchema = z
  .object({
    course_id: uuid,
    employee_id: uuid,
    source: z.enum(["direct", "development_plan", "learning_path"]),
    plan_item_id: uuid.nullable(),
    due_date: z.string().date().nullable().optional(),
    ...idem,
  })
  .strict();
export const lessonProgressSchema = z
  .object({ enrollment_id: uuid, lesson_id: uuid, completed: z.boolean() })
  .strict();
export const quizAttemptSchema = z
  .object({
    quiz_id: uuid,
    enrollment_id: uuid,
    answers: z.record(uuid, z.number().int().min(0).max(19)),
    ...idem,
  })
  .strict();

export const pathFields = z
  .object({
    title: z.string().trim().min(3).max(160),
    description: z.string().max(4000).optional(),
    competency_id: z.union([uuid, z.literal("")]).optional(),
    status: z.enum(["draft", "active", "archived"]),
  })
  .strict();
export const pathSchema = z
  .object({ id: uuid.nullable(), version: z.number().int().nullable(), data: pathFields })
  .strict();
export const pathCoursesSchema = z
  .object({ path_id: uuid, course_ids: z.array(uuid).max(50) })
  .strict();

export const planFields = z
  .object({
    employee_id: z.union([uuid, z.literal("")]).optional(),
    title: z.string().trim().min(3).max(160),
    objectives: z.string().max(4000).optional(),
    responsible_id: z.union([uuid, z.literal("")]).optional(),
    target_date: z.string().max(10).optional(),
    reassessment_due_date: z.string().date().nullable().optional(),
    status: z.enum(["draft", "active", "completed", "cancelled"]).optional(),
    notes: z.string().max(4000).optional(),
  })
  .strict();
export const planSchema = z
  .object({ id: uuid.nullable(), version: z.number().int().nullable(), data: planFields })
  .strict();

export const planItemFields = z
  .object({
    item_type: z.enum(["course", "learning_path", "training", "other"]),
    title: z.string().trim().min(3).max(200),
    description: z.string().max(4000).optional(),
    competency_id: z.union([uuid, z.literal("")]).optional(),
    course_id: z.union([uuid, z.literal("")]).optional(),
    learning_path_id: z.union([uuid, z.literal("")]).optional(),
    training_session_id: z.union([uuid, z.literal("")]).optional(),
    priority: z.enum(["high", "medium", "low"]),
    target_date: z.string().max(10).optional(),
  })
  .strict();
export const planItemSchema = z
  .object({
    id: uuid.nullable(),
    plan_id: uuid,
    version: z.number().int().nullable(),
    data: planItemFields,
  })
  .strict();
export const planItemStatusSchema = z
  .object({
    item_id: uuid,
    status: z.enum(["in_progress", "completed", "cancelled"]),
    evidence: z.string().max(4000).optional(),
  })
  .strict();

export const personalGoalSchema = z
  .object({
    id: uuid.nullable(),
    version: z.number().int().nullable(),
    data: z
      .object({
        evaluation_assignment_id: z.union([uuid, z.literal("")]).optional(),
        title: z.string().trim().min(3).max(160),
        description: z.string().max(4000).optional(),
        success_criteria: z.string().max(4000).optional(),
        target_date: z.string().max(10).optional(),
      })
      .strict(),
    ...idem,
  })
  .strict();

export const submitPersonalGoalSchema = z
  .object({ id: uuid, version: z.number().int(), ...idem })
  .strict();
export const personalGoalProgressSchema = z
  .object({
    id: uuid,
    version: z.number().int(),
    progress: z.number().int().min(0).max(100),
    comment: z.string().max(4000).optional(),
    ...idem,
  })
  .strict();
export const reviewPersonalGoalSchema = z
  .object({
    id: uuid,
    decision: z.enum(["approve", "return", "complete"]),
    comments: z.string().max(4000).optional(),
    ...idem,
  })
  .strict();

export const trainerFields = z
  .object({
    name: z.string().trim().min(2).max(160),
    email: z.string().max(200).optional(),
    specialty: z.string().max(200).optional(),
    is_external: z.boolean(),
    status: z.enum(["active", "inactive"]).optional(),
  })
  .strict();
export const trainerSchema = z
  .object({ id: uuid.nullable(), version: z.number().int().nullable(), data: trainerFields })
  .strict();

export const sessionFields = z
  .object({
    code: z.string().trim().min(1).max(20),
    title: z.string().trim().min(3).max(160),
    type: z.enum(["workshop", "seminar", "on_the_job", "e_learning", "drill"]),
    starts_at: z.string().min(10).max(40),
    ends_at: z.string().min(10).max(40),
    venue: z.string().max(200).optional(),
    delivery_method: z.enum(["in_person", "virtual", "hybrid"]),
    trainer_id: z.union([uuid, z.literal("")]).optional(),
    capacity: z.coerce.number().int().min(1).max(10000).optional(),
    related_competency_id: z.union([uuid, z.literal("")]).optional(),
  })
  .strict();
export const sessionSchema = z
  .object({ id: uuid.nullable(), version: z.number().int().nullable(), data: sessionFields })
  .strict();
export const sessionStatusSchema = z
  .object({ id: uuid, status: z.enum(["planned", "in_progress", "completed", "cancelled"]) })
  .strict();
export const registerParticipantSchema = z
  .object({ session_id: uuid, employee_id: uuid, plan_item_id: uuid.nullable() })
  .strict();
export const attendanceSchema = z
  .object({
    session_id: uuid,
    rows: z
      .array(
        z
          .object({
            employee_id: uuid,
            status: z.enum(["present", "absent", "late", "excused"]),
            remarks: z.string().max(2000).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(500),
    ...idem,
  })
  .strict();
export const trainingResultSchema = z
  .object({
    session_id: uuid,
    employee_id: uuid,
    score: z.coerce.number().min(0).max(100).nullable().optional(),
    outcome: z.enum(["passed", "failed", "completed", "incomplete"]),
    feedback: z.string().max(4000).optional(),
    evidence: z.string().max(4000).optional(),
  })
  .strict();
export const effectivenessSchema = z
  .object({
    session_id: uuid,
    summary: z.string().trim().min(3).max(4000),
    follow_up_required: z.boolean(),
    notes: z.string().max(4000).optional(),
  })
  .strict();
export const reassessLinkSchema = z
  .object({
    employee_id: uuid,
    competency_id: uuid,
    session_id: uuid.nullable(),
    assessment_id: uuid,
    notes: z.string().max(2000).optional(),
  })
  .strict();

export const aiGenerateSchema = z.object({ employee_id: uuid, ...idem }).strict();
export const aiReviewSchema = z
  .object({
    id: uuid,
    decision: z.enum(["accept", "edit", "reject"]),
    comments: z.string().max(4000),
    edited: z
      .object({
        priority: z.enum(["high", "medium", "low"]).optional(),
        expected_outcome: z.string().max(4000).optional(),
        assessment_method: z.string().max(4000).optional(),
        title: z.string().max(200).optional(),
      })
      .strict()
      .optional(),
    ...idem,
  })
  .strict();
export const aiSettingsSchema = z
  .object({
    provider: z.literal("gemini"),
    model: z.string().trim().min(1).max(120),
    version: z.number().int(),
  })
  .strict();

// ---------------- Phase 6: succession, recognition, reports ----------------
export const criticalPositionFields = z
  .object({
    position_id: uuid,
    department_id: uuid,
    criticality: z.enum(["low", "medium", "high", "critical"]),
    business_impact: z.string().max(4000).optional(),
    incumbent_employee_id: z.union([uuid, z.literal("")]).optional(),
    status: z.enum(["active", "monitoring", "closed"]),
    review_date: z.string().max(10).optional(),
  })
  .strict();
export const criticalPositionSchema = z
  .object({
    id: uuid.nullable(),
    version: z.number().int().nullable(),
    data: criticalPositionFields,
  })
  .strict();

export const candidateFields = z
  .object({
    critical_position_id: z.union([uuid, z.literal("")]).optional(),
    employee_id: z.union([uuid, z.literal("")]).optional(),
    readiness_class_id: z.union([uuid, z.literal("")]).optional(),
    notes: z.string().max(4000).optional(),
    status: z.enum(["active", "withdrawn", "appointed"]).optional(),
  })
  .strict();
export const candidateSchema = z
  .object({ id: uuid.nullable(), version: z.number().int().nullable(), data: candidateFields })
  .strict();
export const developmentPlanSubmitSchema = z
  .object({ id: uuid, version: z.number().int(), ...idem })
  .strict();
export const developmentPlanReviewSchema = z
  .object({
    id: uuid,
    version: z.number().int(),
    decision: z.enum(["approve", "return"]),
    comments: z.string().max(4000).optional(),
    ...idem,
  })
  .strict();
export const successionPlanSubmitSchema = z
  .object({ id: uuid, version: z.number().int(), ...idem })
  .strict();
export const successionPlanReviewSchema = z
  .object({
    id: uuid,
    version: z.number().int(),
    decision: z.enum(["approve", "return"]),
    comments: z.string().max(4000).optional(),
    ...idem,
  })
  .strict();
export const successionRequirementSchema = z
  .object({
    id: uuid.nullable(),
    critical_position_id: uuid,
    version: z.number().int().nullable(),
    name: z.string().trim().min(2).max(160),
    description: z.string().max(2000).optional(),
    is_mandatory: z.boolean(),
    active: z.boolean(),
    ...idem,
  })
  .strict();
export const successionQualificationSchema = z
  .object({
    id: uuid.nullable(),
    candidate_id: uuid,
    requirement_id: uuid,
    version: z.number().int().nullable(),
    status: z.enum(["met", "gap", "missing_evidence", "unassessed"]),
    evidence_summary: z.string().max(4000).optional(),
    evidence_date: z.string().max(10).optional(),
    expires_on: z.string().max(10).optional(),
    ...idem,
  })
  .strict()
  .superRefine((data, ctx) => {
    if (
      ["met", "gap"].includes(data.status) &&
      (!data.evidence_summary?.trim() || !data.evidence_date)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["evidence_summary"],
        message: "Verified assessments require an evidence summary and date.",
      });
    }
    if (data.expires_on && data.evidence_date && data.expires_on < data.evidence_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expires_on"],
        message: "Expiry must be on or after the evidence date.",
      });
    }
  });
export const readinessAssessmentSchema = z
  .object({
    candidate_id: uuid,
    summary: z.string().trim().min(3).max(4000),
    readiness_class_id: uuid.nullable(),
  })
  .strict();
export const successionActivitySchema = z
  .object({
    id: uuid.nullable(),
    candidate_id: uuid.nullable(),
    title: z.string().trim().min(3).max(200),
    description: z.string().max(4000).optional(),
    status: z.enum(["planned", "in_progress", "completed", "cancelled"]),
    target_date: z.string().max(10).optional(),
  })
  .strict();
export const grantAccessSchema = z.object({ user_id: uuid, department_id: uuid }).strict();
export const readinessClassFields = z
  .object({
    code: z.string().trim().min(1).max(30),
    label: z.string().trim().min(2).max(80),
    description: z.string().max(1000).optional(),
    sort_order: z.coerce.number().int().min(0).max(100),
  })
  .strict();
export const readinessClassSchema = z
  .object({ id: uuid.nullable(), version: z.number().int().nullable(), data: readinessClassFields })
  .strict();

export const nominationSchema = z
  .object({
    recipient_id: uuid,
    category_id: uuid,
    message: z.string().trim().min(1).max(4000),
    supporting_info: z.string().max(4000).optional(),
    ...idem,
  })
  .strict();
export const nominationReviewSchema = z
  .object({
    id: uuid,
    decision: z.enum(["approve", "reject"]),
    comments: z.string().max(4000),
    visibility: z.enum(["company", "department"]),
    show_nominator: z.boolean(),
    ...idem,
  })
  .strict();
export const categoryFields = z
  .object({
    name: z.string().trim().min(2).max(80),
    description: z.string().max(1000).optional(),
    active: z.boolean().optional(),
  })
  .strict();
export const categorySchema = z
  .object({ id: uuid.nullable(), version: z.number().int().nullable(), data: categoryFields })
  .strict();

const reportKindSchema = z.enum([
  "performance",
  "gaps",
  "learning",
  "training",
  "recognition",
  "succession",
  "audit",
]);
const isIsoDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)) &&
  new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;

export const reportSchema = z
  .object({
    kind: reportKindSchema,
    from: z.string().max(10).optional(),
    to: z.string().max(10).optional(),
    department: uuid.optional(),
    position: uuid.optional(),
    supervisor: uuid.optional(),
    cycle: uuid.optional(),
    status: z.string().max(40).optional(),
    course: uuid.optional(),
    trainer: uuid.optional(),
    competency: uuid.optional(),
    category: uuid.optional(),
    criticality: z.enum(["mandatory", "safety_critical"]).optional(),
    activity: uuid.optional(),
    actor: uuid.optional(),
    action: z.string().max(60).optional(),
    tableName: z.string().max(80).optional(),
  })
  .strict()
  .refine((data) => !data.from || isIsoDate(data.from), {
    message: "Use a valid YYYY-MM-DD start date",
    path: ["from"],
  })
  .refine((data) => !data.to || isIsoDate(data.to), {
    message: "Use a valid YYYY-MM-DD end date",
    path: ["to"],
  })
  .refine((data) => !data.from || !data.to || data.from <= data.to, {
    message: "Start date must be on or before end date",
    path: ["to"],
  });

export const savedReportSchema = z
  .object({
    id: uuid.nullable(),
    version: z.number().int().nullable(),
    name: z.string().trim().min(2).max(120),
    kind: reportKindSchema,
    filters: z.record(z.string().max(80), z.string().max(120)).default({}),
    columns: z.array(z.string().max(80)).max(50),
    idempotencyKey: uuid,
  })
  .strict()
  .superRefine((data, ctx) => {
    const parsedFilters = reportSchema.safeParse({ ...data.filters, kind: data.kind });
    if (!parsedFilters.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Report filters do not match the selected report type",
        path: ["filters"],
      });
    }
  });

export const deleteSavedReportSchema = z
  .object({ id: uuid, version: z.number().int(), idempotencyKey: uuid })
  .strict();

export const reportExportSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    kind: reportKindSchema,
    scope: z.record(z.string().max(80), z.string().max(120)).default({}),
    rowCount: z.number().int().min(0).max(5000),
    idempotencyKey: uuid,
  })
  .strict();
