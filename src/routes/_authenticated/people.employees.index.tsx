import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Users } from "lucide-react";
import {
  fetchEmployeesPage,
  countEmployees,
  fetchCurrentSupervisors,
  empName,
  type EmployeeRow,
} from "@/lib/data";
import { usePermissions } from "@/hooks/use-me";
import { qk } from "@/lib/query-keys";
import { PageHeader, StatusBadge, EmptyState, fmtDate } from "@/components/app/kit";
import { DataTable } from "@/components/app/data-table";
import { Button } from "@/components/ui/button";
import { EmployeeDialog } from "@/components/app/employee-dialog";

export const Route = createFileRoute("/_authenticated/people/employees/")({
  head: () => ({
    meta: [
      { title: "Employees — Priority Handling Logistics, Inc." },
      { name: "description", content: "Employee records in your scope." },
    ],
  }),
  component: Page,
});

function Page() {
  const { any } = usePermissions();
  const canEdit = any("hr.employees", "admin.org");
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;
  const q = useQuery({
    queryKey: [...qk.org.employees(), "page", page],
    queryFn: () => fetchEmployeesPage({ limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
  });
  const total = useQuery({ queryKey: [...qk.org.employees(), "count"], queryFn: countEmployees });
  const sups = useQuery({
    queryKey: [...qk.org.all, "supervisors"],
    queryFn: fetchCurrentSupervisors,
  });
  const [creating, setCreating] = useState(false);
  const pageCount = Math.max(1, Math.ceil((total.data ?? 0) / PAGE_SIZE));
  const cols: ColumnDef<EmployeeRow, unknown>[] = [
    { header: "ID", accessorKey: "employee_code" },
    {
      header: "Name",
      accessorFn: (r) => empName(r),
      cell: ({ getValue }) => <span className="font-bold">{getValue() as string}</span>,
    },
    { header: "Department", accessorFn: (r) => r.department?.name ?? "—" },
    { header: "Position", accessorFn: (r) => r.position?.title ?? "—" },
    {
      header: "Supervisor",
      accessorFn: (r) => empName(sups.data?.find((s) => s.employee_id === r.id)?.supervisor),
    },
    {
      header: "Hired",
      accessorKey: "hire_date",
      cell: ({ getValue }) => fmtDate(getValue() as string),
    },
    { header: "Account", accessorFn: (r) => (r.user_id ? "Linked" : "None") },
    {
      header: "Status",
      accessorKey: "employment_status",
      cell: ({ getValue }) => <StatusBadge status={getValue() as string} />,
    },
  ];
  return (
    <div>
      <PageHeader
        title="Employees"
        description="Only employees in your scope are listed."
        actions={
          canEdit && (
            <Button onClick={() => setCreating(true)}>
              <Plus /> New employee
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
        searchPlaceholder="Search by name, ID, department…"
        onRowClick={(r) => navigate({ to: "/people/employees/$id", params: { id: r.id } })}
        empty={
          <EmptyState
            icon={Users}
            title="No employees in your scope"
            description={
              canEdit
                ? "Add employee records, then link them to user accounts."
                : "Records appear here when people report to you or your department."
            }
            action={canEdit && <Button onClick={() => setCreating(true)}>New employee</Button>}
          />
        }
      />
      <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Page {page + 1} of {pageCount} · {total.data ?? "…"} employees
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page + 1 >= pageCount}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
      {creating && <EmployeeDialog employee={null} onClose={() => setCreating(false)} />}
    </div>
  );
}
