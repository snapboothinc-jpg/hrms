import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  fetchAiRecommendations,
  fetchAiReviews,
  fetchEmployees,
  empName,
  type AiRecRow,
} from "@/lib/data";
import { generateAiRecommendations, reviewAiRecommendation } from "@/lib/api/development.functions";
import { unwrap, ApiError } from "@/lib/api/result";
import { usePermissions } from "@/hooks/use-me";
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
  Tag,
  fmtDateTime,
  SafetyTags,
} from "@/components/app/kit";
import { DataTable } from "@/components/app/data-table";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/ai/queue")({
  head: () => ({
    meta: [
      { title: "AI recommendations — Priority Handling Logistics, Inc." },
      {
        name: "description",
        content: "Review AI-suggested development activities. Advisory only; a human decides.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  const { any, me } = usePermissions();
  const qc = useQueryClient();
  const recs = useQuery({ queryKey: qk.ai.recs(), queryFn: () => fetchAiRecommendations() });
  const employees = useQuery({ queryKey: qk.org.employees(), queryFn: fetchEmployees });
  const generate = useServerFn(generateAiRecommendations);
  const review = useServerFn(reviewAiRecommendation);

  const [genFor, setGenFor] = useState("");
  const [reviewing, setReviewing] = useState<AiRecRow | null>(null);
  const [decision, setDecision] = useState<"accept" | "edit" | "reject">("accept");
  const [comments, setComments] = useState("");
  const [editPriority, setEditPriority] = useState("medium");
  const [editOutcome, setEditOutcome] = useState("");
  const [busy, setBusy] = useState(false);
  const [reviewsFor, setReviewsFor] = useState<AiRecRow | null>(null);

  if (recs.error) return <ErrorState error={recs.error} onRetry={() => recs.refetch()} />;
  if (!recs.data) return <LoadingRows />;

  const canGenerate = any("ai.generate");
  const canReview = any("ai.review");
  const pending = recs.data.filter((r) => r.status === "pending_review");

  const doGenerate = async () => {
    if (!genFor) return;
    setBusy(true);
    try {
      const r = unwrap(
        await generate({ data: { employee_id: genFor, idempotencyKey: crypto.randomUUID() } }),
      );
      toast.success(
        r.saved
          ? `${r.saved} recommendation(s) queued for review`
          : ((r as { note?: string }).note ?? "No recommendations generated"),
      );
      setGenFor("");
      qc.invalidateQueries({ queryKey: qk.ai.all });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Generation failed");
    } finally {
      setBusy(false);
    }
  };

  const doReview = async () => {
    if (!reviewing) return;
    setBusy(true);
    try {
      unwrap(
        await review({
          data: {
            id: reviewing.id,
            decision,
            comments,
            edited:
              decision === "edit"
                ? {
                    priority: editPriority as "high" | "medium" | "low",
                    expected_outcome: editOutcome || undefined,
                  }
                : undefined,
            idempotencyKey: crypto.randomUUID(),
          },
        }),
      );
      toast.success(
        decision === "reject"
          ? "Recommendation rejected"
          : "Recommendation accepted — a development plan item was created and the activity assigned",
      );
      setReviewing(null);
      setComments("");
      qc.invalidateQueries({ queryKey: qk.ai.all });
      qc.invalidateQueries({ queryKey: qk.train.all });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Review failed");
    } finally {
      setBusy(false);
    }
  };

  const cols: ColumnDef<AiRecRow, unknown>[] = [
    {
      header: "Employee",
      cell: ({ row }) => (
        <Link
          to="/people/employees/$id"
          params={{ id: row.original.employee_id }}
          className="font-bold hover:underline"
        >
          {empName(row.original.employee)}
        </Link>
      ),
    },
    {
      header: "Gap",
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.competency?.name}: {row.original.current_level ?? "—"} →{" "}
          {row.original.required_level}
        </span>
      ),
    },
    {
      header: "Type",
      accessorKey: "recommendation_type",
      cell: ({ getValue }) => String(getValue()).replace(/_/g, " "),
    },
    {
      header: "Priority",
      accessorKey: "priority",
      cell: ({ row }) => (
        <Tag
          tone={
            row.original.priority === "high"
              ? "danger"
              : row.original.priority === "medium"
                ? "warning"
                : "neutral"
          }
        >
          {row.original.priority}
        </Tag>
      ),
    },
    {
      header: "Model",
      accessorKey: "model",
      cell: ({ getValue }) => <span className="font-data text-xs">{String(getValue())}</span>,
    },
    {
      header: "Generated",
      accessorKey: "created_at",
      cell: ({ getValue }) => fmtDateTime(getValue() as string),
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: ({ row }) => (
        <StatusBadge
          status={row.original.status}
          label={row.original.status === "pending_review" ? "Pending review" : undefined}
        />
      ),
    },
    {
      header: "",
      id: "actions",
      cell: ({ row }) => {
        const r = row.original;
        const ownGeneration = r.generated_by === me?.user_id;
        return (
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="outline" onClick={() => setReviewsFor(r)}>
              Details
            </Button>
            {canReview && r.status === "pending_review" && (
              <Button
                size="sm"
                disabled={ownGeneration}
                title={
                  ownGeneration ? "You cannot review a recommendation you generated" : undefined
                }
                onClick={() => {
                  setReviewing(r);
                  setDecision("accept");
                  setEditPriority(r.priority);
                  setEditOutcome(r.expected_outcome ?? "");
                }}
              >
                Review
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="AI recommendations queue"
        description="Advisory suggestions from the AI service. A human reviewer accepts, edits, or rejects each one; the AI never approves its own output and never changes ratings."
        actions={
          canGenerate ? (
            <div className="flex gap-2">
              <NativeSelect
                aria-label="Employee to analyze"
                value={genFor}
                onChange={(e) => setGenFor(e.target.value)}
                className="w-64"
              >
                <option value="">Generate for employee…</option>
                {(employees.data ?? []).map((e) => (
                  <option key={e.id} value={e.id}>
                    {empName(e)} ({e.employee_code})
                  </option>
                ))}
              </NativeSelect>
              <Button onClick={doGenerate} disabled={busy || !genFor}>
                <Sparkles className="size-4" aria-hidden /> Generate
              </Button>
            </div>
          ) : undefined
        }
      />
      <Panel title={`Pending review (${pending.length})`} className="mb-6">
        {pending.length === 0 ? (
          <EmptyState
            title="Nothing pending"
            description="Generate recommendations for an employee with validated gaps."
          />
        ) : (
          <DataTable data={pending} columns={cols} searchPlaceholder="Search pending…" />
        )}
      </Panel>
      <Panel title="Decided">
        <DataTable
          data={recs.data.filter((r) => r.status !== "pending_review")}
          columns={cols}
          searchPlaceholder="Search decided…"
        />
      </Panel>

      <Dialog open={!!reviewing} onOpenChange={(o) => !o && setReviewing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review recommendation</DialogTitle>
          </DialogHeader>
          {reviewing && (
            <div className="grid gap-3">
              <div className="rounded-md bg-muted p-3 text-sm">
                <p className="font-semibold">{reviewing.competency?.name}</p>
                <p className="text-muted-foreground">
                  Gap {reviewing.gap} (current {reviewing.current_level ?? "—"}, required{" "}
                  {reviewing.required_level}) · {reviewing.recommendation_type.replace(/_/g, " ")}
                </p>
                <p className="mt-2">{reviewing.rationale}</p>
                {reviewing.expected_outcome && (
                  <p className="mt-1 text-muted-foreground">
                    Expected: {reviewing.expected_outcome}
                  </p>
                )}
              </div>
              <Field label="Decision" htmlFor="rv-decision" required>
                <NativeSelect
                  id="rv-decision"
                  value={decision}
                  onChange={(e) => setDecision(e.target.value as typeof decision)}
                >
                  <option value="accept">Accept — create plan item and assign</option>
                  <option value="edit">Edit and accept</option>
                  <option value="reject">Reject</option>
                </NativeSelect>
              </Field>
              {decision === "edit" && (
                <>
                  <Field label="Priority" htmlFor="rv-prio">
                    <NativeSelect
                      id="rv-prio"
                      value={editPriority}
                      onChange={(e) => setEditPriority(e.target.value)}
                    >
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </NativeSelect>
                  </Field>
                  <Field label="Expected outcome" htmlFor="rv-outcome">
                    <Textarea
                      id="rv-outcome"
                      value={editOutcome}
                      onChange={(e) => setEditOutcome(e.target.value)}
                      rows={2}
                      maxLength={4000}
                    />
                  </Field>
                </>
              )}
              <Field label="Comments" htmlFor="rv-comments">
                <Textarea
                  id="rv-comments"
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  rows={2}
                  maxLength={4000}
                />
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewing(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              onClick={doReview}
              disabled={busy}
              variant={decision === "reject" ? "destructive" : "default"}
            >
              {decision === "reject"
                ? "Reject"
                : decision === "edit"
                  ? "Save edits & accept"
                  : "Accept"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReviewHistory rec={reviewsFor} onClose={() => setReviewsFor(null)} />
    </div>
  );
}

function ReviewHistory({ rec, onClose }: { rec: AiRecRow | null; onClose: () => void }) {
  const reviews = useQuery({
    queryKey: [...qk.ai.all, "reviews", rec?.id],
    queryFn: () => fetchAiReviews(rec!.id),
    enabled: !!rec,
  });
  return (
    <Dialog open={!!rec} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Recommendation detail</DialogTitle>
        </DialogHeader>
        {rec && (
          <div className="space-y-3 text-sm">
            <p>
              <span className="font-semibold">Rationale:</span> {rec.rationale}
            </p>
            {rec.expected_outcome && (
              <p>
                <span className="font-semibold">Expected outcome:</span> {rec.expected_outcome}
              </p>
            )}
            <p className="text-muted-foreground">
              Model: <span className="font-data">{rec.model}</span> · generated{" "}
              {fmtDateTime(rec.created_at)}
            </p>
            <div>
              <p className="font-semibold">Review history</p>
              {!reviews.data?.length ? (
                <p className="text-muted-foreground">No reviews yet.</p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {reviews.data.map((r) => (
                    <li key={r.id} className="flex items-center gap-2">
                      <StatusBadge
                        status={r.decision === "reject" ? "rejected" : "approved"}
                        label={r.decision}
                      />
                      <span className="text-xs text-muted-foreground">
                        {fmtDateTime(r.created_at)}
                      </span>
                      {r.comments && <span className="text-xs">{r.comments}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
