import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import {
  fetchCandidates,
  fetchCriticalPositions,
  fetchEmployees,
  fetchReadinessClasses,
  fetchReadinessAssessments,
  fetchApprovedCompetencyAssessments,
  fetchRequirements,
  fetchSuccessionActivities,
  fetchSuccessionRequirements,
  fetchSuccessionQualifications,
  fetchAccessGrants,
  fetchDepartments,
  empName,
  type CandidateRow,
} from "@/lib/data";
import {
  saveCandidate,
  saveReadinessAssessment,
  saveSuccessionActivity,
  grantSuccessionAccess,
  revokeSuccessionAccess,
  saveSuccessionRequirement,
  saveSuccessionQualification,
} from "@/lib/api/succession.functions";
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
  DefaultNote,
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
import { supabase } from "@/integrations/supabase/client";
import { check } from "@/lib/data";
import { compareTargetCompetencies, compareTargetQualifications } from "@/lib/succession-readiness";

export const Route = createFileRoute("/_authenticated/succession/candidates")({
  head: () => ({
    meta: [
      { title: "Succession candidates — Priority Handling Logistics, Inc." },
      {
        name: "description",
        content: "Candidates, readiness assessments, and development activities.",
      },
    ],
  }),
  component: Page,
});

const emptyCandidate = {
  critical_position_id: "",
  employee_id: "",
  readiness_class_id: "",
  notes: "",
  status: "active" as const,
};

function Page() {
  const { has } = usePermissions();
  const qc = useQueryClient();
  const candidates = useQuery({ queryKey: qk.succ.candidates(), queryFn: () => fetchCandidates() });
  const positions = useQuery({ queryKey: qk.succ.positions(), queryFn: fetchCriticalPositions });
  const employees = useQuery({ queryKey: qk.org.employees(), queryFn: fetchEmployees });
  const classes = useQuery({ queryKey: qk.succ.classes(), queryFn: fetchReadinessClasses });

  const saveCand = useServerFn(saveCandidate);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyCandidate);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<CandidateRow | null>(null);

  if (candidates.error)
    return <ErrorState error={candidates.error} onRetry={() => candidates.refetch()} />;
  if (!candidates.data) return <LoadingRows />;

  const canManage = has("succession.manage");
  const canContribute = canManage || has("succession.dept");

  const doSave = async () => {
    setBusy(true);
    try {
      unwrap(
        await saveCand({
          data: {
            id: null,
            version: null,
            data: {
              ...form,
              readiness_class_id: form.readiness_class_id || undefined,
              notes: form.notes || undefined,
            },
          },
        }),
      );
      toast.success("Candidate added");
      setOpen(false);
      setForm(emptyCandidate);
      qc.invalidateQueries({ queryKey: qk.succ.all });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not save the candidate");
    } finally {
      setBusy(false);
    }
  };

  const cols: ColumnDef<CandidateRow, unknown>[] = [
    {
      header: "Candidate",
      cell: ({ row }) => (
        <span className="font-bold">
          {row.original.employee ? empName(row.original.employee) : "—"}
        </span>
      ),
    },
    {
      header: "Critical position",
      cell: ({ row }) => row.original.critical_position?.position?.title ?? "—",
    },
    {
      header: "Department",
      cell: ({ row }) => row.original.critical_position?.department?.name ?? "—",
    },
    {
      header: "Readiness",
      cell: ({ row }) =>
        row.original.readiness_class ? (
          <StatusBadge status="approved" label={row.original.readiness_class.label} />
        ) : (
          <span className="text-muted-foreground">Not assessed</span>
        ),
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      header: "",
      id: "actions",
      cell: ({ row }) => (
        <div className="text-right">
          <Button size="sm" variant="outline" onClick={() => setDetail(row.original)}>
            Open
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Succession candidates"
        description="Readiness classes are configurable defaults that require organizational validation."
        actions={
          canManage ? <Button onClick={() => setOpen(true)}>Add candidate</Button> : undefined
        }
      />
      <Panel>
        <DataTable data={candidates.data} columns={cols} searchPlaceholder="Search candidates…" />
      </Panel>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add candidate</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Field label="Critical position" htmlFor="sc-pos" required>
              <NativeSelect
                id="sc-pos"
                value={form.critical_position_id}
                onChange={(e) => setForm({ ...form, critical_position_id: e.target.value })}
              >
                <option value="">Choose…</option>
                {(positions.data ?? [])
                  .filter((p) => p.status === "active")
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.position?.title} — {p.department?.name}
                    </option>
                  ))}
              </NativeSelect>
            </Field>
            <Field label="Employee" htmlFor="sc-emp" required>
              <NativeSelect
                id="sc-emp"
                value={form.employee_id}
                onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
              >
                <option value="">Choose…</option>
                {(employees.data ?? []).map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {empName(emp)} ({emp.employee_code})
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Readiness class" htmlFor="sc-class">
              <NativeSelect
                id="sc-class"
                value={form.readiness_class_id}
                onChange={(e) => setForm({ ...form, readiness_class_id: e.target.value })}
              >
                <option value="">Not assessed</option>
                {(classes.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Notes" htmlFor="sc-notes">
              <Textarea
                id="sc-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                maxLength={4000}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              onClick={doSave}
              disabled={busy || !form.critical_position_id || !form.employee_id}
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CandidateDetail
        candidate={detail}
        onClose={() => setDetail(null)}
        canContribute={canContribute}
      />
      <AccessGrants canManage={canManage} />
    </div>
  );
}

function CandidateDetail({
  candidate,
  onClose,
  canContribute,
}: {
  candidate: CandidateRow | null;
  onClose: () => void;
  canContribute: boolean;
}) {
  const qc = useQueryClient();
  const assessments = useQuery({
    queryKey: [...qk.succ.all, "assess", candidate?.id],
    queryFn: () => fetchReadinessAssessments(candidate!.id),
    enabled: !!candidate,
  });
  const activities = useQuery({
    queryKey: [...qk.succ.all, "acts", candidate?.id],
    queryFn: () => fetchSuccessionActivities(candidate!.id),
    enabled: !!candidate,
  });
  const targetRequirements = useQuery({
    queryKey: [...qk.succ.all, "target-requirements", candidate?.critical_position?.position_id],
    queryFn: () => fetchRequirements(candidate!.critical_position!.position_id),
    enabled: !!candidate?.critical_position?.position_id,
  });
  const qualificationRequirements = useQuery({
    queryKey: [...qk.succ.all, "qualification-requirements", candidate?.critical_position_id],
    queryFn: () => fetchSuccessionRequirements(candidate!.critical_position_id),
    enabled: !!candidate,
  });
  const qualificationAssessments = useQuery({
    queryKey: [...qk.succ.all, "qualification-assessments", candidate?.id],
    queryFn: () => fetchSuccessionQualifications(candidate!.id),
    enabled: !!candidate,
  });
  const competencyAssessments = useQuery({
    queryKey: [...qk.comp.assessments({ employee: candidate?.employee_id }), "approved"],
    queryFn: () => fetchApprovedCompetencyAssessments(candidate!.employee_id),
    enabled: !!candidate,
  });
  const classes = useQuery({ queryKey: qk.succ.classes(), queryFn: fetchReadinessClasses });
  const saveAssess = useServerFn(saveReadinessAssessment);
  const saveAct = useServerFn(saveSuccessionActivity);
  const saveRequirement = useServerFn(saveSuccessionRequirement);
  const saveQualification = useServerFn(saveSuccessionQualification);

  const [assessForm, setAssessForm] = useState({ summary: "", readiness_class_id: "" });
  const [actForm, setActForm] = useState({ title: "", description: "", target_date: "" });
  const [requirementForm, setRequirementForm] = useState({
    name: "",
    description: "",
    mandatory: false,
  });
  const [qualificationRequirement, setQualificationRequirement] = useState<
    NonNullable<typeof qualificationRequirements.data>[number] | null
  >(null);
  const [qualificationForm, setQualificationForm] = useState({
    status: "unassessed" as "met" | "gap" | "missing_evidence" | "unassessed",
    evidence_summary: "",
    evidence_date: "",
    expires_on: "",
  });
  const [busy, setBusy] = useState(false);

  const doSaveRequirement = async () => {
    if (!candidate || requirementForm.name.trim().length < 2) return;
    setBusy(true);
    try {
      unwrap(
        await saveRequirement({
          data: {
            id: null,
            critical_position_id: candidate.critical_position_id,
            version: null,
            name: requirementForm.name,
            description: requirementForm.description || undefined,
            is_mandatory: requirementForm.mandatory,
            active: true,
            idempotencyKey: crypto.randomUUID(),
          },
        }),
      );
      toast.success("Qualification requirement added");
      setRequirementForm({ name: "", description: "", mandatory: false });
      qc.invalidateQueries({ queryKey: [...qk.succ.all, "qualification-requirements"] });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not save requirement");
    } finally {
      setBusy(false);
    }
  };

  const openQualificationAssessment = (
    requirement: NonNullable<typeof qualificationRequirements.data>[number],
  ) => {
    const existing = qualificationAssessments.data?.find(
      (item) => item.requirement_id === requirement.id,
    );
    setQualificationRequirement(requirement);
    setQualificationForm({
      status: existing?.status ?? "unassessed",
      evidence_summary: existing?.evidence_summary ?? "",
      evidence_date: existing?.evidence_date ?? "",
      expires_on: existing?.expires_on ?? "",
    });
  };

  const doSaveQualification = async () => {
    if (!candidate || !qualificationRequirement) return;
    const existing = qualificationAssessments.data?.find(
      (item) => item.requirement_id === qualificationRequirement.id,
    );
    setBusy(true);
    try {
      unwrap(
        await saveQualification({
          data: {
            id: existing?.id ?? null,
            candidate_id: candidate.id,
            requirement_id: qualificationRequirement.id,
            version: existing?.version ?? null,
            status: qualificationForm.status,
            evidence_summary: qualificationForm.evidence_summary || undefined,
            evidence_date: qualificationForm.evidence_date || undefined,
            expires_on: qualificationForm.expires_on || undefined,
            idempotencyKey: crypto.randomUUID(),
          },
        }),
      );
      toast.success("Qualification assessment recorded");
      setQualificationRequirement(null);
      qc.invalidateQueries({ queryKey: [...qk.succ.all, "qualification-assessments"] });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not save assessment");
    } finally {
      setBusy(false);
    }
  };

  const doAssess = async () => {
    if (!candidate) return;
    setBusy(true);
    try {
      unwrap(
        await saveAssess({
          data: {
            candidate_id: candidate.id,
            summary: assessForm.summary,
            readiness_class_id: assessForm.readiness_class_id || null,
          },
        }),
      );
      toast.success("Readiness assessment recorded");
      setAssessForm({ summary: "", readiness_class_id: "" });
      qc.invalidateQueries({ queryKey: qk.succ.all });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const doAct = async () => {
    if (!candidate) return;
    setBusy(true);
    try {
      unwrap(
        await saveAct({
          data: {
            id: null,
            candidate_id: candidate.id,
            title: actForm.title,
            description: actForm.description || undefined,
            status: "planned",
            target_date: actForm.target_date || undefined,
          },
        }),
      );
      toast.success("Development activity added");
      setActForm({ title: "", description: "", target_date: "" });
      qc.invalidateQueries({ queryKey: qk.succ.all });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const updateActivity = async (
    activity: NonNullable<typeof activities.data>[number],
    status: "planned" | "in_progress" | "completed" | "cancelled",
  ) => {
    if (!candidate) return;
    setBusy(true);
    try {
      unwrap(
        await saveAct({
          data: {
            id: activity.id,
            candidate_id: candidate.id,
            title: activity.title,
            description: activity.description ?? undefined,
            status,
            target_date: activity.target_date ?? undefined,
          },
        }),
      );
      toast.success("Development progress updated");
      qc.invalidateQueries({ queryKey: qk.succ.all });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not update progress");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Dialog open={!!candidate} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {candidate?.employee ? empName(candidate.employee) : "Candidate"}
            </DialogTitle>
          </DialogHeader>
          {candidate && (
            <div className="grid gap-4">
              <p className="text-sm text-muted-foreground">
                {candidate.critical_position?.position?.title} ·{" "}
                {candidate.critical_position?.department?.name}
              </p>
              <div>
                <h3 className="text-sm font-bold">Target-position competency comparison</h3>
                {targetRequirements.isLoading || competencyAssessments.isLoading ? (
                  <LoadingRows rows={3} />
                ) : targetRequirements.error || competencyAssessments.error ? (
                  <p role="alert" className="text-sm text-destructive">
                    Readiness requirements could not be loaded.
                  </p>
                ) : !targetRequirements.data?.length ? (
                  <p className="text-sm text-muted-foreground">
                    No current competency requirements are defined for this target position.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-2 text-sm">
                    {compareTargetCompetencies(
                      targetRequirements.data.map((requirement) => ({
                        competency_id: requirement.competency_id,
                        competency_name: requirement.competency?.name ?? "Competency",
                        required_level: requirement.required_level,
                        is_mandatory: requirement.is_mandatory,
                        is_safety_critical: requirement.is_safety_critical,
                      })),
                      competencyAssessments.data ?? [],
                    ).map((item) => (
                      <li
                        key={item.competency_id}
                        className="flex flex-wrap justify-between gap-2 border-b py-2"
                      >
                        <span>
                          {item.competency_name}
                          {item.is_mandatory ? " · mandatory" : ""}
                          {item.is_safety_critical ? " · safety-critical" : ""}
                        </span>
                        <span className="text-muted-foreground">
                          {item.assessment_status === "unassessed"
                            ? "Unassessed"
                            : item.assessment_status === "met"
                              ? `Met · ${item.current_level}/${item.required_level}`
                              : `Gap · ${item.current_level}/${item.required_level}`}
                          {" · "}
                          {item.evidence_status === "unassessed"
                            ? "No assessment"
                            : item.evidence_status === "missing"
                              ? "Missing evidence"
                              : "Evidence recorded"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold">Target-position qualifications</h3>
                {qualificationRequirements.isLoading || qualificationAssessments.isLoading ? (
                  <LoadingRows rows={2} />
                ) : qualificationRequirements.error || qualificationAssessments.error ? (
                  <p role="alert" className="text-sm text-destructive">
                    Qualification requirements could not be loaded.
                  </p>
                ) : (
                  <>
                    {!qualificationRequirements.data?.some((requirement) => requirement.active) ? (
                      <p className="text-sm text-muted-foreground">
                        No active qualifications are defined for this position.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-2 text-sm">
                        {compareTargetQualifications(
                          qualificationRequirements.data ?? [],
                          qualificationAssessments.data ?? [],
                        ).map((item) => {
                          const assessment = qualificationAssessments.data?.find(
                            (row) => row.requirement_id === item.id,
                          );
                          const statusLabel =
                            item.status === "met"
                              ? "Met"
                              : item.status === "gap"
                                ? "Deficiency"
                                : item.status === "missing_evidence"
                                  ? "Missing evidence"
                                  : item.status === "expired"
                                    ? "Expired evidence"
                                    : "Unassessed";
                          return (
                            <li
                              key={item.id}
                              className="flex flex-wrap items-center justify-between gap-2 border-b py-2"
                            >
                              <span>
                                {item.name}
                                {item.is_mandatory ? " · mandatory" : ""}
                                {assessment?.evidence_date
                                  ? ` · evidence ${fmtDate(assessment.evidence_date)}`
                                  : ""}
                                {item.mandatory_deficiency ? " · mandatory deficiency" : ""}
                              </span>
                              <div className="flex items-center gap-2">
                                <StatusBadge
                                  status={item.mandatory_deficiency ? "rejected" : item.status}
                                  label={statusLabel}
                                />
                                {canContribute && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      const requirement = qualificationRequirements.data?.find(
                                        (row) => row.id === item.id,
                                      );
                                      if (requirement) openQualificationAssessment(requirement);
                                    }}
                                  >
                                    Assess
                                  </Button>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {canContribute && (
                      <div className="mt-3 grid gap-2 rounded-md border p-3">
                        <p className="text-xs font-semibold">Add a position requirement</p>
                        <Field label="Qualification" htmlFor="qual-name">
                          <Input
                            id="qual-name"
                            value={requirementForm.name}
                            onChange={(event) =>
                              setRequirementForm({ ...requirementForm, name: event.target.value })
                            }
                            maxLength={160}
                          />
                        </Field>
                        <Field label="Description" htmlFor="qual-description">
                          <Textarea
                            id="qual-description"
                            value={requirementForm.description}
                            onChange={(event) =>
                              setRequirementForm({
                                ...requirementForm,
                                description: event.target.value,
                              })
                            }
                            rows={2}
                            maxLength={2000}
                          />
                        </Field>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={requirementForm.mandatory}
                            onChange={(event) =>
                              setRequirementForm({
                                ...requirementForm,
                                mandatory: event.target.checked,
                              })
                            }
                          />
                          Mandatory qualification
                        </label>
                        <div>
                          <Button
                            size="sm"
                            onClick={doSaveRequirement}
                            disabled={busy || requirementForm.name.trim().length < 2}
                          >
                            Add requirement
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold">Readiness assessments</h3>
                {!assessments.data?.length ? (
                  <p className="text-sm text-muted-foreground">None recorded.</p>
                ) : (
                  <ul className="mt-1 space-y-1 text-sm">
                    {assessments.data.map((a) => (
                      <li key={a.id}>
                        <span className="font-semibold">
                          {a.readiness_class?.label ?? "Unclassified"}
                        </span>{" "}
                        · {fmtDate(a.assessment_date)} · {a.assessor ? empName(a.assessor) : "—"}
                        <p className="text-xs text-muted-foreground">{a.summary}</p>
                      </li>
                    ))}
                  </ul>
                )}
                {canContribute && (
                  <div className="mt-2 grid gap-2 rounded-md border p-3">
                    <Field label="Summary" htmlFor="ra-summary">
                      <Textarea
                        id="ra-summary"
                        value={assessForm.summary}
                        onChange={(e) => setAssessForm({ ...assessForm, summary: e.target.value })}
                        rows={2}
                        maxLength={4000}
                      />
                    </Field>
                    <Field label="Readiness class" htmlFor="ra-class">
                      <NativeSelect
                        id="ra-class"
                        value={assessForm.readiness_class_id}
                        onChange={(e) =>
                          setAssessForm({ ...assessForm, readiness_class_id: e.target.value })
                        }
                      >
                        <option value="">Unclassified</option>
                        {(classes.data ?? []).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </NativeSelect>
                    </Field>
                    <div>
                      <Button
                        size="sm"
                        onClick={doAssess}
                        disabled={busy || assessForm.summary.length < 3}
                      >
                        Record assessment
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold">Development activities</h3>
                {!activities.data?.length ? (
                  <p className="text-sm text-muted-foreground">None planned.</p>
                ) : (
                  <ul className="mt-1 space-y-1 text-sm">
                    {activities.data.map((a) => (
                      <li
                        key={a.id}
                        className="flex flex-wrap items-center justify-between gap-2 py-1"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge status={a.status} />
                          <span>{a.title}</span>
                          {a.target_date && (
                            <span className="text-xs text-muted-foreground">
                              by {fmtDate(a.target_date)}
                            </span>
                          )}
                        </div>
                        {canContribute && (
                          <NativeSelect
                            aria-label={`Update progress for ${a.title}`}
                            className="w-36"
                            value={a.status}
                            disabled={busy}
                            onChange={(event) =>
                              updateActivity(
                                a,
                                event.target.value as
                                  "planned" | "in_progress" | "completed" | "cancelled",
                              )
                            }
                          >
                            <option value="planned">Planned</option>
                            <option value="in_progress">In progress</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                          </NativeSelect>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {canContribute && (
                  <div className="mt-2 grid gap-2 rounded-md border p-3">
                    <Field label="Title" htmlFor="sa-title">
                      <Input
                        id="sa-title"
                        value={actForm.title}
                        onChange={(e) => setActForm({ ...actForm, title: e.target.value })}
                        maxLength={200}
                      />
                    </Field>
                    <Field label="Target date" htmlFor="sa-date">
                      <Input
                        id="sa-date"
                        type="date"
                        value={actForm.target_date}
                        onChange={(e) => setActForm({ ...actForm, target_date: e.target.value })}
                      />
                    </Field>
                    <div>
                      <Button size="sm" onClick={doAct} disabled={busy || actForm.title.length < 3}>
                        Add activity
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!qualificationRequirement}
        onOpenChange={(open) => !open && setQualificationRequirement(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assess {qualificationRequirement?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Field label="Assessment" htmlFor="qual-status">
              <NativeSelect
                id="qual-status"
                value={qualificationForm.status}
                onChange={(event) =>
                  setQualificationForm({
                    ...qualificationForm,
                    status: event.target.value as typeof qualificationForm.status,
                  })
                }
              >
                <option value="unassessed">Unassessed</option>
                <option value="met">Met</option>
                <option value="gap">Deficiency</option>
                <option value="missing_evidence">Missing evidence</option>
              </NativeSelect>
            </Field>
            <Field label="Evidence summary" htmlFor="qual-evidence">
              <Textarea
                id="qual-evidence"
                value={qualificationForm.evidence_summary}
                onChange={(event) =>
                  setQualificationForm({
                    ...qualificationForm,
                    evidence_summary: event.target.value,
                  })
                }
                rows={3}
                maxLength={4000}
              />
            </Field>
            <Field label="Evidence date" htmlFor="qual-evidence-date">
              <Input
                id="qual-evidence-date"
                type="date"
                value={qualificationForm.evidence_date}
                onChange={(event) =>
                  setQualificationForm({ ...qualificationForm, evidence_date: event.target.value })
                }
              />
            </Field>
            <Field label="Expires on" htmlFor="qual-expires">
              <Input
                id="qual-expires"
                type="date"
                value={qualificationForm.expires_on}
                onChange={(event) =>
                  setQualificationForm({ ...qualificationForm, expires_on: event.target.value })
                }
              />
            </Field>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setQualificationRequirement(null)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button onClick={doSaveQualification} disabled={busy}>
              Save assessment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AccessGrants({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const grants = useQuery({ queryKey: qk.succ.grants(), queryFn: fetchAccessGrants });
  const departments = useQuery({ queryKey: qk.org.departments(), queryFn: fetchDepartments });
  const profiles = useQuery({
    queryKey: ["profiles-list"],
    queryFn: async () =>
      check(await supabase.from("profiles").select("user_id, full_name, email")) as {
        user_id: string;
        full_name: string | null;
        email: string;
      }[],
    enabled: canManage,
  });
  const grant = useServerFn(grantSuccessionAccess);
  const revoke = useServerFn(revokeSuccessionAccess);
  const [form, setForm] = useState({ user_id: "", department_id: "" });
  const [busy, setBusy] = useState(false);

  if (!canManage) return null;

  const doGrant = async () => {
    setBusy(true);
    try {
      unwrap(await grant({ data: form }));
      toast.success("Access granted");
      setForm({ user_id: "", department_id: "" });
      qc.invalidateQueries({ queryKey: qk.succ.grants() });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not grant access");
    } finally {
      setBusy(false);
    }
  };

  const doRevoke = async (id: string) => {
    try {
      unwrap(await revoke({ data: { id } }));
      toast.success("Access revoked");
      qc.invalidateQueries({ queryKey: qk.succ.grants() });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not revoke");
    }
  };

  return (
    <Panel
      title="Department access grants"
      className="mt-6"
      description="Department Heads can see succession records only for departments explicitly granted here."
    >
      <div className="mb-3 flex flex-wrap gap-2">
        <NativeSelect
          aria-label="User"
          value={form.user_id}
          onChange={(e) => setForm({ ...form, user_id: e.target.value })}
          className="w-64"
        >
          <option value="">User…</option>
          {(profiles.data ?? []).map((p) => (
            <option key={p.user_id} value={p.user_id}>
              {p.full_name ?? p.email}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Department"
          value={form.department_id}
          onChange={(e) => setForm({ ...form, department_id: e.target.value })}
          className="w-56"
        >
          <option value="">Department…</option>
          {(departments.data ?? []).map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </NativeSelect>
        <Button onClick={doGrant} disabled={busy || !form.user_id || !form.department_id}>
          Grant
        </Button>
      </div>
      {!grants.data?.length ? (
        <p className="text-sm text-muted-foreground">No grants yet.</p>
      ) : (
        <ul className="divide-y text-sm">
          {grants.data.map((g) => (
            <li key={g.id} className="flex items-center justify-between py-2">
              <span>
                <span className="font-semibold">{g.profile?.full_name ?? g.profile?.email}</span> —{" "}
                {g.department?.name}
              </span>
              <Button size="sm" variant="outline" onClick={() => doRevoke(g.id)}>
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      )}
      <DefaultNote />
    </Panel>
  );
}
