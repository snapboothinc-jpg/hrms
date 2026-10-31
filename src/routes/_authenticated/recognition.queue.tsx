import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { fetchNominations, empName, type NominationRow } from "@/lib/data";
import { reviewNomination } from "@/lib/api/succession.functions";
import { unwrap, ApiError } from "@/lib/api/result";
import { useMe } from "@/hooks/use-me";
import { qk } from "@/lib/query-keys";
import {
  PageHeader,
  Panel,
  EmptyState,
  LoadingRows,
  ErrorState,
  StatusBadge,
  Field,
  NativeSelect,
  fmtDateTime,
  DefaultNote,
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

export const Route = createFileRoute("/_authenticated/recognition/queue")({
  head: () => ({
    meta: [
      { title: "Recognition approval queue — Priority Handling Logistics, Inc." },
      { name: "description", content: "Approve or reject nominations before they are published." },
    ],
  }),
  component: Page,
});

function Page() {
  const me = useMe();
  const qc = useQueryClient();
  const nominations = useQuery({
    queryKey: qk.rec.nominations({ pending: true }),
    queryFn: () => fetchNominations("submitted"),
  });
  const review = useServerFn(reviewNomination);

  const [reviewing, setReviewing] = useState<NominationRow | null>(null);
  const [decision, setDecision] = useState<"approve" | "reject">("approve");
  const [comments, setComments] = useState("");
  const [visibility, setVisibility] = useState<"company" | "department">("company");
  const [showNominator, setShowNominator] = useState(true);
  const [busy, setBusy] = useState(false);

  if (nominations.error)
    return <ErrorState error={nominations.error} onRetry={() => nominations.refetch()} />;
  if (!nominations.data) return <LoadingRows />;

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
            visibility,
            show_nominator: showNominator,
            idempotencyKey: crypto.randomUUID(),
          },
        }),
      );
      toast.success(decision === "approve" ? "Approved and published" : "Nomination rejected");
      setReviewing(null);
      setComments("");
      qc.invalidateQueries({ queryKey: qk.rec.all });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Review failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Recognition approval queue"
        description="Only approved nominations are published to the feed."
      />
      <DefaultNote>
        The approval route and publication visibility are defaults that require organizational
        validation.
      </DefaultNote>
      <Panel className="mt-4" title={`Pending (${nominations.data.length})`}>
        {nominations.data.length === 0 ? (
          <EmptyState
            title="Queue is empty"
            description="New nominations will appear here for review."
          />
        ) : (
          <ul className="divide-y">
            {nominations.data.map((n) => {
              const own = n.nominator_id === me.data?.employee?.id;
              return (
                <li key={n.id} className="flex items-start justify-between gap-4 py-3">
                  <div>
                    <p className="text-sm">
                      <span className="font-bold">
                        {n.nominator ? empName(n.nominator) : "Someone"}
                      </span>
                      {" nominated "}
                      <span className="font-bold">
                        {n.recipient ? empName(n.recipient) : "a colleague"}
                      </span>
                      {n.category ? <> · {n.category.name}</> : null}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{n.message}</p>
                    {n.supporting_info && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Supporting: {n.supporting_info}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {fmtDateTime(n.created_at)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    disabled={own}
                    title={own ? "You cannot review your own nomination" : undefined}
                    onClick={() => {
                      setReviewing(n);
                      setDecision("approve");
                      setComments("");
                      setVisibility("company");
                      setShowNominator(true);
                    }}
                  >
                    Review
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Dialog open={!!reviewing} onOpenChange={(o) => !o && setReviewing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review nomination</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Field label="Decision" htmlFor="rn-decision" required>
              <NativeSelect
                id="rn-decision"
                value={decision}
                onChange={(e) => setDecision(e.target.value as "approve" | "reject")}
              >
                <option value="approve">Approve and publish</option>
                <option value="reject">Reject</option>
              </NativeSelect>
            </Field>
            {decision === "approve" && (
              <>
                <Field label="Visibility" htmlFor="rn-vis" required>
                  <NativeSelect
                    id="rn-vis"
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value as "company" | "department")}
                  >
                    <option value="company">Company-wide</option>
                    <option value="department">Department only</option>
                  </NativeSelect>
                </Field>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={showNominator}
                    onChange={(e) => setShowNominator(e.target.checked)}
                    className="accent-primary"
                  />
                  Show the nominator's name in the feed
                </label>
              </>
            )}
            <Field label="Comments" htmlFor="rn-comments" required={decision === "reject"}>
              <Textarea
                id="rn-comments"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={2}
                maxLength={4000}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewing(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              onClick={doReview}
              disabled={busy || (decision === "reject" && !comments.trim())}
              variant={decision === "reject" ? "destructive" : "default"}
            >
              {decision === "approve" ? "Approve & publish" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
