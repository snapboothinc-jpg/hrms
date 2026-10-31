import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchAssignments } from "@/lib/data";
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
  const q = useQuery({
    queryKey: qk.perf.assignments({ all: true }),
    queryFn: () => fetchAssignments(),
  });
  return (
    <div>
      <PageHeader
        title="Evaluation history"
        description="Every evaluation keeps the profile version it was created with."
      />
      <AssignmentsTable
        rows={q.data}
        loading={q.isLoading}
        error={q.error}
        onRetry={() => q.refetch()}
        emptyTitle="No evaluations in your scope"
      />
    </div>
  );
}
