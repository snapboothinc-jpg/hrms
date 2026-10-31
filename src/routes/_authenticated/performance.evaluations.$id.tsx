import { createFileRoute, Link, useBlocker } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, RotateCcw, Save, Send, Undo2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { check, empName } from "@/lib/data";
import {
  acknowledgeEvaluation,
  addEvaluationEvidence,
  reopenEvaluation,
  reviewEvaluation,
  saveEvaluation,
  submitEvaluation,
} from "@/lib/api/actions.functions";
import { computeScore } from "@/lib/rules";
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
  Field,
  NativeSelect,
  Tag,
  fmtDateTime,
  fmtDate,
} from "@/components/app/kit";
import { EvidenceFileLink, EvidenceUpload } from "@/components/app/evidence";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/performance/evaluations/$id")({
  head: () => ({
    meta: [
      { title: "Evaluation — Priority Handling Logistics, Inc." },
      { name: "description", content: "Evaluation form and detail." },
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
  options: string[];
  kpi_target: number | null;
  kpi_unit: string | null;
  evidence_required: boolean;
  is_required: boolean;
  competency_id: string | null;
};
type Snapshot = {
  profile_name: string;
  version_number: number;
  rating_scale_max: number;
  instructions: string | null;
  sections: { id: string; title: string; description: string | null; items: SnapItem[] }[];
};
type Resp = {
  item_id: string;
  respondent: "self" | "evaluator";
  rating: number | null;
  text_value: string | null;
  choice_values: string[] | null;
  kpi_actual: number | null;
  comment: string | null;
};
type A = {
  id: string;
  status: string;
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
  overall_score: number | null;
  overall_comment: string | null;
  reopen_reason: string | null;
  employee: { first_name: string; last_name: string; employee_code: string } | null;
  evaluator: { first_name: string; last_name: string } | null;
  cycle: { name: string; due_date: string | null } | null;
};

function Page() {
  const { id } = Route.useParams();
  const { employeeId, has } = usePermissions();
  const q = useQuery({
    queryKey: qk.perf.assignment(id),
    queryFn: async () => {
      const a = check(
        await supabase
          .from("evaluation_assignments")
          .select(
            "*, employee:employees!evaluation_assignments_employee_id_fkey(first_name,last_name,employee_code), evaluator:employees!evaluation_assignments_evaluator_id_fkey(first_name,last_name), cycle:evaluation_cycles(name,due_date)",
          )
          .eq("id", id)
          .maybeSingle(),
      ) as unknown as A | null;
      if (!a) return null;
      const [responses, evidence, reviews] = await Promise.all([
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
      ]);
      return {
        a,
        responses: check(responses) as Resp[],
        evidence: check(evidence) as unknown as {
          id: string;
          file_id: string | null;
          note: string | null;
          item_id: string | null;
          created_at: string;
          file: { original_name: string } | null;
        }[],
        reviews: check(reviews) as {
          id: string;
          decision: string;
          comments: string | null;
          created_at: string;
        }[],
      };
    },
  });

  if (q.isLoading) return <LoadingRows rows={8} />;
  if (!q.data)
    return (
      <EmptyState
        title="Evaluation not found"
        description="It doesn't exist or isn't in your scope."
      />
    );
  const { a } = q.data;
  const isEvaluator = a.evaluator_id === employeeId;
  const isEmployee = a.employee_id === employeeId;
  const evaluatorEditable =
    isEvaluator && ["not_started", "in_progress", "reopened"].includes(a.status);
  const selfEditable =
    isEmployee &&
    a.self_evaluation &&
    (!a.self_submitted_at || a.status === "reopened") &&
    !["submitted", "under_review", "approved"].includes(a.status);
  const respondent: "self" | "evaluator" | null = evaluatorEditable
    ? "evaluator"
    : selfEditable
      ? "self"
      : null;
  const canReview =
    has("perf.approve") &&
    !isEvaluator &&
    !isEmployee &&
    ["submitted", "under_review"].includes(a.status);
  const canReopen = has("perf.approve") && !isEvaluator && !isEmployee && a.status === "approved";
  const canAcknowledge = isEmployee && a.status === "approved" && !a.acknowledged_at;
  return (
    <EvaluationView
      key={a.version}
      data={q.data}
      respondent={respondent}
      canReview={canReview}
      canReopen={canReopen}
      canAcknowledge={canAcknowledge}
      showEvaluatorToEmployee={!isEmployee || a.status === "approved"}
    />
  );
}

function EvaluationView({
  data,
  respondent,
  canReview,
  canReopen,
  canAcknowledge,
  showEvaluatorToEmployee,
}: {
  data: {
    a: A;
    responses: Resp[];
    evidence: {
      id: string;
      file_id: string | null;
      note: string | null;
      created_at: string;
      file: { original_name: string } | null;
    }[];
    reviews: { id: string; decision: string; comments: string | null; created_at: string }[];
  };
  respondent: "self" | "evaluator" | null;
  canReview: boolean;
  canReopen: boolean;
  canAcknowledge: boolean;
  showEvaluatorToEmployee: boolean;
}) {
  const { a } = data;
  const snap = a.snapshot;
  const allItems = useMemo(() => snap.sections.flatMap((s) => s.items), [snap]);
  const initial = useMemo(() => {
    const m: Record<string, Resp> = {};
    data.responses.filter((r) => r.respondent === respondent).forEach((r) => (m[r.item_id] = r));
    return m;
  }, [data.responses, respondent]);
  const [vals, setVals] = useState<Record<string, Partial<Resp>>>(initial);
  const [overall, setOverall] = useState(a.overall_comment ?? "");
  const [dirty, setDirty] = useState(false);
  const [confirm, setConfirm] = useState<
    null | "submit" | "approve" | "return" | "reopen" | "acknowledge"
  >(null);
  const [comment, setComment] = useState("");
  const [note, setNote] = useState("");
  useBlocker({
    shouldBlockFn: () => dirty && !window.confirm("You have unsaved changes. Leave anyway?"),
    enableBeforeUnload: () => dirty,
  });
  useEffect(() => setVals(initial), [initial]);

  const inv = [qk.perf.all, qk.shared.approvals()];
  const save = useAction(useServerFn(saveEvaluation), {
    invalidate: inv,
    success: "Draft saved",
    onSuccess: () => setDirty(false),
  });
  const submit = useAction(useServerFn(submitEvaluation), {
    idempotent: true,
    invalidate: inv,
    success:
      respondent === "self" ? "Self-evaluation submitted" : "Evaluation submitted for review",
    onSuccess: () => setConfirm(null),
  });
  const review = useAction(useServerFn(reviewEvaluation), {
    idempotent: true,
    invalidate: inv,
    success: "Decision recorded",
    onSuccess: () => {
      setConfirm(null);
      setComment("");
    },
  });
  const reopen = useAction(useServerFn(reopenEvaluation), {
    idempotent: true,
    invalidate: inv,
    success: "Evaluation reopened",
    onSuccess: () => {
      setConfirm(null);
      setComment("");
    },
  });
  const acknowledge = useAction(useServerFn(acknowledgeEvaluation), {
    idempotent: true,
    invalidate: inv,
    success: "Evaluation acknowledgement recorded",
    onSuccess: () => {
      setConfirm(null);
      setComment("");
    },
  });
  const addEv = useAction(useServerFn(addEvaluationEvidence), {
    invalidate: inv,
    success: "Evidence added",
    onSuccess: () => setNote(""),
  });

  const set = (itemId: string, patch: Partial<Resp>) => {
    setVals((v) => ({ ...v, [itemId]: { ...v[itemId], ...patch } }));
    setDirty(true);
  };
  const payload = () => ({
    assignment_id: a.id,
    respondent: respondent!,
    responses: Object.entries(vals).map(([item_id, r]) => ({
      item_id,
      rating: r.rating ?? null,
      text_value: r.text_value ?? null,
      choice_values: r.choice_values ?? null,
      kpi_actual: r.kpi_actual ?? null,
      comment: r.comment ?? null,
    })),
    overall_comment: respondent === "evaluator" ? overall : null,
    version: a.version,
  });
  const preview =
    respondent === "evaluator"
      ? computeScore(
          allItems,
          Object.entries(vals).map(([item_id, r]) => ({
            item_id,
            rating: r.rating,
            kpi_actual: r.kpi_actual,
          })),
          snap.rating_scale_max,
        )
      : null;
  const other = (itemId: string, who: "self" | "evaluator") =>
    data.responses.find((r) => r.item_id === itemId && r.respondent === who);

  return (
    <div className="pb-24">
      <PageHeader
        eyebrow={`${a.cycle?.name} · ${snap.profile_name} v${snap.version_number}`}
        title={empName(a.employee)}
        description={
          <>
            Evaluator: {empName(a.evaluator)} · Due {fmtDate(a.cycle?.due_date)}
          </>
        }
        actions={
          <>
            <StatusBadge status={a.status} />
            {a.overall_score != null && <Tag tone="primary">Score {a.overall_score}</Tag>}
            {a.acknowledged_at && <Tag tone="success">Acknowledged</Tag>}
          </>
        }
      />
      {a.reopen_reason && ["reopened"].includes(a.status) && (
        <div className="mb-4 rounded-md border border-warning/40 bg-warning-soft p-3 text-sm">
          <span className="font-bold">Reopened:</span> {a.reopen_reason}
        </div>
      )}
      {snap.instructions && (
        <Panel className="mb-4">
          <p className="text-sm">{snap.instructions}</p>
        </Panel>
      )}
      {respondent && (
        <p className="mb-3 text-sm font-bold text-accent-foreground">
          You are completing the{" "}
          {respondent === "self" ? "self-evaluation" : "evaluator assessment"}. Rating scale 1–
          {snap.rating_scale_max}.
        </p>
      )}

      <div className="space-y-4">
        {snap.sections.map((s) => (
          <Panel key={s.id} title={s.title} description={s.description ?? undefined}>
            <div className="space-y-5">
              {s.items.map((it) => {
                const v = vals[it.id] ?? {};
                const ro = !respondent;
                const fid = `i-${it.id}`;
                const selfR = other(it.id, "self");
                const evalR = other(it.id, "evaluator");
                return (
                  <div key={it.id} className="border-b pb-4 last:border-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Label htmlFor={fid} className="font-bold">
                        {it.label}
                        {it.is_required && <span className="text-destructive"> *</span>}
                      </Label>
                      {Number(it.weight) > 0 && <Tag>{it.weight}%</Tag>}
                      {it.evidence_required && <Tag tone="info">Evidence expected</Tag>}
                    </div>
                    {it.help_text && (
                      <p className="mb-2 text-sm text-muted-foreground">{it.help_text}</p>
                    )}
                    {respondent && (
                      <div className="max-w-xl">
                        {it.item_type === "rating" && (
                          <div
                            role="radiogroup"
                            aria-labelledby={fid}
                            className="flex flex-wrap gap-1"
                          >
                            <span id={fid} className="sr-only">
                              {it.label}
                            </span>
                            {Array.from({ length: snap.rating_scale_max }, (_, i) => i + 1).map(
                              (n) => (
                                <button
                                  key={n}
                                  type="button"
                                  role="radio"
                                  aria-checked={v.rating === n}
                                  disabled={ro}
                                  onClick={() => set(it.id, { rating: n })}
                                  className={`size-10 rounded-md border font-data font-bold ${v.rating === n ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent"}`}
                                >
                                  {n}
                                </button>
                              ),
                            )}
                          </div>
                        )}
                        {it.item_type === "kpi" && (
                          <div className="flex items-center gap-2 font-data text-sm">
                            <Input
                              id={fid}
                              type="number"
                              className="w-32"
                              value={v.kpi_actual ?? ""}
                              onChange={(e) =>
                                set(it.id, {
                                  kpi_actual: e.target.value === "" ? null : Number(e.target.value),
                                })
                              }
                            />
                            <span>
                              actual vs target {it.kpi_target}
                              {it.kpi_unit}
                            </span>
                          </div>
                        )}
                        {it.item_type === "short_text" && (
                          <Input
                            id={fid}
                            maxLength={500}
                            value={v.text_value ?? ""}
                            onChange={(e) => set(it.id, { text_value: e.target.value })}
                          />
                        )}
                        {it.item_type === "long_text" && (
                          <Textarea
                            id={fid}
                            maxLength={8000}
                            value={v.text_value ?? ""}
                            onChange={(e) => set(it.id, { text_value: e.target.value })}
                          />
                        )}
                        {it.item_type === "yes_no" && (
                          <NativeSelect
                            id={fid}
                            className="w-40"
                            value={v.text_value ?? ""}
                            onChange={(e) => set(it.id, { text_value: e.target.value || null })}
                          >
                            <option value="">Select…</option>
                            <option value="yes">Yes</option>
                            <option value="no">No</option>
                          </NativeSelect>
                        )}
                        {it.item_type === "single_choice" && (
                          <NativeSelect
                            id={fid}
                            value={v.choice_values?.[0] ?? ""}
                            onChange={(e) =>
                              set(it.id, {
                                choice_values: e.target.value ? [e.target.value] : null,
                              })
                            }
                          >
                            <option value="">Select…</option>
                            {it.options.map((o) => (
                              <option key={o}>{o}</option>
                            ))}
                          </NativeSelect>
                        )}
                        {it.item_type === "multi_choice" && (
                          <div className="flex flex-wrap gap-3" id={fid}>
                            {it.options.map((o) => (
                              <label key={o} className="flex items-center gap-1.5 text-sm">
                                <Checkbox
                                  checked={v.choice_values?.includes(o) ?? false}
                                  onCheckedChange={(c) =>
                                    set(it.id, {
                                      choice_values: c
                                        ? [...(v.choice_values ?? []), o]
                                        : (v.choice_values ?? []).filter((x) => x !== o),
                                    })
                                  }
                                />{" "}
                                {o}
                              </label>
                            ))}
                          </div>
                        )}
                        <Input
                          aria-label={`Comment on ${it.label}`}
                          placeholder="Comment (optional)"
                          className="mt-2"
                          maxLength={4000}
                          value={v.comment ?? ""}
                          onChange={(e) => set(it.id, { comment: e.target.value })}
                        />
                      </div>
                    )}
                    <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                      {selfR && respondent !== "self" && <ReadResp label="Self" r={selfR} />}
                      {evalR && respondent !== "evaluator" && showEvaluatorToEmployee && (
                        <ReadResp label="Evaluator" r={evalR} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        ))}

        {(respondent === "evaluator" || a.overall_comment) && (
          <Panel title="Overall feedback">
            {respondent === "evaluator" ? (
              <Textarea
                aria-label="Overall feedback"
                value={overall}
                maxLength={8000}
                onChange={(e) => {
                  setOverall(e.target.value);
                  setDirty(true);
                }}
              />
            ) : (
              showEvaluatorToEmployee && (
                <p className="whitespace-pre-wrap text-sm">{a.overall_comment}</p>
              )
            )}
          </Panel>
        )}

        <Panel title="Evidence">
          {data.evidence.length === 0 ? (
            <p className="text-sm text-muted-foreground">No evidence attached.</p>
          ) : (
            <ul className="mb-3 space-y-2">
              {data.evidence.map((e) => (
                <li key={e.id} className="text-sm">
                  {e.file_id ? (
                    <EvidenceFileLink fileId={e.file_id} name={e.file?.original_name ?? "file"} />
                  ) : (
                    <span>{e.note}</span>
                  )}{" "}
                  <span className="font-data text-xs text-muted-foreground">
                    · {fmtDateTime(e.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {respondent && (
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-64 flex-1">
                <Field label="Evidence note" htmlFor="evn">
                  <Input
                    id="evn"
                    value={note}
                    maxLength={2000}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </Field>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={!note.trim() || addEv.isPending}
                onClick={() =>
                  addEv.mutate({ assignment_id: a.id, file_id: null, note, item_id: null })
                }
              >
                Add note
              </Button>
              <EvidenceUpload
                employeeId={a.employee_id}
                onUploaded={(fid) =>
                  addEv
                    .mutateAsync({ assignment_id: a.id, file_id: fid, note: null, item_id: null })
                    .then(() => undefined)
                }
              />
            </div>
          )}
        </Panel>

        <Panel title="Review history">
          {data.reviews.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reviews yet.</p>
          ) : (
            <ul className="space-y-2">
              {data.reviews.map((r) => (
                <li key={r.id} className="text-sm">
                  <StatusBadge
                    status={r.decision === "returned" ? "reopened" : r.decision}
                    label={
                      r.decision === "acknowledged" ? "Employee acknowledged receipt" : r.decision
                    }
                  />{" "}
                  <span className="font-data text-xs text-muted-foreground">
                    {fmtDateTime(r.created_at)}
                  </span>
                  {r.comments && <p className="mt-1">{r.comments}</p>}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 font-data text-xs text-muted-foreground">
            Submitted {fmtDateTime(a.submitted_at)} · Approved {fmtDateTime(a.approved_at)} ·
            Self-evaluation{" "}
            {a.self_submitted_at
              ? `submitted ${fmtDateTime(a.self_submitted_at)}`
              : a.self_evaluation
                ? "pending"
                : "not required"}
          </p>
          <p className="mt-2 text-sm">
            Employee acknowledgement:{" "}
            {a.acknowledged_at ? `received ${fmtDateTime(a.acknowledged_at)}` : "pending"}
          </p>
          {a.acknowledgement_comment && (
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
              Employee comment: {a.acknowledgement_comment}
            </p>
          )}
          <Link
            to="/performance/history"
            className="mt-2 inline-block text-sm font-bold text-primary hover:underline"
          >
            All evaluations
          </Link>
        </Panel>
      </div>

      {(respondent || canReview || canReopen || canAcknowledge) && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-card/95 backdrop-blur md:left-auto md:w-[calc(100%-16rem)]">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-3 sm:px-6 lg:px-8">
            {preview !== null && (
              <span className="font-data text-sm">
                Preview score: <strong>{preview}</strong> / 100
              </span>
            )}
            {dirty && <Tag tone="warning">Unsaved changes</Tag>}
            <div className="flex-1" />
            {respondent && (
              <>
                <Button
                  variant="outline"
                  disabled={!dirty || save.isPending}
                  onClick={() => save.mutate(payload())}
                >
                  <Save /> Save draft
                </Button>
                <Button
                  disabled={dirty || submit.isPending}
                  title={dirty ? "Save your draft first" : undefined}
                  onClick={() => setConfirm("submit")}
                >
                  <Send /> Submit
                </Button>
              </>
            )}
            {canReview && (
              <>
                <Button variant="outline" onClick={() => setConfirm("return")}>
                  <Undo2 /> Return
                </Button>
                <Button onClick={() => setConfirm("approve")}>
                  <CheckCircle2 /> Approve
                </Button>
              </>
            )}
            {canReopen && (
              <Button variant="outline" onClick={() => setConfirm("reopen")}>
                <RotateCcw /> Reopen
              </Button>
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
        onOpenChange={(o) => !o && setConfirm(null)}
        title={
          {
            submit: "Submit evaluation?",
            approve: "Approve evaluation?",
            return: "Return to evaluator?",
            reopen: "Reopen evaluation?",
            acknowledge: "Acknowledge receipt?",
          }[confirm ?? "submit"]
        }
        description={
          confirm === "submit"
            ? "You won't be able to edit it after submitting."
            : confirm === "approve"
              ? "The evaluation becomes final unless reopened with a recorded reason."
              : confirm === "acknowledge"
                ? "This records that you received the finalized evaluation; it does not change or accept the evaluation result."
                : "A reason is required and will be recorded."
        }
        confirmLabel={
          {
            submit: "Submit",
            approve: "Approve",
            return: "Return",
            reopen: "Reopen",
            acknowledge: "Acknowledge",
          }[confirm ?? "submit"]
        }
        pending={submit.isPending || review.isPending || reopen.isPending || acknowledge.isPending}
        onConfirm={() => {
          if (confirm === "submit") submit.mutate({ assignment_id: a.id, respondent: respondent! });
          if (confirm === "approve")
            review.mutate({ assignment_id: a.id, decision: "approve", comments: comment });
          if (confirm === "return")
            review.mutate({ assignment_id: a.id, decision: "return", comments: comment });
          if (confirm === "reopen") reopen.mutate({ assignment_id: a.id, reason: comment });
          if (confirm === "acknowledge") acknowledge.mutate({ assignment_id: a.id, comment });
        }}
      >
        {confirm && confirm !== "submit" && (
          <div className="space-y-1.5">
            <Label htmlFor="rc">
              {confirm === "approve" || confirm === "acknowledge"
                ? confirm === "approve"
                  ? "Comments (optional)"
                  : "Employee comment (optional)"
                : "Reason (required, 5+ characters)"}
            </Label>
            <Textarea
              id="rc"
              value={comment}
              maxLength={confirm === "acknowledge" ? 4000 : 2000}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}

function ReadResp({ label, r }: { label: string; r: Resp }) {
  const v = r.rating ?? r.kpi_actual ?? r.text_value ?? r.choice_values?.join(", ") ?? "—";
  return (
    <div className="rounded-md bg-muted p-2">
      <p className="font-data text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="whitespace-pre-wrap">{String(v)}</p>
      {r.comment && <p className="text-xs text-muted-foreground">{r.comment}</p>}
    </div>
  );
}
