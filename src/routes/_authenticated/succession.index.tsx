import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Briefcase, Users, ShieldCheck, Clock, ListChecks, ClipboardCheck } from "lucide-react";
import {
  fetchCriticalPositions,
  fetchCandidates,
  fetchAccessGrants,
  fetchReadinessClasses,
  fetchSuccessionDashboardCounts,
} from "@/lib/data";
import { logSuccessionView } from "@/lib/api/succession.functions";
import { qk } from "@/lib/query-keys";
import {
  PageHeader,
  Panel,
  StatCard,
  EmptyState,
  LoadingRows,
  ErrorState,
  StatusBadge,
  DefaultNote,
} from "@/components/app/kit";

export const Route = createFileRoute("/_authenticated/succession/")({
  head: () => ({
    meta: [
      { title: "Succession — Priority Handling Logistics, Inc." },
      {
        name: "description",
        content: "Critical positions and succession readiness. Restricted and audited.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  const logView = useServerFn(logSuccessionView);
  const [auditLogError, setAuditLogError] = useState(false);
  const positions = useQuery({ queryKey: qk.succ.positions(), queryFn: fetchCriticalPositions });
  const candidates = useQuery({ queryKey: qk.succ.candidates(), queryFn: () => fetchCandidates() });
  const grants = useQuery({ queryKey: qk.succ.grants(), queryFn: fetchAccessGrants });
  const classes = useQuery({ queryKey: qk.succ.classes(), queryFn: fetchReadinessClasses });
  const counts = useQuery({
    queryKey: ["succ", "dashboard-counts"],
    queryFn: fetchSuccessionDashboardCounts,
  });

  useEffect(() => {
    logView({ data: { record_type: "dashboard", record_id: null } }).catch(() =>
      setAuditLogError(true),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const queryError =
    positions.error ?? candidates.error ?? counts.error ?? grants.error ?? classes.error;
  if (queryError)
    return (
      <ErrorState
        error={queryError}
        onRetry={() => {
          void Promise.all([positions.refetch(), candidates.refetch(), counts.refetch()]);
        }}
      />
    );
  if (!positions.data || !candidates.data || !counts.data || !grants.data || !classes.data)
    return <LoadingRows />;

  const active = positions.data.filter((p) => p.status === "active");
  const completePopulation =
    positions.data.length === counts.data.totalPositions &&
    candidates.data.length === counts.data.totalCandidates;
  const uncovered = active.filter(
    (p) => !candidates.data.some((c) => c.critical_position_id === p.id && c.status === "active"),
  );

  return (
    <div>
      <PageHeader
        title="Succession dashboard"
        description="Restricted area. Every view and change is audited. Employees never see these records, including their own."
      />
      {auditLogError && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          The dashboard view could not be recorded in the audit history.
        </p>
      )}
      <DefaultNote>
        Readiness classifications and coverage thresholds are defaults that require organizational
        validation.
      </DefaultNote>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active critical positions"
          value={counts.data.activePositions}
          icon={Briefcase}
        />
        <StatCard label="Active candidates" value={counts.data.activeCandidates} icon={Users} />
        <StatCard
          label="Candidates with development actions"
          value={counts.data.candidatesWithActivities}
          icon={ListChecks}
        />
        <StatCard
          label="Critical-position reviews due"
          value={counts.data.reviewsDue}
          icon={Clock}
        />
        <StatCard
          label="Positions without a reviewed plan"
          value={counts.data.positionsWithoutReviewedPlans}
          icon={ClipboardCheck}
        />
        <StatCard
          label="Plans awaiting review"
          value={counts.data.plansAwaitingReview}
          icon={Clock}
        />
        <StatCard
          label="Positions without a candidate"
          value={completePopulation ? uncovered.length : "—"}
          icon={ShieldCheck}
          tone={completePopulation && uncovered.length ? "warning" : "default"}
          hint={
            completePopulation
              ? undefined
              : "The position or candidate list exceeded its available rows; count suppressed."
          }
        />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Uncovered critical positions">
          {!completePopulation ? (
            <p className="text-sm text-muted-foreground">
              The full authorized population is not loaded, so uncovered positions cannot be
              calculated accurately.
            </p>
          ) : uncovered.length === 0 ? (
            <EmptyState
              title="Full coverage"
              description="Every active critical position has at least one candidate."
            />
          ) : (
            <ul className="divide-y">
              {uncovered.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-semibold">{p.position?.title}</p>
                    <p className="text-xs text-muted-foreground">{p.department?.name}</p>
                  </div>
                  <StatusBadge status="open" label={p.criticality} />
                </li>
              ))}
            </ul>
          )}
          <Link
            to="/succession/positions"
            className="mt-3 inline-block text-sm font-semibold text-primary hover:underline"
          >
            Manage critical positions
          </Link>
        </Panel>
        <Panel title="Readiness classes">
          <DefaultNote />
          <ul className="mt-2 divide-y">
            {(classes.data ?? []).map((c) => (
              <li key={c.id} className="py-2 text-sm">
                <span className="font-semibold">{c.label}</span>{" "}
                <span className="font-data text-xs text-muted-foreground">({c.code})</span>
                {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            Department access grants: {counts.data.accessGrants}
          </p>
        </Panel>
      </div>
    </div>
  );
}
