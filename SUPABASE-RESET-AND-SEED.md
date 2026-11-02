# Supabase Database and Seed Runbook

## Current project and credentials

The Supabase CLI currently links this checkout to project
`cmkmipoygxoktknpfgnq`, named **performance and development** in organization
`bubpepsbzounegickanv`. The CLI reports it as active and in `eu-west-1`.
This is the project currently configured for this repository; its name does not
establish that it is the production project.

Authentication is provided by the existing Supabase CLI login. Do not copy
access tokens, database passwords, service keys, or connection strings into
this file or the repository. To confirm the active account and project before
any operation:

```powershell
npx.cmd supabase projects list
npx.cmd supabase migration list --linked
```

Supabase CLI is the sole migration manager. The reviewed SQL migration source
is `supabase/migrations/`; the Drizzle migration configuration and journal
have been retired. The app does not currently use Drizzle ORM schema
definitions.

## Review and apply migrations

Run from the repository root. First verify the listed project ref and inspect
the migration history and dry-run output:

```powershell
npm run db:check
npx.cmd supabase migration list --linked
npx.cmd supabase db push --linked --dry-run
```

This checkout's linked project currently reports all 20 repository migrations
as pending. That output does not prove which project is production, and no
migrations have been applied by this runbook. Do not push until the target
project and its existing schema/data have been independently verified.

For a normal forward-only deployment, use:

```powershell
npx.cmd supabase db push --linked
```

## Reset policy

`supabase db reset --linked` is destructive: it drops hosted database data and
recreates the schema from the local migration files. Never run it against a
hosted project unless its owner explicitly authorizes the wipe and confirms
the exact linked project ref. The command below also force-enables the
development demo seed for that reset; it is not part of ordinary deployment
or production migration workflows.

For a disposable local Supabase database only, start the local stack and apply
the schema without automatically seeding:

```powershell
npx.cmd supabase start
npx.cmd supabase db reset --local --no-seed
```

`npm run db:reset:local` is a local-only command and always passes `--no-seed`.
Never substitute `--linked` for `--local`.

### Explicitly authorized full reset and demo reseed

The project owner explicitly authorized a full wipe of the currently linked
project (`cmkmipoygxoktknpfgnq`) on 2026-11-01. The following command completed
successfully: all 20 migrations were applied and the development demo seed was
loaded using Supabase CLI authentication; no credentials were written to this
file.

```powershell
npx.cmd supabase db reset --linked --yes --sql-paths ./seeds/development/demo.sql
```

This reset initially exposed an unapplied migration policy-drop error and
fixture seed omissions. Those were corrected before completion. Do not copy
this command into routine deployment automation.

## Development demo seed

Supabase CLI seeding is explicitly disabled in `supabase/config.toml` and no
SQL seed path is configured. Migrations, local startup, and database resets
therefore do not load demo data. The demo seed contains shared test credentials
and is only for an isolated development database; it must never be run against
production.

For a local development database, point `DATABASE_URL` at that local database
and invoke the explicit seed command:

```powershell
$env:HRMS_SEED_ENV = 'development'
$env:DATABASE_URL = 'postgresql://postgres:your-local-password@127.0.0.1:54322/postgres'
npm.cmd run db:seed:demo
```

Use the local database password printed by `npx.cmd supabase status` rather
than committing it here. The seed command accepts loopback database hosts
without an extra override. It rejects non-loopback hosts unless
`HRMS_SEED_REMOTE_CONFIRM` exactly matches the database hostname; this guard
does not make a production database safe to seed.

A complete existing fixture is left unchanged on rerun; a partial or
conflicting fixture causes the seed transaction to fail rather than overwrite
or duplicate existing records. `psql` must be installed and available on
`PATH`.

The demo accounts use a shared development password defined in the seed SQL.
Because these fixtures were explicitly requested on the production project,
the owner should immediately rotate or disable these accounts and replace the
shared password before any real users access the system. Testing SQL fixtures
and reference datasets have separate directories but no SQL datasets are
currently defined.

See [the runbook](./docs/RUNBOOK.md#setup) for schema responsibilities and
seed account details.
