import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ClipboardCheck, Clock, RotateCcw } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fetchAllAssignmentsForDashboard, fetchCycles } from "@/lib/data";
import { qk } from "@/lib/query-keys";
import { usePermissions } from "@/hooks/use-me";
import {
  PageHeader,
  Panel,
  StatCard,
  EmptyState,
  StatusBadge,
  LoadingRows,
  ErrorState,
} from "@/components/app/kit";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/performance/")({
  head: () => ({
    meta: [
      { title: "Performance — Priority Handling Logistics, Inc." },
      { name: "description", content: "Performance management overview." },
    ],
  }),
  component: Page,
});

function Page() {
  const { employeeId, has, role } = usePermissions();
  const a = useQuery({
    queryKey: qk.perf.assignments({ all: true, employeeId, role }),
    queryFn: fetchAllAssignmentsForDashboard,
  });
  const c = useQuery({ queryKey: qk.perf.cycles(), queryFn: fetchCycles });
  const error = a.error ?? c.error;
  if (error)
    return (
      <ErrorState error={error} onRetry={() => void Promise.all([a.refetch(), c.refetch()])} />
    );
  if (!a.data || !c.data) return <LoadingRows />;
  const rows = a.data.rows;
  const complete = a.data.complete;
  const n = (s: string[]) => rows.filter((r) => s.includes(r.status)).length;
  const classificationCounts = rows.reduce((counts, row) => {
    if (row.status === "approved" && row.classification) {
      counts.set(row.classification, (counts.get(row.classification) ?? 0) + 1);
    }
    return counts;
  }, new Map<string, number>());
  const classifications = [...classificationCounts].map(([label, count]) => ({ label, count }));
  return (
    <div>
      <PageHeader
        title="Performance dashboard"
        description="Status of evaluations in your scope."
      />
      {rows.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No evaluations yet"
          description="Create a cycle and an active evaluation profile per position, then assign employees."
          action={
            has("perf.manage") && (
              <Button asChild>
                <Link to="/performance/cycles">Go to cycles</Link>
              </Button>
            )
          }
        />
      ) : (
        <>
          {!complete && (
            <p role="status" className="mb-3 text-sm text-muted-foreground">
              Evaluation metrics are suppressed because the authorized population exceeds the
              5,000-row dashboard cap.
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={ClipboardCheck}
              label="Not started / in progress"
              value={
                complete ? n(["not_started", "in_progress", "supervisor_in_progress"]) : "Capped"
              }
            />
            <StatCard
              icon={Clock}
              label="Awaiting review"
              value={
                complete
                  ? n([
                      "supervisor_pending",
                      "department_head_pending",
                      "hr_admin_pending",
                      "submitted",
                      "under_review",
                    ])
                  : "Capped"
              }
              tone="warning"
            />
            <StatCard
              icon={CheckCircle2}
              label="Approved"
              value={complete ? n(["approved"]) : "Capped"}
              tone="success"
            />
            <StatCard
              icon={RotateCcw}
              label="Reopened"
              value={complete ? n(["returned_for_revision", "reopened"]) : "Capped"}
            />
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Panel
              title="Finalized classification distribution"
              description="Only administrator-configured performance classifications are counted."
            >
              {!complete ? (
                <p className="text-sm text-muted-foreground">
                  The chart is hidden because the available evaluation rows are incomplete.
                </p>
              ) : classifications.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No configured classifications are available for finalized evaluations.
                </p>
              ) : (
                <div className="h-56">
                  <ResponsiveContainer>
                    <BarChart data={classifications}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis
                        dataKey="label"
                        interval={0}
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
                      <Bar dataKey="count" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>
            <Panel title="Cycles">
              <ul className="divide-y">
                {c.data.map((cy) => {
                  const inCycle = rows.filter((r) => r.cycle_id === cy.id);
                  const done = inCycle.filter((r) => r.status === "approved").length;
                  return (
                    <li key={cy.id} className="flex items-center justify-between py-2 text-sm">
                      {has("perf.manage") ? (
                        <Link
                          to="/performance/cycles/$id"
                          params={{ id: cy.id }}
                          className="font-bold hover:underline"
                        >
                          {cy.name}
                        </Link>
                      ) : (
                        <span className="font-bold">{cy.name}</span>
                      )}
                      <span className="flex items-center gap-2 font-data">
                        {complete ? `${done}/${inCycle.length}` : "Capped"} approved{" "}
                        <StatusBadge status={cy.status} />
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
