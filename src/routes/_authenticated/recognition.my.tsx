import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchNominations, empName } from "@/lib/data";
import { useMe } from "@/hooks/use-me";
import { qk } from "@/lib/query-keys";
import {
  PageHeader,
  Panel,
  EmptyState,
  LoadingRows,
  ErrorState,
  StatusBadge,
  fmtDateTime,
} from "@/components/app/kit";

export const Route = createFileRoute("/_authenticated/recognition/my")({
  head: () => ({
    meta: [
      { title: "My recognition — Priority Handling Logistics, Inc." },
      { name: "description", content: "Nominations you sent and recognition you received." },
    ],
  }),
  component: Page,
});

function Page() {
  const me = useMe();
  const nominations = useQuery({
    queryKey: qk.rec.nominations(),
    queryFn: () => fetchNominations(),
  });

  if (nominations.error)
    return <ErrorState error={nominations.error} onRetry={() => nominations.refetch()} />;
  if (!nominations.data || !me.data) return <LoadingRows />;

  const myId = me.data.employee?.id;
  const sent = nominations.data.filter((n) => n.nominator_id === myId);
  const received = nominations.data.filter(
    (n) => n.recipient_id === myId && n.status === "approved",
  );

  return (
    <div>
      <PageHeader
        title="My recognition"
        description="Nominations you have sent and recognition you have received."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={`Received (${received.length})`}>
          {received.length === 0 ? (
            <EmptyState
              title="Nothing yet"
              description="Approved recognition you receive will appear here."
            />
          ) : (
            <ul className="divide-y">
              {received.map((n) => (
                <li key={n.id} className="py-3">
                  <div className="flex items-center gap-2">
                    <StatusBadge status="approved" label={n.category?.name ?? "Recognition"} />
                    <span className="text-xs text-muted-foreground">
                      {fmtDateTime(n.created_at)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm">{n.message}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title={`Sent (${sent.length})`}>
          {sent.length === 0 ? (
            <EmptyState
              title="No nominations sent"
              description="Nominate a colleague to recognize their work."
            />
          ) : (
            <ul className="divide-y">
              {sent.map((n) => (
                <li key={n.id} className="py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">
                      {n.recipient ? empName(n.recipient) : "—"}
                    </p>
                    <StatusBadge status={n.status} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{n.message}</p>
                  {n.review_comments && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Review: {n.review_comments}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
