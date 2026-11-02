import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.HRMS_STAGING_SUPABASE_URL ?? "";
const key = process.env.HRMS_STAGING_SUPABASE_PUBLISHABLE_KEY ?? "";
const password = process.env.HRMS_STAGING_ACCOUNT_PASSWORD ?? "";
const operationsEmail = process.env.HRMS_STAGING_OPERATIONS_EMAIL ?? "";
const employeeEmail = process.env.HRMS_STAGING_EMPLOYEE_EMAIL ?? "seed.ops.employee@priority.test";
const supervisorEmail =
  process.env.HRMS_STAGING_SUPERVISOR_EMAIL ?? "seed.ops.supervisor@priority.test";
const hrEmail = process.env.HRMS_STAGING_HR_EMAIL ?? "seed.hradmin@priority.test";
const fixtures = {
  acknowledgement: process.env.HRMS_STAGING_ACK_ASSIGNMENT_ID ?? "",
  patch: process.env.HRMS_STAGING_PATCH_COURSE_ID ?? "",
  approve: process.env.HRMS_STAGING_COURSE_APPROVE_ID ?? "",
  return: process.env.HRMS_STAGING_COURSE_RETURN_ID ?? "",
  selfApproval: process.env.HRMS_STAGING_COURSE_SELF_APPROVAL_ID ?? "",
};
const configured =
  process.env.RUN_ACCESS_TESTS === "1" &&
  process.env.HRMS_TEST_ENV === "staging" &&
  url &&
  key &&
  password &&
  operationsEmail &&
  Object.values(fixtures).every(Boolean);
const stagingDescribe = configured ? describe : describe.skip;

async function login(email: string): Promise<SupabaseClient> {
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

async function sha256(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(value)),
  );
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

stagingDescribe("HRMS remediation workflows (isolated staging only)", () => {
  let employee: SupabaseClient;
  let supervisor: SupabaseClient;
  let operations: SupabaseClient;
  let hr: SupabaseClient;

  beforeAll(async () => {
    [employee, supervisor, operations, hr] = await Promise.all([
      login(employeeEmail),
      login(supervisorEmail),
      login(operationsEmail),
      login(hrEmail),
    ]);
  });

  it("allows only the linked employee to acknowledge a finalized evaluation without changing its result", async () => {
    const assignmentId = fixtures.acknowledgement;
    const before = await employee
      .from("evaluation_assignments")
      .select("status, overall_score, acknowledged_at")
      .eq("id", assignmentId)
      .single();
    expect(before.error).toBeNull();
    expect(before.data?.status).toBe("approved");
    expect(before.data?.acknowledged_at).toBeNull();

    const comment = "Acknowledged for staging verification.";
    const idempotencyKey = crypto.randomUUID();
    const request = { assignment_id: assignmentId, comment };
    const requestHash = await sha256(request);

    const unauthorized = await supervisor.rpc("acknowledge_evaluation", {
      _assignment: assignmentId,
      _comment: comment,
      _idem: crypto.randomUUID(),
      _hash: requestHash,
    } as never);
    expect(unauthorized.error?.message).toMatch(/NOT_FOUND/);

    const acknowledged = await employee.rpc("acknowledge_evaluation", {
      _assignment: assignmentId,
      _comment: comment,
      _idem: idempotencyKey,
      _hash: requestHash,
    } as never);
    expect(acknowledged.error).toBeNull();
    const after = await employee
      .from("evaluation_assignments")
      .select("status, overall_score, acknowledged_at, acknowledged_by, acknowledgement_comment")
      .eq("id", assignmentId)
      .single();
    const user = await employee.auth.getUser();
    expect(after.error).toBeNull();
    expect(after.data?.status).toBe("approved");
    expect(after.data?.overall_score).toBe(before.data?.overall_score);
    expect(after.data?.acknowledged_at).toBeTruthy();
    expect(after.data?.acknowledged_by).toBe(user.data.user?.id);
    expect(after.data?.acknowledgement_comment).toBe(comment);
    const history = await employee
      .from("evaluation_reviews")
      .select("decision, comments")
      .eq("assignment_id", assignmentId)
      .eq("decision", "acknowledged");
    expect(history.error).toBeNull();
    expect(history.data?.some((entry) => entry.comments === comment)).toBe(true);

    const replay = await employee.rpc("acknowledge_evaluation", {
      _assignment: assignmentId,
      _comment: comment,
      _idem: idempotencyKey,
      _hash: requestHash,
    } as never);
    expect(replay.error).toBeNull();
    expect(replay.data).toEqual(acknowledged.data);
  });

  it("preserves omitted PATCH fields, replays identical requests, rejects conflicts, and detects stale versions", async () => {
    const id = fixtures.patch;
    const current = await operations
      .from("courses")
      .select("id, title, description, status, duration_minutes, version")
      .eq("id", id)
      .single();
    expect(current.error).toBeNull();
    expect(["draft", "pending_review"]).toContain(current.data?.status);

    const patch = { title: `${current.data!.title} staging update` };
    const idempotencyKey = crypto.randomUUID();
    const requestHash = await sha256({
      id,
      expected_version: current.data!.version,
      patch,
    });
    const params = {
      _id: id,
      _patch: patch,
      _expected_version: current.data!.version,
      _idem: idempotencyKey,
      _hash: requestHash,
    };

    const first = await operations.rpc("api_patch_course", params as never);
    expect(first.error).toBeNull();
    expect(first.data).toMatchObject({
      title: patch.title,
      description: current.data!.description,
      duration_minutes: current.data!.duration_minutes,
    });

    const replay = await operations.rpc("api_patch_course", params as never);
    expect(replay.error).toBeNull();
    expect(replay.data).toEqual(first.data);

    const conflict = await operations.rpc("api_patch_course", {
      ...params,
      _patch: { title: `${patch.title} conflict` },
      _hash: await sha256({
        id,
        expected_version: current.data!.version,
        patch: { title: `${patch.title} conflict` },
      }),
    } as never);
    expect(conflict.error?.message).toMatch(/IDEMPOTENCY_CONFLICT/);

    const stale = await operations.rpc("api_patch_course", {
      ...params,
      _idem: crypto.randomUUID(),
      _hash: requestHash,
    } as never);
    expect(stale.error?.message).toMatch(/CONFLICT/);
  });

  it.each([
    ["approve", fixtures.approve, "approved", "approved"],
    ["return", fixtures.return, "draft", "rejected"],
  ] as const)(
    "submits a course and applies the %s publication decision transactionally",
    async (decision, id, expectedCourseStatus, expectedTaskStatus) => {
      const startedAt = new Date().toISOString();
      const submitKey = crypto.randomUUID();
      const submitted = await operations.rpc("submit_course", {
        _id: id,
        _idem: submitKey,
        _hash: await sha256({ id }),
      } as never);
      expect(submitted.error).toBeNull();

      const task = await hr
        .from("approval_tasks")
        .select("id, status")
        .eq("workflow_type", "course_publication")
        .eq("record_id", id)
        .eq("status", "pending")
        .single();
      expect(task.error).toBeNull();

      const comments = `Staging ${decision} verification`;
      const reviewKey = crypto.randomUUID();
      const reviewHash = await sha256({ id, decision, comments });
      const reviewParams = {
        _id: id,
        _decision: decision,
        _comments: comments,
        _idem: reviewKey,
        _hash: reviewHash,
      };
      const unauthorized = await employee.rpc("review_course", {
        ...reviewParams,
        _idem: crypto.randomUUID(),
      } as never);
      expect(unauthorized.error?.message).toMatch(/FORBIDDEN/);

      const review = await hr.rpc("review_course", reviewParams as never);
      expect(review.error).toBeNull();
      expect(review.data).toMatchObject({ id, status: expectedCourseStatus });

      const replay = await hr.rpc("review_course", reviewParams as never);
      expect(replay.error).toBeNull();
      expect(replay.data).toEqual(review.data);

      const conflict = await hr.rpc("review_course", {
        ...reviewParams,
        _decision: decision === "approve" ? "return" : "approve",
        _hash: await sha256({
          id,
          decision: decision === "approve" ? "return" : "approve",
          comments,
        }),
      } as never);
      expect(conflict.error?.message).toMatch(/IDEMPOTENCY_CONFLICT/);

      const course = await hr.from("courses").select("status").eq("id", id).single();
      const updatedTask = await hr
        .from("approval_tasks")
        .select("status")
        .eq("id", task.data!.id)
        .single();
      expect(course.data?.status).toBe(expectedCourseStatus);
      expect(updatedTask.data?.status).toBe(expectedTaskStatus);
      const employeeVisibility = await employee
        .from("courses")
        .select("id")
        .eq("id", id)
        .maybeSingle();
      expect(employeeVisibility.error).toBeNull();
      expect(employeeVisibility.data?.id ?? null).toBe(
        expectedCourseStatus === "approved" ? id : null,
      );

      const hrUser = await hr.auth.getUser();
      const submitNotification = await hr
        .from("notifications")
        .select("id")
        .eq("user_id", hrUser.data.user!.id)
        .eq("title", "Course awaiting approval")
        .eq("link", "/approvals")
        .gte("created_at", startedAt)
        .limit(1);
      expect(submitNotification.error).toBeNull();
      expect(submitNotification.data?.length).toBeGreaterThan(0);

      const operationsUser = await operations.auth.getUser();
      const decisionNotification = await operations
        .from("notifications")
        .select("id")
        .eq("user_id", operationsUser.data.user!.id)
        .eq("title", decision === "approve" ? "Course approved" : "Course returned")
        .eq("link", "/learning/manage")
        .gte("created_at", startedAt)
        .limit(1);
      expect(decisionNotification.error).toBeNull();
      expect(decisionNotification.data?.length).toBeGreaterThan(0);
    },
  );

  it("prevents an authorized HR reviewer from approving their own submission", async () => {
    const id = fixtures.selfApproval;
    const submitted = await hr.rpc("submit_course", {
      _id: id,
      _idem: crypto.randomUUID(),
      _hash: await sha256({ id }),
    } as never);
    expect(submitted.error).toBeNull();

    const comments = "Self-approval denial verification";
    const review = await hr.rpc("review_course", {
      _id: id,
      _decision: "approve",
      _comments: comments,
      _idem: crypto.randomUUID(),
      _hash: await sha256({ id, decision: "approve", comments }),
    } as never);
    expect(review.error?.message).toMatch(/FORBIDDEN/);

    const course = await hr.from("courses").select("status").eq("id", id).single();
    const task = await hr
      .from("approval_tasks")
      .select("status")
      .eq("workflow_type", "course_publication")
      .eq("record_id", id)
      .eq("status", "pending")
      .single();
    expect(course.data?.status).toBe("pending_review");
    expect(task.data?.status).toBe("pending");
  });
});
