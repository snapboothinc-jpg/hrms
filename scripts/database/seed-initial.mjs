import { readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const migrationsDir = join(root, "supabase", "migrations");
const loopbackHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

if (process.env.HRMS_SEED_ENV !== "development") {
  throw new Error("Set HRMS_SEED_ENV=development to seed the local development database");
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("Set DATABASE_URL to the local Supabase PostgreSQL connection string");
}
const database = new URL(databaseUrl);
if (!["postgres:", "postgresql:"].includes(database.protocol)) {
  throw new Error("DATABASE_URL must use the PostgreSQL protocol");
}
if (!loopbackHosts.has(database.hostname)) {
  throw new Error(
    `Refusing non-local database host ${database.hostname}; this seed has no remote override`,
  );
}
const authApiUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const publishableKey =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;
if (!authApiUrl || !publishableKey) {
  throw new Error(
    "Set the local Supabase URL and publishable key to verify development account logins",
  );
}
if (!loopbackHosts.has(new URL(authApiUrl).hostname)) {
  throw new Error("Refusing to send development credentials to a non-local Supabase Auth API");
}

const accountDefinitions = [
  [
    "super_admin",
    "HRMS_DEV_SUPER_ADMIN_PASSWORD",
    "super-admin@hrms.test",
    "Morgan",
    "Lee",
    "00000000-0000-4000-a000-000000000001",
  ],
  [
    "admin",
    "HRMS_DEV_ADMIN_PASSWORD",
    "admin@hrms.test",
    "Riley",
    "Administrator",
    "00000000-0000-4000-a000-000000000002",
  ],
  [
    "hr_admin",
    "HRMS_DEV_HR_ADMIN_PASSWORD",
    "hr-admin@hrms.test",
    "Jamie",
    "Cruz",
    "00000000-0000-4000-a000-000000000003",
  ],
  [
    "dept_head",
    "HRMS_DEV_DEPT_HEAD_PASSWORD",
    "department-head@hrms.test",
    "Avery",
    "Chen",
    "00000000-0000-4000-a000-000000000004",
  ],
  [
    "supervisor",
    "HRMS_DEV_SUPERVISOR_PASSWORD",
    "supervisor@hrms.test",
    "Alex",
    "Reyes",
    "00000000-0000-4000-a000-000000000005",
  ],
  [
    "employee",
    "HRMS_DEV_EMPLOYEE_PASSWORD",
    "employee@hrms.test",
    "Casey",
    "Garcia",
    "00000000-0000-4000-a000-000000000006",
  ],
  [
    "ops_manager",
    "HRMS_DEV_OPS_MANAGER_PASSWORD",
    "operations-manager@hrms.test",
    "Jordan",
    "Patel",
    "00000000-0000-4000-a000-000000000007",
  ],
];
const accounts = accountDefinitions.map(([role, passwordKey, email, firstName, lastName, id]) => {
  const password = process.env[passwordKey];
  if (!password || password.length < 12) {
    throw new Error(
      `${passwordKey} must be set to a development password of at least 12 characters`,
    );
  }
  return { role, passwordKey, email, firstName, lastName, id, password };
});
if (new Set(accounts.map((account) => account.password)).size !== accounts.length) {
  throw new Error("Use a distinct development password for each seeded account");
}

const ids = {
  department: "00000000-0000-4000-b000-000000000001",
  supervisorPosition: "00000000-0000-4000-c000-000000000001",
  employeePosition: "00000000-0000-4000-c000-000000000002",
  supervisor: "00000000-0000-4000-d000-000000000001",
  employee: "00000000-0000-4000-d000-000000000002",
  reporting: "00000000-0000-4000-d000-000000000003",
  operationsCategory: "00000000-0000-4000-e000-000000000001",
  safetyCategory: "00000000-0000-4000-e000-000000000002",
  routeCompetency: "00000000-0000-4000-f000-000000000001",
  safetyCompetency: "00000000-0000-4000-f000-000000000002",
};

const kpis = [
  {
    id: "00000000-0000-4000-9300-000000000001",
    label: "Shipment documentation accuracy",
    help: "Assess accuracy of shipment documents against the approved operational records.",
    unit: "percent",
  },
  {
    id: "00000000-0000-4000-9300-000000000002",
    label: "Shipment processing turnaround time",
    help: "Measure elapsed processing time using the organization's defined start and end points.",
    unit: "hours",
  },
  {
    id: "00000000-0000-4000-9300-000000000003",
    label: "Shipment file completeness",
    help: "Assess completeness against the document checklist configured by the organization.",
    unit: "percent",
  },
  {
    id: "00000000-0000-4000-9300-000000000004",
    label: "Exception handling",
    help: "Assess handling and escalation of shipment exceptions using operational records.",
    unit: "cases",
  },
  {
    id: "00000000-0000-4000-9300-000000000005",
    label: "Operational compliance",
    help: "Assess compliance against the organization's applicable operating procedures.",
    unit: "percent",
  },
];

const permissionRequirements = {
  super_admin: ["admin.users", "admin.roles", "admin.audit", "admin.settings", "admin.org"],
  admin: ["admin.users", "admin.audit", "admin.settings", "admin.org"],
  hr_admin: ["hr.employees", "perf.manage", "perf.approve", "comp.manage", "comp.assess"],
  dept_head: ["perf.evaluate", "comp.assess", "team.view"],
  supervisor: ["perf.evaluate", "comp.assess", "team.view"],
  employee: ["self.service"],
  ops_manager: ["learn.manage", "train.manage", "ai.generate", "comp.view_all"],
};

const client = postgres(databaseUrl, { max: 1, connect_timeout: 5, idle_timeout: 5 });
try {
  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .map((file) => file.slice(0, 14))
    .sort();
  const appliedRows =
    await client`select version from supabase_migrations.schema_migrations order by version`;
  const applied = appliedRows.map((row) => String(row.version));
  if (JSON.stringify(applied) !== JSON.stringify(files)) {
    throw new Error(
      `Local migrations are not current (${applied.length}/${files.length}); run npm run db:reset:local before seeding`,
    );
  }

  await client.begin(async (tx) => {
    for (const account of accounts) {
      const emailMatch = await tx`
        select id from auth.users where lower(email) = lower(${account.email}) and id <> ${account.id}::uuid
      `;
      const idMatch = await tx`
        select email from auth.users where id = ${account.id}::uuid and lower(email) <> lower(${account.email})
      `;
      if (emailMatch.length || idMatch.length) {
        throw new Error(
          `Account identity conflict for ${account.email}; refusing to take over an account`,
        );
      }

      const fullName = `${account.firstName} ${account.lastName}`;
      await tx`
        insert into auth.users (
          instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
          confirmation_token, recovery_token, email_change_token_new, email_change
        ) values (
          '00000000-0000-0000-0000-000000000000', ${account.id}::uuid,
          'authenticated', 'authenticated', ${account.email},
          extensions.crypt(${account.password}, extensions.gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}'::jsonb,
          ${tx.json({ full_name: fullName })}, now(), now(), '', '', '', ''
        )
        on conflict (id) do update set
          email = excluded.email,
          encrypted_password = excluded.encrypted_password,
          email_confirmed_at = coalesce(auth.users.email_confirmed_at, excluded.email_confirmed_at),
          raw_app_meta_data = excluded.raw_app_meta_data,
          raw_user_meta_data = excluded.raw_user_meta_data,
          updated_at = now()
      `;
      await tx`
        insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
        values (
          ${account.id}::uuid, ${account.id}::uuid, ${account.id},
          ${tx.json({ sub: account.id, email: account.email, email_verified: true })},
          'email', now(), now()
        )
        on conflict (provider_id, provider) do update set
          user_id = excluded.user_id, identity_data = excluded.identity_data, updated_at = now()
      `;
      await tx`
        insert into public.profiles (id, email, full_name, is_active, is_demo)
        values (${account.id}::uuid, ${account.email}, ${fullName}, true, false)
        on conflict (id) do update set email = excluded.email, full_name = excluded.full_name,
          is_active = excluded.is_active, is_demo = excluded.is_demo
        where (public.profiles.email, public.profiles.full_name,
          public.profiles.is_active, public.profiles.is_demo)
          is distinct from (excluded.email, excluded.full_name, excluded.is_active, excluded.is_demo)
      `;
      await tx`
        insert into public.user_roles (user_id, role)
        values (${account.id}::uuid, ${account.role}::public.app_role)
        on conflict (user_id) do update set role = excluded.role
        where public.user_roles.role is distinct from excluded.role
      `;
    }

    await tx`
      insert into public.departments (id, code, name, status, is_demo)
      values (${ids.department}::uuid, 'OPS', 'Operations', 'active', false)
      on conflict (id) do update set code = excluded.code, name = excluded.name,
        status = excluded.status, is_demo = excluded.is_demo
      where (public.departments.code, public.departments.name, public.departments.status, public.departments.is_demo)
        is distinct from (excluded.code, excluded.name, excluded.status, excluded.is_demo)
    `;
    await tx`
      insert into public.positions (id, code, title, department_id, description, status, is_demo)
      values
        (${ids.supervisorPosition}::uuid, 'OPS-SUP', 'Operations Supervisor', ${ids.department}::uuid,
          'Supervises Operations employees and reviews assigned work.', 'active', false),
        (${ids.employeePosition}::uuid, 'LOG-COORD', 'Logistics Coordinator', ${ids.department}::uuid,
          'Coordinates shipment documentation, processing and operational exceptions.', 'active', false)
      on conflict (id) do update set code = excluded.code, title = excluded.title,
        department_id = excluded.department_id, description = excluded.description,
        status = excluded.status, is_demo = excluded.is_demo
      where (public.positions.code, public.positions.title, public.positions.department_id,
        public.positions.description, public.positions.status, public.positions.is_demo)
        is distinct from (excluded.code, excluded.title, excluded.department_id,
          excluded.description, excluded.status, excluded.is_demo)
    `;
    await tx`
      insert into public.employees (
        id, employee_code, first_name, last_name, email, department_id, position_id, user_id, is_demo
      ) values
        (${ids.supervisor}::uuid, 'OPS-SUP-001', 'Alex', 'Reyes', 'supervisor@hrms.test',
          ${ids.department}::uuid, ${ids.supervisorPosition}::uuid,
          '00000000-0000-4000-a000-000000000005', false),
        (${ids.employee}::uuid, 'OPS-EMP-001', 'Casey', 'Garcia', 'employee@hrms.test',
          ${ids.department}::uuid, ${ids.employeePosition}::uuid,
          '00000000-0000-4000-a000-000000000006', false)
      on conflict (id) do update set employee_code = excluded.employee_code,
        first_name = excluded.first_name, last_name = excluded.last_name, email = excluded.email,
        department_id = excluded.department_id, position_id = excluded.position_id,
        user_id = excluded.user_id, is_demo = excluded.is_demo
      where (public.employees.employee_code, public.employees.first_name, public.employees.last_name,
        public.employees.email, public.employees.department_id, public.employees.position_id,
        public.employees.user_id, public.employees.is_demo)
        is distinct from (excluded.employee_code, excluded.first_name, excluded.last_name,
          excluded.email, excluded.department_id, excluded.position_id, excluded.user_id, excluded.is_demo)
    `;
    await tx`
      insert into public.reporting_relationships (
        id, employee_id, supervisor_id, effective_from, is_current, is_demo
      ) values (
        ${ids.reporting}::uuid, ${ids.employee}::uuid, ${ids.supervisor}::uuid,
        current_date, true, true
      )
      on conflict (id) do update set employee_id = excluded.employee_id,
        supervisor_id = excluded.supervisor_id, is_current = excluded.is_current, is_demo = excluded.is_demo
      where (public.reporting_relationships.employee_id, public.reporting_relationships.supervisor_id,
        public.reporting_relationships.is_current, public.reporting_relationships.is_demo)
        is distinct from (excluded.employee_id, excluded.supervisor_id,
          excluded.is_current, excluded.is_demo)
    `;

    await tx`
      insert into public.competency_categories (id, name, description, is_demo)
      values
        (${ids.operationsCategory}::uuid, 'Logistics Operations',
          'Competencies related to logistics coordination and shipment planning.', false),
        (${ids.safetyCategory}::uuid, 'Safety and Equipment',
          'Competencies related to safe cargo handling and equipment care.', false)
      on conflict (id) do update set name = excluded.name,
        description = excluded.description, is_demo = excluded.is_demo
      where (public.competency_categories.name, public.competency_categories.description,
        public.competency_categories.is_demo)
        is distinct from (excluded.name, excluded.description, excluded.is_demo)
    `;
    await tx`
      insert into public.competencies (
        id, code, name, description, definition, category_id, status,
        is_mandatory, is_safety_critical, is_demo
      ) values
        (${ids.routeCompetency}::uuid, 'OPS-ROUTE', 'Route Planning and Optimization',
          'Plans efficient routes while considering applicable operational constraints.',
          'Uses approved routing tools and operating procedures to plan and adjust shipment routes.',
          ${ids.operationsCategory}::uuid, 'active', true, false, false),
        (${ids.safetyCompetency}::uuid, 'SAFE-CARGO', 'Cargo Safety and Equipment Care',
          'Applies applicable cargo-safety procedures and cares for equipment.',
          'Uses approved load-handling and equipment procedures and escalates identified hazards.',
          ${ids.safetyCategory}::uuid, 'active', true, true, false)
      on conflict (id) do update set code = excluded.code, name = excluded.name,
        description = excluded.description, definition = excluded.definition,
        category_id = excluded.category_id, status = excluded.status,
        is_mandatory = excluded.is_mandatory, is_safety_critical = excluded.is_safety_critical,
        is_demo = excluded.is_demo
      where (public.competencies.code, public.competencies.name, public.competencies.description,
        public.competencies.definition, public.competencies.category_id, public.competencies.status,
        public.competencies.is_mandatory, public.competencies.is_safety_critical, public.competencies.is_demo)
        is distinct from (excluded.code, excluded.name, excluded.description, excluded.definition,
          excluded.category_id, excluded.status, excluded.is_mandatory,
          excluded.is_safety_critical, excluded.is_demo)
    `;

    const competencyLevels = [
      "Recognizes the competency's basic concepts and required procedures.",
      "Applies routine procedures with guidance and checks work when prompted.",
      "Applies routine procedures independently and identifies common issues.",
      "Handles complex situations consistently and supports others when appropriate.",
      "Demonstrates expert practice and contributes to improving work methods.",
    ];
    for (const [competencyIndex, competencyId] of [
      ids.routeCompetency,
      ids.safetyCompetency,
    ].entries()) {
      for (const [levelIndex, indicator] of competencyLevels.entries()) {
        const indicatorId = `00000000-0000-4000-f100-${String(competencyIndex * 5 + levelIndex + 1).padStart(12, "0")}`;
        await tx`
          insert into public.behavioral_indicators (id, competency_id, level, indicator, sort_order)
          values (${indicatorId}::uuid, ${competencyId}::uuid, ${levelIndex + 1}, ${indicator}, 0)
          on conflict (id) do update set competency_id = excluded.competency_id,
            level = excluded.level, indicator = excluded.indicator, sort_order = excluded.sort_order
          where (public.behavioral_indicators.competency_id, public.behavioral_indicators.level,
            public.behavioral_indicators.indicator, public.behavioral_indicators.sort_order)
            is distinct from (excluded.competency_id, excluded.level,
              excluded.indicator, excluded.sort_order)
        `;
      }
    }
    await tx`
      insert into public.position_competency_requirements (
        position_id, competency_id, required_level, is_mandatory, is_safety_critical,
        effective_from, is_current, is_demo
      ) values
        (${ids.employeePosition}::uuid, ${ids.routeCompetency}::uuid, 3, true, false, current_date, true, false),
        (${ids.employeePosition}::uuid, ${ids.safetyCompetency}::uuid, 3, true, true, current_date, true, false),
        (${ids.supervisorPosition}::uuid, ${ids.routeCompetency}::uuid, 3, true, false, current_date, true, false),
        (${ids.supervisorPosition}::uuid, ${ids.safetyCompetency}::uuid, 3, true, true, current_date, true, false)
      on conflict (position_id, competency_id) where is_current do update set
        required_level = excluded.required_level, is_mandatory = excluded.is_mandatory,
        is_safety_critical = excluded.is_safety_critical, is_demo = excluded.is_demo
      where (public.position_competency_requirements.required_level,
        public.position_competency_requirements.is_mandatory,
        public.position_competency_requirements.is_safety_critical,
        public.position_competency_requirements.is_demo)
        is distinct from (excluded.required_level, excluded.is_mandatory,
          excluded.is_safety_critical, excluded.is_demo)
    `;

    await tx`
      insert into public.proficiency_levels (level, label, description, requires_validation)
      values
        (1, 'Awareness', 'Recognizes basic concepts and required procedures.', true),
        (2, 'Developing', 'Applies routine procedures with guidance.', true),
        (3, 'Proficient', 'Applies routine procedures independently.', true),
        (4, 'Advanced', 'Handles complex situations and supports others.', true),
        (5, 'Expert', 'Demonstrates expert practice and improves work methods.', true)
      on conflict (level) do nothing
    `;

    await seedEvaluationProfile(tx, {
      profileId: "00000000-0000-4000-9000-000000000001",
      versionId: "00000000-0000-4000-9100-000000000001",
      sectionId: "00000000-0000-4000-9200-000000000001",
      positionId: ids.employeePosition,
      profileName: "Logistics Coordinator Evaluation",
      sectionName: "Position-Specific KPIs",
      profileItems: kpis,
    });
    await seedEvaluationProfile(tx, {
      profileId: "00000000-0000-4000-9000-000000000002",
      versionId: "00000000-0000-4000-9100-000000000002",
      sectionId: "00000000-0000-4000-9200-000000000002",
      positionId: ids.supervisorPosition,
      profileName: "Operations Supervisor Evaluation",
      sectionName: "Position-Specific KPIs",
      profileItems: [],
    });

    const settings = [
      [
        "evaluation.rating_descriptions",
        ["Poor", "Below Average", "Average", "Above Average", "Excellent"],
        "Rating scale labels 1 through 5, as specified for the HRMS evaluation form.",
      ],
      [
        "evaluation.cycle_template",
        {
          self_evaluation: true,
          period_start: null,
          period_end: null,
          due_date: null,
          approval_route: "hr_admin",
        },
        "Configurable starting point only. HR must set period dates and confirm workflow before creating an evaluation cycle.",
      ],
      [
        "evaluation.critical_requirement_types",
        [
          { code: "license", safety_critical_default: false, track_validity: true },
          { code: "certification", safety_critical_default: false, track_validity: true },
          { code: "qualification", safety_critical_default: false, track_validity: true },
          { code: "safety", safety_critical_default: true, track_validity: true },
        ],
        "Supported requirement categories; classify individual requirements based on applicable organizational rules.",
      ],
      [
        "competency.assessment_methods",
        [
          "direct_observation",
          "work_sample",
          "simulation",
          "document_review",
          "structured_interview",
        ],
        "Configurable assessment method options; assessors must select an appropriate validated method.",
      ],
      [
        "development.activity_categories",
        ["course", "learning_path", "training", "other"],
        "Activity types supported by development plans; no employee plans or enrollments are pre-created.",
      ],
    ];
    for (const [key, value, description] of settings) {
      await tx`
        insert into public.system_settings (key, value, description, requires_validation)
        values (${key}, ${tx.json(value)}, ${description}, true)
        on conflict (key) do nothing
      `;
    }

    const missingPermissions = [];
    for (const [role, permissions] of Object.entries(permissionRequirements)) {
      const rows = await tx`
        select permission from public.role_permissions
        where role = ${role}::public.app_role and permission = any(${tx.array(permissions)})
      `;
      for (const permission of permissions) {
        if (!rows.some((row) => row.permission === permission)) {
          missingPermissions.push(`${role}:${permission}`);
        }
      }
    }
    if (missingPermissions.length) {
      throw new Error(
        `Required role permissions are missing from migrations: ${missingPermissions.join(", ")}`,
      );
    }

    await verifyInitialState(tx, accounts);
  });

  console.log(
    "Local initial system seed verified: 7 role accounts, 1 Operations department, 2 positions, 2 employees, 2 active evaluation profiles, 10 factors per profile, 5 unweighted KPI definitions, and no employee workflow records.",
  );
  for (const account of accounts) {
    console.log(`${account.role}: ${account.email} (password from ${account.passwordKey})`);
  }

  await verifyLocalAuth(accounts, authApiUrl, publishableKey);
} finally {
  await client.end({ timeout: 5 });
}

async function seedEvaluationProfile(
  tx,
  { profileId, versionId, sectionId, positionId, profileName, sectionName, profileItems },
) {
  const existing = await tx`
    select status from public.evaluation_profile_versions where id = ${versionId}::uuid
  `;
  if (existing[0]?.status === "active") {
    const counts = await tx`
      select
        (select count(*)::int from public.evaluation_profile_factors where version_id = ${versionId}::uuid) as factors,
        (select count(*)::int from public.evaluation_items where version_id = ${versionId}::uuid and item_type = 'kpi') as kpis
    `;
    if (counts[0].factors !== 10 || counts[0].kpis !== profileItems.length) {
      throw new Error(
        `Active profile ${profileName} is incomplete; refusing to mutate its snapshot source`,
      );
    }
    return;
  }

  await tx`
    insert into public.evaluation_profiles (id, position_id, name, description, is_demo)
    values (${profileId}::uuid, ${positionId}::uuid, ${profileName},
      'Initial configurable position profile. Confirm organization-specific measures before use.', false)
    on conflict (id) do nothing
  `;
  await tx`
    insert into public.evaluation_profile_versions (
      id, profile_id, position_id, version_number, status, rating_scale_max,
      scoring_method, final_score_rule, classification_thresholds, instructions, is_demo
    ) values (
      ${versionId}::uuid, ${profileId}::uuid, ${positionId}::uuid, 1, 'draft', 5,
      'equal', 'supervisor', '[]'::jsonb,
      'Equal weighting is selected as a configurable starting rule. Confirm organizational policy and KPI targets before creating evaluation assignments.',
      false
    )
    on conflict (id) do nothing
  `;
  await tx`select public._seed_performance_factors(${versionId}::uuid)`;
  await tx`
    update public.evaluation_profile_factors set weight = 0
    where version_id = ${versionId}::uuid and weight <> 0
  `;
  await tx`
    insert into public.evaluation_sections (id, version_id, title, description, sort_order)
    values (
      ${sectionId}::uuid, ${versionId}::uuid, ${sectionName},
      'Use approved position-specific measures. Targets and scoring weights are intentionally unconfigured.',
      0
    )
    on conflict (id) do nothing
  `;
  for (const [index, item] of profileItems.entries()) {
    await tx`
      insert into public.evaluation_items (
        id, version_id, section_id, label, help_text, item_type, weight,
        kpi_target, kpi_unit, evidence_required, is_required, sort_order
      ) values (
        ${item.id}::uuid, ${versionId}::uuid, ${sectionId}::uuid, ${item.label},
        ${item.help}, 'kpi', 0, null, ${item.unit}, false, true, ${index}
      )
      on conflict (id) do nothing
    `;
  }
  await tx`
    update public.evaluation_profile_versions
    set status = 'active', effective_date = current_date, activated_at = now(),
      instructions = 'Equal weighting is selected as a configurable starting rule. Confirm organizational policy and KPI targets before creating evaluation assignments.'
    where id = ${versionId}::uuid and status = 'draft'
  `;
}

async function verifyInitialState(tx, expectedAccounts) {
  const counts = await tx`
    select
      (select count(*)::int from auth.users where id = any(${tx.array(
        expectedAccounts.map((account) => account.id),
        "uuid",
      )})) as accounts,
      (select count(*)::int from public.user_roles where user_id = any(${tx.array(
        expectedAccounts.map((account) => account.id),
        "uuid",
      )})) as roles,
      (select count(*)::int from public.departments where id = ${ids.department}::uuid and name = 'Operations') as departments,
      (select count(*)::int from public.positions where department_id = ${ids.department}::uuid) as positions,
      (select count(*)::int from public.employees where department_id = ${ids.department}::uuid) as employees,
      (select count(*)::int from public.reporting_relationships where id = ${ids.reporting}::uuid and is_current) as reporting,
      (select count(*)::int from public.competencies where id = any(${tx.array([ids.routeCompetency, ids.safetyCompetency], "uuid")}) and status = 'active') as competencies,
      (select count(*)::int from public.position_competency_requirements where position_id = any(${tx.array([ids.employeePosition, ids.supervisorPosition], "uuid")}) and is_current) as competency_requirements,
      (select count(*)::int from public.evaluation_profile_versions where id = any(${tx.array(["00000000-0000-4000-9100-000000000001", "00000000-0000-4000-9100-000000000002"], "uuid")}) and status = 'active') as profiles,
      (select count(*)::int from public.proficiency_levels where level between 1 and 5) as proficiency_levels,
      (select count(*)::int from public.evaluation_profile_factors where version_id = any(${tx.array(["00000000-0000-4000-9100-000000000001", "00000000-0000-4000-9100-000000000002"], "uuid")})) as factors,
      (select count(*)::int from public.evaluation_profile_factors where version_id = any(${tx.array(["00000000-0000-4000-9100-000000000001", "00000000-0000-4000-9100-000000000002"], "uuid")}) and weight <> 0) as weighted_factors,
      (select count(*)::int from public.evaluation_items where version_id = '00000000-0000-4000-9100-000000000001' and item_type = 'kpi' and kpi_target is null and weight = 0) as kpis
  `;
  const row = counts[0];
  const expected = {
    accounts: 7,
    roles: 7,
    departments: 1,
    positions: 2,
    employees: 2,
    reporting: 1,
    competencies: 2,
    competency_requirements: 4,
    profiles: 2,
    proficiency_levels: 5,
    factors: 20,
    weighted_factors: 0,
    kpis: 5,
  };
  for (const [key, value] of Object.entries(expected)) {
    if (row[key] !== value) {
      throw new Error(
        `Initial system verification failed for ${key}: expected ${value}, found ${row[key]}`,
      );
    }
  }

  const permissionRows = await tx`
    select role::text as role, permission from public.role_permissions
    where role in ('super_admin','admin','hr_admin','dept_head','supervisor','employee','ops_manager')
  `;
  const permissionSet = new Set(permissionRows.map((item) => `${item.role}:${item.permission}`));
  for (const [role, permissions] of Object.entries(permissionRequirements)) {
    for (const permission of permissions) {
      if (!permissionSet.has(`${role}:${permission}`)) {
        throw new Error(`Initial system verification failed for permission ${role}:${permission}`);
      }
    }
  }

  const badRelationships = await tx`
    select count(*)::int as count
    from public.reporting_relationships r
    join public.employees e on e.id = r.employee_id
    join public.employees s on s.id = r.supervisor_id
    where r.id = ${ids.reporting}::uuid
      and (e.position_id <> ${ids.employeePosition}::uuid
        or s.position_id <> ${ids.supervisorPosition}::uuid
        or e.department_id <> s.department_id)
  `;
  if (badRelationships[0].count)
    throw new Error("Seeded employee reporting relationship is invalid");

  const emptyWorkflowTables = [
    "evaluation_cycles",
    "evaluation_assignments",
    "evaluation_responses",
    "evaluation_factor_responses",
    "evaluation_development_responses",
    "evaluation_evidence",
    "evaluation_reviews",
    "evaluation_critical_requirement_reviews",
    "competency_assessments",
    "competency_gap_snapshots",
    "ai_recommendations",
    "development_plans",
    "course_enrollments",
    "training_sessions",
    "training_attendance",
    "training_results",
    "recognition_nominations",
    "succession_candidates",
    "notifications",
    "approval_tasks",
  ];
  for (const table of emptyWorkflowTables) {
    const result = await tx.unsafe(`select count(*)::int as count from public.${table}`);
    if (result[0].count !== 0) {
      throw new Error(`Seed must not leave workflow records in public.${table}`);
    }
  }

  for (const account of expectedAccounts) {
    const rows = await tx`
      select extensions.crypt(${account.password}, encrypted_password) = encrypted_password as valid
      from auth.users where id = ${account.id}::uuid and email = ${account.email}
    `;
    if (!rows[0]?.valid) throw new Error(`Password hash verification failed for ${account.email}`);
  }
}

async function verifyLocalAuth(expectedAccounts, apiUrl, publishableKey) {
  const { createClient } = await import("@supabase/supabase-js");
  for (const account of expectedAccounts) {
    const auth = createClient(apiUrl, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await auth.auth.signInWithPassword({
      email: account.email,
      password: account.password,
    });
    if (error)
      throw new Error(`Local login verification failed for ${account.email}: ${error.message}`);
    await auth.auth.signOut();
  }
  console.log("Local Supabase Auth password login verified for all seven development accounts.");
}
