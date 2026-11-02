/**
 * All business operations. Sequence for every operation:
 * authenticate (requireSupabaseAuth) → validate (Zod, strict, bounded) →
 * authorize at record level + transaction + audit (SECURITY DEFINER RPC) →
 * standard typed result.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runOp, rpc, hashBody } from "./core.server";
import {
  departmentSchema,
  positionSchema,
  employeeSchema,
  supervisorSchema,
  createUserSchema,
  cycleFields,
  profileContentSchema,
  saveEvaluationSchema,
  submitEvaluationSchema,
  acknowledgeEvaluationSchema,
  reviewEvaluationSchema,
  reopenEvaluationSchema,
  addPerformanceFactorEvidenceSchema,
  createAssignmentsSchema,
  competencyFields,
  requirementSchema,
  assessmentSchema,
  reviewAssessmentSchema,
  uuid,
  ALLOWED_MIME,
  MAX_FILE_BYTES,
} from "@/lib/schemas";

const strict = <T extends z.ZodRawShape>(shape: T) => z.object(shape).strict();
const withoutKey = <T extends { idempotencyKey: string }>(d: T) => {
  const { idempotencyKey: _k, ...rest } = d;
  return rest;
};

// ---------------- identity ----------------
export const getMyContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    runOp("my_context", context.userId, () => rpc(context.supabase, "my_context", {})),
  );

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createUserSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("admin_create_user", context.userId, async () => {
      const { data: allowed, error } = await context.supabase.rpc("has_perm", {
        _perm: "admin.users",
      });
      if (error || !allowed) throw new Error("FORBIDDEN");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
        user_metadata: { full_name: data.full_name },
      });
      if (cErr || !created.user)
        throw new Error(
          cErr?.message?.includes("already")
            ? "CONFLICT: a user with this email already exists"
            : "INVALID: could not create the account",
        );
      const uid = created.user.id;
      try {
        await rpc(context.supabase, "admin_set_role", { _user: uid, _role: data.role });
        if (data.employee_id)
          await rpc(context.supabase, "admin_link_employee", {
            _user: uid,
            _employee: data.employee_id,
          });
      } catch (e) {
        await supabaseAdmin.auth.admin.deleteUser(uid); // compensate: no half-created accounts
        throw e;
      }
      return { user_id: uid };
    }),
  );

export const adminSetRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    strict({ user_id: uuid, role: createUserSchema.shape.role }).parse(d),
  )
  .handler(async ({ data, context }) =>
    runOp("admin_set_role", context.userId, () =>
      rpc(context.supabase, "admin_set_role", { _user: data.user_id, _role: data.role }),
    ),
  );

export const adminSetActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => strict({ user_id: uuid, active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) =>
    runOp("admin_set_active", context.userId, async () => {
      const r = await rpc(context.supabase, "admin_set_active", {
        _user: data.user_id,
        _active: data.active,
      });
      if (!data.active) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.auth.admin.updateUserById(data.user_id, { ban_duration: "876000h" });
      } else {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.auth.admin.updateUserById(data.user_id, { ban_duration: "none" });
      }
      return r;
    }),
  );

export const adminLinkEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => strict({ user_id: uuid, employee_id: uuid.nullable() }).parse(d))
  .handler(async ({ data, context }) =>
    runOp("admin_link_employee", context.userId, () =>
      rpc(context.supabase, "admin_link_employee", {
        _user: data.user_id,
        _employee: data.employee_id,
      }),
    ),
  );

// ---------------- organization ----------------
export const saveDepartment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => departmentSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("upsert_department", context.userId, () =>
      rpc(context.supabase, "upsert_department", {
        _id: data.id,
        _code: data.code,
        _name: data.name,
        _parent: data.parent_id,
        _head: data.head_employee_id,
        _status: data.status,
        _version: data.version,
      }),
    ),
  );

export const savePosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => positionSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("upsert_position", context.userId, () =>
      rpc(context.supabase, "upsert_position", {
        _id: data.id,
        _code: data.code,
        _title: data.title,
        _dept: data.department_id,
        _desc: data.description ?? null,
        _status: data.status,
        _version: data.version,
      }),
    ),
  );

export const saveEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => employeeSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("upsert_employee", context.userId, () =>
      rpc(context.supabase, "upsert_employee", {
        _id: data.id,
        _d: data.data,
        _version: data.version,
      }),
    ),
  );

export const updateMyContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    strict({ phone: z.string().trim().max(40), version: z.number().int() }).parse(d),
  )
  .handler(async ({ data, context }) =>
    runOp("update_my_contact", context.userId, () =>
      rpc(context.supabase, "update_my_contact", { _phone: data.phone, _version: data.version }),
    ),
  );

export const setSupervisor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => supervisorSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("set_supervisor", context.userId, () =>
      rpc(context.supabase, "set_supervisor", {
        _emp: data.employee_id,
        _sup: data.supervisor_id,
        _from: data.effective_from,
      }),
    ),
  );

// ---------------- performance ----------------
export const saveCycle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    strict({ id: uuid.nullable(), version: z.number().int().nullable(), data: cycleFields }).parse(
      d,
    ),
  )
  .handler(async ({ data, context }) =>
    runOp("upsert_cycle", context.userId, () =>
      rpc(context.supabase, "upsert_cycle", {
        _id: data.id,
        _d: data.data,
        _version: data.version,
      }),
    ),
  );

export const setCycleStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    strict({ id: uuid, status: z.enum(["draft", "open", "closed"]) }).parse(d),
  )
  .handler(async ({ data, context }) =>
    runOp("set_cycle_status", context.userId, () =>
      rpc(context.supabase, "set_cycle_status", { _id: data.id, _status: data.status }),
    ),
  );

export const createProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    strict({
      position_id: uuid,
      name: z.string().trim().min(3).max(120),
      description: z.string().max(2000).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) =>
    runOp("create_profile", context.userId, () =>
      rpc<{ profile: { id: string } }>(context.supabase, "create_profile", {
        _position: data.position_id,
        _name: data.name,
        _desc: data.description ?? null,
      }),
    ),
  );

export const saveProfileVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    strict({ version_id: uuid, version: z.number().int(), content: profileContentSchema }).parse(d),
  )
  .handler(async ({ data, context }) =>
    runOp("save_profile_version", context.userId, () =>
      rpc(context.supabase, "save_profile_version", {
        _version_id: data.version_id,
        _c: data.content,
        _expected: data.version,
      }),
    ),
  );

export const activateProfileVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => strict({ version_id: uuid }).parse(d))
  .handler(async ({ data, context }) =>
    runOp("activate_profile_version", context.userId, () =>
      rpc(context.supabase, "activate_profile_version", { _version_id: data.version_id }),
    ),
  );

export const newProfileVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => strict({ profile_id: uuid }).parse(d))
  .handler(async ({ data, context }) =>
    runOp("new_profile_version", context.userId, () =>
      rpc(context.supabase, "new_profile_version", { _profile: data.profile_id }),
    ),
  );

export const createAssignments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createAssignmentsSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("create_assignments", context.userId, async () =>
      rpc<{ created: number; skipped: { employee_id: string; reason: string }[] }>(
        context.supabase,
        "create_assignments",
        {
          _cycle: data.cycle_id,
          _employees: data.employee_ids,
          _idem: data.idempotencyKey,
          _hash: await hashBody(withoutKey(data)),
        },
      ),
    ),
  );

export const saveEvaluation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => saveEvaluationSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("save_evaluation", context.userId, () =>
      rpc(context.supabase, "save_evaluation", {
        _assignment: data.assignment_id,
        _respondent: data.respondent,
        _responses: {
          items: data.responses,
          performance_factors: data.factor_responses,
        },
        _overall_comment: data.overall_comment,
        _expected: data.version,
      }),
    ),
  );

export const submitEvaluation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => submitEvaluationSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("submit_evaluation", context.userId, async () =>
      rpc(context.supabase, "submit_evaluation", {
        _assignment: data.assignment_id,
        _respondent: data.respondent,
        _idem: data.idempotencyKey,
        _hash: await hashBody(withoutKey(data)),
      }),
    ),
  );

export const acknowledgeEvaluation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => acknowledgeEvaluationSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("acknowledge_evaluation", context.userId, async () =>
      rpc(context.supabase, "acknowledge_evaluation", {
        _assignment: data.assignment_id,
        _comment: data.comment ?? "",
        _idem: data.idempotencyKey,
        _hash: await hashBody(withoutKey(data)),
      }),
    ),
  );

export const reviewEvaluation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => reviewEvaluationSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("review_evaluation", context.userId, async () =>
      rpc(context.supabase, "review_evaluation", {
        _assignment: data.assignment_id,
        _decision: data.decision,
        _comments: data.comments,
        _idem: data.idempotencyKey,
        _hash: await hashBody(withoutKey(data)),
        _return_to: data.return_to ?? null,
      }),
    ),
  );

export const reopenEvaluation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => reopenEvaluationSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("reopen_evaluation", context.userId, async () =>
      rpc(context.supabase, "reopen_evaluation", {
        _assignment: data.assignment_id,
        _reason: data.reason,
        _idem: data.idempotencyKey,
        _hash: await hashBody(withoutKey(data)),
      }),
    ),
  );

export const addEvaluationEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    strict({
      assignment_id: uuid,
      file_id: uuid.nullable(),
      note: z.string().max(2000).nullable(),
      item_id: uuid.nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) =>
    runOp("add_evaluation_evidence", context.userId, () =>
      rpc(context.supabase, "add_evaluation_evidence", {
        _assignment: data.assignment_id,
        _file: data.file_id,
        _note: data.note,
        _item: data.item_id,
      }),
    ),
  );

export const addPerformanceFactorEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => addPerformanceFactorEvidenceSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("add_performance_factor_evidence", context.userId, async () =>
      rpc(context.supabase, "add_performance_factor_evidence", {
        _assignment: data.assignment_id,
        _factor_code: data.factor_code,
        _file: data.file_id,
        _note: data.note,
        _idem: data.idempotencyKey,
        _hash: await hashBody(withoutKey(data)),
      }),
    ),
  );

// ---------------- competency ----------------
export const saveCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    strict({
      id: uuid.nullable(),
      name: z.string().trim().min(2).max(80),
      description: z.string().max(1000).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) =>
    runOp("upsert_category", context.userId, () =>
      rpc(context.supabase, "upsert_category", {
        _id: data.id,
        _name: data.name,
        _desc: data.description ?? null,
      }),
    ),
  );

export const saveCompetency = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    strict({
      id: uuid.nullable(),
      version: z.number().int().nullable(),
      data: competencyFields,
    }).parse(d),
  )
  .handler(async ({ data, context }) =>
    runOp("upsert_competency", context.userId, () =>
      rpc<{ id: string }>(context.supabase, "upsert_competency", {
        _id: data.id,
        _d: data.data,
        _version: data.version,
      }),
    ),
  );

export const updateProficiencyLevel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    strict({
      level: z.number().int().min(1).max(5),
      label: z.string().trim().min(2).max(60),
      description: z.string().trim().min(2).max(1000),
      version: z.number().int(),
    }).parse(d),
  )
  .handler(async ({ data, context }) =>
    runOp("update_proficiency_level", context.userId, () =>
      rpc(context.supabase, "update_proficiency_level", {
        _level: data.level,
        _label: data.label,
        _desc: data.description,
        _version: data.version,
      }),
    ),
  );

export const updateSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    strict({
      key: z.string().max(80),
      value: z.union([z.boolean(), z.number(), z.string().max(200)]),
      version: z.number().int(),
    }).parse(d),
  )
  .handler(async ({ data, context }) =>
    runOp("update_setting", context.userId, () =>
      rpc(context.supabase, "update_setting", {
        _key: data.key,
        _value: data.value,
        _version: data.version,
      }),
    ),
  );

export const setRequirement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => requirementSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("set_position_requirement", context.userId, () =>
      rpc(context.supabase, "set_position_requirement", {
        _position: data.position_id,
        _competency: data.competency_id,
        _level: data.required_level,
        _mandatory: data.is_mandatory,
        _safety: data.is_safety_critical,
        _reason: data.reason ?? null,
        _remove: data.remove,
      }),
    ),
  );

export const saveAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => assessmentSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("save_assessment", context.userId, () =>
      rpc<{ id: string; version: number }>(context.supabase, "save_assessment", {
        _id: data.id,
        _employee: data.employee_id,
        _competency: data.competency_id,
        _level: data.current_level,
        _evidence: data.evidence_summary ?? null,
        _comments: data.comments ?? null,
        _reassess: data.is_reassessment,
        _version: data.version,
      }),
    ),
  );

export const addAssessmentEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    strict({
      assessment_id: uuid,
      file_id: uuid.nullable(),
      note: z.string().max(2000).nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) =>
    runOp("add_assessment_evidence", context.userId, () =>
      rpc(context.supabase, "add_assessment_evidence", {
        _assessment: data.assessment_id,
        _file: data.file_id,
        _note: data.note,
      }),
    ),
  );

export const submitAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => strict({ id: uuid, idempotencyKey: uuid }).parse(d))
  .handler(async ({ data, context }) =>
    runOp("submit_assessment", context.userId, async () =>
      rpc(context.supabase, "submit_assessment", {
        _id: data.id,
        _idem: data.idempotencyKey,
        _hash: await hashBody({ id: data.id }),
      }),
    ),
  );

export const reviewAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => reviewAssessmentSchema.parse(d))
  .handler(async ({ data, context }) =>
    runOp("review_assessment", context.userId, async () =>
      rpc(context.supabase, "review_assessment", {
        _id: data.id,
        _decision: data.decision,
        _comments: data.comments,
        _idem: data.idempotencyKey,
        _hash: await hashBody(withoutKey(data)),
      }),
    ),
  );

export const snapshotGaps = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => strict({ employee_id: uuid }).parse(d))
  .handler(async ({ data, context }) =>
    runOp("snapshot_gaps", context.userId, () =>
      rpc(context.supabase, "snapshot_gaps", { _employee: data.employee_id }),
    ),
  );

// ---------------- shared ----------------
export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => strict({ ids: z.array(uuid).max(200).nullable() }).parse(d))
  .handler(async ({ data, context }) =>
    runOp("mark_notifications_read", context.userId, () =>
      rpc(context.supabase, "mark_notifications_read", { _ids: data.ids }),
    ),
  );

export const globalSearch = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => strict({ q: z.string().trim().min(2).max(60) }).parse(d))
  .handler(async ({ data, context }) =>
    runOp("global_search", context.userId, () =>
      rpc<{ kind: string; id: string; label: string; sublabel: string; link: string }[]>(
        context.supabase,
        "global_search",
        { _q: data.q },
      ),
    ),
  );

function sniffMime(b: Uint8Array): string | null {
  const s = (n: number) => Array.from(b.slice(0, n));
  const eq = (arr: number[]) => arr.every((v, i) => b[i] === v);
  if (eq([0x25, 0x50, 0x44, 0x46])) return "application/pdf";
  if (eq([0x89, 0x50, 0x4e, 0x47])) return "image/png";
  if (eq([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (eq([0x50, 0x4b, 0x03, 0x04]))
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  // plain text: no NUL bytes and mostly printable
  const head = s(512);
  if (
    head.length &&
    head.every((c) => c === 9 || c === 10 || c === 13 || (c >= 32 && c !== 127) || c >= 128)
  )
    return "text/plain";
  return null;
}

export const registerFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    strict({
      path: z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}$/),
      name: z.string().min(1).max(255),
      size: z.number().int().min(1).max(MAX_FILE_BYTES),
      employee_id: uuid.nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) =>
    runOp("register_file", context.userId, async () => {
      if (!data.path.startsWith(context.userId + "/")) throw new Error("FORBIDDEN");
      const { data: blob, error } = await context.supabase.storage
        .from("evidence")
        .download(data.path);
      if (error || !blob) throw new Error("NOT_FOUND: upload not found");
      const bytes = new Uint8Array(await blob.slice(0, 512).arrayBuffer());
      const mime = sniffMime(bytes);
      if (
        !mime ||
        !(ALLOWED_MIME as readonly string[]).includes(mime) ||
        blob.size > MAX_FILE_BYTES
      ) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.storage.from("evidence").remove([data.path]);
        throw new Error("INVALID: file type not allowed (PDF, PNG, JPEG, DOCX or plain text only)");
      }
      return rpc<{ id: string }>(context.supabase, "register_file", {
        _path: data.path,
        _name: data.name,
        _mime: mime,
        _size: blob.size,
        _employee: data.employee_id,
      });
    }),
  );

export const getFileUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => strict({ file_id: uuid }).parse(d))
  .handler(async ({ data, context }) =>
    runOp("get_file_url", context.userId, async () => {
      const ok = await rpc<boolean>(context.supabase, "can_access_file", { _file: data.file_id });
      if (!ok) throw new Error("NOT_FOUND");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: f } = await supabaseAdmin
        .from("file_metadata")
        .select("object_path")
        .eq("id", data.file_id)
        .single();
      if (!f) throw new Error("NOT_FOUND");
      const { data: signed, error } = await supabaseAdmin.storage
        .from("evidence")
        .createSignedUrl(f.object_path, 60);
      if (error || !signed) throw new Error("server");
      return { url: signed.signedUrl };
    }),
  );

export const exportAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    strict({
      kind: z.enum(["gaps_csv", "evaluations_csv"]),
      filters: z.record(z.string().max(60)).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) =>
    runOp("log_export", context.userId, () =>
      rpc(context.supabase, "log_audit", {
        _action: "export",
        _table: data.kind,
        _record: null,
        _details: data.filters ?? {},
      }),
    ),
  );
