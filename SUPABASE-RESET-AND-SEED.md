# Supabase Database and Seed Runbook

## Linked project and credentials

The Supabase CLI currently links this checkout to project
`cmkmipoygxoktknpfgnq`, named **performance and development** in organization
`bubpepsbzounegickanv`. The CLI reports it as active and in `eu-west-1`.
The owner identifies this linked project as production. Confirm the project ref
and environment with the owner before any hosted operation; a project name alone
does not identify its environment.

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

As of 2026-11-01, the linked database reports the first 20 repository
migrations applied; `20261101010000` and `20261101020000` are pending. A
dry-run listed only those two migrations. This status is specific to the
currently linked project and must be checked again before an operation.

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

### Current reset and seed status

A hosted reset was completed on 2026-11-01 at the owner's request, before the
current repository revision. The linked database was subsequently observed to
have 20 migrations applied and seven legacy demo accounts. The current
repository no longer contains the legacy `supabase/seeds/development/demo.sql`
fixture: it was deliberately removed in favor of a local-only, environment-
configured seed. Therefore, do not repeat the hosted reset command: the current
checkout cannot recreate those accounts after a wipe.

The replacement `scripts/database/seed-initial.mjs` rejects non-loopback
database and Auth hosts, requires seven distinct development passwords from
environment variables, and is only suitable for a local development instance.
`supabase/config.toml` also disables automatic seed execution. There is no
current production seed or production account-provisioning workflow. The
passwords of existing Auth accounts cannot be read from Postgres; rotate or
reset them through the supported Auth administration process if needed.

For local development only, follow
[`supabase/seeds/development/README.md`](./supabase/seeds/development/README.md)
and use:

```powershell
npm.cmd run db:setup:local
```

This resets only the local database, applies migrations without automatic
seeding, and runs the guarded local seed. Do not substitute `--linked` for
`--local`. Hosted account seeding requires a separate, reviewed, production-
safe provisioning workflow; it must not reuse development passwords.

See [the runbook](./docs/RUNBOOK.md#setup) for schema responsibilities and
the current account-seeding model.
