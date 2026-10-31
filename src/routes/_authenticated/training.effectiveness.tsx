import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  fetchEffectiveness,
  fetchSessions,
  fetchAssessments,
  fetchEmployees,
  fetchCompetencies,
  empName,
} from "@/lib/data";
import { saveEffectivenessReview, linkReassessment } from "@/lib/api/development.functions";
import { unwrap, ApiError } from "@/lib/api/result";
import { qk } from "@/lib/query-keys";
import {
  PageHeader,
  Panel,
  StatusBadge,
  EmptyState,
  LoadingRows,
  ErrorState,
  Field,
  NativeSelect,
  DefaultNote,
  fmtDateTime,
} from "@/components/app/kit";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/training/effectiveness")({
  head: () => ({
    meta: [
      { title: "Training effectiveness — Priority Handling Logistics, Inc." },
      {
        name: "description",
        content: "Effectiveness reviews and evidence-based reassessment links.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  const qc = useQueryClient();
  const reviews = useQuery({
    queryKey: qk.train.effectiveness(),
    queryFn: () => fetchEffectiveness(),
  });
  const sessions = useQuery({
    queryKey: qk.train.sessions("completed"),
    queryFn: () => fetchSessions("completed"),
  });
  const employees = useQuery({ queryKey: qk.org.employees(), queryFn: fetchEmployees });
  const competencies = useQuery({ queryKey: qk.comp.library(), queryFn: fetchCompetencies });
  const reassessments = useQuery({
    queryKey: qk.comp.assessments({ reassess: true }),
    queryFn: () => fetchAssessments({ status: "approved" }),
  });
  const saveReview = useServerFn(saveEffectivenessReview);
  const link = useServerFn(linkReassessment);

  const [reviewFor, setReviewFor] = useState<string | null>(null);
  const [reviewForm, setReviewForm] = useState({
    summary: "",
    follow_up_required: false,
    notes: "",
  });
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkForm, setLinkForm] = useState({
    employee_id: "",
    competency_id: "",
    session_id: "",
    assessment_id: "",
    notes: "",
  });
  const [busy, setBusy] = useState(false);

  if (reviews.error) return <ErrorState error={reviews.error} onRetry={() => reviews.refetch()} />;
  if (!reviews.data || !sessions.data) return <LoadingRows />;

  const reviewedSessions = new Set(reviews.data.map((r) => r.session_id));
  const approvedReassessments = (reassessments.data ?? []).filter((a) => a.is_reassessment);

  const doSaveReview = async () => {
    if (!reviewFor) return;
    setBusy(true);
    try {
      unwrap(
        await saveReview({
          data: {
            session_id: reviewFor,
            summary: reviewForm.summary,
            follow_up_required: reviewForm.follow_up_required,
            notes: reviewForm.notes || undefined,
          },
        }),
      );
      toast.success("Effectiveness review saved");
      setReviewFor(null);
      setReviewForm({ summary: "", follow_up_required: false, notes: "" });
      qc.invalidateQueries({ queryKey: qk.train.effectiveness() });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not save the review");
    } finally {
      setBusy(false);
    }
  };

  const doLink = async () => {
    setBusy(true);
    try {
      unwrap(
        await link({
          data: {
            employee_id: linkForm.employee_id,
            competency_id: linkForm.competency_id,
            session_id: linkForm.session_id || null,
            assessment_id: linkForm.assessment_id,
            notes: linkForm.notes || undefined,
          },
        }),
      );
      toast.success(
        "Reassessment linked — the competency status now reflects the approved reassessment",
      );
      setLinkOpen(false);
      qc.invalidateQueries({ queryKey: qk.comp.all });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not link the reassessment");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Training effectiveness"
        description="Review completed sessions and link evidence-based reassessments."
        actions={<Button onClick={() => setLinkOpen(true)}>Link reassessment</Button>}
      />
      <DefaultNote>
        Completing training never closes a competency gap. Only an approved reassessment with
        evidence updates competency status.
      </DefaultNote>
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <Panel title="Completed sessions awaiting review">
          {sessions.data.filter((s) => !reviewedSessions.has(s.id)).length === 0 ? (
            <EmptyState
              title="All reviewed"
              description="Every completed session has an effectiveness review."
            />
          ) : (
            <ul className="divide-y">
              {sessions.data
                .filter((s) => !reviewedSessions.has(s.id))
                .map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div>
                      <p className="text-sm font-semibold">{s.title}</p>
                      <p className="text-xs text-muted-foreground">{fmtDateTime(s.starts_at)}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setReviewFor(s.id)}>
                      Review
                    </Button>
                  </li>
                ))}
            </ul>
          )}
        </Panel>
        <Panel title="Effectiveness reviews">
          {reviews.data.length === 0 ? (
            <EmptyState
              title="No reviews yet"
              description="Review a completed session to record its effectiveness."
            />
          ) : (
            <ul className="divide-y">
              {reviews.data.map((r) => (
                <li key={r.id} className="py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{r.session?.title}</p>
                    {r.follow_up_required && (
                      <StatusBadge status="pending" label="Follow-up needed" />
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{r.summary}</p>
                  {r.follow_up_notes && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Follow-up: {r.follow_up_notes}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Dialog open={!!reviewFor} onOpenChange={(o) => !o && setReviewFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Effectiveness review</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Field label="Summary" htmlFor="ef-summary" required>
              <Textarea
                id="ef-summary"
                value={reviewForm.summary}
                onChange={(e) => setReviewForm({ ...reviewForm, summary: e.target.value })}
                rows={3}
                maxLength={4000}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={reviewForm.follow_up_required}
                onChange={(e) =>
                  setReviewForm({ ...reviewForm, follow_up_required: e.target.checked })
                }
                className="accent-primary"
              />
              Follow-up required
            </label>
            <Field label="Follow-up notes" htmlFor="ef-notes">
              <Textarea
                id="ef-notes"
                value={reviewForm.notes}
                onChange={(e) => setReviewForm({ ...reviewForm, notes: e.target.value })}
                rows={2}
                maxLength={4000}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewFor(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={doSaveReview} disabled={busy || reviewForm.summary.length < 3}>
              Save review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link an approved reassessment</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Only approved reassessments with evidence can be linked. Record the reassessment first
            under Competency → Assess.
          </p>
          <div className="grid gap-3">
            <Field label="Employee" htmlFor="lk-emp" required>
              <NativeSelect
                id="lk-emp"
                value={linkForm.employee_id}
                onChange={(e) =>
                  setLinkForm({ ...linkForm, employee_id: e.target.value, assessment_id: "" })
                }
              >
                <option value="">Choose…</option>
                {(employees.data ?? []).map((e) => (
                  <option key={e.id} value={e.id}>
                    {empName(e)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Competency" htmlFor="lk-comp" required>
              <NativeSelect
                id="lk-comp"
                value={linkForm.competency_id}
                onChange={(e) =>
                  setLinkForm({ ...linkForm, competency_id: e.target.value, assessment_id: "" })
                }
              >
                <option value="">Choose…</option>
                {(competencies.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Approved reassessment" htmlFor="lk-assess" required>
              <NativeSelect
                id="lk-assess"
                value={linkForm.assessment_id}
                onChange={(e) => setLinkForm({ ...linkForm, assessment_id: e.target.value })}
              >
                <option value="">Choose…</option>
                {approvedReassessments
                  .filter(
                    (a) =>
                      a.employee_id === linkForm.employee_id &&
                      a.competency_id === linkForm.competency_id,
                  )
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.assessment_date} — level {a.current_level ?? "?"}
                    </option>
                  ))}
              </NativeSelect>
            </Field>
            <Field label="Related session" htmlFor="lk-sess">
              <NativeSelect
                id="lk-sess"
                value={linkForm.session_id}
                onChange={(e) => setLinkForm({ ...linkForm, session_id: e.target.value })}
              >
                <option value="">None</option>
                {sessions.data.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Notes" htmlFor="lk-notes">
              <Textarea
                id="lk-notes"
                value={linkForm.notes}
                onChange={(e) => setLinkForm({ ...linkForm, notes: e.target.value })}
                rows={2}
                maxLength={2000}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              onClick={doLink}
              disabled={
                busy || !linkForm.employee_id || !linkForm.competency_id || !linkForm.assessment_id
              }
            >
              Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <p className="mt-6 text-xs text-muted-foreground">
        Looking for a specific session? Open it from the{" "}
        <Link to="/training/calendar" className="underline">
          training calendar
        </Link>
        .
      </p>
    </div>
  );
}
