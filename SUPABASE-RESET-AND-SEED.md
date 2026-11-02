# Local Supabase setup and development seed

## Database safety

The seed command is an explicit development setup tool. It is not a production
reset, it does not truncate tables, and it must never be pointed at production.
This repository cleanup did not connect to, reset, or otherwise modify a database.

Supabase CLI automatic seeding remains disabled in `supabase/config.toml`.
Local schema setup and the centralized seed are separate operations:

```powershell
npx.cmd supabase start
npx.cmd supabase db reset --local --no-seed
```

`db reset` is destructive, so use it only for a disposable local Supabase
database. Never substitute `--linked` for `--local`.

## Run the one official seed

After applying all migrations to the local database, provide the local database
connection string and a unique password for the development accounts:

```powershell
$env:HRMS_SEED_ENV = 'development'
$env:DATABASE_URL = 'postgresql://postgres:<local-password>@127.0.0.1:54322/postgres'
$env:HRMS_SEED_PASSWORD = '<unique-password-of-at-least-16-characters>'
npm.cmd run db:seed
```

The password is hashed with bcrypt by PostgreSQL and is not included in the
repository. The seed rejects non-local hosts unless explicitly confirmed with
`HRMS_SEED_REMOTE_CONFIRM`; remote confirmation does not make production safe.
Use local development only.

The script in `scripts/seed/seed.mjs` runs as one transaction and can be
repeated safely. It creates development accounts and initial organization,
job, performance, competency, and approval configuration. It does not create
evaluation cycles or assignments, completed assessments, approval tasks,
training records, notifications, or other business transactions.

Do not use the development seed to reset or clean an existing database. It
updates only its configured master records and accounts. Review existing data
independently before any cleanup operation; no database cleanup is performed
by the seed.
