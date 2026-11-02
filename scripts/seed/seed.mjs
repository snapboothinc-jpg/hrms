import { createHash } from "node:crypto";
import postgres from "postgres";

const departments = [
  { code: "OPS", name: "Operations" },
  { code: "HR", name: "Human Resources" },
  { code: "FIN", name: "Finance & Accounting" },
  { code: "ADM", name: "Administration" },
  { code: "IT", name: "Information Technology" },
];

const jobCategories = [
  { code: "OPS_LEADERSHIP", name: "Operations Leadership", department: "OPS" },
  { code: "OPS_DISTRIBUTION", name: "Distribution Operations", department: "OPS" },
  { code: "OPS_FLEET", name: "Fleet & Dispatch", department: "OPS" },
  { code: "HR_LEADERSHIP", name: "People Leadership", department: "HR" },
  { code: "HR_TALENT", name: "Talent & Employee Services", department: "HR" },
  { code: "FIN_LEADERSHIP", name: "Finance Leadership", department: "FIN" },
  { code: "FIN_ACCOUNTING", name: "Accounting & Payroll", department: "FIN" },
  { code: "ADM_LEADERSHIP", name: "Administration Leadership", department: "ADM" },
  { code: "ADM_OFFICE", name: "Office & Facilities", department: "ADM" },
  { code: "IT_LEADERSHIP", name: "Technology Leadership", department: "IT" },
  { code: "IT_SERVICES", name: "Technology Services", department: "IT" },
];

const positions = [
  {
    code: "OPS-HEAD",
    title: "Operations Department Head",
    department: "OPS",
    category: "OPS_LEADERSHIP",
    employeeType: "head",
  },
  {
    code: "OPS-SUP",
    title: "Operations Supervisor",
    department: "OPS",
    category: "OPS_LEADERSHIP",
    employeeType: "supervisor",
  },
  {
    code: "LOG-COORD",
    title: "Logistics Coordinator",
    department: "OPS",
    category: "OPS_DISTRIBUTION",
    employeeType: "employee",
  },
  { code: "DISPATCH", title: "Dispatch Coordinator", department: "OPS", category: "OPS_FLEET" },
  {
    code: "HR-HEAD",
    title: "Human Resources Department Head",
    department: "HR",
    category: "HR_LEADERSHIP",
    employeeType: "head",
  },
  {
    code: "HR-SUP",
    title: "Human Resources Supervisor",
    department: "HR",
    category: "HR_LEADERSHIP",
    employeeType: "supervisor",
  },
  {
    code: "HR-OFFICER",
    title: "Human Resources Officer",
    department: "HR",
    category: "HR_TALENT",
    employeeType: "employee",
  },
  { code: "RECRUITER", title: "Recruitment Specialist", department: "HR", category: "HR_TALENT" },
  {
    code: "FIN-HEAD",
    title: "Finance & Accounting Department Head",
    department: "FIN",
    category: "FIN_LEADERSHIP",
    employeeType: "head",
  },
  {
    code: "FIN-SUP",
    title: "Finance Supervisor",
    department: "FIN",
    category: "FIN_LEADERSHIP",
    employeeType: "supervisor",
  },
  {
    code: "ACCOUNTANT",
    title: "Accountant",
    department: "FIN",
    category: "FIN_ACCOUNTING",
    employeeType: "employee",
  },
  { code: "PAYROLL", title: "Payroll Specialist", department: "FIN", category: "FIN_ACCOUNTING" },
  {
    code: "ADM-HEAD",
    title: "Administration Department Head",
    department: "ADM",
    category: "ADM_LEADERSHIP",
    employeeType: "head",
  },
  {
    code: "ADM-SUP",
    title: "Administration Supervisor",
    department: "ADM",
    category: "ADM_LEADERSHIP",
    employeeType: "supervisor",
  },
  {
    code: "ADMIN-OFF",
    title: "Administrative Officer",
    department: "ADM",
    category: "ADM_OFFICE",
    employeeType: "employee",
  },
  { code: "FAC-COORD", title: "Facilities Coordinator", department: "ADM", category: "ADM_OFFICE" },
  {
    code: "IT-HEAD",
    title: "Information Technology Department Head",
    department: "IT",
    category: "IT_LEADERSHIP",
    employeeType: "head",
  },
  {
    code: "IT-SUP",
    title: "IT Support Supervisor",
    department: "IT",
    category: "IT_LEADERSHIP",
    employeeType: "supervisor",
  },
  {
    code: "IT-SUPPORT",
    title: "IT Support Specialist",
    department: "IT",
    category: "IT_SERVICES",
    employeeType: "employee",
  },
  { code: "SYS-ADMIN", title: "Systems Administrator", department: "IT", category: "IT_SERVICES" },
];

const staff = [
  { department: "OPS", type: "head", firstName: "Olivia", lastName: "Carter" },
  { department: "OPS", type: "supervisor", firstName: "Liam", lastName: "Foster" },
  { department: "OPS", type: "employee", firstName: "Evelyn", lastName: "Ross" },
  { department: "HR", type: "head", firstName: "Noah", lastName: "Bennett" },
  { department: "HR", type: "supervisor", firstName: "Emma", lastName: "Diaz" },
  { department: "HR", type: "employee", firstName: "James", lastName: "Cook" },
  { department: "FIN", type: "head", firstName: "Mia", lastName: "Turner" },
  { department: "FIN", type: "supervisor", firstName: "Lucas", lastName: "Reed" },
  { department: "FIN", type: "employee", firstName: "Amira", lastName: "Khan" },
  { department: "ADM", type: "head", firstName: "Ethan", lastName: "Brooks" },
  { department: "ADM", type: "supervisor", firstName: "Sofia", lastName: "Gray" },
  { department: "ADM", type: "employee", firstName: "Leo", lastName: "Ward" },
  { department: "IT", type: "head", firstName: "Ava", lastName: "Collins" },
  { department: "IT", type: "supervisor", firstName: "Mason", lastName: "Patel" },
  { department: "IT", type: "employee", firstName: "Zoe", lastName: "Green" },
];

const systemAccounts = [
  {
    key: "super-admin",
    email: "seed.superadmin@priority.test",
    fullName: "Development Super Admin",
    role: "super_admin",
  },
  { key: "admin", email: "seed.admin@priority.test", fullName: "Development Admin", role: "admin" },
  {
    key: "hr-admin",
    email: "seed.hradmin@priority.test",
    fullName: "Development HR Admin",
    role: "hr_admin",
  },
];

const proficiencyLevels = [
  {
    level: 1,
    label: "Awareness",
    description: "Recognizes basic concepts and completes simple tasks with close guidance.",
  },
  {
    level: 2,
    label: "Developing",
    description: "Performs routine tasks with guidance and resolves familiar issues.",
  },
  {
    level: 3,
    label: "Proficient",
    description: "Works independently on standard tasks and meets role expectations.",
  },
  {
    level: 4,
    label: "Advanced",
    description: "Handles complex work, improves practices, and supports colleagues.",
  },
  {
    level: 5,
    label: "Expert",
    description: "Sets standards, coaches others, and leads sustained improvements.",
  },
];

const competencyCategories = [
  { code: "CORE", name: "Core Workplace", department: null },
  { code: "COMP_OPS", name: "Operations", department: "OPS" },
  { code: "COMP_HR", name: "Human Resources", department: "HR" },
  { code: "COMP_FIN", name: "Finance & Accounting", department: "FIN" },
  { code: "COMP_ADM", name: "Administration", department: "ADM" },
  { code: "COMP_IT", name: "Information Technology", department: "IT" },
];

const competencies = [
  {
    code: "CORE-COMM",
    name: "Clear Communication",
    category: "CORE",
    subject: "work updates",
    description: "Communicates accurate, timely information to colleagues and stakeholders.",
  },
  {
    code: "CORE-TEAM",
    name: "Team Collaboration",
    category: "CORE",
    subject: "shared tasks",
    description: "Coordinates respectfully with others to achieve shared work outcomes.",
  },
  {
    code: "CORE-DIGI",
    name: "Digital Literacy",
    category: "CORE",
    subject: "approved digital tools",
    description: "Uses approved workplace systems and handles digital information responsibly.",
  },
  {
    code: "CORE-PROB",
    name: "Problem Solving",
    category: "CORE",
    subject: "work issues",
    description: "Identifies issues, evaluates options, and takes appropriate corrective action.",
  },
  {
    code: "CORE-SAFE",
    name: "Safety & Wellbeing",
    category: "CORE",
    subject: "safety procedures",
    description: "Follows workplace safety practices and reports hazards promptly.",
  },
  {
    code: "OPS-ROUTE",
    name: "Route Planning",
    category: "COMP_OPS",
    subject: "delivery routes",
    description:
      "Plans efficient routes against delivery windows, vehicle limits, and operating constraints.",
  },
  {
    code: "OPS-DISP",
    name: "Dispatch Coordination",
    category: "COMP_OPS",
    subject: "dispatch schedules",
    description:
      "Coordinates dispatch information and promptly resolves routine schedule exceptions.",
  },
  {
    code: "OPS-CARGO",
    name: "Cargo Handling & Safety",
    category: "COMP_OPS",
    subject: "cargo loads",
    description: "Checks cargo handling, load security, and supporting documentation.",
  },
  {
    code: "HR-REL",
    name: "Employee Relations",
    category: "COMP_HR",
    subject: "employee inquiries",
    description:
      "Responds consistently and respectfully to employee questions and workplace concerns.",
  },
  {
    code: "HR-TALENT",
    name: "Talent Acquisition",
    category: "COMP_HR",
    subject: "recruitment steps",
    description: "Coordinates fair, documented recruitment and selection activities.",
  },
  {
    code: "HR-CONF",
    name: "People Data Confidentiality",
    category: "COMP_HR",
    subject: "employee records",
    description: "Protects confidential personnel information and follows access rules.",
  },
  {
    code: "FIN-RECON",
    name: "Account Reconciliation",
    category: "COMP_FIN",
    subject: "ledger balances",
    description: "Reconciles financial records and documents and resolves variances.",
  },
  {
    code: "FIN-PAY",
    name: "Payroll Administration",
    category: "COMP_FIN",
    subject: "payroll calculations",
    description:
      "Processes payroll inputs accurately and follows approval and cutoff requirements.",
  },
  {
    code: "FIN-CONTROL",
    name: "Financial Controls",
    category: "COMP_FIN",
    subject: "finance controls",
    description: "Applies financial controls and maintains evidence for review and audit.",
  },
  {
    code: "ADM-RECORD",
    name: "Records Management",
    category: "COMP_ADM",
    subject: "organizational records",
    description: "Maintains complete, retrievable records according to retention and access rules.",
  },
  {
    code: "ADM-SERVICE",
    name: "Office Service Coordination",
    category: "COMP_ADM",
    subject: "office service requests",
    description: "Coordinates office services and communicates status to requesting teams.",
  },
  {
    code: "ADM-FACILITY",
    name: "Facilities Coordination",
    category: "COMP_ADM",
    subject: "facility requests",
    description: "Tracks facility issues, coordinates vendors, and escalates safety concerns.",
  },
  {
    code: "IT-HELP",
    name: "Service Desk Support",
    category: "COMP_IT",
    subject: "support tickets",
    description: "Diagnoses user issues, documents support steps, and follows service priorities.",
  },
  {
    code: "IT-SYSTEMS",
    name: "Systems Administration",
    category: "COMP_IT",
    subject: "system access and services",
    description: "Maintains reliable systems and applies controlled change and access procedures.",
  },
  {
    code: "IT-SEC",
    name: "Information Security",
    category: "COMP_IT",
    subject: "security controls",
    description:
      "Protects systems and information by applying security controls and reporting incidents.",
  },
];

const indicatorVerbs = [
  ["Follows documented", "with guidance and asks for help when an exception occurs."],
  ["Completes routine", "with periodic review and resolves familiar exceptions."],
  ["Independently completes standard", "and records results accurately."],
  ["Resolves complex", "and coaches colleagues on effective practice."],
  ["Defines standards for", "and measures improvements across the team."],
];

const sharedCompetencyCodes = ["CORE-COMM", "CORE-TEAM", "CORE-DIGI", "CORE-PROB", "CORE-SAFE"];
const departmentCompetencyCodes = {
  OPS: ["OPS-ROUTE", "OPS-DISP", "OPS-CARGO"],
  HR: ["HR-REL", "HR-TALENT", "HR-CONF"],
  FIN: ["FIN-RECON", "FIN-PAY", "FIN-CONTROL"],
  ADM: ["ADM-RECORD", "ADM-SERVICE", "ADM-FACILITY"],
  IT: ["IT-HELP", "IT-SYSTEMS", "IT-SEC"],
};

const rolePermissions = [
  ["super_admin", "admin.users"],
  ["super_admin", "admin.audit"],
  ["super_admin", "admin.settings"],
  ["super_admin", "admin.org"],
  ["super_admin", "admin.roles"],
  ["admin", "admin.users"],
  ["admin", "admin.audit"],
  ["admin", "admin.settings"],
  ["admin", "admin.org"],
  ["hr_admin", "employees.view_all"],
  ["hr_admin", "hr.employees"],
  ["hr_admin", "perf.manage"],
  ["hr_admin", "perf.approve"],
  ["hr_admin", "comp.manage"],
  ["hr_admin", "comp.approve"],
  ["hr_admin", "comp.assess"],
  ["hr_admin", "reports.hr"],
  ["hr_admin", "succession.manage"],
  ["hr_admin", "recognition.review"],
  ["hr_admin", "learn.manage"],
  ["hr_admin", "learn.approve"],
  ["hr_admin", "train.manage"],
  ["hr_admin", "ai.generate"],
  ["hr_admin", "ai.review"],
  ["employee", "self.service"],
  ["supervisor", "perf.evaluate"],
  ["supervisor", "comp.assess"],
  ["supervisor", "team.view"],
  ["supervisor", "ai.generate"],
  ["dept_head", "perf.evaluate"],
  ["dept_head", "perf.approve"],
  ["dept_head", "comp.assess"],
  ["dept_head", "comp.approve"],
  ["dept_head", "team.view"],
  ["dept_head", "ai.generate"],
  ["ops_manager", "comp.view_all"],
  ["ops_manager", "learn.manage"],
  ["ops_manager", "train.manage"],
  ["ops_manager", "ai.generate"],
  ["ops_manager", "ai.review"],
];

const approvalTransitions = [
  ["profile_version", "draft", "active"],
  ["profile_version", "active", "archived"],
  ["profile_version", "draft", "archived"],
  ["assessment", "draft", "submitted"],
  ["assessment", "submitted", "approved"],
  ["assessment", "submitted", "rejected"],
  ["assessment", "draft", "draft"],
  ["cycle", "draft", "open"],
  ["cycle", "open", "closed"],
  ["cycle", "closed", "open"],
  ["course", "draft", "pending_review"],
  ["course", "pending_review", "approved"],
  ["course", "pending_review", "draft"],
  ["course", "approved", "archived"],
  ["course", "draft", "archived"],
  ["ai_recommendation", "pending_review", "accepted"],
  ["ai_recommendation", "pending_review", "edited"],
  ["ai_recommendation", "pending_review", "rejected"],
  ["development_plan", "draft", "active"],
  ["development_plan", "active", "completed"],
  ["development_plan", "active", "cancelled"],
  ["development_plan", "draft", "cancelled"],
  ["development_plan", "active", "draft"],
  ["plan_item", "pending", "in_progress"],
  ["plan_item", "in_progress", "completed"],
  ["plan_item", "pending", "cancelled"],
  ["plan_item", "in_progress", "cancelled"],
  ["training_session", "planned", "in_progress"],
  ["training_session", "planned", "cancelled"],
  ["training_session", "in_progress", "completed"],
  ["training_session", "in_progress", "cancelled"],
  ["nomination", "submitted", "approved"],
  ["nomination", "submitted", "rejected"],
  ["succession_candidate", "active", "withdrawn"],
  ["succession_candidate", "active", "appointed"],
  ["critical_position", "active", "monitoring"],
  ["critical_position", "monitoring", "active"],
  ["critical_position", "active", "closed"],
  ["critical_position", "monitoring", "closed"],
  ["succession_plan", "draft", "pending_review"],
  ["succession_plan", "returned", "pending_review"],
  ["succession_plan", "pending_review", "approved"],
  ["succession_plan", "pending_review", "returned"],
  ["succession_plan", "approved", "draft"],
  ["succession_plan", "returned", "draft"],
  ["evaluation", "not_started", "in_progress"],
  ["evaluation", "in_progress", "in_progress"],
  ["evaluation", "in_progress", "supervisor_pending"],
  ["evaluation", "not_started", "supervisor_pending"],
  ["evaluation", "returned_for_revision", "supervisor_pending"],
  ["evaluation", "not_started", "supervisor_in_progress"],
  ["evaluation", "not_started", "department_head_pending"],
  ["evaluation", "returned_for_revision", "in_progress"],
  ["evaluation", "returned_for_revision", "supervisor_in_progress"],
  ["evaluation", "supervisor_pending", "supervisor_in_progress"],
  ["evaluation", "supervisor_in_progress", "supervisor_in_progress"],
  ["evaluation", "supervisor_pending", "department_head_pending"],
  ["evaluation", "supervisor_in_progress", "department_head_pending"],
  ["evaluation", "returned_for_revision", "department_head_pending"],
  ["evaluation", "department_head_pending", "returned_for_revision"],
  ["evaluation", "hr_admin_pending", "returned_for_revision"],
  ["evaluation", "department_head_pending", "hr_admin_pending"],
  ["evaluation", "hr_admin_pending", "department_head_pending"],
  ["evaluation", "hr_admin_pending", "approved"],
];

const systemSettings = [
  [
    "evaluation.self_evaluation_default",
    true,
    "Default - requires organizational validation. Whether new cycles include a self-evaluation.",
  ],
  [
    "evaluation.approval_route",
    "hr_admin",
    "Default - requires organizational validation. Role that approves submitted evaluations.",
  ],
  [
    "assessment.approval_route",
    "supervisor_chain_or_hr",
    "Default - requires organizational validation. Department head or HR approves assessments; assessor may not approve own.",
  ],
  [
    "assessment.evidence_required",
    true,
    "Default - requires organizational validation. Assessments require evidence before submission.",
  ],
  [
    "evaluation.rating_scale_max",
    5,
    "Default - requires organizational validation. Rating scale maximum for numeric items.",
  ],
  [
    "learning.publication_route",
    "ops_submits_hr_approves",
    "Default - requires organizational validation. Operations Manager submits courses; HR Administrator approves publication.",
  ],
  [
    "learning.quiz_max_attempts_default",
    3,
    "Default - requires organizational validation. Default maximum quiz attempts.",
  ],
  [
    "ai.provider",
    "gemini",
    "Gemini is the required AI provider. Credentials are server-side only.",
  ],
  ["ai.model", "gemini-2.5-flash", "Default model for development recommendations."],
  [
    "ai.max_items_per_run",
    10,
    "Default - requires organizational validation. Maximum recommendations per generation run.",
  ],
  [
    "training.attendance_recorders",
    "ops_manager_or_hr",
    "Default - requires organizational validation. Who may record attendance.",
  ],
  [
    "recognition.min_message_length",
    20,
    "Default - requires organizational validation. Minimum nomination message length.",
  ],
  [
    "recognition.max_nominations_per_month",
    5,
    "Default - requires organizational validation. Maximum nominations one employee may submit per calendar month.",
  ],
  [
    "recognition.approval_route",
    "hr_admin",
    "Default - requires organizational validation. HR Administrator reviews nominations before publishing.",
  ],
  [
    "succession.readiness_note",
    "configurable",
    "Default - requires organizational validation. Readiness classifications are configurable defaults.",
  ],
];

const readinessClasses = [
  [
    "ready_now",
    "Ready now",
    "Default - requires organizational validation. Candidate can step in immediately.",
    0,
  ],
  [
    "ready_1_2",
    "Ready in 1-2 years",
    "Default - requires organizational validation. Candidate needs limited further development.",
    1,
  ],
  [
    "ready_3_plus",
    "Ready in 3+ years",
    "Default - requires organizational validation. Candidate needs substantial development.",
    2,
  ],
  [
    "not_ready",
    "Not ready",
    "Default - requires organizational validation. Candidate is not currently on track.",
    3,
  ],
];

const recognitionCategories = [
  [
    "Safety Champion",
    "Default - requires organizational validation. For outstanding safety behaviour.",
  ],
  [
    "Customer Hero",
    "Default - requires organizational validation. For exceptional customer service.",
  ],
  ["Team Player", "Default - requires organizational validation. For helping the team succeed."],
];

function stableUuid(key) {
  const bytes = createHash("sha256")
    .update(`priority-handling-hrms-seed:${key}`)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function requiredEnvironment() {
  if (process.env.HRMS_SEED_ENV !== "development") {
    throw new Error(
      "Set HRMS_SEED_ENV=development to confirm this is an isolated development database.",
    );
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");
  const password = process.env.HRMS_SEED_PASSWORD;
  if (!password || password.length < 16) {
    throw new Error(
      "Set HRMS_SEED_PASSWORD to a unique development password of at least 16 characters.",
    );
  }

  const database = new URL(databaseUrl);
  if (!["postgres:", "postgresql:"].includes(database.protocol)) {
    throw new Error("DATABASE_URL must use the postgres or postgresql protocol.");
  }
  const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
  if (
    !localHosts.has(database.hostname) &&
    process.env.HRMS_SEED_REMOTE_CONFIRM !== database.hostname
  ) {
    throw new Error(
      `Refusing non-local database host ${database.hostname}; remote seeding requires HRMS_SEED_REMOTE_CONFIRM to exactly match the hostname.`,
    );
  }

  return { databaseUrl, password };
}

async function seed() {
  const { databaseUrl, password } = requiredEnvironment();
  const db = postgres(databaseUrl, { max: 1, idle_timeout: 5 });
  let section = "preflight";
  const completed = [];

  try {
    await db.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(hashtextextended('priority-handling-initial-seed', 0))`;
      const schema = await tx`
        select
          to_regclass('public.departments') as departments,
          to_regclass('public.job_categories') as job_categories,
          to_regclass('public.evaluation_profile_factors') as evaluation_profile_factors
      `;
      if (
        !schema[0].departments ||
        !schema[0].job_categories ||
        !schema[0].evaluation_profile_factors
      ) {
        throw new Error(
          "Required schema is missing; apply all Supabase migrations before running the seed.",
        );
      }

      section = "approval configuration";
      for (const [role, permission] of rolePermissions) {
        await tx`
          insert into public.role_permissions(role, permission)
          values (${role}::public.app_role, ${permission})
          on conflict (role, permission) do nothing
        `;
      }
      for (const [entity, fromStatus, toStatus] of approvalTransitions) {
        await tx`
          insert into public.status_transitions(entity, from_status, to_status)
          values (${entity}, ${fromStatus}, ${toStatus})
          on conflict (entity, from_status, to_status) do nothing
        `;
      }
      for (const [key, value, description] of systemSettings) {
        await tx`
          insert into public.system_settings(key, value, description)
          values (${key}, ${tx.json(value)}, ${description})
          on conflict (key) do update set value = excluded.value, description = excluded.description
        `;
      }
      await tx`
        insert into public.ai_integration_settings(id, provider, model)
        values (${stableUuid("ai-integration-settings:gemini")}, 'gemini', 'gemini-2.5-flash')
        on conflict (id) do update set provider = excluded.provider, model = excluded.model
      `;
      for (const [code, label, description, sortOrder] of readinessClasses) {
        await tx`
          insert into public.readiness_classes(code, label, description, sort_order)
          values (${code}, ${label}, ${description}, ${sortOrder})
          on conflict (code) do update set
            label = excluded.label,
            description = excluded.description,
            sort_order = excluded.sort_order
        `;
      }
      for (const [name, description] of recognitionCategories) {
        await tx`
          insert into public.recognition_categories(name, description)
          values (${name}, ${description})
          on conflict (name) do update set description = excluded.description, active = true
        `;
      }
      completed.push(
        "Approval permissions, status transitions, system settings, AI defaults, readiness classes and recognition categories",
      );

      section = "development accounts";
      const accounts = [
        ...systemAccounts.map((account) => ({ ...account, employee: null })),
        ...staff.map((member) => ({
          key: `${member.department}-${member.type}`,
          email: `seed.${member.department.toLowerCase()}.${member.type}@priority.test`,
          fullName: `${member.firstName} ${member.lastName}`,
          role: member.type === "head" ? "dept_head" : member.type,
          employee: member,
        })),
      ];
      const passwordHash =
        await tx`select extensions.crypt(${password}, extensions.gen_salt('bf')) as value`;
      const accountIds = new Map();
      const hrAdmin = accounts.find((account) => account.key === "hr-admin");

      for (const account of accounts) {
        const id = stableUuid(`account:${account.key}`);
        const emailConflict = await tx`
          select id from auth.users
          where lower(email) = lower(${account.email}) and id <> ${id}
        `;
        if (emailConflict.length) {
          throw new Error(
            `Account email ${account.email} already belongs to a different auth user.`,
          );
        }
        const idConflict = await tx`
          select email from auth.users
          where id = ${id} and lower(email) <> lower(${account.email})
        `;
        if (idConflict.length)
          throw new Error(`Seed account ID for ${account.email} is already in use.`);

        await tx`
          insert into auth.users(
            instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
            confirmation_token, recovery_token, email_change_token_new, email_change
          ) values (
            '00000000-0000-0000-0000-000000000000', ${id}, 'authenticated', 'authenticated',
            ${account.email}, ${passwordHash[0].value}, now(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            ${tx.json({ full_name: account.fullName })}, now(), now(), '', '', '', ''
          )
          on conflict (id) do update set
            email = excluded.email,
            encrypted_password = excluded.encrypted_password,
            email_confirmed_at = excluded.email_confirmed_at,
            raw_user_meta_data = excluded.raw_user_meta_data,
            updated_at = now()
        `;
        await tx`
          insert into auth.identities(
            id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
          ) values (
            ${stableUuid(`identity:${account.key}`)}, ${id}, ${id},
            ${tx.json({ sub: id, email: account.email, email_verified: true })},
            'email', now(), now(), now()
          )
          on conflict (provider_id, provider) do update set
            user_id = excluded.user_id,
            identity_data = excluded.identity_data,
            updated_at = now()
        `;
        await tx`
          insert into public.profiles(id, email, full_name, is_active, is_demo)
          values (${id}, ${account.email}, ${account.fullName}, true, true)
          on conflict (id) do update set
            email = excluded.email,
            full_name = excluded.full_name,
            is_active = true,
            is_demo = true
        `;
        await tx`
          insert into public.user_roles(user_id, role)
          values (${id}, ${account.role}::public.app_role)
          on conflict (user_id) do update set role = excluded.role
        `;
        accountIds.set(account.key, id);
      }
      completed.push(
        `${accounts.length} development-only role accounts with bcrypt password hashes`,
      );

      section = "organizational structure";
      const departmentIds = new Map();
      for (const department of departments) {
        const rows = await tx`
          insert into public.departments(code, name, status, is_demo)
          values (${department.code}, ${department.name}, 'active', false)
          on conflict (code) do update set name = excluded.name, status = 'active'
          returning id
        `;
        departmentIds.set(department.code, rows[0].id);
      }

      const categoryIds = new Map();
      for (const category of jobCategories) {
        const rows = await tx`
          insert into public.job_categories(code, name, description)
          values (${category.code}, ${category.name}, ${`Job family for ${departments.find((d) => d.code === category.department).name}.`})
          on conflict (code) do update set name = excluded.name, description = excluded.description
          returning id
        `;
        categoryIds.set(category.code, rows[0].id);
        await tx`
          insert into public.department_job_categories(department_id, category_id)
          values (${departmentIds.get(category.department)}, ${rows[0].id})
          on conflict do nothing
        `;
      }

      const positionIds = new Map();
      for (const position of positions) {
        const rows = await tx`
          insert into public.positions(code, title, department_id, description, status, is_demo)
          values (
            ${position.code}, ${position.title}, ${departmentIds.get(position.department)},
            ${`${position.title} role in the ${departments.find((d) => d.code === position.department).name} department.`},
            'active', false
          )
          on conflict (code) do update set
            title = excluded.title,
            department_id = excluded.department_id,
            description = excluded.description,
            status = 'active'
          returning id
        `;
        positionIds.set(position.code, rows[0].id);
        await tx`
          insert into public.job_category_positions(category_id, position_id)
          values (${categoryIds.get(position.category)}, ${rows[0].id})
          on conflict (position_id) do update set category_id = excluded.category_id
        `;
      }

      const employeeIds = new Map();
      const staffByDepartment = new Map();
      for (const member of staff) {
        const accountKey = `${member.department}-${member.type}`;
        const employeeId = stableUuid(`employee:${accountKey}`);
        const position = positions.find(
          (candidate) =>
            candidate.department === member.department && candidate.employeeType === member.type,
        );
        const code = `DEV-${member.type[0].toUpperCase()}-${member.department}`;
        const rows = await tx`
          insert into public.employees(
            id, employee_code, first_name, last_name, email, department_id, position_id,
            employment_status, hire_date, user_id, is_demo
          ) values (
            ${employeeId}, ${code}, ${member.firstName}, ${member.lastName},
            ${`seed.${member.department.toLowerCase()}.${member.type}@priority.test`},
            ${departmentIds.get(member.department)}, ${positionIds.get(position.code)},
            'active', '2024-01-15', ${accountIds.get(accountKey)}, true
          )
          on conflict (id) do update set
            employee_code = excluded.employee_code,
            first_name = excluded.first_name,
            last_name = excluded.last_name,
            email = excluded.email,
            department_id = excluded.department_id,
            position_id = excluded.position_id,
            employment_status = 'active',
            user_id = excluded.user_id,
            is_demo = true
          returning id
        `;
        employeeIds.set(accountKey, rows[0].id);
        if (!staffByDepartment.has(member.department)) staffByDepartment.set(member.department, {});
        staffByDepartment.get(member.department)[member.type] = rows[0].id;
      }

      for (const department of departments) {
        const group = staffByDepartment.get(department.code);
        await tx`
          update public.departments
          set head_employee_id = ${group.head}
          where id = ${departmentIds.get(department.code)}
        `;
        for (const [employeeId, supervisorId] of [
          [group.supervisor, group.head],
          [group.employee, group.supervisor],
        ]) {
          await tx`
            insert into public.reporting_relationships(employee_id, supervisor_id, effective_from, is_current, is_demo)
            values (${employeeId}, ${supervisorId}, '2024-01-15', true, true)
            on conflict (employee_id) where is_current do update set
              supervisor_id = excluded.supervisor_id,
              effective_from = excluded.effective_from,
              is_demo = true
          `;
        }
      }
      completed.push(
        "5 departments, 11 job categories, 20 positions, 5 heads, 5 supervisors, 5 employees and reporting lines",
      );

      section = "competency master data";
      const competencyCategoryIds = new Map();
      for (const category of competencyCategories) {
        const rows = await tx`
          insert into public.competency_categories(name, description, is_demo)
          values (${category.name}, ${`Approved competency definitions for ${category.name.toLowerCase()}.`}, false)
          on conflict (name) do update set description = excluded.description
          returning id
        `;
        competencyCategoryIds.set(category.code, rows[0].id);
      }
      for (const level of proficiencyLevels) {
        await tx`
          insert into public.proficiency_levels(level, label, description, requires_validation)
          values (${level.level}, ${level.label}, ${level.description}, true)
          on conflict (level) do update set
            label = excluded.label,
            description = excluded.description,
            requires_validation = excluded.requires_validation
        `;
      }

      const competencyIds = new Map();
      for (const competency of competencies) {
        const rows = await tx`
          insert into public.competencies(
            code, name, description, definition, category_id, status, is_mandatory, is_safety_critical, is_demo
          ) values (
            ${competency.code}, ${competency.name}, ${competency.description}, ${competency.description},
            ${competencyCategoryIds.get(competency.category)}, 'active', true, ${competency.code === "OPS-CARGO" || competency.code === "CORE-SAFE"}, false
          )
          on conflict (code) do update set
            name = excluded.name,
            description = excluded.description,
            definition = excluded.definition,
            category_id = excluded.category_id,
            status = 'active',
            is_mandatory = true,
            is_safety_critical = excluded.is_safety_critical
          returning id
        `;
        competencyIds.set(competency.code, rows[0].id);

        for (let index = 0; index < indicatorVerbs.length; index += 1) {
          const [prefix, suffix] = indicatorVerbs[index];
          const indicator = `${prefix} ${competency.subject} ${suffix}`;
          await tx`
            insert into public.behavioral_indicators(id, competency_id, level, indicator, sort_order)
            values (${stableUuid(`indicator:${competency.code}:${index + 1}`)}, ${rows[0].id}, ${index + 1}, ${indicator}, 0)
            on conflict (id) do update set
              competency_id = excluded.competency_id,
              level = excluded.level,
              indicator = excluded.indicator
          `;
        }
      }

      for (const position of positions) {
        const requiredLevel =
          position.employeeType === "head" ? 4 : position.employeeType === "supervisor" ? 3 : 3;
        const codes = [...sharedCompetencyCodes, ...departmentCompetencyCodes[position.department]];
        for (const competencyCode of codes) {
          await tx`
            insert into public.position_competency_requirements(
              position_id, competency_id, required_level, is_mandatory, is_safety_critical, is_current, is_demo
            ) values (
              ${positionIds.get(position.code)}, ${competencyIds.get(competencyCode)}, ${requiredLevel},
              true, ${competencyCode === "OPS-CARGO" || competencyCode === "CORE-SAFE"}, true, false
            )
            on conflict (position_id, competency_id) where is_current do update set
              required_level = excluded.required_level,
              is_mandatory = true,
              is_safety_critical = excluded.is_safety_critical,
              is_demo = false
          `;
        }
      }
      completed.push(
        `5 proficiency levels, ${competencies.length} active competencies, observable indicators and position requirements`,
      );

      section = "performance evaluation configuration";
      const factors = await tx`
        select factor_code, title, description, indicators
        from public._default_performance_factors() with ordinality
        order by ordinality
      `;
      if (factors.length !== 10)
        throw new Error(`Expected the original 10 performance factors; found ${factors.length}.`);

      await tx`select set_config('request.jwt.claim.sub', ${accountIds.get(hrAdmin.key)}, true)`;
      await tx`select set_config('request.jwt.claim.role', 'authenticated', true)`;
      for (const position of positions) {
        const positionId = positionIds.get(position.code);
        const profileId = stableUuid(`evaluation-profile:${position.code}`);
        const versionId = stableUuid(`evaluation-profile-version:${position.code}:1`);
        const sectionId = stableUuid(`evaluation-section:${position.code}:factors`);
        const profileName = `${position.title} Evaluation Profile`;

        const profile = await tx`
          insert into public.evaluation_profiles(id, position_id, name, description, is_demo)
          values (
            ${profileId}, ${positionId}, ${profileName},
            ${`Position-specific criteria for ${position.title}; use the shared 1–5 rating scale.`}, false
          )
          on conflict (id) do update set
            position_id = excluded.position_id,
            name = excluded.name,
            description = excluded.description
          returning id
        `;
        if (!profile.length)
          throw new Error(`Unable to create evaluation profile for ${position.title}.`);

        await tx`
          insert into public.evaluation_profile_versions(
            id, profile_id, position_id, version_number, status, rating_scale_max, instructions,
            scoring_method, final_score_rule, is_demo
          ) values (
            ${versionId}, ${profileId}, ${positionId}, 1, 'draft', 5,
            'Rate observable performance against each criterion using the 1–5 scale.',
            'equal', 'supervisor', false
          )
          on conflict (id) do nothing
        `;

        const version = await tx`
          select id, status from public.evaluation_profile_versions where id = ${versionId}
        `;
        if (!version.length)
          throw new Error(`Unable to create evaluation profile version for ${position.title}.`);
        if (version[0].status === "active") {
          const existing = await tx`
            select
              (select count(*)::int from public.evaluation_profile_factors where version_id = ${versionId}) as factor_count,
              (select count(*)::int from public.evaluation_items where version_id = ${versionId}) as item_count
          `;
          if (existing[0].factor_count !== 10 || existing[0].item_count !== 10) {
            throw new Error(
              `Active evaluation profile for ${position.title} is incomplete; refusing to alter it.`,
            );
          }
          continue;
        }

        await tx`select public._seed_performance_factors(${versionId})`;
        for (const factor of factors) {
          const indicators = factor.indicators.map(
            (indicator) => `${indicator} in the ${position.title} role.`,
          );
          await tx`
            update public.evaluation_profile_factors
            set description = ${`${factor.description} Assess results against the expected outcomes of the ${position.title} role.`},
                indicators = ${tx.json(indicators)}
            where version_id = ${versionId} and factor_code = ${factor.factor_code}
          `;
        }
        const sections = await tx`
          insert into public.evaluation_sections(id, version_id, title, description, sort_order)
          values (
            ${sectionId}, ${versionId}, 'Performance Factors',
            'Original ten performance factors with observable indicators for this position.', 0
          )
          on conflict (id) do nothing
          returning id
        `;
        if (!sections.length) {
          const existingSection = await tx`
            select id from public.evaluation_sections where id = ${sectionId} and version_id = ${versionId}
          `;
          if (!existingSection.length)
            throw new Error(`Evaluation section ID conflict for ${position.title}.`);
        }

        for (let index = 0; index < factors.length; index += 1) {
          const factor = factors[index];
          await tx`
            insert into public.evaluation_items(
              id, version_id, section_id, label, help_text, item_type, weight, is_required, sort_order
            ) values (
              ${stableUuid(`evaluation-item:${position.code}:${factor.factor_code}`)}, ${versionId}, ${sectionId},
              ${factor.title}, ${`${factor.description} Apply this criterion to the duties of ${position.title}.`},
              'rating', 10, true, ${index}
            )
            on conflict (id) do nothing
          `;
        }

        const activation = await tx`select public.activate_profile_version(${versionId}) as result`;
        if (!activation[0].result)
          throw new Error(`Unable to activate evaluation profile for ${position.title}.`);
      }
      completed.push(
        `20 position-specific evaluation profiles with all 10 factors and a 1–5 scale`,
      );
    });

    console.log("Development seed completed successfully:");
    for (const item of completed) console.log(`  - ${item}`);
    console.log(
      "No evaluation cycles, assessments, submissions, approvals, training, notifications, or other transactions were seeded.",
    );
  } catch (error) {
    console.error(`Development seed failed during ${section}; the transaction was rolled back.`);
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}

await seed();
