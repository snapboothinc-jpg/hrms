import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ColumnDef } from "@tanstack/react-table";
import { Building2, Plus } from "lucide-react";
import { fetchDepartments, fetchEmployees, empName, type Department } from "@/lib/data";
import { saveDepartment } from "@/lib/api/actions.functions";
import { departmentSchema } from "@/lib/schemas";
import { useAction } from "@/hooks/use-action";
import { usePermissions } from "@/hooks/use-me";
import { qk } from "@/lib/query-keys";
import { PageHeader, StatusBadge, EmptyState, Field, NativeSelect } from "@/components/app/kit";
import { DataTable } from "@/components/app/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { z } from "zod";

export const Route = createFileRoute("/_authenticated/org/departments")({
  head: () => ({
    meta: [
      { title: "Departments — Priority Handling Logistics, Inc." },
      { name: "description", content: "Organization departments." },
    ],
  }),
  component: Page,
});

type F = z.infer<typeof departmentSchema>;

function Page() {
  const { has } = usePermissions();
  const canEdit = has("admin.org");
  const q = useQuery({ queryKey: qk.org.departments(), queryFn: fetchDepartments });
  const emps = useQuery({ queryKey: qk.org.employees(), queryFn: fetchEmployees });
  const [editing, setEditing] = useState<Department | "new" | null>(null);
  const cols: ColumnDef<Department, unknown>[] = [
    { header: "Code", accessorKey: "code" },
    {
      header: "Name",
      accessorKey: "name",
      cell: ({ getValue }) => <span className="font-bold">{getValue() as string}</span>,
    },
    { header: "Parent", accessorFn: (r) => q.data?.find((d) => d.id === r.parent_id)?.name ?? "—" },
    {
      header: "Head",
      accessorFn: (r) => empName(emps.data?.find((e) => e.id === r.head_employee_id)),
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: ({ getValue }) => <StatusBadge status={getValue() as string} />,
    },
    ...(canEdit
      ? [
          {
            id: "a",
            header: "",
            cell: ({ row }: { row: { original: Department } }) => (
              <Button size="sm" variant="outline" onClick={() => setEditing(row.original)}>
                Edit
              </Button>
            ),
          },
        ]
      : []),
  ];
  return (
    <div>
      <PageHeader
        title="Departments"
        description="Departments can have a parent and a head who oversees the department."
        actions={
          canEdit && (
            <Button onClick={() => setEditing("new")}>
              <Plus /> New department
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
        empty={
          <EmptyState
            icon={Building2}
            title="No departments yet"
            description="Create your first department to start building the organization."
            action={canEdit && <Button onClick={() => setEditing("new")}>New department</Button>}
          />
        }
      />
      {editing && (
        <DeptDialog
          dept={editing === "new" ? null : editing}
          departments={q.data ?? []}
          employees={emps.data ?? []}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function DeptDialog({
  dept,
  departments,
  employees,
  onClose,
}: {
  dept: Department | null;
  departments: Department[];
  employees: { id: string; first_name: string; last_name: string; department_id: string }[];
  onClose: () => void;
}) {
  const form = useForm<F>({
    resolver: zodResolver(departmentSchema),
    defaultValues: {
      id: dept?.id ?? null,
      code: dept?.code ?? "",
      name: dept?.name ?? "",
      parent_id: dept?.parent_id ?? null,
      head_employee_id: dept?.head_employee_id ?? null,
      status: (dept?.status as "active") ?? "active",
      version: dept?.version ?? null,
    },
  });
  const save = useAction(useServerFn(saveDepartment), {
    invalidate: [qk.org.all],
    success: "Department saved",
    onSuccess: onClose,
  });
  const e = form.formState.errors;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dept ? "Edit department" : "New department"}</DialogTitle>
        </DialogHeader>
        <form
          id="dept"
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={form.handleSubmit((v) => save.mutate(v))}
          noValidate
        >
          <Field label="Code" htmlFor="code" error={e.code?.message} required>
            <Input id="code" {...form.register("code")} />
          </Field>
          <Field label="Name" htmlFor="name" error={e.name?.message} required>
            <Input id="name" {...form.register("name")} />
          </Field>
          <Field label="Parent department" htmlFor="parent">
            <NativeSelect
              id="parent"
              {...form.register("parent_id", { setValueAs: (v) => v || null })}
            >
              <option value="">None</option>
              {departments
                .filter((d) => d.id !== dept?.id)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </NativeSelect>
          </Field>
          <Field label="Department head" htmlFor="head">
            <NativeSelect
              id="head"
              {...form.register("head_employee_id", { setValueAs: (v) => v || null })}
            >
              <option value="">None</option>
              {employees
                .filter((x) => !dept || x.department_id === dept.id)
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {empName(x)}
                  </option>
                ))}
            </NativeSelect>
          </Field>
          <Field label="Status" htmlFor="status">
            <NativeSelect id="status" {...form.register("status")}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </NativeSelect>
          </Field>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="dept" disabled={save.isPending}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
