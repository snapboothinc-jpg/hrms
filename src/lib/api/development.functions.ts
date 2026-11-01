/**
 * Phase 5 server operations: learning, training, development plans, AI recommendations.
 * Same sequence as actions.functions.ts: authenticate -> validate (Zod) ->
 * authorize at record level + transaction + audit (SECURITY DEFINER RPC) -> typed result.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runOp, rpc, hashBody } from "./core.server";
import {
  uuid,
  courseSchema,
  courseContentSchema,
  courseMappingsSchema,
  idemAction,
  reviewCourseSchema,
  enrollSchema,
  lessonProgressSchema,
  quizAttemptSchema,
  pathSchema,
  pathCoursesSchema,
  planSchema,
  developmentPlanSubmitSchema,
  developmentPlanReviewSchema,
  planItemSchema,
  planItemStatusSchema,
  personalGoalSchema,
  submitPersonalGoalSchema,
  personalGoalProgressSchema,
  reviewPersonalGoalSchema,
  trainerSchema,
  sessionSchema,
  sessionStatusSchema,
  registerParticipantSchema,
  attendanceSchema,
  trainingResultSchema,
  effectivenessSchema,
  reassessLinkSchema,
  aiGenerateSchema,
  aiReviewSchema,
  aiSettingsSchema,
} from "@/lib/schemas";

const strict = <T extends z.ZodRawShape>(shape: T) => z.object(shape).strict();
const withoutKey = <T extends { idempotencyKey: string }>(d: T) => {
  const { idempotencyKey: _k, ...rest } = d;
  return rest;
};

// ---------------- AI ----------------
export const getAiStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    runOp("ai_status", context.userId, async () => {
      const { data: row } = await context.supabase
        .from("ai_integration_settings")
        .select("provider, model, last_status, last_error, last_checked_at, version")
        .order("created_at")
        .limit(1)
        .maybeSingle();
      const { getAiConfig, aiConfigStatus } = await import("@/lib/ai/ai.server");
      const cfg = getAiConfig(row?.provider, row?.model);
      return { ...aiConfigStatus(cfg), db: row ?? null };
    }),
  );

export const updateAiSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => aiSettingsSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("update_ai_settings", context.userId, () =>
      rpc(context.supabase, "update_ai_settings", {
        _provider: data.provider,
        _model: data.model,
        _version: data.version,
      }),
    ),
  );

export const generateAiRecommendations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => aiGenerateSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("ai_generate", context.userId, async () => {
      const ctx = await rpc<import("@/lib/ai/ai.server").AiContext>(
        context.supabase,
        "prepare_ai_context",
        { _employee: data.employee_id },
      );
      const { getAiConfig, runRecommendationCall } = await import("@/lib/ai/ai.server");
      const { data: settingsRow } = await context.supabase
        .from("ai_integration_settings")
        .select("provider, model")
        .order("created_at")
        .limit(1)
        .maybeSingle();
      const cfg = getAiConfig(settingsRow?.provider, settingsRow?.model);
      if (!cfg.key) {
        await rpc(context.supabase, "log_ai_generation", {
          _employee: data.employee_id,
          _model: cfg.model,
          _status: "error",
          _error: `missing ${cfg.keyVar}`,
          _latency: 0,
        });
        throw new Error(
          `INVALID: AI is not configured - the ${cfg.keyVar} environment variable is missing`,
        );
      }
      if (!ctx.gaps.length)
        return { saved: 0, rejected: 0, note: "No validated gaps for this employee" };
      if (!ctx.resources.length)
        return {
          saved: 0,
          rejected: 0,
          note: "No learning resources are linked to the gapped competencies",
        };
      try {
        const result = await runRecommendationCall(cfg, ctx);
        const saved = await rpc<{ saved: number; rejected: number }>(
          context.supabase,
          "save_ai_recommendations",
          {
            _employee: data.employee_id,
            _items: result.items,
            _model: result.model,
            _idem: data.idempotencyKey,
            _hash: await hashBody(withoutKey(data)),
          },
        );
        await rpc(context.supabase, "log_ai_generation", {
          _employee: data.employee_id,
          _model: result.model,
          _status: "success",
          _error: null,
          _latency: result.latencyMs,
        });
        return { ...saved, rejectedUnknown: result.rejectedUnknown };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "AI call failed";
        const invalid = msg.startsWith("INVALID_OUTPUT");
        const rateLimited = msg.startsWith("AI_RATE_LIMIT");
        const timedOut = msg.startsWith("AI_TIMEOUT");
        const logCategory = invalid
          ? "invalid_output"
          : rateLimited
            ? "rate_limited"
            : timedOut
              ? "timeout"
              : "provider_error";
        await rpc(context.supabase, "log_ai_generation", {
          _employee: data.employee_id,
          _model: cfg.model,
          _status: invalid ? "invalid" : "error",
          _error: logCategory,
          _latency: 0,
        });
        throw new Error(
          invalid
            ? "RULE: the AI response failed validation and was discarded"
            : rateLimited
              ? "RULE: the AI provider rate limit was reached; retry later"
              : timedOut
                ? "RULE: the AI provider timed out; retry later"
                : "RULE: the AI provider call failed; verify provider configuration and retry",
        );
      }
    }),
  );

export const reviewAiRecommendation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => aiReviewSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("ai_review", context.userId, async () =>
      rpc(context.supabase, "review_ai_recommendation", {
        _id: data.id,
        _decision: data.decision,
        _comments: data.comments,
        _edited: data.edited ?? {},
        _idem: data.idempotencyKey,
        _hash: await hashBody(withoutKey(data)),
      }),
    ),
  );

// ---------------- learning ----------------
export const saveCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => courseSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("upsert_course", context.userId, () =>
      rpc<{ id: string }>(context.supabase, "upsert_course", {
        _id: data.id,
        _d: data.data,
        _version: data.version,
      }),
    ),
  );

export const saveCourseContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => courseContentSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("save_course_content", context.userId, () =>
      rpc(context.supabase, "save_course_content", {
        _course: data.course_id,
        _sections: data.sections,
        _version: data.version,
      }),
    ),
  );

export const setCourseCompetencies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => courseMappingsSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("set_course_competencies", context.userId, () =>
      rpc(context.supabase, "set_course_competencies", {
        _course: data.course_id,
        _mappings: data.mappings,
      }),
    ),
  );

export const submitCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idemAction.parse(d))
  .handler(async ({ data, context }) =>
    runOp("submit_course", context.userId, async () =>
      rpc(context.supabase, "submit_course", {
        _id: data.id,
        _idem: data.idempotencyKey,
        _hash: await hashBody({ id: data.id }),
      }),
    ),
  );

export const reviewCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => reviewCourseSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("review_course", context.userId, async () =>
      rpc(context.supabase, "review_course", {
        _id: data.id,
        _decision: data.decision,
        _comments: data.comments,
        _idem: data.idempotencyKey,
        _hash: await hashBody(withoutKey(data)),
      }),
    ),
  );

export const archiveCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => strict({ id: uuid }).parse(d))
  .handler(async ({ data, context }) =>
    runOp("archive_course", context.userId, () =>
      rpc(context.supabase, "archive_course", { _id: data.id }),
    ),
  );

export const enrollCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => enrollSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("enroll_course", context.userId, async () =>
      rpc(context.supabase, "enroll_course", {
        _course: data.course_id,
        _employee: data.employee_id,
        _source: data.source,
        _plan_item: data.plan_item_id,
        _due_date: data.due_date ?? null,
        _idem: data.idempotencyKey,
        _hash: await hashBody(withoutKey(data)),
      }),
    ),
  );

export const saveLessonProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => lessonProgressSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("save_lesson_progress", context.userId, () =>
      rpc(context.supabase, "save_lesson_progress", {
        _enrollment: data.enrollment_id,
        _lesson: data.lesson_id,
        _completed: data.completed,
      }),
    ),
  );

export const getQuizQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => strict({ quiz_id: uuid }).parse(d))
  .handler(async ({ data, context }) =>
    runOp("get_quiz_questions", context.userId, async () => {
      const rows = await rpc<{ id: string; question: string; options: string[] }[] | null>(
        context.supabase,
        "get_quiz_questions",
        { _quiz: data.quiz_id },
      );
      if (!rows) throw new Error("NOT_FOUND");
      return rows;
    }),
  );

export const submitQuizAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => quizAttemptSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("submit_quiz_attempt", context.userId, async () =>
      rpc<{ score: number; passed: boolean; attempt: number; max_attempts: number }>(
        context.supabase,
        "submit_quiz_attempt",
        {
          _quiz: data.quiz_id,
          _enrollment: data.enrollment_id,
          _answers: data.answers,
          _idem: data.idempotencyKey,
          _hash: await hashBody(withoutKey(data)),
        },
      ),
    ),
  );

export const saveLearningPath = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => pathSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("upsert_learning_path", context.userId, () =>
      rpc<{ id: string }>(context.supabase, "upsert_learning_path", {
        _id: data.id,
        _d: data.data,
        _version: data.version,
      }),
    ),
  );

export const setPathCourses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => pathCoursesSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("set_path_courses", context.userId, () =>
      rpc(context.supabase, "set_path_courses", {
        _path: data.path_id,
        _course_ids: data.course_ids,
      }),
    ),
  );

// ---------------- training & development plans ----------------
export const saveDevelopmentPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => planSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("upsert_development_plan", context.userId, () =>
      rpc<{ id: string }>(context.supabase, "upsert_development_plan", {
        _id: data.id,
        _d: data.data,
        _version: data.version,
      }),
    ),
  );

export const submitDevelopmentPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => developmentPlanSubmitSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("submit_development_plan", context.userId, async () =>
      rpc(context.supabase, "submit_development_plan", {
        _id: data.id,
        _version: data.version,
        _idem: data.idempotencyKey,
        _hash: await hashBody(withoutKey(data)),
      }),
    ),
  );

export const reviewDevelopmentPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => developmentPlanReviewSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("review_development_plan", context.userId, async () =>
      rpc(context.supabase, "review_development_plan", {
        _id: data.id,
        _version: data.version,
        _decision: data.decision,
        _comments: data.comments ?? null,
        _idem: data.idempotencyKey,
        _hash: await hashBody(withoutKey(data)),
      }),
    ),
  );

export const savePlanItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => planItemSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("save_plan_item", context.userId, () =>
      rpc(context.supabase, "save_plan_item", {
        _id: data.id,
        _plan: data.plan_id,
        _d: data.data,
        _version: data.version,
      }),
    ),
  );

export const setPlanItemStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => planItemStatusSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("set_plan_item_status", context.userId, () =>
      rpc(context.supabase, "set_plan_item_status", {
        _item: data.item_id,
        _status: data.status,
        _evidence: data.evidence ?? null,
      }),
    ),
  );

export const savePersonalGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => personalGoalSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("upsert_personal_goal", context.userId, async () =>
      rpc(context.supabase, "upsert_personal_goal", {
        _id: data.id,
        _d: data.data,
        _version: data.version,
        _idem: data.idempotencyKey,
        _hash: await hashBody(withoutKey(data)),
      }),
    ),
  );

export const submitPersonalGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => submitPersonalGoalSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("submit_personal_goal", context.userId, async () =>
      rpc(context.supabase, "submit_personal_goal", {
        _id: data.id,
        _version: data.version,
        _idem: data.idempotencyKey,
        _hash: await hashBody(withoutKey(data)),
      }),
    ),
  );

export const updatePersonalGoalProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => personalGoalProgressSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("update_personal_goal_progress", context.userId, async () =>
      rpc(context.supabase, "update_personal_goal_progress", {
        _id: data.id,
        _progress: data.progress,
        _comment: data.comment ?? null,
        _version: data.version,
        _idem: data.idempotencyKey,
        _hash: await hashBody(withoutKey(data)),
      }),
    ),
  );

export const reviewPersonalGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => reviewPersonalGoalSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("review_personal_goal", context.userId, async () =>
      rpc(context.supabase, "review_personal_goal", {
        _id: data.id,
        _decision: data.decision,
        _comments: data.comments ?? null,
        _idem: data.idempotencyKey,
        _hash: await hashBody(withoutKey(data)),
      }),
    ),
  );

export const saveTrainer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => trainerSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("upsert_trainer", context.userId, () =>
      rpc(context.supabase, "upsert_trainer", {
        _id: data.id,
        _d: data.data,
        _version: data.version,
      }),
    ),
  );

export const saveTrainingSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => sessionSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("upsert_training_session", context.userId, () =>
      rpc<{ id: string }>(context.supabase, "upsert_training_session", {
        _id: data.id,
        _d: data.data,
        _version: data.version,
      }),
    ),
  );

export const setSessionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => sessionStatusSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("set_session_status", context.userId, () =>
      rpc(context.supabase, "set_session_status", { _id: data.id, _status: data.status }),
    ),
  );

export const registerParticipant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => registerParticipantSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("register_participant", context.userId, () =>
      rpc(context.supabase, "register_participant", {
        _session: data.session_id,
        _employee: data.employee_id,
        _plan_item: data.plan_item_id,
      }),
    ),
  );

export const saveAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => attendanceSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("save_attendance", context.userId, async () =>
      rpc(context.supabase, "save_attendance", {
        _session: data.session_id,
        _rows: data.rows,
        _idem: data.idempotencyKey,
        _hash: await hashBody(withoutKey(data)),
      }),
    ),
  );

export const saveTrainingResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => trainingResultSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("save_training_result", context.userId, () =>
      rpc(context.supabase, "save_training_result", {
        _session: data.session_id,
        _employee: data.employee_id,
        _d: {
          score: data.score ?? null,
          outcome: data.outcome,
          feedback: data.feedback ?? null,
          evidence: data.evidence ?? null,
        },
      }),
    ),
  );

export const saveEffectivenessReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => effectivenessSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("save_effectiveness_review", context.userId, () =>
      rpc(context.supabase, "save_effectiveness_review", {
        _session: data.session_id,
        _summary: data.summary,
        _follow_up: data.follow_up_required,
        _notes: data.notes ?? null,
      }),
    ),
  );

export const linkReassessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => reassessLinkSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("link_reassessment", context.userId, () =>
      rpc(context.supabase, "link_reassessment", {
        _employee: data.employee_id,
        _competency: data.competency_id,
        _session: data.session_id,
        _assessment: data.assessment_id,
        _notes: data.notes ?? null,
      }),
    ),
  );
