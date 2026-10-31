import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { ColumnDef } from "@tanstack/react-table";
import { Download, TrendingDown } from "lucide-react";
import {
  fetchGaps,
  fetchDepartments,
  fetchPositions,
  fetchCategories,
  fetchEmployees,
  empName,
  type GapRow,
} from "@/lib/data";
import { exportAudit } from "@/lib/api/actions.functions";
import { usePermissions } from "@/hooks/use-me";
import { qk } from "@/lib/query-keys";
import {
  PageHeader,
  StatusBadge,
  EmptyState,
  SafetyTags,
  NativeSelect,
  fmtDate,
} from "@/components/app/kit";
import { DataTable } from "@/components/app/data-table";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const search = z.object({
  employee: z.string().uuid().optional(),
  department: z.string().uuid().optional(),
  position: z.string().uuid().optional(),
  category: z.string().uuid().optional(),
  status: z.enum(["gap", "met", "not_assessed"]).optional(),
});

export const Route = createFileRoute("/_authenticated/competency/gaps")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Competency gap analysis — Priority Handling Logistics, Inc." },
      {
        name: "description",
        content: "Required versus current levels, with Not Assessed shown separately.",
      },
    ],
  }),
  component: Page,
});

function csvCell(v: unknown) {
  const s = v == null ? "" : String(v);
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s; // prevent CSV formula injection
  return `"${safe.replace(/"/g, '""')}"`;
}

function Page() {
  const f = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { any } = usePermissions();
  const q = useQuery({ queryKey: qk.comp.gaps(f), queryFn: () => fetchGaps(f) });
  const depts = useQuery({ queryKey: qk.org.departments(), queryFn: fetchDepartments });
  const positions = useQuery({ queryKey: qk.org.positions(), queryFn: fetchPositions });
  const cats = useQuery({ queryKey: [...qk.comp.all, "categories"], queryFn: fetchCategories });
  const emps = useQuery({ queryKey: qk.org.employees(), queryFn: fetchEmployees });
  const logExport = useServerFn(exportAudit);
  const setF = (k: keyof typeof f, v: string) =>
    navigate({ search: (s) => ({ ...s, [k]: v || undefined }) });

  const cols: ColumnDef<GapRow, unknown>[] = [
    {
      header: "Employee",
      accessorKey: "employee_name",
      cell: ({ row }) => (
        <Link
          to="/people/employees/$id"
          params={{ id: row.original.employee_id }}
          className="font-bold hover:underline"
        >
          {row.original.employee_name}
        </Link>
      ),
    },
    { header: "Position", accessorKey: "position_title" },
    {
      header: "Competency",
      accessorKey: "competency_name",
      cell: ({ row }) => (
        <span>
          {row.original.competency_name}{" "}
          <SafetyTags
            mandatory={row.original.is_mandatory}
            safety={row.original.is_safety_critical}
          />
        </span>
      ),
    },
    { header: "Required", accessorKey: "required_level" },
    {
      header: "Current",
      accessorKey: "current_level",
      cell: ({ getValue }) => getValue() ?? <span className="text-muted-foreground">—</span>,
    },
    { header: "Gap", accessorKey: "gap", cell: ({ getValue }) => getValue() ?? "—" },
    {
      header: "Status",
      accessorKey: "gap_status",
      cell: ({ row }) => (
        <StatusBadge
          status={row.original.gap_status}
          label={row.original.gap_status === "gap" ? `Gap of ${row.original.gap}` : undefined}
        />
      ),
    },
    {
      header: "Assessed",
      accessorKey: "assessment_date",
      cell: ({ getValue }) => fmtDate(getValue() as string),
    },
    {
      header: "Evidence",
      accessorKey: "evidence_summary",
      cell: ({ getValue }) => (
        <span className="line-clamp-2 max-w-56 text-xs">{(getValue() as string) ?? "—"}</span>
      ),
    },
    ...(any("comp.assess")
      ? [
          {
            id: "a",
            header: "",
            cell: ({ row }: { row: { original: GapRow } }) => (
              <Button asChild size="sm" variant="outline">
                <Link
                  to="/competency/assess"
                  search={{
                    employee: row.original.employee_id,
                    competency: row.original.competency_id,
                    reassess: row.original.gap_status !== "not_assessed",
                  }}
                >
                  {row.original.gap_status === "not_assessed" ? "Assess" : "Reassess"}
                </Link>
              </Button>
            ),
          },
        ]
      : []),
  ];

  async function exportCsv() {
    const rows = q.data ?? [];
    const header = [
      "Employee ID",
      "Employee",
      "Department",
      "Position",
      "Competency",
      "Category",
      "Required",
      "Current",
      "Gap",
      "Status",
      "Mandatory",
      "Safety-critical",
      "Assessed",
    ];
    const lines = rows.map((r) =>
      [
        r.employee_code,
        r.employee_name,
        r.department_name,
        r.position_title,
        r.competency_name,
        r.category_name,
        r.required_level,
        r.current_level ?? "",
        r.gap ?? "",
        r.gap_status === "not_assessed" ? "Not Assessed" : r.gap_status,
        r.is_mandatory,
        r.is_safety_critical,
        r.assessment_date ?? "",
      ]
        .map(csvCell)
        .join(","),
    );
    try {
      const r = await logExport({
        data: {
          kind: "gaps_csv",
          filters: Object.fromEntries(Object.entries(f).filter(([, v]) => v)) as Record<
            string,
            string
          >,
        },
      });
      if (!r.ok) throw new Error(r.error.message);
    } catch {
      toast.error("Export could not be recorded, so it was not created.");
      return;
    }
    const blob = new Blob([[header.map(csvCell).join(","), ...lines].join("\n")], {
      type: "text/csv",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `competency-gaps-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div>
      <PageHeader
        title="Competency gap analysis"
        description="Gap = required − current (never below 0). Not Assessed is its own status and is never counted as level 0. Gaps close only through approved reassessment with evidence."
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={!q.data?.length}>
            <Download /> Export CSV
          </Button>
        }
      />
      <DataTable
        columns={cols}
        data={q.data}
        loading={q.isLoading}
        error={q.error}
        onRetry={() => q.refetch()}
        pageSize={25}
        toolbar={
          <>
            <NativeSelect
              aria-label="Employee"
              className="w-44"
              value={f.employee ?? ""}
              onChange={(e) => setF("employee", e.target.value)}
            >
              <option value="">All employees</option>
              {emps.data?.map((e) => (
                <option key={e.id} value={e.id}>
                  {empName(e)}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect
              aria-label="Department"
              className="w-44"
              value={f.department ?? ""}
              onChange={(e) => setF("department", e.target.value)}
            >
              <option value="">All departments</option>
              {depts.data?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect
              aria-label="Position"
              className="w-44"
              value={f.position ?? ""}
              onChange={(e) => setF("position", e.target.value)}
            >
              <option value="">All positions</option>
              {positions.data?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect
              aria-label="Category"
              className="w-44"
              value={f.category ?? ""}
              onChange={(e) => setF("category", e.target.value)}
            >
              <option value="">All categories</option>
              {cats.data?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect
              aria-label="Gap status"
              className="w-40"
              value={f.status ?? ""}
              onChange={(e) => setF("status", e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="gap">Gap</option>
              <option value="met">Met</option>
              <option value="not_assessed">Not Assessed</option>
            </NativeSelect>
          </>
        }
        empty={
          <EmptyState
            icon={TrendingDown}
            title="No results"
            description="No requirements match these filters, or none are in your scope."
          />
        }
      />
    </div>
  );
}
