import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Pencil, UserCog } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  check,
  fetchEmployee,
  fetchEmployees,
  fetchGaps,
  fetchAssignments,
  empName,
} from "@/lib/data";
import { setSupervisor, updateMyContact } from "@/lib/api/actions.functions";
import { useAction } from "@/hooks/use-action";
import { usePermissions } from "@/hooks/use-me";
import { qk } from "@/lib/query-keys";
import {
  PageHeader,
  Panel,
  StatusBadge,
  EmptyState,
  ErrorState,
  LoadingRows,
  SafetyTags,
  fmtDate,
  fmtDateTime,
  Field,
  NativeSelect,
} from "@/components/app/kit";
import { EmployeeDialog } from "@/components/app/employee-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/people/employees/$id")({
  head: () => ({
    meta: [
      { title: "Employee — Priority Handling Logistics, Inc." },
      { name: "description", content: "Employee record." },
    ],
  }),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const { any, employeeId } = usePermissions();
  const canEdit = any("hr.employees", "admin.org");
  const isSelf = employeeId === id;
  const q = useQuery({ queryKey: qk.org.employee(id), queryFn: () => fetchEmployee(id) });
  const all = useQuery({ queryKey: qk.org.employees(), queryFn: fetchEmployees, enabled: canEdit });
  const reporting = useQuery({
    queryKey: [...qk.org.employee(id), "reporting"],
    queryFn: async () =>
      check(
        await supabase
          .from("reporting_relationships")
          .select(
            "*, supervisor:employees!reporting_relationships_supervisor_id_fkey(first_name,last_name)",
          )
          .eq("employee_id", id)
          .order("effective_from", { ascending: false }),
      ) as unknown as {
        id: string;
        supervisor_id: string;
        effective_from: string;
        effective_to: string | null;
        is_current: boolean;
        supervisor: { first_name: string; last_name: string } | null;
      }[],
  });
  const gaps = useQuery({
    queryKey: qk.comp.gaps({ employee: id }),
    queryFn: () => fetchGaps({ employee: id }),
  });
  const evals = useQuery({
    queryKey: qk.perf.assignments({ employee: id }),
    queryFn: () => fetchAssignments({ employee: id }),
  });
  const history = useQuery({
    queryKey: qk.shared.audit({ employee: id }),
    queryFn: async () =>
      check(
        await supabase
          .from("audit_logs")
          .select("*")
          .eq("record_id", id)
          .order("created_at", { ascending: false })
          .limit(50),
      ) as {
        id: string;
        action: string;
        created_at: string;
        before_data: Record<string, unknown> | null;
        after_data: Record<string, unknown> | null;
      }[],
  });
  const [editing, setEditing] = useState(false);
  const [sup, setSup] = useState("");
  const setSupFn = useAction(useServerFn(setSupervisor), {
    invalidate: [qk.org.all],
    success: "Reporting line updated",
  });
  const [phone, setPhone] = useState<string | null>(null);
  const contact = useAction(useServerFn(updateMyContact), {
    invalidate: [qk.org.all, ["me"]],
    success: "Contact updated",
    onSuccess: () => setPhone(null),
  });

  if (q.isLoading) return <LoadingRows />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const e = q.data;
  if (!e)
    return (
      <EmptyState
        title="Employee not found"
        description="The record doesn't exist or isn't in your scope."
      />
    );
  const current = reporting.data?.find((r) => r.is_current);

  return (
    <div>
      <PageHeader
        eyebrow={e.employee_code}
        title={empName(e)}
        description={`${e.position?.title ?? ""} · ${e.department?.name ?? ""}`}
        actions={
          canEdit && (
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil /> Edit
            </Button>
          )
        }
      />
      <Tabs defaultValue="profile">
        <TabsList className="flex-wrap">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="reporting">Reporting line</TabsTrigger>
          <TabsTrigger value="competency">Competencies</TabsTrigger>
          <TabsTrigger value="evaluations">Evaluations</TabsTrigger>
          <TabsTrigger value="history">Change history</TabsTrigger>
        </TabsList>
        <TabsContent value="profile" className="mt-4">
          <Panel>
            <dl className="grid gap-4 font-data sm:grid-cols-3">
              {[
                ["Status", <StatusBadge key="s" status={e.employment_status} />],
                ["Email", e.email ?? "—"],
                ["Phone", e.phone ?? "—"],
                ["Hire date", fmtDate(e.hire_date)],
                ["Supervisor", current ? empName(current.supervisor) : "—"],
                ["Linked account", e.user_id ? "Yes" : "No"],
              ].map(([k, v]) => (
                <div key={k as string}>
                  <dt className="text-xs font-semibold uppercase text-muted-foreground">{k}</dt>
                  <dd className="mt-0.5">{v}</dd>
                </div>
              ))}
              <div className="sm:col-span-3">
                <dt className="text-xs font-semibold uppercase text-muted-foreground">
                  Job information
                </dt>
                <dd className="mt-0.5 whitespace-pre-wrap">{e.job_notes ?? "—"}</dd>
              </div>
            </dl>
            {isSelf && (
              <form
                className="mt-6 flex max-w-md items-end gap-2 border-t pt-4"
                onSubmit={(ev) => {
                  ev.preventDefault();
                  if (phone !== null) contact.mutate({ phone, version: e.version });
                }}
              >
                <div className="flex-1">
                  <Field
                    label="Update my phone"
                    htmlFor="myphone"
                    hint="This is the only field you can edit yourself."
                  >
                    <Input
                      id="myphone"
                      value={phone ?? e.phone ?? ""}
                      onChange={(x) => setPhone(x.target.value)}
                      maxLength={40}
                    />
                  </Field>
                </div>
                <Button type="submit" disabled={phone === null || contact.isPending}>
                  Save
                </Button>
              </form>
            )}
          </Panel>
        </TabsContent>
        <TabsContent value="reporting" className="mt-4 space-y-4">
          {canEdit && (
            <Panel
              title="Change supervisor"
              description="Each employee has one active supervisor. The previous line is closed with today's date."
            >
              <div className="flex max-w-lg items-end gap-2">
                <div className="flex-1">
                  <Field label="New supervisor" htmlFor="sup">
                    <NativeSelect id="sup" value={sup} onChange={(x) => setSup(x.target.value)}>
                      <option value="">Select…</option>
                      {all.data
                        ?.filter((x) => x.id !== id)
                        .map((x) => (
                          <option key={x.id} value={x.id}>
                            {empName(x)} — {x.position?.title}
                          </option>
                        ))}
                    </NativeSelect>
                  </Field>
                </div>
                <Button
                  disabled={!sup || setSupFn.isPending}
                  onClick={() =>
                    setSupFn.mutate({ employee_id: id, supervisor_id: sup, effective_from: null })
                  }
                >
                  <UserCog /> Assign
                </Button>
              </div>
            </Panel>
          )}
          <Panel title="Reporting history">
            {!reporting.data?.length ? (
              <p className="text-sm text-muted-foreground">No reporting line recorded.</p>
            ) : (
              <ul className="divide-y font-data text-sm">
                {reporting.data.map((r) => (
                  <li key={r.id} className="flex justify-between py-2">
                    <span className="font-bold">{empName(r.supervisor)}</span>
                    <span className="text-muted-foreground">
                      {fmtDate(r.effective_from)} –{" "}
                      {r.is_current ? "current" : fmtDate(r.effective_to)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </TabsContent>
        <TabsContent value="competency" className="mt-4">
          <Panel
            title="Competency gaps"
            actions={
              <Link
                to="/competency/gaps"
                search={{ employee: id }}
                className="text-sm font-bold text-primary hover:underline"
              >
                Open gap analysis
              </Link>
            }
          >
            {gaps.isLoading ? (
              <LoadingRows rows={3} />
            ) : !gaps.data?.length ? (
              <p className="text-sm text-muted-foreground">
                No requirements for this position, or not in your scope.
              </p>
            ) : (
              <ul className="divide-y">
                {gaps.data.map((g) => (
                  <li
                    key={g.competency_id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                  >
                    <span className="font-bold">
                      {g.competency_name}{" "}
                      <SafetyTags mandatory={g.is_mandatory} safety={g.is_safety_critical} />
                    </span>
                    <span className="flex items-center gap-3 font-data">
                      Required {g.required_level} · Current {g.current_level ?? "—"}
                      <StatusBadge
                        status={g.gap_status}
                        label={g.gap_status === "gap" ? `Gap ${g.gap}` : undefined}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </TabsContent>
        <TabsContent value="evaluations" className="mt-4">
          <Panel>
            {!evals.data?.length ? (
              <p className="text-sm text-muted-foreground">No evaluations visible to you.</p>
            ) : (
              <ul className="divide-y">
                {evals.data.map((a) => (
                  <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                    <Link
                      to="/performance/evaluations/$id"
                      params={{ id: a.id }}
                      className="font-bold hover:underline"
                    >
                      {a.cycle?.name}
                    </Link>
                    <span className="flex items-center gap-3 font-data">
                      {a.overall_score != null && `Score ${a.overall_score}`}
                      <StatusBadge status={a.status} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <Panel>
            {!history.data?.length ? (
              <p className="text-sm text-muted-foreground">
                No changes visible to you. Change history is shown to HR and administrators.
              </p>
            ) : (
              <ul className="divide-y font-data text-sm">
                {history.data.map((h) => {
                  const changed =
                    h.before_data && h.after_data
                      ? Object.keys(h.after_data).filter(
                          (k) =>
                            !["updated_at", "updated_by", "version"].includes(k) &&
                            JSON.stringify(h.after_data![k]) !== JSON.stringify(h.before_data![k]),
                        )
                      : [];
                  return (
                    <li key={h.id} className="py-2">
                      <span className="font-bold capitalize">{h.action}</span> ·{" "}
                      {fmtDateTime(h.created_at)}
                      {changed.length > 0 && (
                        <span className="block text-muted-foreground">
                          Changed: {changed.join(", ")}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </TabsContent>
      </Tabs>
      {editing && <EmployeeDialog employee={e} onClose={() => setEditing(false)} />}
    </div>
  );
}
