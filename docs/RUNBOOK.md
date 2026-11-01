# Priority Handling Logistics, Inc. runbook

## Environment variables

| Variable                                         | Where            | Purpose                                                                                                     |
| ------------------------------------------------ | ---------------- | ----------------------------------------------------------------------------------------------------------- |
| VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY | browser (public) | Supabase client                                                                                             |
| SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY           | server           | auth middleware, health check                                                                               |
| SUPABASE_SERVICE_ROLE_KEY                        | server only      | account creation/deactivation (admin), file type rejection cleanup, signed evidence URLs, outbox processing |
| DATABASE_URL                                     | seed only        | Direct PostgreSQL connection for explicitly requested development fixture seeding                           |
| GEMINI_API_KEY                                   | server only      | Required default provider credential for Gemini 2.5 Flash                                                   |
| AI_MODEL                                         | server only      | Optional Gemini model override; default is `gemini-2.5-flash`                                               |
| OUTBOX_PROCESSOR_SECRET                          | server only      | bearer secret for the outbox processing endpoint                                                            |
| OUTBOX_PROCESSOR_SECRET_PREVIOUS                 | server only      | Optional previous secret during credential rotation                                                         |

No secret is used in browser code, logged, or returned in errors. The AI settings
page names a missing variable but never its value.

## Setup

1. Supabase CLI is the sole migration manager. Run `npm run db:check` and inspect `npm run db:migrations:list`. For local initialization, `npx supabase start` applies `supabase/migrations/`; for a linked database, review `npm run db:push:dry-run` before the deliberate `npm run db:push`. Never use linked resets in deployment or point unreviewed migrations at production.
2. Schema changes are reviewed SQL migrations in `supabase/migrations/`, ordered by their 14-digit Supabase migration versions. The former Drizzle journal timestamps were preserved as these versions; SQL bodies were moved without regeneration. Drizzle ORM and Drizzle Kit are not used by application code and are no longer part of the migration workflow.
3. Migration 0000 is the base identity/organization schema. The original source was consolidated into seven domain migrations; `0007_personal_goals.sql`, `0008_report_workspace.sql`, and `0009_phase3_approvals_qualification.sql` are additive Phase 3 changes for employee-owned goals, saved reports/export metadata, approval and qualification workflows, and learning/reassessment deadlines. Migration 0005 blocks before altering the fixed 1–5 scale if existing scores/snapshots require review. Migration 0003 sets Gemini-only provider configuration. Migration 0019 adds versioned, position-specific performance factors and independent self/supervisor scoring; configure a profile and its scoring/classification rules before activating it for a cycle.
4. Supabase CLI seed execution is explicitly disabled in `supabase/config.toml`; even local reset is invoked with `--no-seed`. The development demo seed is in `supabase/seeds/development/demo.sql`, outside migrations. On an isolated database, set `HRMS_SEED_ENV=development` and run `npm run db:seed:demo` (requires `psql` and `DATABASE_URL`). Loopback database hosts are allowed directly; a remote development host additionally requires `HRMS_SEED_REMOTE_CONFIRM` to exactly match its hostname. The SQL seed is repeat-safe for a complete fixture set and aborts if it finds a partial/conflicting fixture. Never seed production.
5. Seed accounts use `firstname.role+priority@gmail.com` addresses and the shared development password `Test1234!`. The seed contains seven role accounts and one Logistics Department. Remove demo data by signing in as a non-demo Super Admin and calling `remove_demo_data()`. `reset_demo_data()` clears mutable demo rows but does not recreate them; rebuild the isolated database and rerun the seed to restore a complete workflow.

| Role               | Seed account                           |
| ------------------ | -------------------------------------- |
| Super Admin        | `victor.superadmin+priority@gmail.com` |
| Admin              | `nina.admin+priority@gmail.com`        |
| HR Administrator   | `liza.hradmin+priority@gmail.com`      |
| Department Head    | `maria.depthead+priority@gmail.com`    |
| Supervisor         | `jose.supervisor+priority@gmail.com`   |
| Employee           | `ana.employee+priority@gmail.com`      |
| Operations Manager | `carlo.opsmanager+priority@gmail.com`  |

The shared password for every account in this table is `Test1234!`; use it only in isolated development environments.

| Supabase migration file                                 | Classification and responsibility                                                            |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `20261030230559_base_identity_organization.sql`         | Canonical schema: base identity, roles, organization, shared primitives, baseline RLS/grants |
| `20261030230600_performance_competency.sql`             | Canonical schema/functions: performance and competency                                       |
| `20261030230601_storage_security.sql`                   | Canonical policies and function hardening: evidence storage and audit history                |
| `20261030230602_learning_training_ai.sql`               | Canonical schema/functions and required defaults: learning, training, AI, outbox             |
| `20261030230603_succession_recognition_reporting.sql`   | Canonical schema/functions: succession, recognition and scoped reporting                     |
| `20261030230604_hrms_v2_remediation.sql`                | Canonical forward changes: evaluation/course operations and permissions                      |
| `20261030230605_demo_lifecycle.sql`                     | Canonical functions only: guarded demo removal/reset; no fixtures                            |
| `20261030230606_personal_goals.sql`                     | Canonical schema/functions: employee goals and review lifecycle                              |
| `20261030230607_report_workspace.sql`                   | Canonical schema/functions: saved reports and export history                                 |
| `20261030230608_phase3_approvals_qualification.sql`     | Canonical schema/transitions: approvals, qualifications, course and reassessment deadlines   |
| `20261030230609_policy_and_foreign_key_indexes.sql`     | Canonical indexes and policy optimization                                                    |
| `20261030230610_fix_linter_function_errors.sql`         | Canonical forward function corrections                                                       |
| `20261030230611_fix_demo_cleanup_ambiguous_columns.sql` | Canonical forward demo-cleanup function correction                                           |
| `20261030230612_restrict_client_database_grants.sql`    | Canonical grants: authenticated read-only tables/sequences                                   |
| `20261030230613_restrict_default_function_execute.sql`  | Canonical default function privileges                                                        |
| `20261030230614_bootstrap_initial_super_admin.sql`      | Canonical guarded bootstrap function                                                         |
| `20261030230615_mark_demo_fixtures.sql`                 | Canonical demo lifecycle function version                                                    |
| `20261030230616_mark_demo_reporting_lines.sql`          | Canonical replacement adding reporting-line fixture marking                                  |
| `20261030230617_compact_demo_reset.sql`                 | Canonical forward demo reset function correction                                             |
| `20261030230618_performance_evaluation_factors.sql`     | Canonical schema/functions: versioned factors, responses, scoring                            |

`supabase/seeds/development/demo.sql` contains the separated, minimal Logistics Department development
fixtures. It is not a migration and is disabled in Supabase CLI seed configuration. Each seeded role is
assigned by the permissions catalogue from the migrations; the shared fixture password
is `Test1234!`. Never use this password outside isolated development data.
The previous Drizzle snapshots were empty and did not represent the SQL objects.
`npm run db:check` validates migration naming/order, seed separation, table RLS enablement,
SECURITY DEFINER search paths, no direct authenticated table-write grants, and key
generated Supabase types. It is a static check, not a substitute for running the
migrations in isolated PostgreSQL/Supabase.
`docs/pending/phase5_learning_training_ai.sql` is a non-executable reference draft superseded by
`20261030230602_learning_training_ai.sql`; it is not part of the migration sequence. Apply future schema changes only through
the canonical migrations under `supabase/migrations/`.

The linked project was inspected read-only during standardization: Supabase reported no
migration rows, no Supabase/Drizzle migration tracking tables were present, and the checked core tables
(`profiles`, `employees`, `role_permissions`, and `evaluation_profile_factors`) did not
exist. This is evidence for that linked project only; migration status in any other
environment remains unknown. No migration was pushed. Local Postgres/Supabase replay
must be run before deployment.

## Health

`GET /api/public/health` returns `{status, checks}`; 503 when configuration is missing.

## Outbox

Notifications, emails and AI calls are written to `public.outbox_events` in the same
transaction as the business change. Processing is asynchronous:

- Endpoint: `POST /api/public/outbox/process` with header `Authorization: Bearer $OUTBOX_PROCESSOR_SECRET`.
- Schedule it with an external cron (e.g. every minute) against the deployed URL
  `https://<application-host>/api/public/outbox/process`.
- Behavior: `notification` events are marked sent; `email` events retry with
  exponential backoff (2^n minutes) up to 7 attempts, then move to the `dead`
  (dead-letter) state; unknown kinds go straight to `dead`.
- The processor runs as `service_role` only; the endpoint rejects callers without the secret.

## REST API (/api/v1)

- OpenAPI description: `GET /api/v1/openapi.json`.
- Auth: Supabase access token in `Authorization: Bearer <token>`; all data is RLS-scoped.
- Pagination: `?cursor=<opaque-compound-cursor>&limit=<1-100>`; the cursor is bound to the selected sort field/direction and includes the unique `id` tie-breaker. Changing sort requires starting again without a cursor.
- Sorting/filtering: whitelisted fields only (`sort`, plus documented query params).
- Unsafe methods require an `Idempotency-Key` UUID header; replays with the same key
  and body return the stored result, a different body returns 409.
- Updates require `If-Match` with the ETag from the last GET (`W/"<id>:<version>"`);
  mismatches return 412, a missing header 428.
- Errors use the standard shape `{ "error": { "code", "message" } }`.

## Tests

- Unit: `npm test` (includes evaluation-scale, AI configuration, REST PATCH validation, and cursor traversal tests).
- Live access tests mutate demo records and are disabled unless all staging guards are set. They do not read `.env`. Configure `HRMS_TEST_ENV=staging`, `RUN_ACCESS_TESTS=1`, `HRMS_STAGING_SUPABASE_URL`, `HRMS_STAGING_SUPABASE_PUBLISHABLE_KEY`, and `HRMS_STAGING_DEMO_PASSWORD`; never point these variables at the shared preview/published backend.
- To test the ungranted Department Head case, also provide `HRMS_STAGING_UNGRANTED_DEPT_HEAD_EMAIL` and `HRMS_STAGING_UNGRANTED_DEPT_HEAD_PASSWORD` for a dedicated staging account with that role and no succession grant.
- The remediation integration suite additionally requires dedicated fixture IDs: `HRMS_STAGING_ACK_ASSIGNMENT_ID` must be approved, unacknowledged, assigned to `ana.employee+priority@gmail.com`, and have a different evaluator; `HRMS_STAGING_PATCH_COURSE_ID` must be editable; `HRMS_STAGING_COURSE_APPROVE_ID` and `HRMS_STAGING_COURSE_RETURN_ID` must each be draft, have at least one section, be created by the Operations Manager seed account, and be safe to submit/review; `HRMS_STAGING_COURSE_SELF_APPROVAL_ID` must be a draft with at least one section and owned by `liza.hradmin+priority@gmail.com`. These records are mutated. Recreate/reset the fixtures in staging before rerunning; do not use production records.

## Backup and restore

Configure automated database backups and restore procedures in the Supabase project. After a restore, re-run the access tests. Retention periods are a "Default - requires organizational validation" policy and are not yet configured.

## Environments

**Current state: one backend instance serves both the preview and the published app.**
Separate staging and production environments are NOT yet set up — this is an open item.

To set them up:

1. Create a second Supabase project for staging. Each
   backend has its own database, auth users, storage and keys — that separation is the
   point; never point staging at the production backend.
2. Apply the same migrations in order to the staging backend.
3. Set staging's own secrets (`GEMINI_API_KEY`, `OUTBOX_PROCESSOR_SECRET`)
   on the staging environment only.
4. Promote by merging to the production project and publishing; never copy production
   data into staging — use `reset_demo_data()`/seeded demo data there.

## Account security

- Two-factor sign-in for Admin and Super Admin: **not yet built** (open item).
- Idle session timeout: **not yet built** (open item).
- Refresh token rotation: handled by Supabase Auth; no app code needed.
