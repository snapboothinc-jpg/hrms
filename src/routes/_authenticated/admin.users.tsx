import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ColumnDef } from "@tanstack/react-table";
import type { z } from "zod";
import { ShieldCheck, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { check, fetchEmployees, empName } from "@/lib/data";
import {
  adminCreateUser,
  adminLinkEmployee,
  adminSetActive,
  adminSetRole,
} from "@/lib/api/actions.functions";
import { createUserSchema } from "@/lib/schemas";
import { useAction } from "@/hooks/use-action";
import { usePermissions } from "@/hooks/use-me";
import { qk } from "@/lib/query-keys";
import { ROLE_LABELS, type AppRole } from "@/lib/policy";
import {
  PageHeader,
  EmptyState,
  Field,
  NativeSelect,
  ConfirmDialog,
  Tag,
} from "@/components/app/kit";
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

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({
    meta: [
      { title: "Users & roles — Priority Handling Logistics, Inc." },
      { name: "description", content: "User accounts and roles." },
    ],
  }),
  component: Page,
});

type U = {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  is_demo: boolean;
  role: AppRole | null;
  employee_id: string | null;
};
const ROLES = Object.keys(ROLE_LABELS) as AppRole[];

function Page() {
  const { has, me } = usePermissions();
  const canGrantAdmin = has("admin.roles");
  const users = useQuery({
    queryKey: qk.org.users(),
    queryFn: async () => {
      const [p, r, e] = await Promise.all([
        supabase.from("profiles").select("id, email, full_name, is_active, is_demo").order("email"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("employees").select("id, user_id").not("user_id", "is", null),
      ]);
      const roles = check(r) as { user_id: string; role: AppRole }[];
      const emps = check(e) as { id: string; user_id: string }[];
      return (check(p) as Omit<U, "role" | "employee_id">[]).map((x) => ({
        ...x,
        role: roles.find((y) => y.user_id === x.id)?.role ?? null,
        employee_id: emps.find((y) => y.user_id === x.id)?.id ?? null,
      }));
    },
  });
  const emps = useQuery({ queryKey: qk.org.employees(), queryFn: fetchEmployees });
  const inv = [qk.org.all];
  const setRole = useAction(useServerFn(adminSetRole), {
    invalidate: inv,
    success: "Role updated",
  });
  const link = useAction(useServerFn(adminLinkEmployee), {
    invalidate: inv,
    success: "Employee link updated",
  });
  const setActive = useAction(useServerFn(adminSetActive), {
    invalidate: inv,
    success: "Account updated",
    onSuccess: () => setDeact(null),
  });
  const [creating, setCreating] = useState(false);
  const [deact, setDeact] = useState<U | null>(null);

  const cols: ColumnDef<U, unknown>[] = [
    {
      header: "User",
      accessorFn: (r) => `${r.full_name ?? ""} ${r.email}`,
      cell: ({ row }) => (
        <div>
          <p className="font-bold">
            {row.original.full_name ?? "—"} {row.original.is_demo && <Tag>Demo</Tag>}
          </p>
          <p className="text-xs text-muted-foreground">{row.original.email}</p>
        </div>
      ),
    },
    {
      header: "Role",
      accessorKey: "role",
      cell: ({ row }) => (
        <NativeSelect
          aria-label={`Role for ${row.original.email}`}
          value={row.original.role ?? ""}
          disabled={row.original.id === me?.user_id || setRole.isPending}
          onChange={(e) =>
            setRole.mutate({ user_id: row.original.id, role: e.target.value as AppRole })
          }
          className="w-48"
        >
          <option value="" disabled>
            No role
          </option>
          {ROLES.filter(
            (r) =>
              canGrantAdmin || !["super_admin", "admin"].includes(r) || r === row.original.role,
          ).map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </NativeSelect>
      ),
    },
    {
      header: "Employee record",
      id: "emp",
      cell: ({ row }) => (
        <NativeSelect
          aria-label={`Employee for ${row.original.email}`}
          value={row.original.employee_id ?? ""}
          onChange={(e) =>
            link.mutate({ user_id: row.original.id, employee_id: e.target.value || null })
          }
          className="w-52"
        >
          <option value="">Not linked</option>
          {emps.data
            ?.filter((x) => !x.user_id || x.user_id === row.original.id)
            .map((x) => (
              <option key={x.id} value={x.id}>
                {empName(x)} ({x.employee_code})
              </option>
            ))}
        </NativeSelect>
      ),
    },
    {
      header: "Status",
      accessorKey: "is_active",
      cell: ({ getValue }) => (getValue() ? <Tag tone="success">Active</Tag> : <Tag>Inactive</Tag>),
    },
    {
      id: "a",
      header: "",
      cell: ({ row }) =>
        row.original.id !== me?.user_id && (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              row.original.is_active
                ? setDeact(row.original)
                : setActive.mutate({ user_id: row.original.id, active: true })
            }
          >
            {row.original.is_active ? "Deactivate" : "Activate"}
          </Button>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Users & roles"
        description="Each user has one primary role. Only a Super Admin can grant administrative roles."
        actions={
          <Button onClick={() => setCreating(true)}>
            <UserPlus /> Create account
          </Button>
        }
      />
      <DataTable
        columns={cols}
        data={users.data}
        loading={users.isLoading}
        error={users.error}
        onRetry={() => users.refetch()}
        empty={<EmptyState icon={ShieldCheck} title="No accounts" />}
      />
      {creating && (
        <CreateUser
          onClose={() => setCreating(false)}
          canGrantAdmin={canGrantAdmin}
          employees={(emps.data ?? []).filter((e) => !e.user_id)}
        />
      )}
      <ConfirmDialog
        open={!!deact}
        onOpenChange={(o) => !o && setDeact(null)}
        title="Deactivate account?"
        description={`${deact?.email} will be signed out and unable to sign in.`}
        confirmLabel="Deactivate"
        destructive
        pending={setActive.isPending}
        onConfirm={() => deact && setActive.mutate({ user_id: deact.id, active: false })}
      />
    </div>
  );
}

type F = z.infer<typeof createUserSchema>;
function CreateUser({
  onClose,
  canGrantAdmin,
  employees,
}: {
  onClose: () => void;
  canGrantAdmin: boolean;
  employees: { id: string; first_name: string; last_name: string; employee_code: string }[];
}) {
  const form = useForm<F>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { email: "", full_name: "", password: "", role: "employee", employee_id: null },
  });
  const create = useAction(useServerFn(adminCreateUser), {
    invalidate: [qk.org.all],
    success: "Account created",
    onSuccess: onClose,
  });
  const e = form.formState.errors;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create account</DialogTitle>
        </DialogHeader>
        <form
          id="cu"
          className="space-y-4"
          onSubmit={form.handleSubmit((v) => create.mutate(v))}
          noValidate
        >
          <Field label="Full name" htmlFor="fn" error={e.full_name?.message} required>
            <Input id="fn" {...form.register("full_name")} />
          </Field>
          <Field label="Email" htmlFor="em" error={e.email?.message} required>
            <Input id="em" type="email" {...form.register("email")} />
          </Field>
          <Field
            label="Temporary password"
            htmlFor="pw"
            error={e.password?.message}
            hint="12+ characters with upper, lower case and a number. Share it securely."
            required
          >
            <Input
              id="pw"
              type="password"
              autoComplete="new-password"
              {...form.register("password")}
            />
          </Field>
          <Field label="Role" htmlFor="rl" required>
            <NativeSelect id="rl" {...form.register("role")}>
              {ROLES.filter((r) => canGrantAdmin || !["super_admin", "admin"].includes(r)).map(
                (r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ),
              )}
            </NativeSelect>
          </Field>
          <Field label="Link to employee record" htmlFor="el">
            <NativeSelect
              id="el"
              {...form.register("employee_id", { setValueAs: (v) => v || null })}
            >
              <option value="">Not linked</option>
              {employees.map((x) => (
                <option key={x.id} value={x.id}>
                  {empName(x)} ({x.employee_code})
                </option>
              ))}
            </NativeSelect>
          </Field>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="cu" disabled={create.isPending}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
