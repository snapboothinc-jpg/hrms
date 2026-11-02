import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchAllAssignmentsForDashboard } from "@/lib/data";
import { usePermissions } from "@/hooks/use-me";
import { qk } from "@/lib/query-keys";
import { PageHeader } from "@/components/app/kit";
import { AssignmentsTable } from "@/components/app/assignments-table";

export const Route = createFileRoute("/_authenticated/performance/my")({
  head: () => ({
    meta: [
      { title: "My evaluations — Priority Handling Logistics, Inc." },
      { name: "description", content: "Your evaluations and self-evaluations." },
    ],
  }),
  component: Page,
});

function Page() {
  const { employeeId, role } = usePermissions();
  const q = useQuery({
    queryKey: qk.perf.assignments({ employee: employeeId, role }),
    enabled: !!employeeId,
    queryFn: fetchAllAssignmentsForDashboard,
  });
  const rows = (q.data?.rows ?? []).filter((assignment) => assignment.employee_id === employeeId);
  return (
    <div>
      <PageHeader
        title="My evaluations"
        description="Complete self-evaluations when assigned, and see your evaluation history."
      />
      {q.data && !q.data.complete && (
        <p role="status" className="mb-3 text-sm text-muted-foreground">
          Only the first 5,000 authorized evaluations are shown. Your displayed history is
          incomplete.
        </p>
      )}
      <AssignmentsTable
        rows={rows}
        loading={q.isLoading}
        error={q.error}
        onRetry={() => q.refetch()}
        hideEmployee
        emptyTitle="No evaluations yet"
        emptyText="You'll be notified when you're included in an evaluation cycle."
      />
    </div>
  );
}
