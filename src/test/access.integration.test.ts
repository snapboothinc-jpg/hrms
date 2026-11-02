/**
 * Live access checks against the configuration-only development seed.
 * Run only against an isolated staging backend with the staging guard variables set.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL_ = process.env.HRMS_STAGING_SUPABASE_URL ?? "";
const KEY = process.env.HRMS_STAGING_SUPABASE_PUBLISHABLE_KEY ?? "";
const PW = process.env.HRMS_STAGING_ACCOUNT_PASSWORD ?? "";
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

const accounts = {
  superadmin: "seed.superadmin@priority.test",
  admin: "seed.admin@priority.test",
  hr: "seed.hradmin@priority.test",
  depthead: "seed.ops.head@priority.test",
  supervisor: "seed.ops.supervisor@priority.test",
  employee: "seed.ops.employee@priority.test",
};

async function as(email: string, password = PW) {
  const client = createClient(URL_, KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

run("seeded configuration access", () => {
  const clients: Record<keyof typeof accounts, SupabaseClient> = {} as Record<
    keyof typeof accounts,
    SupabaseClient
  >;

  beforeAll(async () => {
    for (const role of Object.keys(accounts) as (keyof typeof accounts)[]) {
      clients[role] = await as(accounts[role]);
    }
  });

  it("creates only the requested organization and master configuration", async () => {
    const [departments, employees, positions, categories, requirements, profiles, factors] =
      await Promise.all([
        clients.hr.from("departments").select("name"),
        clients.hr.from("employees").select("email"),
        clients.hr.from("positions").select("id"),
        clients.hr.from("job_categories").select("id"),
        clients.hr.from("position_competency_requirements").select("id"),
        clients.hr.from("evaluation_profile_versions").select("rating_scale_max, status"),
        clients.hr.from("evaluation_profile_factors").select("id"),
      ]);

    expect(departments.error).toBeNull();
    expect(departments.data?.map((row) => row.name).sort()).toEqual(
      [
        "Administration",
        "Finance & Accounting",
        "Human Resources",
        "Information Technology",
        "Operations",
      ].sort(),
    );
    expect(employees.data).toHaveLength(15);
    expect(positions.data).toHaveLength(20);
    expect(categories.data).toHaveLength(11);
    expect(requirements.data).toHaveLength(160);
    expect(profiles.data).toHaveLength(20);
    expect(
      profiles.data?.every(
        (profile) => profile.rating_scale_max === 5 && profile.status === "active",
      ),
    ).toBe(true);
    expect(factors.data).toHaveLength(200);
  });

  it("seeds no business transactions", async () => {
    const results = await Promise.all([
      clients.hr.from("evaluation_cycles").select("id"),
      clients.hr.from("evaluation_assignments").select("id"),
      clients.hr.from("evaluation_submissions").select("id"),
      clients.hr.from("competency_assessments").select("id"),
      clients.hr.from("approval_tasks").select("id"),
      clients.hr.from("training_sessions").select("id"),
      clients.hr.from("notifications").select("id"),
    ]);

    for (const result of results) {
      expect(result.error).toBeNull();
      expect(result.data).toEqual([]);
    }
  });

  it("limits employees to self, direct reports, or department scope", async () => {
    const own = await clients.employee
      .from("employees")
      .select("id, email")
      .eq("email", accounts.employee);
    const hiddenEmployee = await clients.employee
      .from("employees")
      .select("id")
      .eq("email", "seed.hr.employee@priority.test");
    const directReport = await clients.supervisor
      .from("employees")
      .select("id")
      .eq("email", accounts.employee);
    const outsideDepartment = await clients.supervisor
      .from("employees")
      .select("id")
      .eq("email", "seed.hr.employee@priority.test");
    const operationsDepartment = await clients.depthead
      .from("departments")
      .select("id")
      .eq("name", "Operations")
      .single();
    const departmentEmployees = await clients.depthead
      .from("employees")
      .select("id")
      .eq("department_id", operationsDepartment.data?.id ?? "");

    expect(own.data).toHaveLength(1);
    expect(hiddenEmployee.data).toEqual([]);
    expect(directReport.data).toHaveLength(1);
    expect(outsideDepartment.data).toEqual([]);
    expect(departmentEmployees.data).toHaveLength(3);
  });

  it("assigns the supervisor-to-HR approval permissions without creating tasks", async () => {
    const [supervisorContext, headContext, hrContext] = await Promise.all([
      clients.supervisor.rpc("my_context"),
      clients.depthead.rpc("my_context"),
      clients.hr.rpc("my_context"),
    ]);
    expect((supervisorContext.data as { permissions: string[] }).permissions).toContain(
      "perf.evaluate",
    );
    expect((headContext.data as { permissions: string[] }).permissions).toContain("perf.approve");
    expect((hrContext.data as { permissions: string[] }).permissions).toContain("perf.approve");
  });

  it.skipIf(!ungrantedHeadEmail || !ungrantedHeadPassword)(
    "an ungranted Department Head cannot access scoped succession records",
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
});
