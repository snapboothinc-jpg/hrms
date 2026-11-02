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
if (!/\[db\.seed\]\s*enabled\s*=\s*false/i.test(config))
  throw new Error("Supabase automatic seed execution must remain disabled");

const seed = await readFile(join(root, "supabase", "seeds", "development", "demo.sql"), "utf8");
if (!/insert\s+into\s+auth\.users/i.test(seed))
  throw new Error("Demo seed must retain its auth fixtures");
if (allSql.some((sql) => /insert\s+into\s+auth\.users/i.test(sql))) {
  throw new Error("Demo accounts must remain outside automatic schema migrations");
}
if (files.some((file) => file.startsWith("seed") || file.includes("demo_data"))) {
  throw new Error("General-purpose seed data must remain outside production migrations");
}
if (!/crypt\('Test1234!'/i.test(seed)) {
  throw new Error("All demo accounts must use the standardized development password");
}
if (
  !/Demo fixtures partially exist; refusing to overwrite or duplicate existing records/.test(seed)
) {
  throw new Error("Demo seed must abort rather than overwrite or duplicate partial fixtures");
}
if (!/perform\s+public\._seed_performance_factors\(/i.test(seed)) {
  throw new Error(
    "Demo evaluation profile must include the complete current set of performance factors",
  );
}

const accountsBlock = seed.match(
  /select\s+\*\s+from\s+\(values([\s\S]*?)\)\s+as\s+accounts\(id,email,name,role\)/i,
);
if (!accountsBlock) throw new Error("Demo seed is missing its role account list");
const accountRows = [
  ...accountsBlock[1].matchAll(
    /\('([0-9a-f-]+)'::uuid,'([^']+)','([^']+)','([^']+)'(?:::public\.app_role)?\)/gi,
  ),
];
const roleAliases = new Map([
  ["super_admin", "superadmin"],
  ["admin", "admin"],
  ["hr_admin", "hradmin"],
  ["dept_head", "depthead"],
  ["supervisor", "supervisor"],
  ["employee", "employee"],
  ["ops_manager", "opsmanager"],
]);
if (accountRows.length !== roleAliases.size) {
  throw new Error(`Expected one account for each of ${roleAliases.size} system roles`);
}
const seenRoles = new Set();
for (const [, , email, name, role] of accountRows) {
  const [firstName, roleAlias] = email.split("@")[0].split("+")[0].split(".");
  if (
    !/^[a-z]+\.[a-z]+\+priority@gmail\.com$/i.test(email) ||
    firstName !== name.split(/\s+/)[0].toLowerCase() ||
    roleAlias !== roleAliases.get(role)
  ) {
    throw new Error(`Demo account does not match the first-name/role email format: ${email}`);
  }
  if (seenRoles.has(role)) throw new Error(`Duplicate demo account role: ${role}`);
  seenRoles.add(role);
}
if ([...roleAliases.keys()].some((role) => !seenRoles.has(role))) {
  throw new Error("Demo seed is missing a required system role");
}
const departmentBlock = seed.match(
  /insert\s+into\s+public\.departments\([^;]+?\)\s+values([\s\S]*?);/i,
);
if (
  !departmentBlock ||
  !/Logistics Department/.test(departmentBlock[1]) ||
  [...departmentBlock[1].matchAll(/\('[0-9a-f-]+','[^']+'/gi)].length !== 1
) {
  throw new Error("Demo seed must define exactly one Logistics Department");
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
  `Migration source check passed: ${files.length} ordered Supabase SQL migrations, ${tables.size} RLS-protected public tables, ${functionHeaders.length} function definitions; key Supabase types match; automatic seeds are disabled and demo fixtures remain separate.`,
);
