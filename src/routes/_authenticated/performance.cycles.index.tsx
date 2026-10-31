import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { CalendarRange, Plus } from "lucide-react";
import { fetchCycles } from "@/lib/data";
import { qk } from "@/lib/query-keys";
import { PageHeader, StatusBadge, EmptyState, fmtDate } from "@/components/app/kit";
import { CycleDialog } from "@/components/app/cycle-dialog";
import { DataTable } from "@/components/app/data-table";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/performance/cycles/")({
  head: () => ({
    meta: [
      { title: "Evaluation cycles — Priority Handling Logistics, Inc." },
      { name: "description", content: "Evaluation cycles." },
    ],
  }),
  component: Page,
});

type Cycle = Awaited<ReturnType<typeof fetchCycles>>[number];

function Page() {
  const q = useQuery({ queryKey: qk.perf.cycles(), queryFn: fetchCycles });
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const cols: ColumnDef<Cycle, unknown>[] = [
    {
      header: "Name",
      accessorKey: "name",
      cell: ({ getValue }) => <span className="font-bold">{getValue() as string}</span>,
    },
    {
      header: "Period",
      accessorFn: (r) => `${fmtDate(r.period_start)} – ${fmtDate(r.period_end)}`,
    },
    {
      header: "Due",
      accessorKey: "due_date",
      cell: ({ getValue }) => fmtDate(getValue() as string),
    },
    { header: "Self-evaluation", accessorFn: (r) => (r.self_evaluation ? "Yes" : "No") },
    {
      header: "Status",
      accessorKey: "status",
      cell: ({ getValue }) => <StatusBadge status={getValue() as string} />,
    },
  ];
  return (
    <div>
      <PageHeader
        title="Evaluation cycles"
        description="Set up a cycle, then assign employees. Each assignment uses the active profile for the employee's position."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus /> New cycle
          </Button>
        }
      />
      <DataTable
        columns={cols}
        data={q.data}
        loading={q.isLoading}
        error={q.error}
        onRetry={() => q.refetch()}
        onRowClick={(r) => navigate({ to: "/performance/cycles/$id", params: { id: r.id } })}
        empty={
          <EmptyState
            icon={CalendarRange}
            title="No cycles yet"
            description="Create a cycle to start evaluating."
            action={<Button onClick={() => setCreating(true)}>New cycle</Button>}
          />
        }
      />
      {creating && <CycleDialog cycle={null} onClose={() => setCreating(false)} />}
    </div>
  );
}
