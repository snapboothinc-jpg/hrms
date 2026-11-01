# Local initial system setup

The initial system is seeded by `scripts/database/seed-initial.mjs`, not by
automatic Supabase SQL seeding. `supabase/config.toml` deliberately keeps
automatic seed execution disabled. The script runs only against a loopback
PostgreSQL host, verifies that every migration is applied, hashes each account
password with PostgreSQL `crypt`, uses stable identifiers, and verifies that
the initial state contains no employee workflow records.

Copy `.env.example` to `.env`, set the local Supabase URL and publishable key,
and set the seven `HRMS_DEV_*_PASSWORD` variables to distinct passwords of at
least 12 characters, then run:

```powershell
npm.cmd run db:setup:local
```

This command resets only the local Supabase database, applies repository
migrations without an automatic seed, and runs the initial seed. It requires a
running local Supabase stack and Docker. To seed an already-reset local database
without another reset, run `npm.cmd run db:seed:local`.

Seeded login emails:

| Role                                        | Email                          |
| ------------------------------------------- | ------------------------------ |
| Super Admin                                 | `super-admin@hrms.test`        |
| Admin                                       | `admin@hrms.test`              |
| HR Administrator                            | `hr-admin@hrms.test`           |
| Department Head                             | `department-head@hrms.test`    |
| Supervisor                                  | `supervisor@hrms.test`         |
| Employee                                    | `employee@hrms.test`           |
| Operations Manager / Training & Development | `operations-manager@hrms.test` |

Use the password configured for the corresponding role in `.env`; credentials
are intentionally not embedded in source or shown on the sign-in page.

The seed creates the Operations department, two positions, one linked supervisor
and employee, position competency requirements, competencies, evaluation
profiles, the ten common factors, and configurable KPI definitions. Targets,
weights, classification thresholds, evaluation-cycle dates, actual assessments,
and employee-specific business records are not fabricated. HR must confirm
company policy, set KPI targets and weights, and create a cycle and assignments
before evaluations can begin.

To check the baseline against an isolated staging Supabase project, set
`RUN_ACCESS_TESTS=1`, `HRMS_TEST_ENV=staging`, the dedicated
`HRMS_STAGING_SUPABASE_URL` and publishable key, plus each role's
`HRMS_STAGING_<ROLE>_PASSWORD`. The check-only initial-system tests log in to
all seeded roles. The remediation integration tests are separate, require
explicit staging transaction fixture IDs, and mutate those fixtures.

Never use linked or hosted database reset commands for development setup.
