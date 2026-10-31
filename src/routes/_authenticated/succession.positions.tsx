import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import {
  fetchCriticalPositions,
  fetchCandidates,
  fetchPositions,
  fetchDepartments,
  fetchEmployees,
  fetchSuccessionPlans,
  fetchSuccessionRequirements,
  empName,
  type CriticalPositionRow,
  type SuccessionPlanRow,
} from "@/lib/data";
import { saveCriticalPosition, submitSuccessionPlan } from "@/lib/api/succession.functions";
import { unwrap, ApiError } from "@/lib/api/result";
import { usePermissions } from "@/hooks/use-me";
import { qk } from "@/lib/query-keys";
import {
  PageHeader,
  Panel,
  StatusBadge,
  LoadingRows,
  ErrorState,
  Field,
  NativeSelect,
  fmtDate,
} from "@/components/app/kit";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/app/data-table";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/succession/positions")({
  head: () => ({
    meta: [
      { title: "Critical positions — Priority Handling Logistics, Inc." },
      { name: "description", content: "Positions designated as critical for succession planning." },
    ],
  }),
  component: Page,
});

const empty = {
  position_id: "",
  department_id: "",
  criticality: "high" as const,
  business_impact: "",
  incumbent_employee_id: "",
  status: "active" as const,
  review_date: "",
};

function Page() {
  const { has } = usePermissions();
  const qc = useQueryClient();
  const positions = useQuery({ queryKey: qk.succ.positions(), queryFn: fetchCriticalPositions });
  const successionPlans = useQuery({
    queryKey: [...qk.succ.all, "plans"],
    queryFn: fetchSuccessionPlans,
  });
  const orgPositions = useQuery({ queryKey: qk.org.positions(), queryFn: fetchPositions });
  const departments = useQuery({ queryKey: qk.org.departments(), queryFn: fetchDepartments });
  const employees = useQuery({ queryKey: qk.org.employees(), queryFn: fetchEmployees });
  const save = useServerFn(saveCriticalPosition);
  const submitPlan = useServerFn(submitSuccessionPlan);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CriticalPositionRow | null>(null);
  const [planDetail, setPlanDetail] = useState<SuccessionPlanRow | null>(null);
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);

  if (positions.error)
    return <ErrorState error={positions.error} onRetry={() => positions.refetch()} />;
  if (!positions.data) return <LoadingRows />;

  const canManage = has("succession.manage");
  const canContribute = canManage || has("succession.dept");

  const submitSuccession = async (positionId: string) => {
    const plan = successionPlans.data?.find((item) => item.critical_position_id === positionId);
    if (!plan) {
      toast.error("The succession plan is not available");
      return;
    }
    setBusy(true);
    try {
      unwrap(
        await submitPlan({
          data: { id: plan.id, version: plan.version, idempotencyKey: crypto.randomUUID() },
        }),
      );
      toast.success("Succession plan submitted for review");
      await qc.invalidateQueries({ queryKey: [...qk.succ.all, "plans"] });
      await qc.invalidateQueries({ queryKey: qk.shared.approvals() });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not submit the succession plan");
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (p: CriticalPositionRow) => {
    setEditing(p);
    setForm({
      position_id: p.position_id,
      department_id: p.department_id,
      criticality: p.criticality as typeof empty.criticality,
      business_impact: p.business_impact ?? "",
      incumbent_employee_id: p.incumbent_employee_id ?? "",
      status: p.status as typeof empty.status,
      review_date: p.review_date ?? "",
    });
    setOpen(true);
  };

  const doSave = async () => {
    setBusy(true);
    try {
      unwrap(
        await save({
          data: {
            id: editing?.id ?? null,
            version: editing?.version ?? null,
            data: {
              ...form,
              business_impact: form.business_impact || undefined,
              incumbent_employee_id: form.incumbent_employee_id || undefined,
              review_date: form.review_date || undefined,
            },
          },
        }),
      );
      toast.success(editing ? "Position updated" : "Critical position added");
      setOpen(false);
      setEditing(null);
      setForm(empty);
      qc.invalidateQueries({ queryKey: qk.succ.all });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const cols: ColumnDef<CriticalPositionRow, unknown>[] = [
    {
      header: "Position",
      cell: ({ row }) => <span className="font-bold">{row.original.position?.title}</span>,
    },
    { header: "Department", cell: ({ row }) => row.original.department?.name },
    {
      header: "Criticality",
      accessorKey: "criticality",
      cell: ({ row }) => (
        <StatusBadge
          status={
            row.original.criticality === "critical" || row.original.criticality === "high"
              ? "open"
              : "draft"
          }
          label={row.original.criticality}
        />
      ),
    },
    {
      header: "Incumbent",
      cell: ({ row }) => (row.original.incumbent ? empName(row.original.incumbent) : "—"),
    },
    {
      header: "Review date",
      accessorKey: "review_date",
      cell: ({ getValue }) => fmtDate(getValue() as string),
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      header: "Plan approval",
      cell: ({ row }) => {
        const plan = successionPlans.data?.find(
          (item) => item.critical_position_id === row.original.id,
        );
        return plan ? <StatusBadge status={plan.status} /> : <span>Unavailable</span>;
      },
    },
    {
      header: "Review feedback",
      cell: ({ row }) =>
        successionPlans.data?.find((item) => item.critical_position_id === row.original.id)
          ?.review_comments ?? "—",
    },
    {
      header: "",
      id: "actions",
      cell: ({ row }) =>
        canManage || canContribute ? (
          <div className="text-right">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setPlanDetail(
                  successionPlans.data?.find(
                    (item) => item.critical_position_id === row.original.id,
                  ) ?? null,
                )
              }
            >
              Open plan
            </Button>
            {canManage && (
              <Button size="sm" variant="outline" onClick={() => openEdit(row.original)}>
                Edit
              </Button>
            )}
            {(() => {
              const plan = successionPlans.data?.find(
                (item) => item.critical_position_id === row.original.id,
              );
              return canContribute && plan && ["draft", "returned"].includes(plan.status) ? (
                <Button
                  size="sm"
                  onClick={() => void submitSuccession(row.original.id)}
                  disabled={busy}
                >
                  Submit plan
                </Button>
              ) : null;
            })()}
          </div>
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Critical positions"
        description="Positions whose vacancy would significantly affect operations."
        actions={
          canManage ? (
            <Button
              onClick={() => {
                setEditing(null);
                setForm(empty);
                setOpen(true);
              }}
            >
              Add critical position
            </Button>
          ) : undefined
        }
      />
      <Panel>
        <DataTable
          data={positions.data}
          columns={cols}
          loading={successionPlans.isLoading}
          error={successionPlans.error}
          onRetry={() => successionPlans.refetch()}
          searchPlaceholder="Search positions…"
        />
      </Panel>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit critical position" : "Add critical position"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Field label="Position" htmlFor="cp-pos" required>
              <NativeSelect
                id="cp-pos"
                value={form.position_id}
                onChange={(e) => setForm({ ...form, position_id: e.target.value })}
              >
                <option value="">Choose…</option>
                {(orgPositions.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Department" htmlFor="cp-dept" required>
              <NativeSelect
                id="cp-dept"
                value={form.department_id}
                onChange={(e) => setForm({ ...form, department_id: e.target.value })}
              >
                <option value="">Choose…</option>
                {(departments.data ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Criticality" htmlFor="cp-crit" required>
              <NativeSelect
                id="cp-crit"
                value={form.criticality}
                onChange={(e) =>
                  setForm({ ...form, criticality: e.target.value as typeof empty.criticality })
                }
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </NativeSelect>
            </Field>
            <Field label="Incumbent" htmlFor="cp-inc">
              <NativeSelect
                id="cp-inc"
                value={form.incumbent_employee_id}
                onChange={(e) => setForm({ ...form, incumbent_employee_id: e.target.value })}
              >
                <option value="">None</option>
                {(employees.data ?? []).map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {empName(emp)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Business impact" htmlFor="cp-impact">
              <Textarea
                id="cp-impact"
                value={form.business_impact}
                onChange={(e) => setForm({ ...form, business_impact: e.target.value })}
                rows={2}
                maxLength={4000}
              />
            </Field>
            <Field label="Review date" htmlFor="cp-review">
              <Input
                id="cp-review"
                type="date"
                value={form.review_date}
                onChange={(e) => setForm({ ...form, review_date: e.target.value })}
              />
            </Field>
            <Field label="Status" htmlFor="cp-status">
              <NativeSelect
                id="cp-status"
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as typeof empty.status })
                }
              >
                <option value="active">Active</option>
                <option value="monitoring">Monitoring</option>
                <option value="closed">Closed</option>
              </NativeSelect>
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={doSave} disabled={busy || !form.position_id || !form.department_id}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <SuccessionPlanDetail
        plan={planDetail}
        position={
          positions.data.find((item) => item.id === planDetail?.critical_position_id) ?? null
        }
        onClose={() => setPlanDetail(null)}
      />
    </div>
  );
}

function SuccessionPlanDetail({
  plan,
  position,
  onClose,
}: {
  plan: SuccessionPlanRow | null;
  position: CriticalPositionRow | null;
  onClose: () => void;
}) {
  const candidates = useQuery({
    queryKey: qk.succ.candidates({ plan: plan?.critical_position_id }),
    queryFn: () => fetchCandidates(plan!.critical_position_id),
    enabled: !!plan,
  });
  const requirements = useQuery({
    queryKey: [...qk.succ.all, "qualification-requirements", plan?.critical_position_id],
    queryFn: () => fetchSuccessionRequirements(plan!.critical_position_id),
    enabled: !!plan,
  });

  return (
    <Dialog open={!!plan} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Succession plan · {position?.position?.title ?? "Critical position"}
          </DialogTitle>
        </DialogHeader>
        {plan && (
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={plan.status} />
              <span className="text-sm text-muted-foreground">
                {position?.department?.name ?? "Department"}
                {position?.review_date ? ` · next review ${fmtDate(position.review_date)}` : ""}
              </span>
            </div>
            {plan.submitted_at && <p className="text-sm">Submitted {fmtDate(plan.submitted_at)}</p>}
            {plan.reviewed_at && (
              <p className="text-sm">Last reviewed {fmtDate(plan.reviewed_at)}</p>
            )}
            {plan.review_comments && (
              <Panel title="Review feedback">
                <p className="whitespace-pre-wrap text-sm">{plan.review_comments}</p>
              </Panel>
            )}
            {candidates.isError || requirements.isError ? (
              <p role="alert" className="text-sm text-destructive">
                Plan details could not be fully loaded.
              </p>
            ) : candidates.isLoading || requirements.isLoading ? (
              <LoadingRows rows={3} />
            ) : (
              <>
                <Panel title={`Candidates (${candidates.data?.length ?? 0})`}>
                  {!candidates.data?.length ? (
                    <p className="text-sm text-muted-foreground">
                      No candidates have been referred.
                    </p>
                  ) : (
                    <ul className="divide-y">
                      {candidates.data.map((candidate) => (
                        <li key={candidate.id} className="flex items-center justify-between py-2">
                          <span className="text-sm font-semibold">
                            {candidate.employee ? empName(candidate.employee) : "Candidate"}
                          </span>
                          <StatusBadge
                            status={candidate.readiness_class?.label ?? "unassessed"}
                            label={candidate.readiness_class?.label ?? "Unassessed"}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
                <Panel title={`Qualification requirements (${requirements.data?.length ?? 0})`}>
                  {!requirements.data?.length ? (
                    <p className="text-sm text-muted-foreground">No requirements are configured.</p>
                  ) : (
                    <ul className="space-y-1">
                      {requirements.data.map((requirement) => (
                        <li key={requirement.id} className="text-sm">
                          {requirement.name}
                          {requirement.is_mandatory ? " · mandatory" : ""}
                          {!requirement.active ? " · inactive" : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
