import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Award } from "lucide-react";
import { fetchRecognitionFeed, empName } from "@/lib/data";
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
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/recognition/")({
  head: () => ({
    meta: [
      { title: "Recognition — Priority Handling Logistics, Inc." },
      { name: "description", content: "Approved recognition published to the feed." },
    ],
  }),
  component: Page,
});

function Page() {
  const feed = useQuery({ queryKey: qk.rec.feed(), queryFn: fetchRecognitionFeed });

  if (feed.error) return <ErrorState error={feed.error} onRetry={() => feed.refetch()} />;
  if (!feed.data) return <LoadingRows />;

  return (
    <div>
      <PageHeader
        title="Recognition feed"
        description="Only approved nominations appear here, published according to their visibility setting."
        actions={
          <Button asChild>
            <Link to="/recognition/nominate">
              <Award className="size-4" aria-hidden /> Nominate a colleague
            </Link>
          </Button>
        }
      />
      {feed.data.length === 0 ? (
        <EmptyState
          title="Nothing published yet"
          description="Approved recognition will appear here."
        />
      ) : (
        <div className="grid gap-4">
          {feed.data.map((p) => {
            const n = p.nomination;
            return (
              <Panel key={p.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm">
                      <span className="font-bold">
                        {n?.recipient ? empName(n.recipient) : "A colleague"}
                      </span>
                      {" was recognized"}
                      {n?.category ? (
                        <>
                          {" "}
                          for <span className="font-semibold">{n.category.name}</span>
                        </>
                      ) : null}
                      {n?.show_nominator && n?.nominator ? (
                        <>
                          {" "}
                          by <span className="font-semibold">{empName(n.nominator)}</span>
                        </>
                      ) : null}
                    </p>
                    <p className="mt-2 text-sm">{n?.message}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <StatusBadge
                      status="approved"
                      label={p.visibility === "department" ? "Department" : "Company"}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {fmtDateTime(p.published_at)}
                    </p>
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}
