import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ColumnDef } from "@tanstack/react-table";
import { Briefcase, Plus } from "lucide-react";
import type { z } from "zod";
import { fetchDepartments, fetchPositions, type Position } from "@/lib/data";
import { savePosition } from "@/lib/api/actions.functions";
import { positionSchema } from "@/lib/schemas";
import { useAction } from "@/hooks/use-action";
import { usePermissions } from "@/hooks/use-me";
import { qk } from "@/lib/query-keys";
import { PageHeader, StatusBadge, EmptyState, Field, NativeSelect } from "@/components/app/kit";
import { DataTable } from "@/components/app/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/org/positions")({
  head: () => ({
    meta: [
      { title: "Positions — Priority Handling Logistics, Inc." },
      { name: "description", content: "Positions in the organization." },
    ],
  }),
  component: Page,
});

type F = z.infer<typeof positionSchema>;

function Page() {
  const { any } = usePermissions();
  const canEdit = any("admin.org", "hr.employees");
  const q = useQuery({ queryKey: qk.org.positions(), queryFn: fetchPositions });
  const depts = useQuery({ queryKey: qk.org.departments(), queryFn: fetchDepartments });
  const [editing, setEditing] = useState<Position | "new" | null>(null);
  const cols: ColumnDef<Position, unknown>[] = [
    { header: "Code", accessorKey: "code" },
    {
      header: "Title",
      accessorKey: "title",
      cell: ({ getValue }) => <span className="font-bold">{getValue() as string}</span>,
    },
    {
      header: "Department",
      accessorFn: (r) => depts.data?.find((d) => d.id === r.department_id)?.name ?? "—",
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
            cell: ({ row }: { row: { original: Position } }) => (
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
        title="Positions"
        description="Each position has its own evaluation profile and competency requirements."
        actions={
          canEdit && (
            <Button onClick={() => setEditing("new")} disabled={!depts.data?.length}>
              <Plus /> New position
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
            icon={Briefcase}
            title="No positions yet"
            description={
              depts.data?.length
                ? "Add positions to each department."
                : "Create a department first."
            }
            action={
              canEdit &&
              !!depts.data?.length && (
                <Button onClick={() => setEditing("new")}>New position</Button>
              )
            }
          />
        }
      />
      {editing && (
        <PosDialog
          pos={editing === "new" ? null : editing}
          departments={depts.data ?? []}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function PosDialog({
  pos,
  departments,
  onClose,
}: {
  pos: Position | null;
  departments: { id: string; name: string }[];
  onClose: () => void;
}) {
  const form = useForm<F>({
    resolver: zodResolver(positionSchema),
    defaultValues: {
      id: pos?.id ?? null,
      code: pos?.code ?? "",
      title: pos?.title ?? "",
      department_id: pos?.department_id ?? departments[0]?.id,
      description: pos?.description ?? "",
      status: (pos?.status as "active") ?? "active",
      version: pos?.version ?? null,
    },
  });
  const save = useAction(useServerFn(savePosition), {
    invalidate: [qk.org.all],
    success: "Position saved",
    onSuccess: onClose,
  });
  const e = form.formState.errors;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{pos ? "Edit position" : "New position"}</DialogTitle>
        </DialogHeader>
        <form
          id="pos"
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={form.handleSubmit((v) => save.mutate(v))}
          noValidate
        >
          <Field label="Code" htmlFor="code" error={e.code?.message} required>
            <Input id="code" {...form.register("code")} />
          </Field>
          <Field label="Title" htmlFor="title" error={e.title?.message} required>
            <Input id="title" {...form.register("title")} />
          </Field>
          <Field label="Department" htmlFor="dept" error={e.department_id?.message} required>
            <NativeSelect id="dept" {...form.register("department_id")}>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
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
          <div className="sm:col-span-2">
            <Field label="Description" htmlFor="desc" error={e.description?.message}>
              <Textarea id="desc" {...form.register("description")} />
            </Field>
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="pos" disabled={save.isPending}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
