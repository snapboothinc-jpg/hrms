import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { BookOpen, Plus } from "lucide-react";
import { fetchCompetencies } from "@/lib/data";
import { usePermissions } from "@/hooks/use-me";
import { qk } from "@/lib/query-keys";
import { PageHeader, StatusBadge, EmptyState, SafetyTags } from "@/components/app/kit";
import { DataTable } from "@/components/app/data-table";
import { Button } from "@/components/ui/button";
import { CompetencyDialog } from "@/components/app/competency-dialog";

export const Route = createFileRoute("/_authenticated/competency/library/")({
  head: () => ({
    meta: [
      { title: "Competency library — Priority Handling Logistics, Inc." },
      { name: "description", content: "Competency library." },
    ],
  }),
  component: Page,
});

type C = Awaited<ReturnType<typeof fetchCompetencies>>[number];

function Page() {
  const { has } = usePermissions();
  const q = useQuery({ queryKey: qk.comp.library(), queryFn: fetchCompetencies });
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const cols: ColumnDef<C, unknown>[] = [
    { header: "Code", accessorKey: "code" },
    {
      header: "Name",
      accessorKey: "name",
      cell: ({ getValue }) => <span className="font-bold">{getValue() as string}</span>,
    },
    { header: "Category", accessorFn: (r) => r.category?.name ?? "—" },
    {
      header: "Flags",
      id: "f",
      cell: ({ row }) => (
        <SafetyTags
          mandatory={row.original.is_mandatory}
          safety={row.original.is_safety_critical}
        />
      ),
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: ({ getValue }) => <StatusBadge status={getValue() as string} />,
    },
  ];
  return (
    <div>
      <PageHeader
        title="Competency library"
        description="Definitions, proficiency indicators and flags for each competency."
        actions={
          has("comp.manage") && (
            <Button onClick={() => setCreating(true)}>
              <Plus /> New competency
            </Button>
          )
        }
      />
      <DataTable
        columns={cols}
        data={q.data}
        loading={q.isLoading}
        error={q.error}
        onRetry={() => q.refetch()}
        onRowClick={(r) => navigate({ to: "/competency/library/$id", params: { id: r.id } })}
        empty={
          <EmptyState
            icon={BookOpen}
            title="No competencies yet"
            action={
              has("comp.manage") && (
                <Button onClick={() => setCreating(true)}>New competency</Button>
              )
            }
          />
        }
      />
      {creating && <CompetencyDialog competency={null} onClose={() => setCreating(false)} />}
    </div>
  );
}
