import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

if (process.env.HRMS_SEED_ENV !== "development") {
  throw new Error(
    "Set HRMS_SEED_ENV=development to confirm this is an isolated development database",
  );
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required to seed demo fixtures");

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const seedFile = join(root, "supabase", "seeds", "development", "demo.sql");
const database = new URL(databaseUrl);
const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
if (
  !localHosts.has(database.hostname) &&
  process.env.HRMS_SEED_REMOTE_CONFIRM !== database.hostname
) {
  throw new Error(
    `Refusing to seed remote host ${database.hostname}; set HRMS_SEED_REMOTE_CONFIRM to that exact host only for an isolated development database`,
  );
}
const result = spawnSync("psql", [databaseUrl, "-v", "ON_ERROR_STOP=1", "-f", seedFile], {
  stdio: "inherit",
});

if (result.error) throw result.error;
if (result.status !== 0) {
  process.exitCode = result.status ?? 1;
}
