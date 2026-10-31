import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { fetchDepartments, fetchPositions, type EmployeeRow } from "@/lib/data";
import { saveEmployee } from "@/lib/api/actions.functions";
import { employeeFields } from "@/lib/schemas";
import { useAction } from "@/hooks/use-action";
import { qk } from "@/lib/query-keys";
import { Field, NativeSelect } from "./kit";
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

type F = z.infer<typeof employeeFields>;

export function EmployeeDialog({
  employee,
  onClose,
}: {
  employee: EmployeeRow | null;
  onClose: () => void;
}) {
  const depts = useQuery({ queryKey: qk.org.departments(), queryFn: fetchDepartments });
  const positions = useQuery({ queryKey: qk.org.positions(), queryFn: fetchPositions });
  const form = useForm<F>({
    resolver: zodResolver(employeeFields),
    defaultValues: {
      employee_code: employee?.employee_code ?? "",
      first_name: employee?.first_name ?? "",
      last_name: employee?.last_name ?? "",
      email: employee?.email ?? "",
      phone: employee?.phone ?? "",
      department_id: employee?.department_id ?? "",
      position_id: employee?.position_id ?? "",
      employment_status: (employee?.employment_status as F["employment_status"]) ?? "active",
      hire_date: employee?.hire_date ?? "",
      job_notes: employee?.job_notes ?? "",
    },
  });
  const dept = form.watch("department_id");
  const save = useAction(useServerFn(saveEmployee), {
    invalidate: [qk.org.all],
    success: "Employee saved",
    onSuccess: onClose,
  });
  const e = form.formState.errors;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{employee ? "Edit employee" : "New employee"}</DialogTitle>
        </DialogHeader>
        <form
          id="emp"
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={form.handleSubmit((v) =>
            save.mutate({ id: employee?.id ?? null, version: employee?.version ?? null, data: v }),
          )}
          noValidate
        >
          <Field label="Employee ID" htmlFor="code" error={e.employee_code?.message} required>
            <Input id="code" {...form.register("employee_code")} />
          </Field>
          <Field label="Status" htmlFor="st">
            <NativeSelect id="st" {...form.register("employment_status")}>
              <option value="active">Active</option>
              <option value="on_leave">On leave</option>
              <option value="inactive">Inactive</option>
              <option value="terminated">Terminated</option>
            </NativeSelect>
          </Field>
          <Field label="First name" htmlFor="fn" error={e.first_name?.message} required>
            <Input id="fn" {...form.register("first_name")} />
          </Field>
          <Field label="Last name" htmlFor="ln" error={e.last_name?.message} required>
            <Input id="ln" {...form.register("last_name")} />
          </Field>
          <Field label="Email" htmlFor="em" error={e.email?.message}>
            <Input id="em" type="email" {...form.register("email")} />
          </Field>
          <Field label="Phone" htmlFor="ph" error={e.phone?.message}>
            <Input id="ph" {...form.register("phone")} />
          </Field>
          <Field
            label="Department"
            htmlFor="dp"
            error={e.department_id?.message ? "Choose a department" : undefined}
            required
          >
            <NativeSelect id="dp" {...form.register("department_id")}>
              <option value="">Select…</option>
              {depts.data?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field
            label="Position"
            htmlFor="po"
            error={e.position_id?.message ? "Choose a position" : undefined}
            required
          >
            <NativeSelect id="po" {...form.register("position_id")}>
              <option value="">Select…</option>
              {positions.data
                ?.filter((p) => !dept || p.department_id === dept)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
            </NativeSelect>
          </Field>
          <Field label="Hire date" htmlFor="hd">
            <Input id="hd" type="date" {...form.register("hire_date")} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Job information" htmlFor="jn">
              <Textarea id="jn" {...form.register("job_notes")} />
            </Field>
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="emp" disabled={save.isPending}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
