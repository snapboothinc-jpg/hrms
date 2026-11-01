import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const passwordKeys = [
  "HRMS_DEV_SUPER_ADMIN_PASSWORD",
  "HRMS_DEV_ADMIN_PASSWORD",
  "HRMS_DEV_HR_ADMIN_PASSWORD",
  "HRMS_DEV_DEPT_HEAD_PASSWORD",
  "HRMS_DEV_SUPERVISOR_PASSWORD",
  "HRMS_DEV_EMPLOYEE_PASSWORD",
  "HRMS_DEV_OPS_MANAGER_PASSWORD",
];
const loopbackHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

if (process.env.HRMS_SEED_ENV !== "development") {
  throw new Error("Set HRMS_SEED_ENV=development to confirm a local development setup");
}
const passwords = passwordKeys.map((key) => {
  const value = process.env[key];
  if (!value || value.length < 12) {
    throw new Error(`${key} must be set to a development password of at least 12 characters`);
  }
  return value;
});
if (new Set(passwords).size !== passwords.length) {
  throw new Error("Use a distinct development password for each seeded account");
}
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("Set DATABASE_URL to the local Supabase PostgreSQL connection string");
}
if (!loopbackHosts.has(new URL(databaseUrl).hostname)) {
  throw new Error("Refusing to reset or seed a non-local database");
}
const authApiUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const publishableKey =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;
if (!authApiUrl || !publishableKey) {
  throw new Error(
    "Set the local Supabase URL and publishable key before resetting the local database",
  );
}
if (!loopbackHosts.has(new URL(authApiUrl).hostname)) {
  throw new Error("Refusing to send development credentials to a non-local Supabase Auth API");
}

console.log("Resetting only the local Supabase database and applying repository migrations...");
const reset = spawnSync(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["run", "db:reset:local"],
  {
    cwd: root,
    env: process.env,
    stdio: "inherit",
    shell: process.platform === "win32",
  },
);
if (reset.error) throw reset.error;
if (reset.status !== 0) process.exit(reset.status ?? 1);

console.log("Seeding the initial HRMS system configuration...");
const seed = spawnSync(process.execPath, ["scripts/database/seed-initial.mjs"], {
  cwd: root,
  env: process.env,
  stdio: "inherit",
});
if (seed.error) throw seed.error;
if (seed.status !== 0) process.exit(seed.status ?? 1);
