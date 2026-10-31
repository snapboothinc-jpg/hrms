import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarRange, CheckCircle2, ClipboardList, Users } from "lucide-react";
import { fetchSessions, fetchPlans, fetchTrainingDashboardCounts, empName } from "@/lib/data";
import { qk } from "@/lib/query-keys";
import {
  PageHeader,
  Panel,
  StatCard,
  StatusBadge,
  EmptyState,
  LoadingRows,
  ErrorState,
  fmtDate,
  fmtDateTime,
} from "@/components/app/kit";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/training/")({
  head: () => ({
    meta: [
      { title: "Training dashboard — Priority Handling Logistics, Inc." },
      { name: "description", content: "Sessions, attendance and development plan overview." },
    ],
  }),
  component: Page,
});

function Page() {
  const sessions = useQuery({ queryKey: qk.train.sessions(), queryFn: () => fetchSessions() });
  const plans = useQuery({ queryKey: qk.train.plans(), queryFn: () => fetchPlans() });
  const counts = useQuery({
    queryKey: [...qk.train.all, "dashboard-counts"],
    queryFn: fetchTrainingDashboardCounts,
  });

  const error = sessions.error ?? plans.error ?? counts.error;
  if (error)
    return (
      <ErrorState
        error={error}
        onRetry={() => void Promise.all([sessions.refetch(), plans.refetch(), counts.refetch()])}
      />
    );
  if (!sessions.data || !plans.data || !counts.data) return <LoadingRows />;

  const now = new Date().toISOString();
  const upcoming = sessions.data.filter(
    (s) => (s.status === "planned" || s.status === "in_progress") && s.starts_at >= now,
  );
  const openPlans = plans.data.filter((plan) => !["completed", "cancelled"].includes(plan.status));

  return (
    <div>
      <PageHeader
        title="Training dashboard"
        description="Sessions, development plans and training activity in your scope."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to="/training/needs">Training needs</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/training/calendar">Training calendar</Link>
            </Button>
          </div>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Plans awaiting approval"
          value={counts.data.plansAwaitingApproval}
          icon={ClipboardList}
          tone={counts.data.plansAwaitingApproval ? "warning" : "default"}
        />
        <StatCard
          label="Upcoming sessions"
          value={counts.data.upcomingSessions}
          icon={CalendarRange}
        />
        <StatCard
          label="Scheduled employees"
          value={counts.data.scheduledParticipants}
          icon={Users}
        />
        <StatCard
          label="Attendance missing"
          value={counts.data.attendanceMissing}
          icon={AlertTriangle}
          tone={counts.data.attendanceMissing ? "warning" : "default"}
        />
        <StatCard
          label="Training in progress"
          value={counts.data.sessionsInProgress}
          icon={CheckCircle2}
        />
        <StatCard
          label="Gaps awaiting follow-up"
          value={counts.data.gapsAwaitingFollowUp ?? "Capped"}
          icon={ClipboardList}
          hint={
            counts.data.gapsAwaitingFollowUp === null
              ? "The authorized gap set exceeds the 5,000-row dashboard cap."
              : undefined
          }
        />
        <StatCard
          label="Reassessments due"
          value={counts.data.reassessmentsDue}
          icon={CalendarRange}
          tone={counts.data.reassessmentsDue ? "warning" : "default"}
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Upcoming sessions">
          {counts.data.upcomingSessions === 0 ? (
            <EmptyState
              title="No upcoming sessions"
              description="Schedule a session from the training calendar."
            />
          ) : (
            <ul className="divide-y">
              {upcoming.slice(0, 8).map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <p className="text-sm font-semibold">{s.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtDateTime(s.starts_at)} · {s.venue ?? s.delivery_method.replace(/_/g, " ")}
                    </p>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/training/sessions/$id" params={{ id: s.id }}>
                      Open
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {sessions.data.length > 1000 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Showing the latest 1,000 session records; the upcoming-session card is an exact
              authorized count.
            </p>
          )}
        </Panel>
        <Panel title="Development plans">
          {openPlans.length === 0 ? (
            <EmptyState
              title="No open development plans"
              description="Open plans are created from accepted AI recommendations or directly."
            />
          ) : (
            <ul className="divide-y">
              {openPlans.slice(0, 8).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <p className="text-sm font-semibold">{p.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {empName(p.employee)} · owner {empName(p.responsible)}
                      {p.target_date ? ` · target ${fmtDate(p.target_date)}` : ""}
                      {p.reassessment_due_date
                        ? ` · reassessment due ${fmtDate(p.reassessment_due_date)}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={p.status} />
                    <Button asChild size="sm" variant="outline">
                      <Link to="/training/plans/$id" params={{ id: p.id }}>
                        Open
                      </Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {plans.data.length >= 1000 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Showing the most recent 1,000 plans. Dashboard approval and active-plan metrics use
              exact scoped counts.
            </p>
          )}
        </Panel>
      </div>
    </div>
  );
}
