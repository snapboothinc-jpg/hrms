import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchAllAssignmentsForDashboard } from "@/lib/data";
import { usePermissions } from "@/hooks/use-me";
import { qk } from "@/lib/query-keys";
import { PageHeader } from "@/components/app/kit";
import { AssignmentsTable } from "@/components/app/assignments-table";

export const Route = createFileRoute("/_authenticated/performance/history")({
  head: () => ({
    meta: [
      { title: "Evaluation history — Priority Handling Logistics, Inc." },
      { name: "description", content: "All evaluations in your scope." },
    ],
  }),
  component: Page,
});

function Page() {
  const { employeeId, role } = usePermissions();
  const q = useQuery({
    queryKey: qk.perf.assignments({ all: true, employeeId, role }),
    queryFn: fetchAllAssignmentsForDashboard,
  });
  return (
    <div>
      <PageHeader
        title="Evaluation history"
        description="Every evaluation keeps the profile version it was created with."
      />
      {q.data && !q.data.complete && (
        <p role="status" className="mb-3 text-sm text-muted-foreground">
          Only the first 5,000 authorized evaluations are shown. The displayed list is incomplete.
        </p>
      )}
      <AssignmentsTable
        rows={q.data?.rows}
        loading={q.isLoading}
        error={q.error}
        onRetry={() => q.refetch()}
        emptyTitle="No evaluations in your scope"
      />
    </div>
  );
}
