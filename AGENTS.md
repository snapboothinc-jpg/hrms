# Priority Handling Logistics, Inc. architecture rules

- All writes go through SECURITY DEFINER Postgres functions (public.*) called from `createServerFn` handlers in `src/lib/api/actions.functions.ts`; tables grant only SELECT to `authenticated`. Why: authorization, status transitions, idempotency and audit run in one DB transaction.
- Reads use the browser Supabase client under RLS (`src/lib/data.ts`). Why: RLS is the scope boundary; no read bypasses it.
- The permission catalogue lives in `public.role_permissions` + scope helpers (`has_perm`, `can_view_employee`, `can_view_perf`, `can_view_comp`); `src/lib/policy.ts` only maps permissions to navigation. Components read permissions via `usePermissions()`. Why: one source of truth; hiding UI is not security.
- DB functions raise `CODE: message` (UNAUTHENTICATED, FORBIDDEN, NOT_FOUND, CONFLICT, IDEMPOTENCY_CONFLICT, INVALID, RULE); `mapDbError` turns them into the standard `{ error: { code, message, request_id } }`. Why: one error format, no internals leaked.
- Status transitions are rows in `public.status_transitions`, checked by `assert_transition`. Why: state machines in one place.
- Evaluation assignments store an immutable `snapshot` of the profile version; only draft profile versions are editable (triggers enforce). Why: history never changes when profiles change.
- Editable records carry `version`; updates require the expected version (409 on mismatch). Side-effecting actions take an Idempotency-Key stored in `idempotency_keys` (24h, per user).
- Audit is written by the `tg_audit` trigger on business tables; `audit_logs` rejects update/delete. Why: same-transaction, append-only audit.
- Demo data is flagged `is_demo` and removed with `public.remove_demo_data()`. Live access tests (`RUN_ACCESS_TESTS=1`) run against demo accounts and mutate demo data.
- `skills/` holds third-party Claude Code skills converted for reference; they are not runtime code.
- tsconfig relaxes exactOptionalPropertyTypes / noUncheckedIndexedAccess / noPropertyAccessFromIndexSignature. Why: compatibility with generated shadcn/TanStack typings.
