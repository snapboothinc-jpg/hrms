import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Award, CheckCircle2, XCircle, Clock } from "lucide-react";
import { fetchNominations, fetchRecognitionCategories } from "@/lib/data";
import { qk } from "@/lib/query-keys";
import {
  PageHeader,
  Panel,
  StatCard,
  EmptyState,
  LoadingRows,
  ErrorState,
} from "@/components/app/kit";

export const Route = createFileRoute("/_authenticated/recognition/analytics")({
  head: () => ({
    meta: [
      { title: "Recognition analytics — Priority Handling Logistics, Inc." },
      { name: "description", content: "Nomination volumes and outcomes from live data." },
    ],
  }),
  component: Page,
});

function Page() {
  const nominations = useQuery({
    queryKey: qk.rec.nominations(),
    queryFn: () => fetchNominations(),
  });
  const categories = useQuery({
    queryKey: qk.rec.categories(),
    queryFn: fetchRecognitionCategories,
  });

  if (nominations.error)
    return <ErrorState error={nominations.error} onRetry={() => nominations.refetch()} />;
  if (!nominations.data || !categories.data) return <LoadingRows />;

  const all = nominations.data;
  const approved = all.filter((n) => n.status === "approved").length;
  const rejected = all.filter((n) => n.status === "rejected").length;
  const pending = all.filter((n) => n.status === "submitted").length;

  const byCategory = categories.data
    .map((c) => ({ name: c.name, count: all.filter((n) => n.category_id === c.id).length }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);
  const maxCat = Math.max(1, ...byCategory.map((c) => c.count));

  const byMonth = new Map<string, number>();
  for (const n of all) {
    const key = n.created_at.slice(0, 7);
    byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
  }
  const months = [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-6);
  const maxMonth = Math.max(1, ...months.map(([, v]) => v));

  return (
    <div>
      <PageHeader title="Recognition analytics" description="Computed from live nomination data." />
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Total nominations" value={all.length} icon={Award} />
        <StatCard label="Approved" value={approved} icon={CheckCircle2} tone="success" />
        <StatCard
          label="Pending review"
          value={pending}
          icon={Clock}
          tone={pending ? "warning" : "default"}
        />
        <StatCard
          label="Rejected"
          value={rejected}
          icon={XCircle}
          tone={rejected ? "danger" : "default"}
        />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Nominations by category">
          {byCategory.length === 0 ? (
            <EmptyState title="No data" description="Nominations will be summarized here." />
          ) : (
            <ul className="space-y-2">
              {byCategory.map((c) => (
                <li key={c.name}>
                  <div className="flex justify-between text-sm">
                    <span>{c.name}</span>
                    <span className="font-data">{c.count}</span>
                  </div>
                  <div
                    className="mt-1 h-2 rounded bg-muted"
                    role="img"
                    aria-label={`${c.name}: ${c.count} nominations`}
                  >
                    <div
                      className="h-2 rounded bg-primary"
                      style={{ width: `${(c.count / maxCat) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Nominations per month">
          {months.length === 0 ? (
            <EmptyState title="No data" description="Monthly volumes will appear here." />
          ) : (
            <ul className="space-y-2">
              {months.map(([m, v]) => (
                <li key={m}>
                  <div className="flex justify-between text-sm">
                    <span className="font-data">{m}</span>
                    <span className="font-data">{v}</span>
                  </div>
                  <div
                    className="mt-1 h-2 rounded bg-muted"
                    role="img"
                    aria-label={`${m}: ${v} nominations`}
                  >
                    <div
                      className="h-2 rounded bg-primary"
                      style={{ width: `${(v / maxMonth) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
