import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchAssignments } from "@/lib/data";
import { usePermissions } from "@/hooks/use-me";
import { qk } from "@/lib/query-keys";
import { PageHeader } from "@/components/app/kit";
import { AssignmentsTable } from "@/components/app/assignments-table";

export const Route = createFileRoute("/_authenticated/performance/team")({
  head: () => ({
    meta: [
      { title: "Team evaluations — Priority Handling Logistics, Inc." },
      { name: "description", content: "Evaluations you are responsible for." },
    ],
  }),
  component: Page,
});

function Page() {
  const { employeeId } = usePermissions();
  const q = useQuery({
    queryKey: qk.perf.assignments({ team: employeeId }),
    queryFn: () => fetchAssignments(),
  });
  const rows = (q.data ?? []).filter((a) => a.employee_id !== employeeId);
  return (
    <div>
      <PageHeader
        title="Team evaluations"
        description="Evaluations where you are the evaluator, plus your team or department's evaluations."
      />
      <AssignmentsTable
        rows={rows}
        loading={q.isLoading}
        error={q.error}
        onRetry={() => q.refetch()}
        emptyTitle="No team evaluations"
        emptyText="Evaluations appear when HR includes your direct reports in a cycle."
      />
    </div>
  );
}
