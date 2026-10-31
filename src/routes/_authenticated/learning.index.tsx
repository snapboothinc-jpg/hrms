import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, CheckCircle2, Clock, GraduationCap } from "lucide-react";
import {
  fetchCourses,
  fetchEnrollments,
  fetchLearningPaths,
  fetchLearningDashboardCounts,
  empName,
} from "@/lib/data";
import { usePermissions } from "@/hooks/use-me";
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
} from "@/components/app/kit";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/learning/")({
  head: () => ({
    meta: [
      { title: "Learning dashboard — Priority Handling Logistics, Inc." },
      { name: "description", content: "Course, enrollment and learning path overview." },
    ],
  }),
  component: Page,
});

function Page() {
  const { any, employeeId } = usePermissions();
  const courses = useQuery({ queryKey: qk.learn.courses(), queryFn: () => fetchCourses() });
  const enrollments = useQuery({
    queryKey: qk.learn.enrollments(),
    queryFn: () => fetchEnrollments(),
  });
  const paths = useQuery({ queryKey: qk.learn.paths(), queryFn: fetchLearningPaths });
  const counts = useQuery({
    queryKey: [...qk.learn.all, "dashboard-counts"],
    queryFn: fetchLearningDashboardCounts,
  });

  const error = courses.error ?? enrollments.error ?? paths.error ?? counts.error;
  if (error)
    return (
      <ErrorState
        error={error}
        onRetry={() =>
          void Promise.all([
            courses.refetch(),
            enrollments.refetch(),
            paths.refetch(),
            counts.refetch(),
          ])
        }
      />
    );
  if (!courses.data || !enrollments.data || !paths.data || !counts.data) return <LoadingRows />;

  const mine = employeeId ? enrollments.data.filter((e) => e.employee_id === employeeId) : [];

  return (
    <div>
      <PageHeader
        title="Learning dashboard"
        description="Courses, enrollments and learning paths."
        actions={
          <Button asChild variant="outline">
            <Link to="/learning/catalog">Browse catalog</Link>
          </Button>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Published courses" value={counts.data.publishedCourses} icon={BookOpen} />
        <StatCard
          label="Awaiting approval"
          value={counts.data.awaitingApproval}
          icon={Clock}
          tone={counts.data.awaitingApproval ? "warning" : "default"}
        />
        <StatCard
          label="Assigned enrollments"
          value={counts.data.assignedEnrollments}
          icon={GraduationCap}
        />
        <StatCard label="In progress" value={counts.data.inProgress} icon={Clock} />
        <StatCard
          label="Completions"
          value={counts.data.completed}
          icon={CheckCircle2}
          tone="success"
        />
        <StatCard
          label="Overdue learning"
          value={counts.data.overdue}
          icon={Clock}
          tone={counts.data.overdue ? "warning" : "default"}
        />
        <StatCard
          label="Upcoming deadlines"
          value={counts.data.upcomingDeadlines}
          icon={Clock}
          hint="Due within the next seven days."
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Recent enrollments">
          {enrollments.data.length === 0 ? (
            <EmptyState
              title="No enrollments yet"
              description="Enroll employees from the catalog or through development plans."
              action={
                any("learn.manage") ? (
                  <Button asChild size="sm">
                    <Link to="/learning/manage">Manage courses</Link>
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <ul className="divide-y">
              {enrollments.data.slice(0, 8).map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{e.course?.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {empName(e.employee)} · assigned {fmtDate(e.assigned_at)}
                    </p>
                  </div>
                  <StatusBadge status={e.status} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel
          title="Learning paths"
          description="Ordered course collections tied to competencies."
        >
          {!paths.data?.length ? (
            <EmptyState
              title="No learning paths"
              description="Create a path to sequence courses for a competency."
            />
          ) : (
            <ul className="divide-y">
              {paths.data.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <p className="text-sm font-semibold">{p.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.competency?.name ?? "General"}
                    </p>
                  </div>
                  <StatusBadge status={p.status} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      {mine.length > 0 && (
        <Panel title="My learning" className="mt-6">
          <ul className="divide-y">
            {mine.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                <p className="text-sm font-semibold">{e.course?.title}</p>
                <div className="flex items-center gap-2">
                  <StatusBadge status={e.status} />
                  <Button asChild size="sm" variant="outline">
                    <Link to="/learning/course/$id" params={{ id: e.course_id }}>
                      Open
                    </Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
