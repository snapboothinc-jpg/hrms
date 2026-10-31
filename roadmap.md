# Priority Handling Logistics, Inc. roadmap

## Done (this session)

- [x] Skills installed (80 skills + 1 nested group), license file, index
- [x] Phase 1: foundation, brand tokens, fonts, light/dark, app shell, shared components, protected routing
- [x] Phase 2: Cloud, schema, 7 roles, RLS, central policy, users and roles admin, employees, departments, positions, reporting lines
- [x] Phase 3: notifications, approval center, audit log, shared Zod schemas, scoped global search, private evidence storage
- [x] Phase 4: cycles, versioned profiles and builder, assignments, evaluation form with draft, submit, review and reopen; competency library, proficiency framework, requirements, assessments with evidence, gaps, Not Assessed, history

## In progress (Phases 5–6 session)

- [x] Phase 5 database: learning, training, AI, outbox tables + RPCs + RLS + demo data (migrations 0006–0009)
- [x] Phase 6 database: succession, recognition, readiness classes, report reader, remove/reset demo data (migrations 0010–0011)
- [x] AI service module (Gemini provider, Zod-validated output, unknown resource IDs rejected)
- [x] Server functions: learning, training, AI, succession, recognition, reports, PDF export
- [x] Phase 5 pages: learning (dashboard, catalog, player+quiz, manage, my, paths, progress), training (dashboard, plans, plan detail, calendar, session detail with attendance/results), effectiveness with reassessment linking
- [x] Phase 6 pages: AI queue with review/edit/reject, AI settings with provider status, succession (dashboard, positions, candidates with readiness + access grants), recognition (feed, nominate, queue, my, analytics), reports with audited CSV export, admin configuration (categories, readiness classes)
- [x] Hardening: /api/v1 + OpenAPI (employees, gaps, courses with Idempotency-Key, ETag/If-Match, cursor pagination), outbox processor endpoint (secret-protected, retries + dead-letter), server-side pagination for employees/assignments/assessments, 12 new rule tests (27 passing), security-functions review doc, runbook update, skills count note

## Open (next sessions)

- [ ] MFA for Admin/Super Admin, idle session timeout (checked: not in place; listed in runbook)
- [ ] API contract tests and end-to-end suite in repo (unit + integration tests exist; contract/e2e pending)
- [ ] Live AI call test (module built; not yet called against the Gemini API)
- [ ] MFA for Admin/Super Admin, session idle timeout (not started)
- [ ] Separate staging environment (requires a separate Supabase project; document in runbook)
- [ ] Strict tsconfig settings: kept relaxed (generated shadcn/TanStack typings incompatible) — documented in AGENTS.md
- [ ] /api/v1 REST surface and OpenAPI contract tests
- [ ] Outbox worker for email and AI side effects
- [ ] MFA requirement for Super Admin and Admin, session idle timeout
- [ ] Separate staging and production environments
- [ ] Playwright end-to-end suite kept in the repo (flows were verified manually this session)
