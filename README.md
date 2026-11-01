# Priority Handling Logistics, Inc.

Build Priority Handling Logistics, Inc.: Full-Stack Performance and Development Management System. Build a working, connected human resource management system for a freight and logistics organization. This is not a prototype, landing page, or set of disconnected dashboards. Every page must read and write real database records, enforce permissions on the server, and persist changes after refresh and sign-out.

Build everything in Section 11 in one build session, in phase order. All six modules ship in this build. Each module must work end to end before the build is reported complete, so no page has a dead button.

Where this spec leaves a policy, threshold, approval route, frequency, or rating definition open, make it configurable and mark it "Default - requires organizational validation." Do not present a default as company policy.
0A. Skills
Install three open-source skill sets into this project and use them throughout the build. All three are MIT licensed. They were written for Claude Code, so convert them as described below.

Sources (install all skills from each):

- https://github.com/Jeffallan/claude-skills.git: 67 skills in skills/
- https://github.com/shanraisshan/claude-code-best-practice.git: 9 skills in .claude/skills/ and agent-teams/.claude/skills/
- https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git: 7 skills in .claude/skills/ (use these, not the cli/assets copies)
  Install steps:

1. Shallow-clone each repository into a temporary location outside the project.
2. Copy each skill folder to skills/<skill-name>/ in the project. Keep every file the skill needs to run, including scripts, data, and reference files. Skip media, READMEs, CI files, docs, and cli/.
3. Create skills/THIRD_PARTY_LICENSES.md with each source repository, its URL, and its MIT license text and copyright notice.
4. Adapt each skill for this project. Keep the name and description frontmatter exactly as written. In the body, replace Claude Code-only references (Task tool and subagent spawning, slash commands, .claude/ paths, allowed-tools, hooks) with the equivalent project action, or mark them as not applicable. Do not rewrite the skill's guidance.
5. Create skills/README.md as an index: skill name, source, one-line purpose, and whether it applies to this stack.
6. Make the skills available to contributors through the project documentation and list their files in skills/README.md.
   Use the skills in all coding:

- Before building each area, read the matching skills and follow their guidance. Name the skills used in each module's completion note.
- Area to skills mapping:
  - Foundation, UI, and theming: react-expert, typescript-pro, ui-ux-pro-max, design-system, ui-styling, brand
  - Accessibility and visual review: ui-ux-pro-max, code-reviewer
  - Database schema and RLS: postgres-pro, sql-pro, database-optimizer, secure-code-guardian
  - API and server functions: api-designer, fullstack-guardian, architecture-designer
  - Security reviews: security-reviewer, secure-code-guardian
  - AI recommendations: prompt-engineer
  - Testing: test-master, playwright-expert
  - Debugging: debugging-wizard
  - Operations, monitoring, and deployment: monitoring-expert, devops-engineer, sre-engineer
  - Planning and requirements checks: feature-forge, spec-miner
- Skills for other stacks (for example Django, Rails, Flutter, Salesforce, Shopify, WordPress) stay installed but are not applied here.
- If a skill conflicts with this specification, this specification wins. Note the conflict in the final report.

1. Product goal
   Manage the full employee performance and development lifecycle:

Performance Evaluation → Competency Assessment → Competency Gap Analysis → AI-Assisted Development Recommendations → Human Review and Approval → Learning and Training → Reassessment → Gap Monitoring

The stages share one set of records: employees, departments, positions, competencies, evaluations, learning resources, and training. Succession Planning and Social Recognition are connected HR modules but are not required steps in every employee's development process.

Example flow:

1. An employee belongs to a department and holds a position.
2. The position has an active, versioned Evaluation Profile.
3. The employee is included in an evaluation cycle and receives an assignment.
4. The employee's competencies are assessed against the position's requirements.
5. The system calculates gaps from the configured proficiency levels.
6. The AI service suggests courses, learning paths, or training activities for validated gaps.
7. An authorized reviewer accepts, edits, or rejects each suggestion.
8. Approved activities become part of the employee's development plan.
9. The employee completes learning or training.
10. The competency is reassessed with evidence.
11. The system records whether the gap was reduced or closed.
12. Technology stack
    Use this stack. Do not replace it with another framework or router.

Frontend

- TanStack Start with TanStack Router, React 19, TypeScript, Vite
- Tailwind CSS 4, Radix-based components (shadcn/ui), Lucide React icons
  Data and forms
- TanStack Query for server state, caching, invalidation, and mutations
- React Hook Form for forms
- Zod for validation, shared between client and server
- TanStack Table for sorting, filtering, and pagination
- Recharts for charts
  Backend
- Supabase: PostgreSQL, authentication, file storage, and server functions
- Row Level Security (RLS) on every table that holds employee, evaluation, succession, or recognition data
- Server functions for all business operations and authorization checks
- If the organization requires its own Supabase project, connect it under project Settings > General > External Supabase. The schema, RLS, and access rules in this spec stay the same.
  Other
- PDF-Lib for printable reports and records
- Gemini 2.5 Flash for recommendations through the Gemini API. All AI calls go through one server-side AI service module that reads its credentials from environment variables. Set `GEMINI_API_KEY` as a server secret; never place a key in client code.
  Before building, confirm which of these are already in the project and report any gap. Do not silently substitute a different component.

3. Brand and design system
   Colors (fixed brand palette, used consistently)

- Primary electric blue: #0000FE
- Deep navy (text, headers): #080B3D
- Supporting blue: #3B82F6
- Off-white background: #F8FAFC
- Pale blue accent: #EFF6FF
- White surfaces: #FFFFFF
- Success green: #059669
- Warning amber: #D97706
- Error red: #DC2626
  Define these as design tokens in styles.css. Do not introduce other primary colors.

Typography: Atkinson Hyperlegible for headings and body, Source Sans 3 for data-dense tables and labels. Load both in styles.css and define a type scale.

Themes: Light theme uses off-white background, white surfaces, navy text, and electric-blue primary actions. Dark theme uses dark surfaces with accessible contrast and the same brand accents. Both themes must be complete.

Layout: Collapsible left sidebar, top bar (page context, global search, notifications, help, account menu), and a structured content area. Responsive for desktop, tablet, and mobile.

Components: Build reusable components for cards, tables, dialogs, forms, tabs, badges, empty states, loading skeletons, error states, and confirmation dialogs. Do not style these separately on each page.

Accessibility:

- Keyboard navigation and visible focus indicators on every control
- Status always shown with text or an icon, never color alone
- Labels on all form fields and proper dialog focus handling

4. Roles and access control
   Seven account roles. Each user has one primary role, and records are scoped by department, reporting line, and assignment.

Super Admin

- Purpose: Platform governance
- Main capabilities: System overview, global roles and permissions, security and audit oversight, integration settings, administrative recovery. Does not approve employee performance or succession decisions by virtue of this role.
  Admin
- Purpose: Daily system administration
- Main capabilities: User accounts (create, activate, deactivate), link accounts to employee records, organization setup, departments, positions, reporting lines, routine configuration, notifications.
  HR Administrator
- Purpose: HR operations
- Main capabilities: Employee records, performance management and cycles, competency framework, position requirements, gap monitoring, succession planning, recognition administration, HR reports, approval center, authorized exports.
  Department Head
- Purpose: Department oversight
- Main capabilities: Department dashboard and employees, performance oversight, competency and gap monitoring, learning and training progress, critical position input, delegated approvals, department reports.
  Supervisor
- Purpose: Direct team management
- Main capabilities: Team dashboard, performance evaluations, competency assessments, evidence validation, team gap monitoring, reviewing development recommendations where authorized, team learning progress, recognition nominations and reviews where authorized, team reports.
  Employee
- Purpose: Self-service
- Main capabilities: Own profile (permitted fields), self-evaluations, own performance history, own assessments and gaps, approved development plan, assigned learning, training schedule and results, personal goals, recognition, own notifications.
  Operations Manager (Training & Development Officer)
- Purpose: Learning and training operations
- Main capabilities: Learning dashboard, course catalog and materials, learning paths, competency-to-course mapping, quizzes, course submission for approval, AI recommendation review, development plan management, training calendar and sessions, trainers, attendance, results and effectiveness, reassessment coordination, learning reports.
  Access rules to implement

1. Role-based navigation and page access.
2. Server-side authorization on every protected operation.
3. RLS policies on protected tables.
4. Record scope based on role, department, reporting line, and assignment:
   - Employees: own records only.
   - Supervisors: direct reports (current reporting line).
   - Department Heads: their department(s).
   - HR Administrators: all employees, with succession records restricted to explicitly authorized users.
   - Operations Manager: learning and training records, plus assessment results needed for planning.
5. Ownership and authorization checks on every sensitive write.
6. Audit logging for important changes and approvals.
   Hiding a button or link is not security. Put all permission rules in one central policy module that the server functions and RLS helpers both reflect. Do not scatter role checks through components.
7. Modules
   Module 1: Performance Management
   Pages: Performance Dashboard, Evaluation Cycles, Evaluation Assignments, My Evaluations, Team Evaluations, Evaluation Form, Evaluation Detail, Evaluation History, Evaluation Profiles, Evaluation Profile Builder, Position Evaluation Matrix, Performance Reports.

Process: Cycle setup, employee and evaluator assignment, status tracking (not started, in progress, submitted, under review, approved, reopened), self-evaluation where configured, supervisor evaluation, save draft, submit, review and approval, comments and feedback, evidence attachments, evaluation history, reopening with a recorded reason, audit trail.

Evaluation Profiles (critical requirement):

- Profiles are position-specific and versioned. Do not use one fixed checklist for everyone.
- Each profile has: position, name, description, version number, effective date, status (draft, active, archived), sections, criteria, KPIs, competencies, item types, weights, rating scale, evidence requirements, and instructions.
- Common evaluation standards (process, rating framework) are shared. Criteria, KPIs, competencies, and weights vary by position.
- Only one version per position may be active at a time. Activating a version archives the previous one for new evaluations.
- When an evaluation is created, copy the profile version and its criteria into the evaluation. Editing a profile later never changes completed evaluations.
- Weights in an active profile must total 100 percent. Validate this before activation.
- Item types: numeric rating, short text, long text, single choice, multiple choice, yes/no, KPI with target and actual value.
  Module 2: Competency Management
  Pages: Competency Dashboard, Competency Library, Competency Detail, Job Competency Requirements, Employee Competency Matrix, Competency Assessment Form, Competency Gap Analysis, Competency History.

Competency library fields: name, description, category, definition, proficiency levels, behavioral indicators per level, applicable positions, status (draft, active, retired), mandatory and safety-critical flags.

Proficiency framework: Five numeric levels (1 to 5) defined in a configuration table, not in code. Each level has a label and description that admins can edit. Labels are defaults until validated by the organization.

Position requirements: Required level, mandatory flag, safety-critical flag, effective dates, versioned history. Changes are audited.

Assessments: Employee, competency, assessor, assessment date, current level, evidence, comments, status (draft, submitted, approved), reviewer and review date.

Gap rules:

- Numeric competencies: gap = max(0, required level - current level).
- Not assessed: shown as "Not Assessed" with its own status. Never treated as level 0 or as a low rating.
- Gap view shows: required level, current level, gap, gap status, mandatory and safety-critical flags, assessment date, evidence, and linked development activities.
- Filters: employee, department, position, category, gap status.
- Gap snapshots are saved so trends can be reported over time.
- Completing a course never closes a gap. Closure requires a valid reassessment with evidence and an approved assessment.
  AI-Assisted Development Recommendations (Gemini 2.5 Flash)
  Input to the AI (only what the reviewer is authorized to see, and only what the task needs):
- The employee's assessed competencies and levels
- Position requirements and identified gaps (with mandatory and safety-critical flags)
- Available courses, learning paths, and training activities (IDs and summaries)
- Relevant development history, where authorized
  Required output (structured JSON, validated with Zod before saving):
- Competency and gap snapshot reference
- Recommendation type: course, learning path, or training activity
- Reference to an existing resource ID from the supplied list (any other ID is rejected)
- Rationale and expected learning outcome
- Suggested priority (high, medium, low)
- Sources used and generation timestamp
  Workflow:

1. Detect eligible gaps.
2. Retrieve available learning resources linked to those competencies.
3. Send the authorized context to Gemini 2.5 Flash from the server.
4. Validate the response. Discard or flag anything that fails validation or references an unknown resource.
5. Save the recommendation with status "Pending review."
6. Show it in the AI Recommendations Queue.
7. An authorized reviewer views details and accepts, edits, or rejects. Record the reviewer, decision, comments, and timestamp.
8. An accepted recommendation becomes a development plan item and assigns the activity to the employee.
   Safeguards:

- Recommendations are advisory only.
- AI cannot change ratings, approve its own output, or make promotion, dismissal, compensation, or succession decisions.
- Every recommendation links to a real gap and a real resource.
- Store generation logs (model, timestamp, status, error) without storing secrets.
- Handle timeouts, rate limits, unavailable models, and invalid output with clear error states and a retry option.
  If the AI provider is unavailable or misconfigured: show a clear status on the AI settings page that names the missing or invalid variable. Do not return fabricated recommendations. Do not claim the integration works until a real call succeeds.
  Module 3: Learning Management
  Pages: Learning Dashboard, Course Catalog, Course Detail, Learning Player, Course Management, Course Create/Edit, Learning Paths, Learner Progress, Quiz and Assessment Management.

Course fields: title, description, category, learning objectives, competency mapping, sections and lessons, materials and attachments, owner, duration, difficulty, publication status, enrollment availability, completion requirements.

Publication workflow (default, requires validation): Operations Manager submits a course, HR Administrator approves, and only approved courses appear in the catalog. Archived courses stay visible in historical records.

Learning player: Sections and lessons, reading materials, attachments, lesson completion, course progress, quizzes, scores, and completion records. Progress saves as the learner goes.

Quizzes: Question bank, attempts, scoring, and results. Attempts are stored with timestamps.

Learning paths: Ordered collections of courses and activities tied to specific competencies. Paths can be linked to gaps and development plans.

Assignments: Employees receive assignments through development plans or direct assignment. Assignments generate notifications.
Module 4: Training Management
Pages: Training Dashboard, Development Plans, Development Plan Detail, Training Calendar, Training Session Detail, Attendance Register, Training Results, Training Effectiveness, Training Needs, AI Training Recommendations (shows the shared AI queue filtered to training activities).

Development plans: Employee, linked gaps, objectives, recommended activities, assigned courses and training, responsible person, target dates, progress, status, notes, evidence.

Training sessions: Title, type, date and time, venue or delivery method, trainer, participants, capacity, related competencies, related development plans, status (planned, in progress, completed, cancelled).

Attendance: Authorized training staff view participants, record and update attendance status, add remarks, save, and view history.

Results and effectiveness: Assessment results, outcomes, completion status, participant and trainer feedback, evidence, follow-up assessment, and reassessment results.

Rule: Keep these distinct: participation, course completion, assessment result, and demonstrated competency. A completed session never marks a competency as mastered.
Module 5: Succession Planning
Pages: Succession Dashboard, Critical Position Management, Candidate Identification, Candidate Readiness and Gap Analysis, Succession Plan Detail, Succession Development Progress.

Critical positions: Position, department, criticality, business impact, current incumbent, succession coverage, status, review date.

Candidates: Linked to critical positions. Readiness classifications are configurable. Defaults (requires validation): Ready now, Ready in 1 to 2 years, Ready in 3 or more years, Not ready.

Readiness: Assessments, relevant competencies, identified gaps, development activities, progress over time.

Access: Restricted. Default access is HR Administrators plus Department Heads explicitly granted access for their department. Employees never see succession records, including their own. Every view and change is audited.
Module 6: Social Recognition
Pages: Recognition Feed, Submit Nomination, Approval Queue, Recognition Detail, My Recognition History, Recognition Analytics.

Nomination fields: Nominator, recipient, category (configurable), message, supporting information, submission date, status, reviewer, approval comments, decision history.

Validation: No self-nomination. Minimum message length. Recipient must be an active employee. Configurable nomination limits.

Workflow (default: HR review before publishing, requires validation): Submit → validate → route for approval where configured → approve or reject → publish to the feed according to visibility → keep history → show analytics.

Visibility and privacy: Each approved recognition has a visibility setting (company-wide or department). Nominator visibility is configurable. Only approved items appear in the feed. 6. Shared features
Dashboards: Role-specific. Each shows relevant metrics, pending actions, and recent activity from real records, limited to the user's scope. With no records, the dashboard explains the setup needed and links to the permitted setup action.

Employees: Employee ID, name, contact details, department, position, supervisor, employment status, hire date, job information, linked account, and change history. Employees can edit only permitted fields.

Organization: Departments (with optional parent), positions, and reporting lines with effective dates. Each employee has one active supervisor at a time.

Approval center: One place for pending approvals the user is allowed to act on. Shows the record, workflow type, submitter, submission date, status, and allowed actions. Backed by an approval_tasks table linked to each workflow.

Notifications: Persisted, user-scoped, read and unread state, mark one or all as read. Triggered by evaluation assignments and submissions, pending approvals, assessments, AI decisions, learning and training assignments, schedule changes, completions, reassessments, and recognition decisions. In-app only at first.

Global search: Server-side, scoped to what the user can see. Groups results by type (employees, competencies, courses, evaluations, and so on). Restricted records never appear in results for unauthorized users.

Reports and exports: Role-appropriate reports for performance, competency, gaps, learning progress, training participation and effectiveness, succession coverage, and recognition activity. Filters for date range, department, position, and status. CSV export and PDF export. All sensitive exports are audited.

PDF (PDF-Lib): Printable evaluation summaries, competency gap reports, and development plans, generated on the server with the same access checks.

Audit log: Append-only. Records actor, action, affected record, timestamp, and before/after values for changes. Covers account and role changes, employee changes, evaluation creation, submission, approval, reopening, competency assessments and requirement changes, AI decisions, course publication, attendance and results, succession changes, recognition decisions, configuration changes, and exports. Viewable by Super Admin and Admin. No one edits or deletes entries from the app. 7. Database and backend
Data model
Use normalized PostgreSQL tables with UUID primary keys, foreign keys, created_at and updated_at, indexes on foreign keys and common filters, and check or unique constraints where they apply (for example, one active profile version per position). Use status fields rather than hard deletes for records referenced by history.

Identity and organization: profiles, user_roles, role_permissions, employees, departments, positions, reporting_relationships

Performance: evaluation_cycles, evaluation_assignments, evaluation_profiles, evaluation_profile_versions, evaluation_sections, evaluation_items, evaluation_responses, evaluation_evidence, evaluation_reviews

Competency: competency_categories, competencies, proficiency_levels, behavioral_indicators, position_competency_requirements, competency_assessments, competency_assessment_evidence, competency_gap_snapshots

AI: ai_recommendations, ai_recommendation_items, ai_recommendation_reviews, ai_generation_logs, ai_integration_settings

Learning: courses, course_sections, lessons, learning_materials, course_competency_mappings, learning_paths, learning_path_courses, course_enrollments, lesson_progress, quizzes, quiz_questions, quiz_attempts, course_completions

Training and development: development_plans, development_plan_items, training_sessions, training_participants, trainers, training_attendance, training_results, training_effectiveness_reviews, competency_reassessments

Succession: critical_positions, succession_plans, succession_candidates, succession_readiness_assessments, succession_development_activities

Recognition: recognition_categories, recognition_nominations, recognition_reviews, recognition_publications

Shared: notifications, approval_tasks, audit_logs, file_metadata, system_settings

Add tables where a sound design needs them. Avoid duplicating business data across unrelated tables.

Use version-controlled migrations. Seed a clearly labeled demo dataset that can be removed, so both populated and empty states can be tested.
Server operations
Create server functions with Zod input validation and consistent error responses for:

- Authentication and authorization
- Employees and organization
- Evaluation cycles, assignments, forms, submission, review, reopening
- Evaluation profile versioning and activation
- Competency library, requirements, assessments, gap calculation
- AI recommendation generation, validation, and review
- Learning: courses, paths, enrollment, progress, quizzes
- Training: plans, sessions, attendance, results, reassessment
- Succession and recognition
- Notifications, approval tasks, reports, exports, audit logging
  Use transactions or database functions for multi-record actions, such as submitting an evaluation (snapshot the profile, update status, create approval task, notify, audit) so that either all of it happens or none does.

Authoritative calculations (gap, weights, scores, status transitions) run on the server or in the database, never only in the browser. 8. Security and privacy

- Supabase Auth with secure sessions. Protected routes redirect to sign-in.
- Server-side permission checks on every operation.
- RLS on all protected tables, backed by helper functions for scope (self, direct supervisor, department head, HR role, succession access).
- Protected file storage with signed, scoped access and file-type and size limits.
- Input validation on client and server. Safe error messages that don't expose internals.
- No service-role keys, API secrets, or integration credentials in frontend code.
- Sensitive data (succession, performance comments, exports) restricted and audited.
  Required access tests (run for each role and record the results):

1. Employee requests another employee's evaluation, assessment, or succession record: denied.
2. Supervisor requests an employee outside their reporting line: denied.
3. Department Head requests another department's records: denied.
4. Non-authorized user calls an approval action directly: denied.
5. Super Admin attempts to approve a performance evaluation without a performance-approval role: denied.
6. AI recommendation reviewer attempts to approve their own generated item: denied.
7. Search for a restricted employee or succession candidate: not returned.
8. Anonymous request to any protected server function: denied.
9. Business rules
10. Evaluation profiles are position-specific and versioned.
11. Evaluations keep the profile version and criteria used when created.
12. Proficiency scales and labels are configurable.
13. Not Assessed is distinct from any low rating.
14. Numeric gap = max(0, required - current).
15. Mandatory and safety-critical requirements are flagged and monitored separately.
16. AI recommendations link to real gaps and real resources.
17. AI recommendations need human review and never make consequential HR decisions.
18. Training completion never closes a competency gap.
19. Gap closure requires a valid reassessment and evidence.
20. Succession records are access-restricted.
21. Recognition publishes only after its configured approval and visibility rules are met.
22. Important approvals and configuration changes are audited.
23. Historical records are never silently overwritten when configuration changes.
    Any policy not defined here (evaluation frequency, rating definitions, approval routes, thresholds, retention) is configurable and marked for organizational validation.
24. Experience quality
    Every page connects to the data model and includes: data loading, search and filters, sorting and pagination where relevant, create and edit with validation, save and submit, status transitions, detail views, loading, empty, and error states, success feedback, and permission checks.

- Use confirmation dialogs for consequential actions (submit, approve, reject, reopen, publish, deactivate, export).
- Use optimistic updates only where a change can be safely reversed.
- No static numbers or placeholder charts. Charts use database data.
- Empty states say what is missing and offer the action the user is allowed to take.
  10A. Enterprise engineering standards
  These apply to all layers. Where a standard conflicts with a feature convenience, the standard wins and the trade-off is noted in the final report.
  Database (PostgreSQL)
- Every schema change is a versioned migration. No manual edits in the dashboard. Migrations are applied in order and reviewed before merge.
- Enforce rules in the database, not only in code: NOT NULL on required fields, CHECK constraints for ranges and enums (ratings 1 to 5, weights 0 to 100, dates in order), and explicit ON DELETE behavior on every foreign key.
- Use unique constraints for business keys, for example one active profile version per position, one active supervisor per employee at a time, and one open assessment per employee, competency, and cycle.
- Use enum types or lookup tables for statuses. Define allowed transitions in one place (see Backend).
- Index every foreign key and common filter column. Use partial indexes for active-record queries. Check query plans for list screens.
- Every table has id (UUID), created_at, updated_at (timestamptz, UTC), created_by, and updated_by. Editable business records also have a version integer for optimistic concurrency.
- No hard deletes for records that history depends on: evaluations, assessments, AI recommendations, approvals, training results, recognition. Use status or deleted_at with the audit trail.
- audit_logs is append-only. Enforce it with RLS (no update or delete policies) and a trigger that rejects updates and deletes.
- Store only the personal data the process needs. Mark sensitive columns (succession notes, performance comments, compensation if added) and restrict them through separate tables or column-level grants.
- Keep seed and demo data out of migrations. Seed data is a separate, removable script that never runs in production.
  Row Level Security
- Enable RLS on every table in an exposed schema. Deny by default: a table with RLS on and no policy returns nothing.
- Write separate policies for SELECT, INSERT, UPDATE, and DELETE for each role. Never use USING (true) for authenticated users on protected data.
- Store roles in a user_roles table. Never trust roles from a client-editable field such as user metadata or the profile row.
- Use SECURITY DEFINER helper functions with a fixed search_path for scope checks (is self, is direct supervisor, is in department, has HR role, has succession access). Keep helpers from reading tables through RLS in a way that recurses.
- Use WITH CHECK on INSERT and UPDATE so users cannot write rows they should not own, for example setting another person as evaluator or submitter.
- Protect sensitive columns with restricted views or separate tables. Do not rely on the UI to hide them.
- Storage buckets are private. Storage policies check the path prefix against the same scope rules as the database.
- Revoke unnecessary default grants to anon and public. Browser code uses the user-scoped client. The service role is used only in documented server jobs and never reaches the browser.
- Automated tests run as each role (see Testing) and confirm both allowed and denied access.
  Backend and server functions
- Every operation follows the same sequence: authenticate, validate input, authorize at the record level, run in a transaction, write the audit record, return a typed response. Deny by default.
- Validate all input with Zod at the boundary. Reject unknown fields, enforce maximum lengths and ranges, and cap page sizes.
- Authorization is checked on the specific record, not only the route. Out-of-scope records return the same response as missing records (404), so users cannot probe for IDs.
- Use transactions for every multi-row action. Example: submitting an evaluation snapshots the profile, changes status, creates the approval task, queues notifications, and writes the audit record, all or nothing.
- Use explicit state machines for statuses (evaluation, approval, AI recommendation, course publication, recognition). The server rejects any transition not on the list.
- Enforce separation of duties in code and in the database: the submitter cannot approve their own item, and an AI-generated item cannot be approved by the system.
- Use an outbox table for notifications, emails, and AI calls. Write the event in the same transaction as the business change, then process it asynchronously with retries and a dead-letter state.
- Keep secrets in environment variables. Never log them, never return them, and never include them in error messages.
- Log in structured JSON with request ID, user ID, action, and duration. Redact personal data from logs.
  Idempotency
- Every operation that creates a record or triggers a side effect accepts an Idempotency-Key (client-generated UUID). This includes submit, approve, reject, publish, attendance save, AI generation, notification sends, and exports.
- The server stores the key, a hash of the request body, the user, the response, and a status. A repeated key with the same body returns the stored response. The same key with a different body returns a conflict error.
- Keys expire after 24 hours. Keys are scoped per user.
- Database unique constraints back this up, so a retry cannot create duplicate records even if the key store fails.
- The UI disables submit buttons while a request is in flight and reuses the same key for retries of the same action.
  Concurrency
- Editable records send their version (or ETag) on update. The server applies the change only when the version matches, and returns a conflict error (409) when it does not.
- The UI shows a clear conflict message with a reload option. It never silently overwrites another person's change.
  External AI calls
- Set a timeout on every outbound call. Retry only idempotent calls, with exponential backoff and jitter, and a fixed maximum attempt count.
- Rate-limit AI generation per user and per organization. Enforce a per-run item limit so one job cannot run unbounded.
- Validate the structured AI output against a schema before saving. Reject anything that does not match, and reject any resource ID not supplied in the request.
- Treat employee-entered text as data. Do not let it override system instructions. Never render AI output as HTML without escaping.
- Log model name, latency, status, and token counts for each call. Do not log full prompts that contain personal data.
- Read the provider and its credentials from environment variables through one AI service module. Switching providers must not require changes outside that module.
  API design
- Version the API path (for example /api/v1/...). Use resource-based URLs and plural nouns.
- Use GET for reads, POST for creates and actions, PATCH for partial updates, and DELETE only where deletion is allowed. Use the status codes: 200 OK, 201 Created, 204 No Content, 400 invalid input, 401 unauthenticated, 403 forbidden, 404 not found or out of scope, 409 conflict, 422 business rule violated, 429 rate limited, 5xx server error.
- Use one error format everywhere: { "error": { "code", "message", "request_id", "details" } }. Do not return stack traces.
- Use cursor-based pagination for large lists. Whitelist sort fields and filter fields. Never build SQL from request input.
- Use Idempotency-Key on unsafe methods and ETag / If-Match on updates.
- Keep an OpenAPI description of the API and test it against the implementation.
- Restrict CORS to the app's own origin. Send security headers (Content-Security-Policy, Strict-Transport-Security, X-Content-Type-Options, Referrer-Policy).
- Rate-limit sign-in, search, exports, and AI endpoints.
  File uploads
- Check file type by content, not only by extension. Enforce size limits.
- Store files under random keys, never under user-supplied names or paths.
- Serve files only through authorized, short-lived signed URLs.
- Scan uploads for malware if the platform supports it, and state clearly if it does not.
  Frontend
- Use TanStack Query with query-key factories, a clear invalidation rule after each mutation, and sensible stale times. Do not cache sensitive data longer than needed, and clear the cache on sign-out.
- Use React Hook Form with the same Zod schemas the server uses, so validation rules match. Map server field errors back onto the form.
- Warn users about unsaved changes before leaving a form.
- Use route-level error boundaries and show the request ID when an error occurs.
- Read permissions from the central policy module through one hook. Do not repeat role checks in components.
- Render user content as text. Do not use dangerouslySetInnerHTML for user content. If rich text is needed, sanitize it with an allowlist.
- Keep secrets out of the client bundle. Only public configuration can use client-side variables.
- Use optimistic updates only for low-risk, reversible actions. Approvals, succession changes, and publication always wait for server confirmation.
- Handle expired sessions: detect a 401, send the user to sign-in, and return them to the page afterward.
- Split code by module, paginate or virtualize large tables, and set performance budgets for first load.
- Meet WCAG 2.2 AA: keyboard operation, focus management in dialogs, labeled fields, live regions for async results, and sufficient contrast in both themes.
- Show dates and times in the user's timezone, and store and send them in UTC.
  Security baseline
- Follow the OWASP ASVS Level 2 baseline and the OWASP Top 10.
- Enforce a password policy and leaked-password checks. Offer multi-factor sign-in, and require it for Super Admin and Admin accounts.
- Set session expiry and idle timeout. Rotate refresh tokens.
- Run dependency and static security scans before publishing. Resolve critical and high findings before release.
- Use least-privilege database access. Keep the service role out of client code and limit it to documented jobs.
- Document data retention, backup, and restore procedures.
  Testing
- Unit tests for the business rules: gap calculation, weight totals, state transitions, scoring, and permission checks.
- Integration tests for each server operation, including idempotent replays and concurrent updates that should return a conflict.
- RLS tests that sign in as each of the seven roles and confirm allowed and denied access for every protected table.
- API contract tests against the OpenAPI description.
- End-to-end tests for the critical workflows: evaluation submission and approval, competency assessment and gap closure, AI recommendation review, course publication, succession access, and recognition approval.
- Accessibility checks on each major page in both themes.
  Operations
- Separate development, staging, and production environments with separate databases and keys.
- Provide a health check endpoint and error monitoring.
- Keep a short README and runbook that list environment variables, setup steps, the migration process, and the restore procedure.
- Record significant architecture decisions and trade-offs in short decision records.

11. Build phases
    Complete phases 1 to 6 in order in this single build. Each phase's acceptance criteria in Section 12 must pass before moving on.

Phase 1: Foundation. Stack setup, brand tokens, fonts, light and dark themes, app shell (sidebar, top bar, responsive layout), shared components, environment and integration boundaries, protected routing.

Phase 2: Database and authentication. Supabase, initial schema and migrations, sign-in and sign-out, all seven roles, RLS policies, central permission module, user and role administration, employee and organization records (departments, positions, reporting lines).

Phase 3: Shared services. Notifications, approval tasks, audit logging, validation schemas, global search with scope, file storage with access rules.

Phase 4: Performance and competency core. Evaluation cycles, position-specific versioned profiles and the profile builder, assignments, evaluation form with draft and submit, review and approval, reopening. Competency library, five-level framework configuration, position requirements, assessments with evidence, gap calculation and display, filters, Not Assessed handling, competency history.

Phase 5: Development, AI, learning, and training. Gemini 2.5 Flash integration with validation, AI queue with accept, edit, reject, and audit. Course catalog and management, publication workflow, learning player with progress, quizzes, learning paths. Development plans, training calendar, sessions, attendance, results, effectiveness, and reassessment that updates competency status from evidence.

Phase 6: Succession, recognition, reporting, and administration. Critical positions, candidates, readiness, restricted access. Recognition nominations, approvals, feed, history, analytics. Reports, CSV and PDF exports, configuration pages, system settings, integration settings. 12. Acceptance criteria
Phase 1 to 2

- The app runs. Users sign in and out. Protected pages redirect when signed out.
- Navigation changes by role. Unauthorized server calls are rejected.
- Records persist across refresh and new sessions. RLS blocks out-of-scope reads and writes.
  Phase 3 to 4
- An HR Administrator creates a position-specific profile, activates it, and it cannot be activated with weights that total something other than 100 percent.
- A supervisor completes an assigned evaluation, saves a draft, submits it, and an HR reviewer approves it.
- A historical evaluation still shows its original profile version after the profile is edited.
- An authorized assessor records a competency assessment with evidence.
- Gaps calculate and display correctly. An unassessed competency shows "Not Assessed," never level 0.
  Phase 5
- Gemini recommendations run from the server using `GEMINI_API_KEY`. A missing or invalid key shows a clear error, not fake output.
- Recommendations link to real gaps and real resources. Invalid AI output is rejected.
- A reviewer accepts, edits, or rejects. The AI cannot approve its own output.
- An accepted recommendation becomes a tracked development item.
- Courses are created, submitted, approved, and published. Employees see only assigned or published content.
- Lesson progress and quiz results persist. Completing training does not close a gap.
- Sessions are scheduled, attendance and results are recorded, and reassessment updates competency status only with evidence.
  Phase 6
- Succession records are visible only to authorized users. Employees cannot see them.
- Recognition nominations are validated, reviewed, and published only after approval. Visibility rules apply.
- Reports use database data and respect scope. Exports are audited.
  Skills (Section 0A)
- skills/ contains all 83 skill folders from the three sources, with the license file and index.
- Each converted skill keeps its original name and description and has no Claude Code-only instructions left in its body.
- Each module's completion note names the skills applied to it.
  Engineering standards (Section 10A)
- Retrying a submit, approve, or AI generation request with the same Idempotency-Key returns the original result and creates no duplicate records.
- Reusing a key with a different request body returns a conflict error.
- Two users editing the same record at once: the second save returns a conflict and does not overwrite the first.
- RLS tests pass for all seven roles on every protected table, including denied cases.
- Every list endpoint paginates, whitelists sort and filter fields, and rejects unknown input fields.
- Every mutation writes an audit record in the same transaction as the change.
- Error responses use the standard format and contain no stack traces.
- No secret appears in the client bundle, logs, or error messages.
- Critical workflows pass end-to-end tests in both light and dark themes.
  All phases
- Notifications are user-scoped and persist. Approval tasks link to real workflows.
- Audit entries exist for every important action in Section 6.
- Light and dark themes work. The layout is responsive and keyboard accessible.

13. Final report
    When the session ends, report:
1. What was built and works end to end.
1. Tables and migrations created.
1. Pages and modules that work.
1. Frontend-to-backend workflows connected.
1. RLS policies and authorization controls in place.
1. Integrations configured and tested (and which were not).
1. Features still incomplete.
1. Credentials or configuration still needed (for example, `GEMINI_API_KEY` for AI recommendations).
1. Errors, compatibility issues, and known limitations.
1. Skills installed (count), any that failed to copy or adapt, and which skills were applied to which modules.
   Do not report a feature as complete if it only has a frontend or was tested only with demo data.

## Development

Requirements: Node.js 20.19 or newer, npm, and Docker Desktop (for local Supabase).
The app requires a Supabase backend; the optional Gemini and outbox integrations can
be configured later. See [the runbook](./docs/RUNBOOK.md) for all environment
variables, deployment operations, and safety requirements.

1. Install dependencies and create your local environment file:

   ```sh
   npm ci
   cp .env.example .env
   ```

   On PowerShell, use `Copy-Item .env.example .env`.

2. Start Docker Desktop, then start the local Supabase stack:

   ```sh
   npx supabase start
   npx supabase status -o env
   ```

   Copy the local `API_URL`, `ANON_KEY`, and `SERVICE_ROLE_KEY` values from the
   status output into the corresponding Supabase variables in `.env`. The example
   already contains the local Postgres URL and port.

3. Supabase CLI applies `supabase/migrations/` during local startup. Check the
   migration sources and local history:

   ```sh
   npm run db:check
   npx supabase migration list --local
   ```

   For a linked database, review `npm run db:migrations:list` and
   `npm run db:push:dry-run` before a deliberate `npm run db:push`. Supabase CLI
   automatic seed execution is disabled. Development demo fixtures are separate
   and require the guarded command in [the runbook](./docs/RUNBOOK.md#setup).

4. Start the app:

   ```sh
   npm run dev
   ```

   Open the local URL printed by Vite. `.env` is loaded for server-side runtime,
   migration, and seed commands; only `VITE_` variables are exposed to browser
   code.

Useful validation commands:

```sh
npm run typecheck
npm test
npm run lint
npm run build
```
