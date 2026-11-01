import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const migrationsDir = join(root, "supabase", "migrations");
const files = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();

if (files.length < 6) {
  throw new Error(`Expected at least 6 logical SQL migrations; found ${files.length}`);
}

const allSql = [];
let previousVersion = "";
for (const file of files) {
  const match = file.match(/^(\d{14})_[a-z0-9_]+\.sql$/);
  if (!match) throw new Error(`Migration must use Supabase's timestamp_name.sql format: ${file}`);
  if (match[1] <= previousVersion)
    throw new Error(`Migration versions are not strictly increasing at ${file}`);
  previousVersion = match[1];

  const sql = await readFile(join(migrationsDir, file), "utf8");
  if (!sql.trim()) throw new Error(`Migration is empty: ${file}`);
  allSql.push(sql);
}

const config = await readFile(join(root, "supabase", "config.toml"), "utf8");
if (!/\[db\.seed\][\s\S]*?enabled\s*=\s*false/i.test(config))
  throw new Error("Supabase automatic seed execution must remain disabled");

const seed = await readFile(join(root, "scripts", "database", "seed-initial.mjs"), "utf8");
const setup = await readFile(join(root, "scripts", "database", "setup-local.mjs"), "utf8");
if (allSql.some((sql) => /insert\s+into\s+auth\.users/i.test(sql))) {
  throw new Error("Development accounts must remain outside schema migrations");
}
if (files.some((file) => file.startsWith("seed") || file.includes("demo_data"))) {
  throw new Error("Initial seed data must remain outside schema migrations");
}
if (
  /insert\s+into\s+public\.(evaluation_assignments|evaluation_responses|evaluation_factor_responses|evaluation_reviews|competency_assessments|development_plans|course_enrollments|training_attendance|training_results|recognition_nominations|succession_candidates|notifications|approval_tasks)\b/i.test(
    seed,
  )
) {
  throw new Error("Initial seed must not create employee workflow or transaction records");
}
if (!/extensions\.crypt\(\$\{account\.password\},\s*extensions\.gen_salt\('bf'\)\)/i.test(seed)) {
  throw new Error("Initial account passwords must be securely hashed by PostgreSQL");
}
if (
  !/is distinct from excluded\.role/i.test(seed) ||
  !/on conflict \(id\) do nothing/i.test(seed)
) {
  throw new Error("Initial seed must use conflict-aware idempotent writes");
}
if (!/public\._seed_performance_factors\(/i.test(seed)) {
  throw new Error(
    "Initial evaluation profiles must include the complete current set of performance factors",
  );
}
if (
  !/HRMS_SEED_ENV !== "development"/.test(seed) ||
  !/loopbackHosts\.has\(database\.hostname\)/.test(seed)
) {
  throw new Error("Initial seed must require development confirmation and a loopback database");
}
if (!/HRMS_SEED_ENV !== "development"/.test(setup) || !/db:reset:local/.test(setup)) {
  throw new Error(
    "Full local setup must require development confirmation and reset only local Supabase",
  );
}

const sql = allSql.join("\n");
const tables = new Set(
  [...sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z0-9_]+)/gi)].map(
    (match) => match[1],
  ),
);
const rlsTables = new Set(
  [...sql.matchAll(/alter\s+table\s+public\.([a-z0-9_]+)\s+enable\s+row\s+level\s+security/gi)].map(
    (match) => match[1],
  ),
);
for (const match of sql.matchAll(
  /alter\s+table\s+public\.([a-z0-9_]+)\s+enable\s+row\s+level\s+security/gi,
)) {
  rlsTables.add(match[1]);
}
for (const match of sql.matchAll(
  /foreach\s+\w+\s+in\s+array\s+array\[([\s\S]*?)\]\s+loop([\s\S]*?)end\s+loop/gi,
)) {
  if (!/enable\s+row\s+level\s+security/i.test(match[2])) continue;
  for (const table of match[1].matchAll(/'([a-z0-9_]+)'/gi)) rlsTables.add(table[1]);
}
for (const match of sql.matchAll(
  /alter\s+table\s+public\.%I\s+enable\s+row\s+level\s+security['"`]\s*,\s*'([a-z0-9_]+)'/gi,
)) {
  rlsTables.add(match[1]);
}
const missingRls = [...tables].filter((table) => !rlsTables.has(table));
if (missingRls.length)
  throw new Error(`Public tables without RLS enablement: ${missingRls.join(", ")}`);

const functionHeaders = [
  ...sql.matchAll(
    /create\s+(?:or\s+replace\s+)?function\s+public\.[a-z0-9_]+\s*\([\s\S]*?\bas\s+\$\$/gi,
  ),
].map((match) => match[0]);
const insecureDefiners = functionHeaders.filter(
  (header) => /security\s+definer/i.test(header) && !/set\s+search_path\s*=\s*public/i.test(header),
);
if (insecureDefiners.length) {
  throw new Error(
    `${insecureDefiners.length} SECURITY DEFINER function(s) lack a pinned public search_path`,
  );
}

if (/grant\s+(?:insert|update|delete|all)\b[^;]*\bto\s+authenticated/i.test(sql)) {
  throw new Error("Unexpected direct authenticated table-write grant found in migrations");
}

const generatedTypes = await readFile(
  join(root, "src", "integrations", "supabase", "types.ts"),
  "utf8",
);
for (const name of [
  "acknowledged_at",
  "acknowledgement_comment",
  "acknowledge_evaluation",
  "api_patch_course",
  "review_course",
  "approval_status",
  "succession_plans",
  "succession_qualification_requirements",
  "succession_candidate_qualifications",
  "submit_development_plan",
  "review_development_plan",
  "submit_succession_plan",
  "review_succession_plan",
  "due_date",
  "reassessment_due_date",
  "enroll_course",
  "update_ai_settings",
  "my_context",
]) {
  if (!generatedTypes.includes(name)) {
    throw new Error(`Supabase TypeScript definitions are missing database object ${name}`);
  }
}

console.log(
  `Migration source check passed: ${files.length} ordered Supabase SQL migrations, ${tables.size} RLS-protected public tables, ${functionHeaders.length} function definitions; key Supabase types match; automatic seeds are disabled and initial seed data is local-only.`,
);
