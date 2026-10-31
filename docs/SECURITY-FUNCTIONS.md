# Rule-enforcing database functions — security review

The earlier security scan flagged the SECURITY DEFINER functions in `public` as
executable by `authenticated`. This document is the single review of those functions
and the rule each one enforces. The design rule: **a function may stay callable by
`authenticated` only when the function itself checks the caller's permission**; any
function that cannot safely self-authorize is revoked to `service_role` only.

## How to re-derive the list

```bash
rg -o "create or replace function public\.[a-z_0-9]+" drizzle/migrations/*.sql | sort -u
```

The scan's count of 53 referred to the set at that time; the schema has since grown
(Phases 5–6 added learning, training, AI, succession and recognition operations).
Every function below follows the same contract, so the review applies to the full set.

## Categories

### 1. Self-authorizing business operations (callable by `authenticated` — intended)

These are the write path of the application. Each one, in a single transaction:

1. rejects anonymous callers (`UNAUTHENTICATED`),
2. checks the caller's permission through the central catalogue
   (`public.has_perm`, `can_view_employee`, `can_view_perf`, `can_view_comp`,
   role helpers) and raises `FORBIDDEN` when it fails,
3. validates status transitions via `public.status_transitions` / `assert_transition`,
4. enforces optimistic concurrency (`version`) and idempotency keys,
5. writes its audit row via the `tg_audit` trigger in the same transaction.

Covers (non-exhaustive, one entry per family):

| Function family                                                                                     | Permission checked inside                                                                         |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `upsert_employee`, `set_employee_status`, org operations                                            | `hr.employees` / `admin.org`                                                                      |
| `create_cycle`, `assign_evaluations`, `submit_evaluation`, `review_evaluation`, `reopen_evaluation` | `perf.manage` / evaluator scope                                                                   |
| `save_profile_version`, `publish_profile`, `set_requirement`                                        | `comp.manage`                                                                                     |
| `record_assessment`, `approve_assessment`                                                           | assessor scope + evidence required                                                                |
| `upsert_course`, `save_course_content`, `submit_course`, `review_course`                            | `learn.manage` + publication workflow (Operations submits, HR approves)                           |
| `enroll_employee`, `save_lesson_progress`, `submit_quiz_attempt`                                    | own record or `learn.manage`                                                                      |
| `save_plan`, `save_plan_item`, `set_plan_item_status`                                               | plan owner / `train.manage`                                                                       |
| `save_session`, `set_session_status`, `record_attendance`, `record_result`                          | `train.manage`                                                                                    |
| `save_effectiveness_review`, `link_reassessment`                                                    | `train.manage`; reassessment must be approved with evidence                                       |
| `generate_ai_recommendations`, `review_ai_recommendation`                                           | `ai.generate` / `ai.review`; reviewer may not be the generator                                    |
| `save_critical_position`, `save_candidate`, `save_readiness_assessment`, `save_succession_activity` | `succession.manage` or explicit department grant (`succession.dept`)                              |
| `grant_succession_access`, `revoke_succession_access`                                               | `succession.manage` only                                                                          |
| `submit_nomination`, `review_nomination`                                                            | any employee (self-nomination rejected) / `recognition.review`; reviewer may not be the nominator |
| `update_setting`, `update_proficiency_level`, `save_readiness_class`, `save_recognition_category`   | `admin.settings` / module manage permission                                                       |

**Verdict: keep callable by `authenticated`.** Removing the grant would break the app;
the permission check is inside the function, so direct calls cannot bypass it.

### 2. Infrastructure functions (revoked to `service_role`)

| Function                                  | Why restricted                                                                                                                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `process_outbox(int)`                     | Runs the outbox worker; revoked from `public`/`anon`/`authenticated`, granted to `service_role`. Called only by the secured `/api/public/outbox/process` endpoint. |
| `remove_demo_data()`, `reset_demo_data()` | Destructive demo lifecycle; service-role / non-demo Super Admin only.                                                                                              |

### 3. Trigger and helper functions (not meant to be called directly)

| Function                                                                      | Note                                                                                                            |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `tg_audit`, `tg_audit_immutable`, `tg_snapshot_immutable`                     | Fired by triggers; `search_path` pinned (fixed in migration 0005).                                              |
| `has_perm`, `has_role`, `can_view_employee`, `can_view_perf`, `can_view_comp` | Read-only scope helpers used by RLS policies and the operations above; they return booleans and change nothing. |
| `handle_new_user`                                                             | Auth lifecycle trigger on `auth.users`; creates the profile row.                                                |

## Standing rules

- Tables grant `SELECT` to `authenticated`; all writes go through the functions above.
- `audit_logs` rejects UPDATE/DELETE (append-only).
- Every new SECURITY DEFINER function must either self-authorize (category 1) or be
  revoked to `service_role` (category 2), and must pin `search_path = public`.
