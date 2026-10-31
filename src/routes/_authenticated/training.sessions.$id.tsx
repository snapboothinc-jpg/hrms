import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  fetchSession,
  fetchParticipants,
  fetchAttendance,
  fetchTrainingResults,
  fetchEmployees,
  empName,
} from "@/lib/data";
import {
  registerParticipant,
  saveAttendance,
  saveTrainingResult,
} from "@/lib/api/development.functions";
import { unwrap, ApiError } from "@/lib/api/result";
import { usePermissions } from "@/hooks/use-me";
import { qk } from "@/lib/query-keys";
import {
  PageHeader,
  Panel,
  StatusBadge,
  EmptyState,
  LoadingRows,
  ErrorState,
  Field,
  NativeSelect,
  fmtDateTime,
  Tag,
} from "@/components/app/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/training/sessions/$id")({
  head: () => ({
    meta: [
      { title: "Training session — Priority Handling Logistics, Inc." },
      {
        name: "description",
        content: "Participants, attendance register and results for one session.",
      },
    ],
  }),
  component: Page,
});

type AttStatus = "present" | "absent" | "late" | "excused";

function Page() {
  const { id } = Route.useParams();
  const { any } = usePermissions();
  const qc = useQueryClient();
  const session = useQuery({ queryKey: qk.train.session(id), queryFn: () => fetchSession(id) });
  const participants = useQuery({
    queryKey: [...qk.train.session(id), "participants"],
    queryFn: () => fetchParticipants(id),
  });
  const attendance = useQuery({
    queryKey: [...qk.train.session(id), "attendance"],
    queryFn: () => fetchAttendance(id),
  });
  const results = useQuery({
    queryKey: [...qk.train.session(id), "results"],
    queryFn: () => fetchTrainingResults(id),
  });
  const employees = useQuery({ queryKey: qk.org.employees(), queryFn: fetchEmployees });
  const register = useServerFn(registerParticipant);
  const saveAtt = useServerFn(saveAttendance);
  const saveResult = useServerFn(saveTrainingResult);

  const [addEmp, setAddEmp] = useState("");
  const [attRows, setAttRows] = useState<Record<string, { status: AttStatus; remarks: string }>>(
    {},
  );
  const [resultFor, setResultFor] = useState<string | null>(null);
  const [resultForm, setResultForm] = useState({
    score: "",
    outcome: "completed",
    feedback: "",
    evidence: "",
  });
  const [busy, setBusy] = useState(false);

  if (session.error) return <ErrorState error={session.error} onRetry={() => session.refetch()} />;
  if (!session.data || !participants.data) return <LoadingRows />;
  if (!session.data.id)
    return <EmptyState title="Session not found" description="It may be outside your access." />;

  const canManage = any("train.manage");
  const s = session.data;
  const attByEmp = new Map((attendance.data ?? []).map((a) => [a.employee_id, a]));
  const resultByEmp = new Map((results.data ?? []).map((r) => [r.employee_id, r]));
  const registered = new Set(participants.data.map((p) => p.employee_id));

  const doRegister = async () => {
    if (!addEmp) return;
    setBusy(true);
    try {
      unwrap(await register({ data: { session_id: id, employee_id: addEmp, plan_item_id: null } }));
      toast.success("Participant registered");
      setAddEmp("");
      qc.invalidateQueries({ queryKey: qk.train.session(id) });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  };

  const doSaveAttendance = async () => {
    const rows = Object.entries(attRows).map(([employee_id, r]) => ({
      employee_id,
      status: r.status,
      remarks: r.remarks || undefined,
    }));
    if (!rows.length) return;
    setBusy(true);
    try {
      unwrap(
        await saveAtt({ data: { session_id: id, rows, idempotencyKey: crypto.randomUUID() } }),
      );
      toast.success("Attendance saved");
      setAttRows({});
      qc.invalidateQueries({ queryKey: qk.train.session(id) });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not save attendance");
    } finally {
      setBusy(false);
    }
  };

  const doSaveResult = async () => {
    if (!resultFor) return;
    setBusy(true);
    try {
      unwrap(
        await saveResult({
          data: {
            session_id: id,
            employee_id: resultFor,
            score: resultForm.score ? Number(resultForm.score) : null,
            outcome: resultForm.outcome as "passed" | "failed" | "completed" | "incomplete",
            feedback: resultForm.feedback || undefined,
            evidence: resultForm.evidence || undefined,
          },
        }),
      );
      toast.success("Result saved");
      setResultFor(null);
      qc.invalidateQueries({ queryKey: qk.train.session(id) });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not save the result");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow={s.code}
        title={s.title}
        description={`${fmtDateTime(s.starts_at)} → ${fmtDateTime(s.ends_at)} · ${s.venue ?? s.delivery_method.replace(/_/g, " ")}`}
        actions={
          <div className="flex gap-2">
            {s.related_competency && <Tag tone="info">{s.related_competency.name}</Tag>}
            <StatusBadge status={s.status} />
          </div>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Participants"
          description={`${participants.data.length} registered${s.capacity ? ` · capacity ${s.capacity}` : ""}`}
          actions={
            canManage && (s.status === "planned" || s.status === "in_progress") ? (
              <div className="flex gap-2">
                <NativeSelect
                  aria-label="Employee to register"
                  value={addEmp}
                  onChange={(e) => setAddEmp(e.target.value)}
                  className="w-56"
                >
                  <option value="">Add employee…</option>
                  {(employees.data ?? [])
                    .filter((e) => !registered.has(e.id))
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {empName(e)} ({e.employee_code})
                      </option>
                    ))}
                </NativeSelect>
                <Button size="sm" onClick={doRegister} disabled={busy || !addEmp}>
                  Register
                </Button>
              </div>
            ) : undefined
          }
        >
          {participants.data.length === 0 ? (
            <EmptyState
              title="No participants"
              description="Register employees to build the attendance register."
            />
          ) : (
            <ul className="divide-y">
              {participants.data.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <p className="text-sm font-semibold">{empName(p.employee)}</p>
                    <p className="text-xs text-muted-foreground">{p.employee?.employee_code}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={p.status} />
                    {canManage && s.status === "completed" && !resultByEmp.has(p.employee_id) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setResultFor(p.employee_id);
                          setResultForm({
                            score: "",
                            outcome: "completed",
                            feedback: "",
                            evidence: "",
                          });
                        }}
                      >
                        Record result
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Attendance register"
          description="Record or update attendance; every save is audited and history is kept."
        >
          {participants.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">Register participants first.</p>
          ) : !canManage ? (
            <ul className="divide-y">
              {participants.data.map((p) => {
                const a = attByEmp.get(p.employee_id);
                return (
                  <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                    <span>{empName(p.employee)}</span>
                    <span className="font-semibold">{a ? a.status : "not recorded"}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="space-y-3">
              {participants.data.map((p) => {
                const existing = attByEmp.get(p.employee_id);
                const row = attRows[p.employee_id] ?? {
                  status: (existing?.status as AttStatus) ?? "present",
                  remarks: existing?.remarks ?? "",
                };
                return (
                  <div key={p.id} className="grid grid-cols-[1fr_120px_1fr] items-center gap-2">
                    <span className="text-sm font-semibold">{empName(p.employee)}</span>
                    <NativeSelect
                      aria-label={`Attendance for ${empName(p.employee)}`}
                      value={row.status}
                      onChange={(e) =>
                        setAttRows({
                          ...attRows,
                          [p.employee_id]: { ...row, status: e.target.value as AttStatus },
                        })
                      }
                    >
                      <option value="present">Present</option>
                      <option value="late">Late</option>
                      <option value="absent">Absent</option>
                      <option value="excused">Excused</option>
                    </NativeSelect>
                    <Input
                      aria-label={`Remarks for ${empName(p.employee)}`}
                      placeholder="Remarks"
                      value={row.remarks}
                      onChange={(e) =>
                        setAttRows({
                          ...attRows,
                          [p.employee_id]: { ...row, remarks: e.target.value },
                        })
                      }
                      maxLength={2000}
                    />
                  </div>
                );
              })}
              <Button
                onClick={doSaveAttendance}
                disabled={busy || Object.keys(attRows).length === 0}
              >
                Save attendance
              </Button>
            </div>
          )}
        </Panel>

        <Panel
          title="Results"
          description="Scores and outcomes. A completed session never marks a competency as mastered."
          className="lg:col-span-2"
        >
          {!results.data?.length ? (
            <p className="text-sm text-muted-foreground">No results recorded yet.</p>
          ) : (
            <ul className="divide-y">
              {results.data.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <p className="text-sm font-semibold">{empName(r.employee)}</p>
                    {r.feedback && <p className="text-xs text-muted-foreground">{r.feedback}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {r.score != null && <Tag tone="info">{r.score}%</Tag>}
                    <StatusBadge
                      status={
                        r.outcome === "passed"
                          ? "approved"
                          : r.outcome === "failed"
                            ? "rejected"
                            : r.outcome
                      }
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Dialog open={!!resultFor} onOpenChange={(o) => !o && setResultFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record result</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Score (%)" htmlFor="r-score">
                <Input
                  id="r-score"
                  type="number"
                  min={0}
                  max={100}
                  value={resultForm.score}
                  onChange={(e) => setResultForm({ ...resultForm, score: e.target.value })}
                />
              </Field>
              <Field label="Outcome" htmlFor="r-outcome" required>
                <NativeSelect
                  id="r-outcome"
                  value={resultForm.outcome}
                  onChange={(e) => setResultForm({ ...resultForm, outcome: e.target.value })}
                >
                  <option value="passed">Passed</option>
                  <option value="failed">Failed</option>
                  <option value="completed">Completed</option>
                  <option value="incomplete">Incomplete</option>
                </NativeSelect>
              </Field>
            </div>
            <Field label="Feedback" htmlFor="r-feedback">
              <Textarea
                id="r-feedback"
                value={resultForm.feedback}
                onChange={(e) => setResultForm({ ...resultForm, feedback: e.target.value })}
                rows={2}
              />
            </Field>
            <Field
              label="Evidence"
              htmlFor="r-evidence"
              hint="What demonstrates the outcome (observation, test, artifact)."
            >
              <Textarea
                id="r-evidence"
                value={resultForm.evidence}
                onChange={(e) => setResultForm({ ...resultForm, evidence: e.target.value })}
                rows={2}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResultFor(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={doSaveResult} disabled={busy}>
              Save result
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
