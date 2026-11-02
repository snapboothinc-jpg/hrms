import { createFileRoute, useBlocker } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Save, Send, Undo2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { check, empName } from "@/lib/data";
import {
  acknowledgeEvaluation,
  addEvaluationEvidence,
  reviewEvaluation,
  saveEvaluation,
  submitEvaluation,
} from "@/lib/api/actions.functions";
import { useAction } from "@/hooks/use-action";
import { usePermissions } from "@/hooks/use-me";
import { qk } from "@/lib/query-keys";
import {
  PageHeader,
  Panel,
  StatusBadge,
  ConfirmDialog,
  LoadingRows,
  EmptyState,
  ErrorState,
  Field,
  Tag,
  fmtDateTime,
  fmtDate,
} from "@/components/app/kit";
import { EvidenceFileLink, EvidenceUpload } from "@/components/app/evidence";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/performance/evaluations/$id")({
  head: () => ({
    meta: [
      { title: "Evaluation — Priority Handling Logistics, Inc." },
      { name: "description", content: "Job-specific performance evaluation." },
    ],
  }),
  component: Page,
});

type SnapItem = {
  id: string;
  label: string;
  help_text: string | null;
  item_type: string;
  weight: number;
  evidence_required: boolean;
  is_required: boolean;
};
type Snapshot = {
  profile_name: string;
  version_number: number;
  rating_scale_max: number;
  instructions: string | null;
  final_score_rule?: "supervisor" | "self" | "average";
  classification_thresholds?: { label: string; min: number; max: number }[];
  sections: { id: string; title: string; description: string | null; items: SnapItem[] }[];
};
type Response = {
  item_id: string;
  respondent: "self" | "evaluator";
  rating: number | null;
  comment: string | null;
};
type Evidence = {
  id: string;
  file_id: string | null;
  note: string | null;
  item_id: string | null;
  created_by: string | null;
  created_at: string;
  file: { original_name: string } | null;
};
type Review = {
  id: string;
  reviewer_id: string;
  reviewer_name: string | null;
  stage: "department_head" | "hr_admin" | null;
  return_to: "employee" | "supervisor" | "department_head" | null;
  decision: string;
  comments: string | null;
  created_at: string;
};
type Submission = {
  id: string;
  respondent: "self" | "evaluator";
  submission_number: number;
  submitted_at: string;
  response_snapshot: {
    responses: Response[];
    evidence: {
      file_id: string | null;
      note: string | null;
      item_id: string | null;
      file?: { original_name: string } | null;
    }[];
    overall_comment: string | null;
  };
};
type Assignment = {
  id: string;
  status: string;
  return_to: "employee" | "supervisor" | "department_head" | null;
  version: number;
  snapshot: Snapshot;
  employee_id: string;
  evaluator_id: string;
  self_evaluation: boolean;
  self_submitted_at: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  acknowledgement_comment: string | null;
  self_score: number | null;
  supervisor_score: number | null;
  final_score: number | null;
  classification: string | null;
  overall_comment: string | null;
  reopen_reason: string | null;
  employee: {
    first_name: string;
    last_name: string;
    employee_code: string;
    user_id: string | null;
    department: { name: string } | null;
    position: { title: string } | null;
  } | null;
  evaluator: { first_name: string; last_name: string; user_id: string | null } | null;
  cycle: {
    name: string;
    due_date: string | null;
    period_start: string;
    period_end: string;
  } | null;
  profile_version: {
    position: { title: string; department: { name: string } | null } | null;
  } | null;
};

function Page() {
  const { id } = Route.useParams();
  const { employeeId, has, role } = usePermissions();
  const query = useQuery({
    queryKey: qk.perf.assignment(id),
    queryFn: async () => {
      const assignmentResult = await supabase
        .from("evaluation_assignments")
        .select(
          "*, employee:employees!evaluation_assignments_employee_id_fkey(first_name,last_name,employee_code,user_id,department:departments(name),position:positions(title)), evaluator:employees!evaluation_assignments_evaluator_id_fkey(first_name,last_name,user_id), cycle:evaluation_cycles(name,due_date,period_start,period_end), profile_version:evaluation_profile_versions(position:positions(title,department:departments(name)))",
        )
        .eq("id", id)
        .maybeSingle();
      const assignment = check(assignmentResult) as unknown as Assignment | null;
      if (!assignment) return null;
      const [responsesResult, evidenceResult, reviewsResult, submissionsResult] = await Promise.all([
        supabase.from("evaluation_responses").select("*").eq("assignment_id", id),
        supabase
          .from("evaluation_evidence")
          .select("*, file:file_metadata(original_name)")
          .eq("assignment_id", id)
          .order("created_at"),
        supabase
          .from("evaluation_reviews")
          .select("*")
          .eq("assignment_id", id)
          .order("created_at", { ascending: false }),
        supabase
          .from("evaluation_submissions")
          .select("*")
          .eq("assignment_id", id)
          .order("submitted_at", { ascending: false }),
      ]);
      return {
        assignment,
        responses: check(responsesResult) as Response[],
        evidence: check(evidenceResult) as unknown as Evidence[],
        reviews: check(reviewsResult) as unknown as Review[],
        submissions: check(submissionsResult) as Submission[],
      };
    },
  });

  if (query.isLoading) return <LoadingRows rows={8} />;
  if (query.error)
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  if (!query.data?.assignment)
    return (
      <EmptyState
        title="Evaluation not found"
        description="It doesn't exist or isn't available in your record-based scope."
      />
    );

  const data = query.data;
  const assignment = data.assignment;
  const isEmployee = assignment.employee_id === employeeId;
  const isSupervisor = assignment.evaluator_id === employeeId;
  const employeeEditable =
    isEmployee &&
    assignment.self_evaluation &&
    (["not_started", "in_progress"].includes(assignment.status) ||
      (assignment.status === "returned_for_revision" && assignment.return_to === "employee"));
  const supervisorEditable =
    isSupervisor &&
    (["supervisor_pending", "supervisor_in_progress"].includes(assignment.status) ||
      (assignment.status === "not_started" && !assignment.self_evaluation) ||
      (assignment.status === "returned_for_revision" && assignment.return_to === "supervisor"));
  const respondent = employeeEditable ? "self" : supervisorEditable ? "evaluator" : null;
  const canReview =
    has("perf.approve") &&
    !isEmployee &&
    !isSupervisor &&
    ((assignment.status === "department_head_pending" && role === "dept_head") ||
      (assignment.status === "hr_admin_pending" && role === "hr_admin"));
  const canAcknowledge =
    isEmployee && assignment.status === "approved" && !assignment.acknowledged_at;

  return (
    <EvaluationForm
      key={`${assignment.id}-${assignment.version}`}
      assignment={assignment}
      responses={data.responses}
      evidence={data.evidence}
      reviews={data.reviews}
      submissions={data.submissions}
      respondent={respondent}
      canReview={canReview}
      canAcknowledge={canAcknowledge}
      isEmployee={isEmployee}
    />
  );
}

function EvaluationForm({
  assignment,
  responses,
  evidence,
  reviews,
  submissions,
  respondent,
  canReview,
  canAcknowledge,
  isEmployee,
}: {
  assignment: Assignment;
  responses: Response[];
  evidence: Evidence[];
  reviews: Review[];
  submissions: Submission[];
  respondent: "self" | "evaluator" | null;
  canReview: boolean;
  canAcknowledge: boolean;
  isEmployee: boolean;
}) {
  const { role } = usePermissions();
  const initial = useMemo(() => {
    const values: Record<string, Partial<Response>> = {};
    responses
      .filter((response) => response.respondent === respondent)
      .forEach((response) => (values[response.item_id] = response));
    return values;
  }, [responses, respondent]);
  const [values, setValues] = useState<Record<string, Partial<Response>>>(initial);
  const [criterionNotes, setCriterionNotes] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [confirm, setConfirm] = useState<"submit" | "approve" | "return" | "acknowledge" | null>(
    null,
  );
  const [reviewComment, setReviewComment] = useState("");
  const [returnTo, setReturnTo] = useState<"employee" | "supervisor" | "department_head">(
    role === "hr_admin" ? "department_head" : "supervisor",
  );
  useBlocker({
    shouldBlockFn: () => dirty && !window.confirm("You have unsaved changes. Leave anyway?"),
    enableBeforeUnload: () => dirty,
  });
  useEffect(() => setValues(initial), [initial]);

  const invalidate = [qk.perf.all, qk.shared.approvals()];
  const save = useAction(useServerFn(saveEvaluation), {
    invalidate,
    success: "Draft saved",
    onSuccess: () => setDirty(false),
  });
  const submit = useAction(useServerFn(submitEvaluation), {
    idempotent: true,
    invalidate,
    success: respondent === "self" ? "Self-evaluation submitted" : "Supervisor evaluation submitted",
    onSuccess: () => setConfirm(null),
  });
  const review = useAction(useServerFn(reviewEvaluation), {
    idempotent: true,
    invalidate,
    success: "Approval decision recorded",
    onSuccess: () => {
      setConfirm(null);
      setReviewComment("");
    },
  });
  const acknowledge = useAction(useServerFn(acknowledgeEvaluation), {
    idempotent: true,
    invalidate,
    success: "Evaluation acknowledgement recorded",
    onSuccess: () => {
      setConfirm(null);
      setReviewComment("");
    },
  });
  const addEvidence = useAction(useServerFn(addEvaluationEvidence), {
    invalidate,
    success: "Evidence attached",
    onSuccess: (result) => {
      const itemId = (result as { item_id?: string | null }).item_id;
      if (itemId) setCriterionNotes((notes) => ({ ...notes, [itemId]: "" }));
    },
  });

  const setResponse = (itemId: string, patch: Partial<Response>) => {
    setValues((current) => ({ ...current, [itemId]: { ...current[itemId], ...patch } }));
    setDirty(true);
  };
  const items = assignment.snapshot.sections.flatMap((section) => section.items);
  const employeeResponse = (itemId: string) =>
    responses.find((response) => response.item_id === itemId && response.respondent === "self");
  const supervisorResponse = (itemId: string) =>
    responses.find((response) => response.item_id === itemId && response.respondent === "evaluator");
  const payload = {
    assignment_id: assignment.id,
    respondent: respondent!,
    responses: Object.entries(values).map(([item_id, response]) => ({
      item_id,
      rating: response.rating ?? null,
      comment: response.comment ?? null,
    })),
    factor_responses: [],
    overall_comment: null,
    version: assignment.version,
  };
  const finalScoreRule = assignment.snapshot.final_score_rule ?? "supervisor";
  const finalScoreRuleLabel =
    finalScoreRule === "self"
      ? "Employee self-evaluation"
      : finalScoreRule === "average"
        ? "Configured average"
        : "Supervisor evaluation";

  return (
    <div className="pb-24">
      <PageHeader
        eyebrow={`${assignment.cycle?.name ?? "Evaluation"} · ${assignment.snapshot.profile_name} v${assignment.snapshot.version_number}`}
        title={empName(assignment.employee)}
        description="Review the job context and the same position-specific criteria throughout the approval workflow."
        actions={<StatusBadge status={assignment.status} />}
      />
      {assignment.reopen_reason && assignment.status === "returned_for_revision" && (
        <p className="mb-4 rounded-md border border-warning/40 bg-warning-soft p-3 text-sm">
          <strong>Returned for revision:</strong> {assignment.reopen_reason}
        </p>
      )}
      {respondent && (
        <p className="mb-3 text-sm font-bold text-accent-foreground">
          Completing the {respondent === "self" ? "employee self-evaluation" : "supervisor evaluation"}.
          Ratings use the configured 1–{assignment.snapshot.rating_scale_max} scale.
        </p>
      )}

      <div className="space-y-4">
        <Panel title="Employee & Job Context">
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
            <ContextValue label="Employee ID" value={assignment.employee?.employee_code} />
            <ContextValue label="Employee Name" value={empName(assignment.employee)} />
            <ContextValue
              label="Department"
              value={
                assignment.profile_version?.position?.department?.name ??
                assignment.employee?.department?.name
              }
            />
            <ContextValue
              label="Job Position"
              value={
                assignment.profile_version?.position?.title ?? assignment.employee?.position?.title
              }
            />
            <ContextValue label="Immediate Supervisor" value={empName(assignment.evaluator)} />
            <ContextValue label="Evaluation Period">
              {assignment.cycle
                ? `${fmtDate(assignment.cycle.period_start)} – ${fmtDate(assignment.cycle.period_end)}`
                : "—"}
            </ContextValue>
            <ContextValue label="Evaluation Due Date" value={fmtDate(assignment.cycle?.due_date)} />
            <div>
              <dt className="text-sm text-muted-foreground">Evaluation Status</dt>
              <dd className="mt-1">
                <StatusBadge status={assignment.status} />
              </dd>
            </div>
          </dl>
          {assignment.snapshot.instructions && (
            <p className="mt-4 border-t pt-3 text-sm text-muted-foreground">
              {assignment.snapshot.instructions}
            </p>
          )}
          {!respondent &&
            (role === "dept_head" ||
              role === "hr_admin" ||
              (isEmployee && assignment.status === "approved")) && (
            <div className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4">
              <Score label="Employee self-evaluation" value={assignment.self_score} />
              <Score label="Supervisor evaluation" value={assignment.supervisor_score} />
              <Score
                label="Final approved score"
                value={assignment.status === "approved" ? assignment.final_score : null}
              />
              <div>
                <p className="text-sm text-muted-foreground">Configured score rule</p>
                <p className="mt-1 font-semibold">{finalScoreRuleLabel}</p>
              </div>
              {assignment.status === "approved" && assignment.classification && (
                <div className="sm:col-span-2 lg:col-span-4">
                  <Tag tone="success">{assignment.classification}</Tag>
                </div>
              )}
            </div>
          )}
          {(role === "dept_head" || role === "hr_admin") && (
            <div className="mt-4 border-t pt-4">
            <h3 className="font-semibold">Approval history</h3>
            {reviews.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No approval decisions yet.</p>
            ) : (
              <ul className="mt-2 space-y-3">
                {reviews.map((entry) => (
                  <li key={entry.id} className="text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong>
                        {entry.reviewer_name ?? "Previous reviewer"}
                      </strong>
                      {entry.stage && (
                        <span className="text-xs text-muted-foreground">
                          {entry.stage === "department_head" ? "Department Head" : "HR Admin"}
                        </span>
                      )}
                      <StatusBadge
                        status={entry.decision === "returned" ? "returned_for_revision" : entry.decision}
                        label={
                          entry.decision === "returned"
                            ? "Returned"
                            : entry.decision.charAt(0).toUpperCase() + entry.decision.slice(1)
                        }
                      />
                      <span className="font-data text-xs text-muted-foreground">
                        {fmtDateTime(entry.created_at)}
                      </span>
                    </div>
                    {entry.comments && <p className="mt-1 whitespace-pre-wrap">{entry.comments}</p>}
                    {entry.return_to && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Returned to {entry.return_to.replaceAll("_", " ")}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 font-data text-xs text-muted-foreground">
              Employee submission:{" "}
              {assignment.self_submitted_at
                ? fmtDateTime(assignment.self_submitted_at)
                : assignment.self_evaluation
                  ? "pending"
                  : "not required"}{" "}
              · Latest supervisor submission: {fmtDateTime(assignment.submitted_at)} · Final HR
              approval: {fmtDateTime(assignment.status === "approved" ? assignment.approved_at : null)}
            </p>
            {assignment.acknowledged_at && (
              <p className="mt-2 text-sm">
                Employee acknowledged receipt {fmtDateTime(assignment.acknowledged_at)}
                {assignment.acknowledgement_comment
                  ? `: ${assignment.acknowledgement_comment}`
                  : ""}
              </p>
            )}
            </div>
          )}
          <SubmissionHistory submissions={submissions} snapshot={assignment.snapshot} />
        </Panel>

        <Panel
          title="Job-Specific Performance Criteria"
          description="Employee and supervisor assessments are kept separate. The Department Head and HR Admin can compare submitted responses and evidence."
        >
          <div className="mb-4 rounded-md bg-muted p-3 text-sm">
            <strong>Rating scale:</strong> 1 Poor · 2 Below Average · 3 Average · 4 Above Average ·
            5 Excellent
          </div>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              This assigned profile has no criteria. Contact HR to correct the profile.
            </p>
          ) : (
            <div className="space-y-5">
              {items.map((item, index) => {
                const current = values[item.id] ?? {};
                const self = employeeResponse(item.id);
                const supervisor = supervisorResponse(item.id);
                const itemEvidence = evidence.filter(
                  (entry) =>
                    entry.item_id === item.id &&
                    (!isEmployee ||
                      entry.created_by === assignment.employee?.user_id ||
                      assignment.status === "approved"),
                );
                const commentId = `criterion-comment-${item.id}`;
                return (
                  <article key={item.id} className="rounded-md border p-4">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <h3 className="font-bold">
                        {index + 1}. {item.label}
                        {item.is_required && <span className="text-destructive"> *</span>}
                      </h3>
                      {Number(item.weight) > 0 && <Tag>{item.weight}%</Tag>}
                      {item.evidence_required && <Tag tone="info">Evidence required</Tag>}
                    </div>
                    {item.help_text && (
                      <p className="mb-3 whitespace-pre-wrap text-sm text-muted-foreground">
                        {item.help_text}
                      </p>
                    )}
                    {respondent === "evaluator" && (
                      <div className="mb-4 rounded-md border border-dashed p-3">
                        <p className="mb-2 text-sm font-semibold">Employee Self-Evaluation</p>
                        <Assessment response={self} compact />
                      </div>
                    )}
                    {respondent ? (
                      <div className="max-w-2xl">
                        <Label htmlFor={`rating-${item.id}`} className="mb-2 block">
                          {respondent === "self" ? "Your self-rating" : "Supervisor Evaluation"}
                        </Label>
                        <div
                          id={`rating-${item.id}`}
                          className="flex flex-wrap gap-2"
                          role="radiogroup"
                          aria-label={`${item.label} rating`}
                        >
                          {Array.from(
                            { length: assignment.snapshot.rating_scale_max },
                            (_, value) => value + 1,
                          ).map((rating) => (
                            <button
                              key={rating}
                              type="button"
                              role="radio"
                              aria-checked={current.rating === rating}
                              onClick={() => setResponse(item.id, { rating })}
                              className={`size-10 rounded-md border font-data font-bold ${
                                current.rating === rating
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "bg-card hover:bg-accent"
                              }`}
                              aria-label={`${rating} ${ratingLabel(rating)}`}
                            >
                              {rating}
                            </button>
                          ))}
                        </div>
                        <Field label="Comments or observations" htmlFor={commentId}>
                          <Textarea
                            id={commentId}
                            className="mt-3"
                            placeholder="Describe examples and observations"
                            maxLength={4000}
                            value={current.comment ?? ""}
                            onChange={(event) =>
                              setResponse(item.id, { comment: event.target.value })
                            }
                          />
                        </Field>
                      </div>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-2">
                        <Assessment label="Employee Self-Evaluation" response={self} />
                        <Assessment label="Supervisor Evaluation" response={supervisor} />
                      </div>
                    )}
                    {(!respondent || assignment.status === "approved") && (
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {respondent !== "evaluator" && (
                          <Assessment label="Employee Self-Evaluation" response={self} />
                        )}
                        {respondent !== "self" &&
                          (!isEmployee || assignment.status === "approved") && (
                            <Assessment label="Supervisor Evaluation" response={supervisor} />
                          )}
                      </div>
                    )}
                    <EvidenceList
                      entries={itemEvidence}
                      employeeUserId={assignment.employee?.user_id}
                      supervisorUserId={assignment.evaluator?.user_id}
                    />
                    {respondent && (
                      <div className="mt-3 flex flex-wrap items-end gap-2">
                        <Field label="Evidence note" htmlFor={`evidence-note-${item.id}`}>
                          <Input
                            id={`evidence-note-${item.id}`}
                            maxLength={2000}
                            value={criterionNotes[item.id] ?? ""}
                            onChange={(event) =>
                              setCriterionNotes((notes) => ({
                                ...notes,
                                [item.id]: event.target.value,
                              }))
                            }
                          />
                        </Field>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!criterionNotes[item.id]?.trim() || addEvidence.isPending}
                          onClick={() =>
                            addEvidence.mutate({
                              assignment_id: assignment.id,
                              file_id: null,
                              note: criterionNotes[item.id]!,
                              item_id: item.id,
                            })
                          }
                        >
                          Add evidence note
                        </Button>
                        <EvidenceUpload
                          employeeId={assignment.employee_id}
                          onUploaded={(fileId) =>
                            addEvidence.mutateAsync({
                              assignment_id: assignment.id,
                              file_id: fileId,
                              note: null,
                              item_id: item.id,
                            }).then(() => undefined)
                          }
                        />
                      </div>
                    )}
                  </article>
                );
              })}
              </div>
          )}
        </Panel>
      </div>

      {(respondent || canReview || canAcknowledge) && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-card/95 backdrop-blur md:left-auto md:w-[calc(100%-16rem)]">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-3 sm:px-6 lg:px-8">
            {dirty && <Tag tone="warning">Unsaved changes</Tag>}
            <div className="flex-1" />
            {respondent && (
              <>
                <Button
                  variant="outline"
                  disabled={!dirty || save.isPending}
                  onClick={() => save.mutate(payload)}
                >
                  <Save /> Save draft
                </Button>
                <Button
                  disabled={dirty || submit.isPending || addEvidence.isPending}
                  title={dirty ? "Save your draft before submitting" : undefined}
                  onClick={() => setConfirm("submit")}
                >
                  <Send /> Submit
                </Button>
              </>
            )}
            {canReview && (
              <>
                <Button variant="outline" onClick={() => setConfirm("return")}>
                  <Undo2 /> Return for revision
                </Button>
                <Button onClick={() => setConfirm("approve")}>
                  <CheckCircle2 /> Approve
                </Button>
              </>
            )}
            {canAcknowledge && (
              <Button onClick={() => setConfirm("acknowledge")}>
                <CheckCircle2 /> Acknowledge receipt
              </Button>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={
          confirm === "submit"
            ? "Submit this evaluation?"
            : confirm === "approve"
              ? role === "dept_head"
                ? "Approve at Department Head stage?"
                : "Approve as HR Admin?"
              : confirm === "acknowledge"
                ? "Acknowledge receipt?"
                : "Return this evaluation for revision?"
        }
        description={
          confirm === "submit"
            ? "Your submitted assessment becomes read-only. You can revise it only if a reviewer returns it."
            : confirm === "approve"
              ? role === "dept_head"
                ? "This advances the complete evaluation to HR Admin review. It is not final until HR Admin approves."
                : "This records final HR approval after Department Head approval."
              : confirm === "acknowledge"
                ? "This records receipt of the final approved evaluation."
                : "A reason is required and the returned-to role will be recorded."
        }
        confirmLabel={
          confirm === "submit"
            ? "Submit"
            : confirm === "approve"
              ? "Approve"
              : confirm === "acknowledge"
                ? "Acknowledge"
                : "Return"
        }
        pending={submit.isPending || review.isPending || acknowledge.isPending}
        onConfirm={() => {
          if (confirm === "submit") submit.mutate({ assignment_id: assignment.id, respondent: respondent! });
          if (confirm === "approve")
            review.mutate({
              assignment_id: assignment.id,
              decision: "approve",
              comments: reviewComment,
            });
          if (confirm === "return")
            review.mutate({
              assignment_id: assignment.id,
              decision: "return",
              comments: reviewComment,
              return_to: returnTo,
            });
          if (confirm === "acknowledge")
            acknowledge.mutate({ assignment_id: assignment.id, comment: reviewComment });
        }}
      >
        {(confirm === "approve" || confirm === "return" || confirm === "acknowledge") && (
          <div className="space-y-3">
            <Field
              label={
                confirm === "return"
                  ? "Reason (required, at least 5 characters)"
                  : confirm === "acknowledge"
                    ? "Employee comment (optional)"
                    : "Approval comments (optional)"
              }
              htmlFor="review-comment"
            >
              <Textarea
                id="review-comment"
                value={reviewComment}
                maxLength={4000}
                onChange={(event) => setReviewComment(event.target.value)}
              />
            </Field>
            {confirm === "return" && (
              <Field label="Return to" htmlFor="return-to">
                <select
                  id="return-to"
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={returnTo}
                  onChange={(event) =>
                    setReturnTo(
                      event.target.value as "employee" | "supervisor" | "department_head",
                    )
                  }
                >
                  {role === "dept_head" ? (
                    <>
                      <option value="supervisor">Supervisor</option>
                      <option value="employee">Employee</option>
                    </>
                  ) : (
                    <>
                      <option value="department_head">Department Head</option>
                      <option value="supervisor">Supervisor</option>
                    </>
                  )}
                </select>
              </Field>
            )}
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}

function ContextValue({
  label,
  value,
  children,
}: {
  label: string;
  value?: string | null;
  children?: ReactNode;
}) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{children ?? value ?? "—"}</dd>
    </div>
  );
}

function Score({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-data text-xl font-bold">{value === null ? "Not configured" : `${value} / 5`}</p>
    </div>
  );
}

function SubmissionHistory({
  submissions,
  snapshot,
}: {
  submissions: Submission[];
  snapshot: Snapshot;
}) {
  if (submissions.length === 0) return null;
  const criteria = new Map(
    snapshot.sections.flatMap((section) =>
      section.items.map((item) => [item.id, item.label] as const),
    ),
  );
  return (
    <details className="mt-4 border-t pt-4">
      <summary className="cursor-pointer font-semibold">
        Submission history ({submissions.length})
      </summary>
      <ul className="mt-3 space-y-4">
        {submissions.map((submission) => (
          <li key={submission.id} className="rounded-md border p-3">
            <p className="font-semibold">
              {submission.respondent === "self" ? "Employee" : "Supervisor"} submission{" "}
              {submission.submission_number}
              <span className="ml-2 font-data text-xs text-muted-foreground">
                {fmtDateTime(submission.submitted_at)}
              </span>
            </p>
            <ul className="mt-2 space-y-2">
              {submission.response_snapshot.responses.map((response) => (
                <li key={response.item_id} className="text-sm">
                  <strong>{criteria.get(response.item_id) ?? "Criterion"}</strong>:{" "}
                  {response.rating == null
                    ? "Not rated"
                    : `${response.rating} / 5 · ${ratingLabel(response.rating)}`}
                  {response.comment && (
                    <p className="whitespace-pre-wrap text-muted-foreground">{response.comment}</p>
                  )}
                </li>
              ))}
              {submission.response_snapshot.evidence.map((entry, index) => (
                <li key={`${entry.item_id ?? "evidence"}-${index}`} className="text-sm">
                  <strong>{criteria.get(entry.item_id ?? "") ?? "Evidence"}: </strong>
                  {entry.file_id ? (
                    <EvidenceFileLink
                      fileId={entry.file_id}
                      name={entry.file?.original_name ?? "Supporting file"}
                    />
                  ) : (
                    entry.note ?? "Evidence attached"
                  )}
                </li>
              ))}
            </ul>
            {submission.response_snapshot.overall_comment && (
              <p className="mt-2 whitespace-pre-wrap text-sm">
                Supervisor comments: {submission.response_snapshot.overall_comment}
              </p>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}

function Assessment({
  label,
  response,
  compact = false,
}: {
  label?: string;
  response: Response | undefined;
  compact?: boolean;
}) {
  return (
    <div className={`rounded-md bg-muted p-3 ${compact ? "" : "min-h-20"}`}>
      {label && <p className="mb-1 text-sm font-semibold">{label}</p>}
      <p className="font-data font-bold">
        {response?.rating == null ? "Not rated" : `${response.rating} / 5 · ${ratingLabel(response.rating)}`}
      </p>
      {response?.comment && (
        <p className="mt-1 whitespace-pre-wrap text-sm">{response.comment}</p>
      )}
    </div>
  );
}

function EvidenceList({
  entries,
  employeeUserId,
  supervisorUserId,
}: {
  entries: Evidence[];
  employeeUserId: string | null | undefined;
  supervisorUserId: string | null | undefined;
}) {
  if (entries.length === 0) return null;
  return (
    <div className="mt-4">
      <p className="mb-2 text-sm font-semibold">Supporting evidence</p>
      <ul className="space-y-2">
        {entries.map((entry) => (
          <li key={entry.id} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold">
              {entry.created_by === employeeUserId
                ? "Employee"
                : entry.created_by === supervisorUserId
                  ? "Supervisor"
                  : "Evidence"}
            </span>
            {entry.file_id ? (
              <EvidenceFileLink
                fileId={entry.file_id}
                name={entry.file?.original_name ?? "Supporting file"}
              />
            ) : (
              <span className="whitespace-pre-wrap">{entry.note}</span>
            )}
            <span className="font-data text-xs text-muted-foreground">
              {fmtDateTime(entry.created_at)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ratingLabel(rating: number) {
  return ["Poor", "Below Average", "Average", "Above Average", "Excellent"][rating - 1] ?? "";
}
