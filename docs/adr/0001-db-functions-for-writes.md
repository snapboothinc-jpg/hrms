# ADR 0001: Business writes run in database functions

Status: accepted

Context: The spec requires that each operation authenticates, validates, authorizes at record level, runs in a transaction, writes audit and returns a typed response, with idempotency and optimistic concurrency.

Decision: Server functions validate input with strict Zod schemas and call SECURITY DEFINER PL/pgSQL functions with the caller's JWT. The functions check permissions and scope, enforce status transitions, idempotency keys and version numbers, create approval tasks and notifications, and audit through triggers, all inside one transaction. Tables expose SELECT-only grants guarded by RLS.

Trade-offs:

- Notifications are inserted directly in the same transaction instead of through an outbox worker. This is acceptable for in-app notifications only. Email and AI calls (Phase 5+) need an outbox with retries.
- The versioned REST API (/api/v1) and OpenAPI document are not built yet. The app uses typed server functions.
- Reads go straight to the database under RLS, not through server functions. Table pagination happens in the browser, with server queries capped at 1000 rows. Cursor pagination is used only on the audit log.
