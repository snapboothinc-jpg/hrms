import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, CircleDashed, ShieldAlert } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { check, fetchGaps } from "@/lib/data";
import { qk } from "@/lib/query-keys";
import { usePermissions } from "@/hooks/use-me";
import {
  PageHeader,
  Panel,
  StatCard,
  EmptyState,
  LoadingRows,
  ErrorState,
} from "@/components/app/kit";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/competency/")({
  head: () => ({
    meta: [
      { title: "Competency dashboard — Priority Handling Logistics, Inc." },
      { name: "description", content: "Competency status and gap trends." },
    ],
  }),
  component: Page,
});

function Page() {
  const { has } = usePermissions();
  const gaps = useQuery({ queryKey: qk.comp.gaps({ dash: true }), queryFn: () => fetchGaps() });
  const trend = useQuery({
    queryKey: [...qk.comp.all, "trend"],
    queryFn: async () =>
      check(
        await supabase
          .from("competency_gap_snapshots")
          .select("snapshot_at, gap_status")
          .order("snapshot_at")
          .limit(5001),
      ) as { snapshot_at: string; gap_status: string }[],
  });
  const error = gaps.error ?? trend.error;
  if (error)
    return (
      <ErrorState
        error={error}
        onRetry={() => void Promise.all([gaps.refetch(), trend.refetch()])}
      />
    );
  if (!gaps.data || !trend.data) return <LoadingRows />;
  const g = gaps.data;
  const gapsAtLimit = g.length >= 500;
  const trendAtLimit = trend.data.length > 5000;
  const trendRows = trendAtLimit ? [] : trend.data;
  const byComp = Object.values(
    g.reduce<Record<string, { name: string; met: number; gap: number; not_assessed: number }>>(
      (m, r) => {
        m[r.competency_id] ??= { name: r.competency_name, met: 0, gap: 0, not_assessed: 0 };
        m[r.competency_id][r.gap_status]++;
        return m;
      },
      {},
    ),
  );
  const months = Object.values(
    trendRows.reduce<
      Record<string, { month: string; gap: number; met: number; not_assessed: number }>
    >((m, r) => {
      const k = r.snapshot_at.slice(0, 7);
      m[k] ??= { month: k, gap: 0, met: 0, not_assessed: 0 };
      m[k][r.gap_status as "gap"]++;
      return m;
    }, {}),
  );
  return (
    <div>
      <PageHeader
        title="Competency dashboard"
        description="Current status from approved assessments against current position requirements."
      />
      {gaps.isLoading ? (
        <LoadingRows />
      ) : g.length === 0 ? (
        <EmptyState
          title="No requirements in scope"
          description="Add competency requirements to positions to start tracking."
          action={
            has("comp.manage") && (
              <Button asChild>
                <Link to="/competency/requirements">Set requirements</Link>
              </Button>
            )
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={CheckCircle2}
              label="Met"
              value={gapsAtLimit ? "Capped" : g.filter((x) => x.gap_status === "met").length}
              tone="success"
            />
            <StatCard
              icon={AlertTriangle}
              label="Gaps"
              value={gapsAtLimit ? "Capped" : g.filter((x) => x.gap_status === "gap").length}
              tone="danger"
            />
            <StatCard
              icon={CircleDashed}
              label="Not Assessed"
              value={
                gapsAtLimit ? "Capped" : g.filter((x) => x.gap_status === "not_assessed").length
              }
            />
            <StatCard
              icon={ShieldAlert}
              label="Safety-critical not met"
              value={
                gapsAtLimit
                  ? "Capped"
                  : g.filter((x) => x.is_safety_critical && x.gap_status !== "met").length
              }
              tone="danger"
            />
          </div>
          {gapsAtLimit && (
            <p role="status" className="mt-3 text-sm text-muted-foreground">
              Counts and competency chart are suppressed because the 500-row gap query cap was
              reached.
            </p>
          )}
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Panel title="By competency">
              {gapsAtLimit ? (
                <p className="text-sm text-muted-foreground">
                  Narrow the authorized population to produce a complete chart.
                </p>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer>
                    <BarChart data={byComp} layout="vertical" margin={{ left: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis
                        type="number"
                        allowDecimals={false}
                        tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={140}
                        tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--color-popover)",
                          border: "1px solid var(--color-border)",
                        }}
                      />
                      <Legend />
                      <Bar dataKey="met" stackId="a" name="Met" fill="var(--color-chart-3)" />
                      <Bar dataKey="gap" stackId="a" name="Gap" fill="var(--color-chart-5)" />
                      <Bar
                        dataKey="not_assessed"
                        stackId="a"
                        name="Not Assessed"
                        fill="var(--color-muted-foreground)"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>
            <Panel
              title="Gap snapshots over time"
              description="Saved when assessments are approved or a snapshot is taken."
            >
              {trendAtLimit ? (
                <p role="status" className="text-sm text-muted-foreground">
                  Snapshot history exceeded 5,000 rows; the trend chart is suppressed.
                </p>
              ) : months.length === 0 ? (
                <p className="text-sm text-muted-foreground">No snapshots yet.</p>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer>
                    <BarChart data={months}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis
                        dataKey="month"
                        tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--color-popover)",
                          border: "1px solid var(--color-border)",
                        }}
                      />
                      <Legend />
                      <Bar dataKey="met" name="Met" fill="var(--color-chart-3)" />
                      <Bar dataKey="gap" name="Gap" fill="var(--color-chart-5)" />
                      <Bar
                        dataKey="not_assessed"
                        name="Not Assessed"
                        fill="var(--color-muted-foreground)"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
