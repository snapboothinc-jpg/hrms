import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ClipboardCheck,
  Inbox,
  ShieldAlert,
  Target,
  Users,
  Building2,
  CircleDashed,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/use-me";
import { fetchAssignments, fetchGaps, check } from "@/lib/data";
import {
  PageHeader,
  Panel,
  StatCard,
  EmptyState,
  StatusBadge,
  LoadingRows,
  fmtDateTime,
} from "@/components/app/kit";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS } from "@/lib/policy";
import { qk } from "@/lib/query-keys";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Priority Handling Logistics, Inc." },
      { name: "description", content: "Your Priority Handling Logistics, Inc. overview." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { me, role, has, any, employeeId } = usePermissions();
  const approvals = useQuery({
    queryKey: [...qk.shared.approvals(), "count"],
    enabled: any("perf.approve", "comp.approve", "team.view", "hr.employees"),
    queryFn: async () => {
      const { count, error } = await supabase
        .from("approval_tasks")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
        .neq("submitted_by", me?.user_id ?? "");
      if (error) throw error;
      if (count === null) throw new Error("Approval count was unavailable.");
      return count;
    },
  });
  const showPerf = !!employeeId || any("perf.manage", "perf.evaluate");
  const assignments = useQuery({
    queryKey: qk.perf.assignments({ dash: true }),
    enabled: showPerf,
    queryFn: () => fetchAssignments({ limit: 200 }),
  });
  const evaluationsToComplete = useQuery({
    queryKey: [...qk.perf.assignments({ evaluator: employeeId }), "open-count"],
    enabled: !!employeeId && has("perf.evaluate"),
    queryFn: async () => {
      const { count, error } = await supabase
        .from("evaluation_assignments")
        .select("id", { count: "exact", head: true })
        .eq("evaluator_id", employeeId!)
        .not("status", "in", "(submitted,under_review,approved,cancelled)");
      if (error) throw error;
      if (count === null) throw new Error("Evaluation workload count was unavailable.");
      return count;
    },
  });
  const showComp = !!employeeId || any("comp.manage", "comp.assess", "comp.view_all");
  const gaps = useQuery({
    queryKey: qk.comp.gaps({ dash: true }),
    enabled: showComp,
    queryFn: () => fetchGaps(),
  });
  const notes = useQuery({
    queryKey: [...qk.shared.notifications(), "recent"],
    queryFn: async () =>
      check(
        await supabase
          .from("notifications")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(6),
      ) as {
        id: string;
        title: string;
        body: string | null;
        created_at: string;
        read_at: string | null;
        link: string | null;
      }[],
  });
  const admin = useQuery({
    queryKey: [...qk.org.all, "admin-counts"],
    enabled: any("admin.users", "admin.org"),
    queryFn: async () => {
      const [u, d, e] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("departments").select("id", { count: "exact", head: true }),
        supabase.from("employees").select("id", { count: "exact", head: true }),
      ]);
      if (u.error) throw u.error;
      if (d.error) throw d.error;
      if (e.error) throw e.error;
      if (u.count === null || d.count === null || e.count === null)
        throw new Error("One or more organization counts were unavailable.");
      return { users: u.count, departments: d.count, employees: e.count };
    },
  });

  const toEvaluate = (assignments.data ?? []).filter(
    (a) =>
      a.evaluator_id === employeeId &&
      !["submitted", "under_review", "approved", "cancelled"].includes(a.status),
  );
  const mine = (assignments.data ?? []).filter((a) => a.employee_id === employeeId);
  const g = gaps.data ?? [];
  const gapsAtLimit = g.length >= 500;
  const counts = {
    met: g.filter((x) => x.gap_status === "met").length,
    gap: g.filter((x) => x.gap_status === "gap").length,
    not_assessed: g.filter((x) => x.gap_status === "not_assessed").length,
  };
  const safetyOpen = g.filter((x) => x.is_safety_critical && x.gap_status !== "met").length;
  const chart = [
    { name: "Met", value: counts.met },
    { name: "Gap", value: counts.gap },
    { name: "Not Assessed", value: counts.not_assessed },
  ];

  return (
    <div>
      <PageHeader
        eyebrow={role ? ROLE_LABELS[role] : undefined}
        title={`Welcome${me?.employee ? `, ${me.employee.name.split(" ")[0]}` : ""}`}
        description="Your pending work and the records in your scope."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {any("perf.approve", "comp.approve") && (
          <StatCard
            icon={Inbox}
            label="Pending approvals"
            value={approvals.isError ? "Unavailable" : (approvals.data ?? "…")}
            hint={approvals.isError ? "Approval count could not be loaded." : undefined}
            tone={approvals.data ? "warning" : "default"}
          />
        )}
        {has("perf.evaluate") && (
          <StatCard
            icon={ClipboardCheck}
            label="Evaluations to complete"
            value={
              evaluationsToComplete.isError ? "Unavailable" : (evaluationsToComplete.data ?? "…")
            }
            hint={
              evaluationsToComplete.isError
                ? "Workload count could not be loaded."
                : "Exact count in your assigned scope."
            }
          />
        )}
        {showComp && (
          <StatCard
            icon={AlertTriangle}
            label="Open competency gaps"
            value={
              gaps.isLoading
                ? "…"
                : gaps.isError
                  ? "Unavailable"
                  : gapsAtLimit
                    ? "Capped"
                    : counts.gap
            }
            hint={gapsAtLimit ? "Results reached the 500-row limit; narrow your scope." : undefined}
            tone={
              !gaps.isLoading && !gaps.isError && !gapsAtLimit && counts.gap ? "danger" : "default"
            }
          />
        )}
        {showComp && (
          <StatCard
            icon={ShieldAlert}
            label="Safety-critical not met"
            value={
              gaps.isLoading
                ? "…"
                : gaps.isError
                  ? "Unavailable"
                  : gapsAtLimit
                    ? "Capped"
                    : safetyOpen
            }
            hint={
              gapsAtLimit
                ? "Results reached the 500-row limit; count is incomplete."
                : "Includes not assessed"
            }
            tone={
              !gaps.isLoading && !gaps.isError && !gapsAtLimit && safetyOpen ? "danger" : "default"
            }
          />
        )}
        {showComp && (
          <StatCard
            icon={CircleDashed}
            label="Not assessed"
            value={
              gaps.isLoading
                ? "…"
                : gaps.isError
                  ? "Unavailable"
                  : gapsAtLimit
                    ? "Capped"
                    : counts.not_assessed
            }
          />
        )}
        {any("admin.users", "admin.org") && (
          <>
            <StatCard
              icon={Users}
              label="User accounts"
              value={admin.isError ? "Unavailable" : (admin.data?.users ?? "…")}
            />
            <StatCard
              icon={Building2}
              label="Departments"
              value={admin.isError ? "Unavailable" : (admin.data?.departments ?? "…")}
            />
            <StatCard
              icon={Users}
              label="Employee records"
              value={admin.isError ? "Unavailable" : (admin.data?.employees ?? "…")}
            />
          </>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {showComp && (
          <Panel
            title="Competency status in your scope"
            className="lg:col-span-2"
            description="From approved assessments against current position requirements."
          >
            {gaps.isLoading ? (
              <LoadingRows rows={3} />
            ) : gaps.isError ? (
              <p role="alert" className="text-sm text-destructive">
                Competency metrics could not be loaded.
              </p>
            ) : gapsAtLimit ? (
              <p role="status" className="text-sm text-muted-foreground">
                Metrics are suppressed because the 500-row result limit was reached. Narrow your
                scope on the competency gap page for accurate figures.
              </p>
            ) : g.length === 0 ? (
              <EmptyState
                icon={Target}
                title="No position requirements yet"
                description="Gaps appear once positions have competency requirements."
                action={
                  has("comp.manage") ? (
                    <Button asChild>
                      <Link to="/competency/requirements">Set requirements</Link>
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div
                className="h-56"
                role="img"
                aria-label={`Met ${counts.met}, gap ${counts.gap}, not assessed ${counts.not_assessed}`}
              >
                <ResponsiveContainer>
                  <BarChart data={chart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis
                      dataKey="name"
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
                        color: "var(--color-foreground)",
                      }}
                    />
                    <Bar dataKey="value" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Panel>
        )}

        <Panel
          title="Recent notifications"
          actions={
            <Link to="/notifications" className="text-sm font-bold text-primary hover:underline">
              View all
            </Link>
          }
        >
          {notes.isLoading ? (
            <LoadingRows rows={3} />
          ) : notes.isError ? (
            <p role="alert" className="text-sm text-destructive">
              Notifications could not be loaded.
            </p>
          ) : (notes.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No notifications yet.</p>
          ) : (
            <ul className="space-y-3">
              {notes.data!.map((n) => (
                <li key={n.id} className="text-sm">
                  <p className={n.read_at ? "" : "font-bold"}>{n.title}</p>
                  <p className="font-data text-xs text-muted-foreground">
                    {fmtDateTime(n.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {has("perf.evaluate") && (
          <Panel title="Evaluations assigned to you" className="lg:col-span-2">
            {assignments.isError || evaluationsToComplete.isError ? (
              <p role="alert" className="text-sm text-destructive">
                Evaluation workload could not be loaded.
              </p>
            ) : (evaluationsToComplete.data ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing waiting for you.</p>
            ) : (
              <ul className="divide-y">
                {toEvaluate.slice(0, 6).map((a) => (
                  <li key={a.id} className="flex items-center justify-between py-2">
                    <Link
                      to="/performance/evaluations/$id"
                      params={{ id: a.id }}
                      className="font-bold hover:underline"
                    >
                      {a.employee?.first_name} {a.employee?.last_name}{" "}
                      <span className="font-normal text-muted-foreground">· {a.cycle?.name}</span>
                    </Link>
                    <StatusBadge status={a.status} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}
        {employeeId && (
          <Panel title="My evaluations">
            {assignments.isLoading ? (
              <LoadingRows rows={2} />
            ) : assignments.isError ? (
              <p role="alert" className="text-sm text-destructive">
                Your evaluation list could not be loaded.
              </p>
            ) : mine.length === 0 ? (
              <p className="text-sm text-muted-foreground">You have no evaluations yet.</p>
            ) : (
              <>
                <ul className="divide-y">
                  {mine.map((a) => (
                    <li key={a.id} className="flex items-center justify-between py-2">
                      <Link
                        to="/performance/evaluations/$id"
                        params={{ id: a.id }}
                        className="font-bold hover:underline"
                      >
                        {a.cycle?.name}
                      </Link>
                      <StatusBadge status={a.status} />
                    </li>
                  ))}
                </ul>
                {assignments.data?.length === 200 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Showing the first 200 authorized assignments.
                  </p>
                )}
              </>
            )}
          </Panel>
        )}
        {any("admin.org") && (admin.data?.departments ?? 1) === 0 && (
          <Panel title="Get started" className="lg:col-span-3">
            <EmptyState
              title="No organization set up"
              description="Create departments and positions, then add employees and link user accounts."
              action={
                <Button asChild>
                  <Link to="/org/departments">Create departments</Link>
                </Button>
              }
            />
          </Panel>
        )}
      </div>
    </div>
  );
}
