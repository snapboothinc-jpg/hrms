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

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const seedFile = join(root, "drizzle", "seeds", "demo.sql");
const result = spawnSync("psql", [databaseUrl, "-v", "ON_ERROR_STOP=1", "-f", seedFile], {
  stdio: "inherit",
});

if (result.error) throw result.error;
if (result.status !== 0) {
  process.exitCode = result.status ?? 1;
}
