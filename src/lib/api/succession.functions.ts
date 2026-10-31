/**
 * Phase 6 server operations: succession planning, recognition, reports and exports.
 * Same sequence as actions.functions.ts: authenticate -> validate (Zod) ->
 * authorize at record level + transaction + audit (SECURITY DEFINER RPC) -> typed result.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runOp, rpc, hashBody } from "./core.server";
import {
  uuid,
  criticalPositionSchema,
  candidateSchema,
  readinessAssessmentSchema,
  successionActivitySchema,
  grantAccessSchema,
  readinessClassSchema,
  nominationSchema,
  nominationReviewSchema,
  categorySchema,
  reportSchema,
  savedReportSchema,
  deleteSavedReportSchema,
  reportExportSchema,
  successionPlanSubmitSchema,
  successionPlanReviewSchema,
  successionRequirementSchema,
  successionQualificationSchema,
} from "@/lib/schemas";

const strict = <T extends z.ZodRawShape>(shape: T) => z.object(shape).strict();
const withoutKey = <T extends { idempotencyKey: string }>(d: T) => {
  const { idempotencyKey: _k, ...rest } = d;
  return rest;
};

// ---------------- succession ----------------
export const saveCriticalPosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => criticalPositionSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("upsert_critical_position", context.userId, () =>
      rpc<{ id: string }>(context.supabase, "upsert_critical_position", {
        _id: data.id,
        _d: data.data,
        _version: data.version,
      }),
    ),
  );

export const saveCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => candidateSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("upsert_succession_candidate", context.userId, () =>
      rpc<{ id: string }>(context.supabase, "upsert_succession_candidate", {
        _id: data.id,
        _d: data.data,
        _version: data.version,
      }),
    ),
  );

export const saveReadinessAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => readinessAssessmentSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("save_readiness_assessment", context.userId, () =>
      rpc(context.supabase, "save_readiness_assessment", {
        _candidate: data.candidate_id,
        _summary: data.summary,
        _class: data.readiness_class_id,
      }),
    ),
  );

export const saveSuccessionActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => successionActivitySchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("save_succession_activity", context.userId, () =>
      rpc(context.supabase, "save_succession_activity", {
        _id: data.id,
        _candidate: data.candidate_id,
        _d: {
          title: data.title,
          description: data.description ?? null,
          status: data.status,
          target_date: data.target_date ?? null,
        },
      }),
    ),
  );

export const grantSuccessionAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => grantAccessSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("grant_succession_access", context.userId, () =>
      rpc(context.supabase, "grant_succession_access", {
        _user: data.user_id,
        _department: data.department_id,
      }),
    ),
  );

export const revokeSuccessionAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => strict({ id: uuid }).parse(d))
  .handler(async ({ data, context }) =>
    runOp("revoke_succession_access", context.userId, () =>
      rpc(context.supabase, "revoke_succession_access", { _grant: data.id }),
    ),
  );

export const saveReadinessClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => readinessClassSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("upsert_readiness_class", context.userId, () =>
      rpc(context.supabase, "upsert_readiness_class", {
        _id: data.id,
        _d: data.data,
        _version: data.version,
      }),
    ),
  );

export const submitSuccessionPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => successionPlanSubmitSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("submit_succession_plan", context.userId, async () =>
      rpc(context.supabase, "submit_succession_plan", {
        _id: data.id,
        _version: data.version,
        _idem: data.idempotencyKey,
        _hash: await hashBody(withoutKey(data)),
      }),
    ),
  );

export const reviewSuccessionPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => successionPlanReviewSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("review_succession_plan", context.userId, async () =>
      rpc(context.supabase, "review_succession_plan", {
        _id: data.id,
        _version: data.version,
        _decision: data.decision,
        _comments: data.comments ?? null,
        _idem: data.idempotencyKey,
        _hash: await hashBody(withoutKey(data)),
      }),
    ),
  );

export const saveSuccessionRequirement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => successionRequirementSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("upsert_succession_qualification_requirement", context.userId, async () =>
      rpc(context.supabase, "upsert_succession_qualification_requirement", {
        _id: data.id,
        _critical_position: data.critical_position_id,
        _name: data.name,
        _description: data.description ?? null,
        _mandatory: data.is_mandatory,
        _active: data.active,
        _version: data.version,
        _idem: data.idempotencyKey,
        _hash: await hashBody(withoutKey(data)),
      }),
    ),
  );

export const saveSuccessionQualification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => successionQualificationSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("set_succession_candidate_qualification", context.userId, async () =>
      rpc(context.supabase, "set_succession_candidate_qualification", {
        _id: data.id,
        _candidate: data.candidate_id,
        _requirement: data.requirement_id,
        _status: data.status,
        _evidence: data.evidence_summary ?? null,
        _evidence_date: data.evidence_date ?? null,
        _expires_on: data.expires_on ?? null,
        _version: data.version,
        _idem: data.idempotencyKey,
        _hash: await hashBody(withoutKey(data)),
      }),
    ),
  );

/** Succession pages call this on load: every succession view is audited. */
export const logSuccessionView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    strict({ record_type: z.string().max(60), record_id: uuid.nullable() }).parse(d),
  )
  .handler(async ({ data, context }) =>
    runOp("log_succession_view", context.userId, () =>
      rpc(context.supabase, "log_succession_view", {
        _record_type: data.record_type,
        _record: data.record_id,
      }),
    ),
  );

// ---------------- recognition ----------------
export const saveRecognitionCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => categorySchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("upsert_recognition_category", context.userId, () =>
      rpc(context.supabase, "upsert_recognition_category", {
        _id: data.id,
        _d: data.data,
        _version: data.version,
      }),
    ),
  );

export const submitNomination = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => nominationSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("submit_nomination", context.userId, async () =>
      rpc<{ id: string }>(context.supabase, "submit_nomination", {
        _recipient: data.recipient_id,
        _category: data.category_id,
        _message: data.message,
        _supporting: data.supporting_info ?? null,
        _idem: data.idempotencyKey,
        _hash: await hashBody(withoutKey(data)),
      }),
    ),
  );

export const reviewNomination = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => nominationReviewSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("review_nomination", context.userId, async () =>
      rpc(context.supabase, "review_nomination", {
        _id: data.id,
        _decision: data.decision,
        _comments: data.comments,
        _visibility: data.visibility,
        _show_nominator: data.show_nominator,
        _idem: data.idempotencyKey,
        _hash: await hashBody(withoutKey(data)),
      }),
    ),
  );

// ---------------- reports & exports ----------------
export const getReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => reportSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("report_data", context.userId, () =>
      rpc<Record<string, number>>(context.supabase, "report_data", {
        _kind: data.kind,
        _from: data.from ?? null,
        _to: data.to ?? null,
        _department: data.department ?? null,
      }),
    ),
  );

export const logReportView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => reportSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("log_report_view", context.userId, () =>
      rpc(context.supabase, "log_report_view", {
        _kind: data.kind,
        _filters: data,
      }),
    ),
  );

export const saveReportDefinition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => savedReportSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("save_report_definition", context.userId, async () =>
      rpc(context.supabase, "upsert_saved_report", {
        _id: data.id,
        _name: data.name,
        _kind: data.kind,
        _filters: data.filters,
        _columns: data.columns,
        _version: data.version,
        _idem: data.idempotencyKey,
        _hash: await hashBody(withoutKey(data)),
      }),
    ),
  );

export const deleteReportDefinition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => deleteSavedReportSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("delete_report_definition", context.userId, async () =>
      rpc(context.supabase, "delete_saved_report", {
        _id: data.id,
        _version: data.version,
        _idem: data.idempotencyKey,
        _hash: await hashBody(withoutKey(data)),
      }),
    ),
  );

/** Export metadata is retained without storing a downloaded file or bypassing report RLS. */
export const logExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => reportExportSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("record_report_export", context.userId, async () =>
      rpc(context.supabase, "record_report_export", {
        _name: data.name,
        _kind: data.kind,
        _scope: data.scope,
        _format: "csv",
        _result: "success",
        _row_count: data.rowCount,
        _idem: data.idempotencyKey,
        _hash: await hashBody(withoutKey(data)),
      }),
    ),
  );

const pdfKindSchema = strict({
  kind: z.enum(["evaluation_summary", "gap_report", "development_plan"]),
  id: uuid,
});

/** Server-side PDF (pdf-lib) with the same record-level access checks as the UI. */
export const exportPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => pdfKindSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("export_pdf", context.userId, async () => {
      const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
      const doc = await PDFDocument.create();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const bold = await doc.embedFont(StandardFonts.HelveticaBold);
      const navy = rgb(0.031, 0.043, 0.239);
      let title = "";
      let lines: string[] = [];

      if (data.kind === "evaluation_summary") {
        const { data: a } = await context.supabase
          .from("evaluation_assignments")
          .select(
            "id, status, overall_score, submitted_at, employee:employees!evaluation_assignments_employee_id_fkey(first_name,last_name,employee_code), cycle:evaluation_cycles(name)",
          )
          .eq("id", data.id)
          .maybeSingle();
        if (!a) throw new Error("NOT_FOUND");
        const emp = a.employee as unknown as {
          first_name: string;
          last_name: string;
          employee_code: string;
        } | null;
        const cyc = a.cycle as unknown as { name: string } | null;
        title = "Evaluation summary";
        lines = [
          `Employee: ${emp ? `${emp.first_name} ${emp.last_name} (${emp.employee_code})` : "-"}`,
          `Cycle: ${cyc?.name ?? "-"}`,
          `Status: ${a.status}`,
          `Overall score: ${a.overall_score ?? "not scored"}`,
          `Submitted: ${a.submitted_at ? new Date(a.submitted_at).toISOString().slice(0, 10) : "-"}`,
        ];
      } else if (data.kind === "gap_report") {
        const gaps = await rpc<
          {
            competency_name: string;
            required_level: number;
            current_level: number | null;
            gap: number | null;
            gap_status: string;
          }[]
        >(context.supabase, "competency_gaps", {
          _employee: data.id,
          _department: undefined,
          _position: undefined,
          _category: undefined,
          _status: undefined,
          _limit: 200,
          _offset: 0,
        });
        if (!gaps.length) throw new Error("NOT_FOUND");
        const { data: emp } = await context.supabase
          .from("employees")
          .select("first_name,last_name,employee_code")
          .eq("id", data.id)
          .maybeSingle();
        title = "Competency gap report";
        lines = [
          `Employee: ${emp ? `${emp.first_name} ${emp.last_name} (${emp.employee_code})` : "-"}`,
          "",
          ...gaps.map(
            (g) =>
              `${g.competency_name}: required ${g.required_level}, current ${g.current_level ?? "Not Assessed"}, ` +
              (g.gap_status === "gap"
                ? `gap ${g.gap}`
                : g.gap_status === "met"
                  ? "met"
                  : "Not Assessed"),
          ),
        ];
      } else {
        const { data: plan } = await context.supabase
          .from("development_plans")
          .select(
            "title, objectives, status, target_date, employee:employees(first_name,last_name,employee_code)",
          )
          .eq("id", data.id)
          .maybeSingle();
        if (!plan) throw new Error("NOT_FOUND");
        const { data: items } = await context.supabase
          .from("development_plan_items")
          .select("title, item_type, priority, status, target_date")
          .eq("plan_id", data.id)
          .order("created_at");
        const emp = plan.employee as unknown as {
          first_name: string;
          last_name: string;
          employee_code: string;
        } | null;
        title = "Development plan";
        lines = [
          `Employee: ${emp ? `${emp.first_name} ${emp.last_name} (${emp.employee_code})` : "-"}`,
          `Plan: ${plan.title} (${plan.status})`,
          `Target date: ${plan.target_date ?? "-"}`,
          "",
          ...(items ?? []).map(
            (i) =>
              `- [${i.status}] ${i.title} (${i.item_type}, ${i.priority} priority, due ${i.target_date ?? "-"})`,
          ),
        ];
      }

      const page = doc.addPage([595, 842]);
      page.drawText("Priority Handling Logistics, Inc. - " + title, {
        x: 48,
        y: 790,
        size: 18,
        font: bold,
        color: navy,
      });
      page.drawText(`Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`, {
        x: 48,
        y: 770,
        size: 9,
        font,
      });
      let y = 740;
      for (const line of lines) {
        if (y < 60) break;
        page.drawText(line.slice(0, 110), { x: 48, y, size: 11, font });
        y -= 18;
      }
      const bytes = await doc.save();
      await rpc(context.supabase, "log_audit", {
        _action: "export_pdf",
        _table: data.kind,
        _record: data.id,
        _details: {},
      });
      // base64 without Buffer (workerd-safe)
      let bin = "";
      const chunk = 8192;
      for (let i = 0; i < bytes.length; i += chunk)
        bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
      return { filename: `${data.kind}.pdf`, base64: btoa(bin) };
    }),
  );
