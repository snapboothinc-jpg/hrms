/**
 * Initial-system access checks against an isolated staging Supabase project.
 * Run only with RUN_ACCESS_TESTS=1 and HRMS_TEST_ENV=staging.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.HRMS_STAGING_SUPABASE_URL ?? "";
const key = process.env.HRMS_STAGING_SUPABASE_PUBLISHABLE_KEY ?? "";
const accounts = [
  ["super_admin", "super-admin@hrms.test", "admin.roles"],
  ["admin", "admin@hrms.test", "admin.users"],
  ["hr_admin", "hr-admin@hrms.test", "perf.approve"],
  ["dept_head", "department-head@hrms.test", "team.view"],
  ["supervisor", "supervisor@hrms.test", "perf.evaluate"],
  ["employee", "employee@hrms.test", "self.service"],
  ["ops_manager", "operations-manager@hrms.test", "train.manage"],
].map(([role, defaultEmail, permission]) => ({
  role,
  permission,
  email: process.env[`HRMS_STAGING_${role.toUpperCase()}_EMAIL`] ?? defaultEmail,
  password: process.env[`HRMS_STAGING_${role.toUpperCase()}_PASSWORD`] ?? "",
}));

const run =
  process.env.RUN_ACCESS_TESTS === "1" &&
  process.env.HRMS_TEST_ENV === "staging" &&
  url &&
  key &&
  accounts.every((account) => account.password)
    ? describe
    : describe.skip;

const DEPARTMENT = "00000000-0000-4000-b000-000000000001";
const SUPERVISOR = "00000000-0000-4000-d000-000000000001";
const EMPLOYEE = "00000000-0000-4000-d000-000000000002";
const EMPLOYEE_VERSION = "00000000-0000-4000-9100-000000000001";

run("initial development system", () => {
  const clients: Record<string, SupabaseClient> = {};

  beforeAll(async () => {
    for (const account of accounts) {
      const client = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error } = await client.auth.signInWithPassword({
        email: account.email,
        password: account.password,
      });
      if (error) throw error;
      clients[account.role] = client;
    }
  });

  it("authenticates one configured account for each supported role", async () => {
    for (const account of accounts) {
      const { data, error } = await clients[account.role].rpc("my_context");
      expect(error, account.role).toBeNull();
      expect((data as { role: string }).role).toBe(account.role);
      expect((data as { permissions: string[] }).permissions).toContain(account.permission);
    }
  });

  it("contains one Operations department, two positions, and the supervisor-report relationship", async () => {
    const [departments, positions, supervisor, employee, reports, visible] = await Promise.all([
      clients.employee.from("departments").select("id, name"),
      clients.employee.from("positions").select("id, title").order("code"),
      clients.supervisor.from("employees").select("id, department_id").eq("id", SUPERVISOR),
      clients.employee.from("employees").select("id, department_id").eq("id", EMPLOYEE),
      clients.supervisor
        .from("reporting_relationships")
        .select("employee_id, supervisor_id, is_current")
        .eq("employee_id", EMPLOYEE)
        .eq("is_current", true),
      clients.supervisor.from("employees").select("id").eq("id", EMPLOYEE),
    ]);

    expect(departments.error).toBeNull();
    expect(departments.data).toEqual([{ id: DEPARTMENT, name: "Operations" }]);
    expect(positions.error).toBeNull();
    expect(positions.data?.map(({ title }) => title).sort()).toEqual([
      "Logistics Coordinator",
      "Operations Supervisor",
    ]);
    expect(supervisor.data).toHaveLength(1);
    expect(employee.data).toHaveLength(1);
    expect(supervisor.data?.[0].department_id).toBe(DEPARTMENT);
    expect(employee.data?.[0].department_id).toBe(DEPARTMENT);
    expect(reports.data).toEqual([
      { employee_id: EMPLOYEE, supervisor_id: SUPERVISOR, is_current: true },
    ]);
    expect(visible.data).toHaveLength(1);
  });

  it("has active performance profiles with all ten factors and configurable KPI entries", async () => {
    const [profiles, factors, kpis, cycles, assignments, assessments] = await Promise.all([
      clients.hr_admin
        .from("evaluation_profile_versions")
        .select("id, status, rating_scale_max, scoring_method")
        .in("id", [EMPLOYEE_VERSION, "00000000-0000-4000-9100-000000000002"]),
      clients.hr_admin
        .from("evaluation_profile_factors")
        .select("factor_code")
        .eq("version_id", EMPLOYEE_VERSION),
      clients.hr_admin
        .from("evaluation_items")
        .select("label, kpi_target, weight")
        .eq("version_id", EMPLOYEE_VERSION)
        .eq("item_type", "kpi"),
      clients.hr_admin.from("evaluation_cycles").select("id"),
      clients.hr_admin.from("evaluation_assignments").select("id"),
      clients.hr_admin.from("competency_assessments").select("id"),
    ]);

    expect(profiles.error).toBeNull();
    expect(profiles.data).toHaveLength(2);
    expect(profiles.data?.every((profile) => profile.status === "active")).toBe(true);
    expect(profiles.data?.every((profile) => profile.rating_scale_max === 5)).toBe(true);
    expect(profiles.data?.every((profile) => profile.scoring_method === "equal")).toBe(true);
    expect(factors.error).toBeNull();
    expect(factors.data).toHaveLength(10);
    expect(kpis.error).toBeNull();
    expect(kpis.data).toHaveLength(5);
    expect(kpis.data?.every((item) => item.kpi_target === null && item.weight === 0)).toBe(true);
    expect(cycles.data).toEqual([]);
    expect(assignments.data).toEqual([]);
    expect(assessments.data).toEqual([]);
  });

  it("keeps employee data private from a different employee account", async () => {
    const { data, error } = await clients.employee
      .from("employees")
      .select("id")
      .eq("id", SUPERVISOR);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
