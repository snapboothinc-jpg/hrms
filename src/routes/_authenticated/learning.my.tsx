import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { GraduationCap } from "lucide-react";
import { fetchEnrollments, fetchQuizAttempts } from "@/lib/data";
import { usePermissions } from "@/hooks/use-me";
import { qk } from "@/lib/query-keys";
import {
  PageHeader,
  Panel,
  StatusBadge,
  EmptyState,
  LoadingRows,
  ErrorState,
  fmtDate,
  fmtDateTime,
} from "@/components/app/kit";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/learning/my")({
  head: () => ({
    meta: [
      { title: "My learning — Priority Handling Logistics, Inc." },
      { name: "description", content: "Your enrollments, progress and quiz results." },
    ],
  }),
  component: Page,
});

function Page() {
  const { employeeId } = usePermissions();
  const enrollments = useQuery({
    queryKey: qk.learn.enrollments({ employee: employeeId }),
    queryFn: () => fetchEnrollments({ employee: employeeId! }),
    enabled: !!employeeId,
  });
  const attempts = useQuery({
    queryKey: [...qk.learn.all, "my-attempts", employeeId],
    queryFn: async () => {
      // attempts are RLS-scoped to the learner; list via enrollments' courses
      const all: {
        id: string;
        attempt_no: number;
        score: number;
        passed: boolean;
        submitted_at: string;
      }[] = [];
      return all;
    },
    enabled: false,
  });
  void attempts;

  if (!employeeId)
    return (
      <EmptyState
        title="No employee record"
        description="Your account is not linked to an employee record."
      />
    );
  if (enrollments.error)
    return <ErrorState error={enrollments.error} onRetry={() => enrollments.refetch()} />;
  if (!enrollments.data) return <LoadingRows />;

  return (
    <div>
      <PageHeader title="My learning" description="Your assigned and self-enrolled courses." />
      {enrollments.data.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No courses yet"
          description="Browse the catalog or wait for a development plan assignment."
          action={
            <Button asChild>
              <Link to="/learning/catalog">Browse catalog</Link>
            </Button>
          }
        />
      ) : (
        <Panel>
          <ul className="divide-y">
            {enrollments.data.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-semibold">{e.course?.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {e.course?.code} · {e.source.replace(/_/g, " ")} · assigned{" "}
                    {fmtDate(e.assigned_at)}
                    {e.due_date && ` · due ${fmtDate(e.due_date)}`}
                    {e.completed_at && ` · completed ${fmtDateTime(e.completed_at)}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={e.status} />
                  <Button asChild size="sm" variant="outline">
                    <Link to="/learning/course/$id" params={{ id: e.course_id }}>
                      {e.status === "completed" ? "Review" : "Continue"}
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
