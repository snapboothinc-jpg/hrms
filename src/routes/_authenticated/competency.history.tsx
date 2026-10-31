import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { History, Plus } from "lucide-react";
import { fetchAssessments, type AssessmentRow } from "@/lib/data";
import { usePermissions } from "@/hooks/use-me";
import { qk } from "@/lib/query-keys";
import { PageHeader, StatusBadge, EmptyState, fmtDate, Tag } from "@/components/app/kit";
import { DataTable } from "@/components/app/data-table";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/competency/history")({
  head: () => ({
    meta: [
      { title: "Competency assessment history — Priority Handling Logistics, Inc." },
      { name: "description", content: "All competency assessments in your scope." },
    ],
  }),
  component: Page,
});

function Page() {
  const { me, has } = usePermissions();
  const q = useQuery({ queryKey: qk.comp.assessments(), queryFn: () => fetchAssessments() });
  const cols: ColumnDef<AssessmentRow, unknown>[] = [
    {
      header: "Employee",
      accessorFn: (r) => `${r.employee?.first_name} ${r.employee?.last_name}`,
      cell: ({ getValue }) => <span className="font-bold">{getValue() as string}</span>,
    },
    { header: "Competency", accessorFn: (r) => r.competency?.name },
    { header: "Level", accessorKey: "current_level", cell: ({ getValue }) => getValue() ?? "—" },
    {
      header: "Type",
      accessorKey: "is_reassessment",
      cell: ({ getValue }) => (getValue() ? <Tag tone="info">Reassessment</Tag> : "Assessment"),
    },
    {
      header: "Date",
      accessorKey: "assessment_date",
      cell: ({ getValue }) => fmtDate(getValue() as string),
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: ({ getValue }) => <StatusBadge status={getValue() as string} />,
    },
    {
      header: "Review",
      accessorKey: "review_comments",
      cell: ({ getValue }) => (
        <span className="line-clamp-2 max-w-56 text-xs">{(getValue() as string) ?? ""}</span>
      ),
    },
    {
      id: "a",
      header: "",
      cell: ({ row }) =>
        row.original.status === "draft" && row.original.assessor_id === me?.user_id ? (
          <Button asChild size="sm" variant="outline">
            <Link to="/competency/assess" search={{ id: row.original.id }}>
              Continue
            </Link>
          </Button>
        ) : null,
    },
  ];
  return (
    <div>
      <PageHeader
        title="Competency history"
        description="Assessments are never overwritten; each reassessment is a new record."
        actions={
          has("comp.assess") && (
            <Button asChild>
              <Link to="/competency/assess">
                <Plus /> New assessment
              </Link>
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
        empty={<EmptyState icon={History} title="No assessments yet" />}
      />
    </div>
  );
}
