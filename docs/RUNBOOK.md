# Priority Handling Logistics, Inc. runbook

## Environment variables

| Variable                                         | Where            | Purpose                                                                                                     |
| ------------------------------------------------ | ---------------- | ----------------------------------------------------------------------------------------------------------- |
| VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY | browser (public) | Supabase client                                                                                             |
| SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY           | server           | auth middleware, health check                                                                               |
| SUPABASE_SERVICE_ROLE_KEY                        | server only      | account creation/deactivation (admin), file type rejection cleanup, signed evidence URLs, outbox processing |
| DATABASE_URL                                     | migration only   | Direct PostgreSQL connection for Drizzle migrations                                                         |
| GEMINI_API_KEY                                   | server only      | Required default provider credential for Gemini 2.5 Flash                                                   |
| AI_MODEL                                         | server only      | Optional Gemini model override; default is `gemini-2.5-flash`                                               |
| OUTBOX_PROCESSOR_SECRET                          | server only      | bearer secret for the outbox processing endpoint                                                            |
| OUTBOX_PROCESSOR_SECRET_PREVIOUS                 | server only      | Optional previous secret during credential rotation                                                         |

No secret is used in browser code, logged, or returned in errors. The AI settings
page names a missing variable but never its value.

## Setup

1. Use a clean, isolated Supabase development database. Set `DATABASE_URL` to its direct Postgres connection string and run `npm run db:check`, then `npm run db:migrate`. This invokes Drizzle Kit's SQL migrator, which executes the SQL files in `drizzle/migrations/` in `_journal.json` order. Do not point the command at production during development.
2. The schema is maintained as reviewed SQL; `drizzle/schema.ts` is intentionally empty, and Drizzle snapshots are not used as schema authority. Add schema changes as reviewed SQL, then update the journal and run `npm run db:check`.
3. Migration 0000 is the base identity/organization schema. The original source was consolidated into seven domain migrations; `0007_personal_goals.sql`, `0008_report_workspace.sql`, and `0009_phase3_approvals_qualification.sql` are additive Phase 3 changes for employee-owned goals, saved reports/export metadata, approval and qualification workflows, and learning/reassessment deadlines. Migration 0005 blocks before altering the fixed 1–5 scale if existing scores/snapshots require review. Migration 0003 sets Gemini-only provider configuration.
4. Demo fixtures are not applied by `db:migrate`. For an isolated, empty development database only, set `HRMS_SEED_ENV=development` and run `npm run db:seed:demo` (requires `psql` and `DATABASE_URL`). The seed includes test-account credentials and must never be run against production.
5. Demo accounts use the `@priorityhandling.demo` domain and password `Priority-Demo-2026!`. Remove demo data by signing in as a non-demo Super Admin and calling `remove_demo_data()`. Reset mutable demo rows for a fresh live test with `reset_demo_data()`.

| Migration                                   | Responsibility                                                                                             | Consolidated source                     |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `0000_base_identity_organization.sql`       | Base identity, roles, organization, shared primitives, baseline RLS/grants                                 | `0000`                                  |
| `0001_performance_competency.sql`           | Performance/competency schema and business operations                                                      | `0001`, `0002`                          |
| `0002_storage_security.sql`                 | Evidence bucket policies, audit-history read policy, trigger search-path fixes                             | `0003` storage policies, `0004`, `0005` |
| `0003_learning_training_ai.sql`             | Learning/training/AI/outbox schema and operations, Gemini-only settings                                    | `0006`–`0008`, `0013`                   |
| `0004_succession_recognition_reporting.sql` | Succession, recognition and scoped report operations                                                       | `0010`                                  |
| `0005_hrms_v2_remediation.sql`              | Evaluation acknowledgement/scale, course review, REST PATCH, scoped nav context                            | `0012`                                  |
| `0006_demo_lifecycle.sql`                   | Guarded demo removal/reset functions (function definitions only)                                           | `0011` lifecycle functions              |
| `0007_personal_goals.sql`                   | Employee-owned personal goals, review/progress lifecycle, scoped RLS, audit and idempotent write functions | Phase 3 continuation                    |
| `0008_report_workspace.sql`                 | Owner-scoped saved report definitions, RLS-scoped export history, audit logging and idempotent writes      | Phase 3 continuation                    |
| `0009_phase3_approvals_qualification.sql`   | Development/succession approvals, candidate qualifications, course due dates, reassessment dates, guarded transitions and notifications | Phase 3 continuation |

`drizzle/seeds/demo.sql` contains the separated development fixtures originally in
`0003`, `0009`, and `0011`; the final account names and password from `0014` are
applied directly in the seed. It is intentionally not listed in the migration journal.
The prior Drizzle snapshots had empty schemas and did not represent the SQL objects;
they were removed. The SQL journal is the source used by `drizzle-kit migrate`.
`npm run db:check` validates journal/file parity, order, table RLS enablement,
SECURITY DEFINER search paths, no direct authenticated table-write grants, and key
generated Supabase types. It is a static check, not a substitute for running the
migrations in isolated PostgreSQL/Supabase.
`docs/pending/phase5_learning_training_ai.sql` is a non-executable reference draft;
it is not part of the migration journal. Apply future schema changes only through
the canonical migrations under `drizzle/migrations/`.

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
- The remediation integration suite additionally requires dedicated fixture IDs: `HRMS_STAGING_ACK_ASSIGNMENT_ID` must be approved, unacknowledged, assigned to `employee@priorityhandling.demo`, and have a different evaluator; `HRMS_STAGING_PATCH_COURSE_ID` must be editable; `HRMS_STAGING_COURSE_APPROVE_ID` and `HRMS_STAGING_COURSE_RETURN_ID` must each be draft, have at least one section, be created by the Operations Manager demo account, and be safe to submit/review; `HRMS_STAGING_COURSE_SELF_APPROVAL_ID` must be a draft with at least one section and owned by `hr@priorityhandling.demo`. These records are mutated. Recreate/reset the fixtures in staging before rerunning; do not use production records.

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
