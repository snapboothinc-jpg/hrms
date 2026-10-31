/**
 * Live access tests against the backend, signing in as each demo role.
 * Run only against an isolated staging backend with HRMS_TEST_ENV=staging and
 * the HRMS_STAGING_* variables configured. The suite mutates demo records.
 */
import { describe, expect, it, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL_ = process.env.HRMS_STAGING_SUPABASE_URL ?? "";
const KEY = process.env.HRMS_STAGING_SUPABASE_PUBLISHABLE_KEY ?? "";
const PW = process.env.HRMS_STAGING_DEMO_PASSWORD ?? "";
const ungrantedHeadEmail = process.env.HRMS_STAGING_UNGRANTED_DEPT_HEAD_EMAIL;
const ungrantedHeadPassword = process.env.HRMS_STAGING_UNGRANTED_DEPT_HEAD_PASSWORD;
const run =
  process.env.RUN_ACCESS_TESTS === "1" &&
  process.env.HRMS_TEST_ENV === "staging" &&
  URL_ &&
  KEY &&
  PW
    ? describe
    : describe.skip;

const ANA = "00000000-0000-4000-d000-000000000003"; // employee
const PAOLO = "00000000-0000-4000-d000-000000000004"; // supervisor's report
const VICTOR = "00000000-0000-4000-d000-000000000007"; // same department, outside the supervisor's reporting line
const SAFETY = "00000000-0000-4000-f000-000000000001";
const DEMO_EMAILS: Record<string, string> = {
  superadmin: "victor.superadmin+priority@gmail.com",
  admin: "nina.admin+priority@gmail.com",
  hr: "liza.hradmin+priority@gmail.com",
  depthead: "maria.depthead+priority@gmail.com",
  supervisor: "jose.supervisor+priority@gmail.com",
  employee: "ana.employee+priority@gmail.com",
  ops: "carlo.opsmanager+priority@gmail.com",
};

async function as(email: string, password = PW) {
  const c = createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return c;
}

run("role access", () => {
  const c: Record<string, SupabaseClient> = {};
  beforeAll(async () => {
    for (const r of Object.keys(DEMO_EMAILS)) c[r] = await as(DEMO_EMAILS[r]);
  });

  it("1. employee cannot read another employee's evaluation or assessment", async () => {
    const ev = await c.employee
      .from("evaluation_assignments")
      .select("id")
      .eq("employee_id", PAOLO);
    expect(ev.data).toEqual([]);
    const as_ = await c.employee
      .from("competency_assessments")
      .select("id")
      .eq("employee_id", PAOLO);
    expect(as_.data).toEqual([]);
    const own = await c.employee.from("evaluation_assignments").select("id").eq("employee_id", ANA);
    expect(own.data?.length).toBe(1);
  });

  it("2. supervisor cannot see employees outside their reporting line", async () => {
    const r = await c.supervisor.from("employees").select("id").eq("id", VICTOR);
    expect(r.data).toEqual([]);
    const ok = await c.supervisor.from("employees").select("id").eq("id", PAOLO);
    expect(ok.data?.length).toBe(1);
    const w = await c.supervisor.rpc("save_assessment", {
      _id: null,
      _employee: VICTOR,
      _competency: SAFETY,
      _level: 3,
      _evidence: "x",
      _comments: null,
      _reassess: false,
      _version: null,
    } as never);
    expect(w.error?.message).toMatch(/NOT_FOUND/);
  });

  it("3. all seeded employees belong to the single Logistics Department", async () => {
    const [departments, employees] = await Promise.all([
      c.depthead.from("departments").select("id, name"),
      c.depthead.from("employees").select("department_id"),
    ]);
    expect(departments.error).toBeNull();
    expect(departments.data).toEqual([
      { id: "00000000-0000-4000-b000-000000000001", name: "Logistics Department" },
    ]);
    expect(employees.error).toBeNull();
    expect(new Set(employees.data?.map((employee) => employee.department_id))).toEqual(
      new Set(["00000000-0000-4000-b000-000000000001"]),
    );
  });

  it("succession access is explicitly granted and restricted to that Department Head's department", async () => {
    const [context, grants, departments] = await Promise.all([
      c.depthead.rpc("my_context"),
      c.depthead.from("succession_access_grants").select("department_id"),
      c.depthead.from("departments").select("id"),
    ]);
    expect(context.error).toBeNull();
    expect((context.data as { permissions: string[] }).permissions).toContain("succession.dept");
    const departmentId = grants.data?.[0]?.department_id;
    expect(departmentId).toBeTruthy();

    const inScope = await c.depthead
      .from("critical_positions")
      .select("id")
      .eq("department_id", departmentId!);
    expect(inScope.error).toBeNull();
    expect(inScope.data?.length).toBeGreaterThan(0);

    expect(departments.data).toHaveLength(1);

    const employeeRows = await c.employee.from("critical_positions").select("id");
    expect(employeeRows.error).toBeNull();
    expect(employeeRows.data).toEqual([]);
  });

  it.skipIf(!ungrantedHeadEmail || !ungrantedHeadPassword)(
    "an ungranted Department Head cannot discover or read succession records",
    async () => {
      const ungranted = await as(ungrantedHeadEmail!, ungrantedHeadPassword!);
      const context = await ungranted.rpc("my_context");
      expect(context.error).toBeNull();
      expect((context.data as { role: string }).role).toBe("dept_head");
      expect((context.data as { permissions: string[] }).permissions).not.toContain(
        "succession.dept",
      );
      const records = await ungranted.from("critical_positions").select("id");
      expect(records.error).toBeNull();
      expect(records.data).toEqual([]);
    },
  );

  it("4. non-authorized user calling an approval action is denied", async () => {
    const { data } = await c.hr
      .from("evaluation_assignments")
      .select("id")
      .eq("employee_id", ANA)
      .single();
    const r = await c.supervisor.rpc("review_evaluation", {
      _assignment: data!.id,
      _decision: "approve",
      _comments: "",
      _idem: null,
      _hash: "",
    } as never);
    expect(r.error?.message).toMatch(/FORBIDDEN/);
  });

  it("5. super admin cannot approve a performance evaluation", async () => {
    const r = await c.superadmin.rpc("review_evaluation", {
      _assignment: "00000000-0000-0000-0000-000000000000",
      _decision: "approve",
      _comments: "",
      _idem: null,
      _hash: "",
    } as never);
    expect(r.error?.message).toMatch(/FORBIDDEN/);
    const read = await c.superadmin.from("evaluation_assignments").select("id");
    expect(read.data).toEqual([]);
  });

  it("6. an assessor cannot approve their own assessment", async () => {
    const { data } = await c.depthead
      .from("competency_assessments")
      .select("id, assessor_id")
      .eq("employee_id", ANA)
      .limit(1);
    // demo assessments were made by the supervisor and are approved; check separation rule directly
    expect(data?.length).toBeGreaterThan(0);
    const r = await c.supervisor.rpc("review_assessment", {
      _id: data![0].id,
      _decision: "approve",
      _comments: "",
      _idem: null,
      _hash: "",
    } as never);
    expect(r.error?.message).toMatch(/FORBIDDEN/);
  });

  it("7. search never returns restricted employees", async () => {
    const r = await c.employee.rpc("global_search", { _q: "Victor" } as never);
    expect((r.data as { kind: string }[]).filter((x) => x.kind === "employee")).toEqual([]);
    const s = await c.supervisor.rpc("global_search", { _q: "Ramos" } as never);
    expect((s.data as { kind: string }[]).filter((x) => x.kind === "employee")).toEqual([]);
  });

  it("8. anonymous requests are denied", async () => {
    const anon = createClient(URL_, KEY, { auth: { persistSession: false } });
    const r = await anon.rpc("my_context");
    expect(r.error).toBeTruthy();
    const t = await anon.from("employees").select("id");
    expect(t.data ?? []).toEqual([]);
  });

  it("audit log is append-only", async () => {
    const r = await c.admin
      .from("audit_logs")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    const after = await c.admin.from("audit_logs").select("id", { count: "exact", head: true });
    expect(r.error || (after.count ?? 0) > 0).toBeTruthy();
  });

  it("active evaluation profile weights total 100", async () => {
    const items = await c.hr
      .from("evaluation_items")
      .select("weight")
      .eq("version_id", "00000000-0000-4000-9100-000000000001");
    expect(items.error).toBeNull();
    expect(items.data?.reduce((total, item) => total + item.weight, 0)).toBe(100);
  });

  it("idempotent replay returns the same result; a different body conflicts", async () => {
    const key = crypto.randomUUID();
    const { data: cyc } = await c.hr.from("evaluation_cycles").select("id").limit(1).single();
    const a = await c.hr.rpc("create_assignments", {
      _cycle: cyc!.id,
      _employees: [VICTOR],
      _idem: key,
      _hash: "h1",
    } as never);
    const b = await c.hr.rpc("create_assignments", {
      _cycle: cyc!.id,
      _employees: [VICTOR],
      _idem: key,
      _hash: "h1",
    } as never);
    expect(b.data).toEqual(a.data);
    const d = await c.hr.rpc("create_assignments", {
      _cycle: cyc!.id,
      _employees: [ANA],
      _idem: key,
      _hash: "h2",
    } as never);
    expect(d.error?.message).toMatch(/IDEMPOTENCY_CONFLICT/);
  });

  it("stale version returns a conflict", async () => {
    const { data: e } = await c.hr.from("employees").select("*").eq("id", PAOLO).single();
    const body = {
      employee_code: e!.employee_code,
      first_name: e!.first_name,
      last_name: e!.last_name,
      department_id: e!.department_id,
      position_id: e!.position_id,
      employment_status: e!.employment_status,
    };
    const ok = await c.hr.rpc("upsert_employee", {
      _id: PAOLO,
      _d: body,
      _version: e!.version,
    } as never);
    expect(ok.error).toBeNull();
    const stale = await c.hr.rpc("upsert_employee", {
      _id: PAOLO,
      _d: body,
      _version: e!.version,
    } as never);
    expect(stale.error?.message).toMatch(/CONFLICT/);
  });

  it("gap closes only after an approved reassessment with evidence", async () => {
    const before = (await c.supervisor.rpc("competency_gaps", { _employee: PAOLO } as never))
      .data as { competency_id: string; gap_status: string; current_level: number | null }[];
    expect(before.find((g) => g.competency_id === SAFETY)?.gap_status).toBe("gap");
    const noEvidence = await c.supervisor.rpc("save_assessment", {
      _id: null,
      _employee: PAOLO,
      _competency: SAFETY,
      _level: 3,
      _evidence: null,
      _comments: null,
      _reassess: true,
      _version: null,
    } as never);
    expect(noEvidence.error).toBeNull();
    const id = (noEvidence.data as { id: string }).id;
    const sub1 = await c.supervisor.rpc("submit_assessment", {
      _id: id,
      _idem: null,
      _hash: "",
    } as never);
    expect(sub1.error?.message).toMatch(/evidence is required/);
    const v = (noEvidence.data as { version: number }).version;
    await c.supervisor.rpc("save_assessment", {
      _id: id,
      _employee: PAOLO,
      _competency: SAFETY,
      _level: 3,
      _evidence: "Observed 5 compliant load checks after refresher",
      _comments: null,
      _reassess: true,
      _version: v,
    } as never);
    const sub = await c.supervisor.rpc("submit_assessment", {
      _id: id,
      _idem: null,
      _hash: "",
    } as never);
    expect(sub.error).toBeNull();
    const still = (await c.supervisor.rpc("competency_gaps", { _employee: PAOLO } as never))
      .data as { competency_id: string; gap_status: string }[];
    expect(still.find((g) => g.competency_id === SAFETY)?.gap_status).toBe("gap");
    const ap = await c.depthead.rpc("review_assessment", {
      _id: id,
      _decision: "approve",
      _comments: "Verified",
      _idem: null,
      _hash: "",
    } as never);
    expect(ap.error).toBeNull();
    const after = (await c.supervisor.rpc("competency_gaps", { _employee: PAOLO } as never))
      .data as { competency_id: string; gap_status: string; current_level: number }[];
    expect(after.find((g) => g.competency_id === SAFETY)).toMatchObject({
      gap_status: "met",
      current_level: 3,
    });
  });
});
