import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { fetchSessions, fetchTrainers, fetchCompetencies, type SessionRow } from "@/lib/data";
import {
  saveTrainingSession,
  setSessionStatus,
  saveTrainer,
} from "@/lib/api/development.functions";
import { unwrap, ApiError } from "@/lib/api/result";
import { usePermissions } from "@/hooks/use-me";
import { qk } from "@/lib/query-keys";
import {
  PageHeader,
  StatusBadge,
  LoadingRows,
  ErrorState,
  Field,
  NativeSelect,
  ConfirmDialog,
  fmtDateTime,
} from "@/components/app/kit";
import { DataTable } from "@/components/app/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/training/calendar")({
  head: () => ({
    meta: [
      { title: "Training calendar — Priority Handling Logistics, Inc." },
      {
        name: "description",
        content: "Scheduled training sessions with status, trainers and capacity.",
      },
    ],
  }),
  component: Page,
});

interface SessionForm {
  code: string;
  title: string;
  type: string;
  starts_at: string;
  ends_at: string;
  venue: string;
  delivery_method: string;
  trainer_id: string;
  capacity: string;
  related_competency_id: string;
}
const emptySession: SessionForm = {
  code: "",
  title: "",
  type: "workshop",
  starts_at: "",
  ends_at: "",
  venue: "",
  delivery_method: "in_person",
  trainer_id: "",
  capacity: "",
  related_competency_id: "",
};

function Page() {
  const { any } = usePermissions();
  const qc = useQueryClient();
  const sessions = useQuery({ queryKey: qk.train.sessions(), queryFn: () => fetchSessions() });
  const trainers = useQuery({ queryKey: qk.train.trainers(), queryFn: fetchTrainers });
  const competencies = useQuery({ queryKey: qk.comp.library(), queryFn: fetchCompetencies });
  const save = useServerFn(saveTrainingSession);
  const setStatus = useServerFn(setSessionStatus);
  const saveTrainerFn = useServerFn(saveTrainer);

  const [editing, setEditing] = useState<SessionRow | "new" | null>(null);
  const [form, setForm] = useState<SessionForm>(emptySession);
  const [trainerOpen, setTrainerOpen] = useState(false);
  const [trainerForm, setTrainerForm] = useState({
    name: "",
    email: "",
    specialty: "",
    is_external: false,
  });
  const [statusChange, setStatusChange] = useState<{ session: SessionRow; to: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  if (sessions.error)
    return <ErrorState error={sessions.error} onRetry={() => sessions.refetch()} />;
  if (!sessions.data) return <LoadingRows />;

  const canManage = any("train.manage");
  const toLocal = (iso: string) => iso.slice(0, 16);

  const openEdit = (s: SessionRow | "new") => {
    setEditing(s);
    setForm(
      s === "new"
        ? emptySession
        : {
            code: s.code,
            title: s.title,
            type: s.type,
            starts_at: toLocal(s.starts_at),
            ends_at: toLocal(s.ends_at),
            venue: s.venue ?? "",
            delivery_method: s.delivery_method,
            trainer_id: "",
            capacity: s.capacity ? String(s.capacity) : "",
            related_competency_id: "",
          },
    );
  };

  const doSave = async () => {
    setBusy(true);
    try {
      const existing = editing === "new" ? null : editing;
      unwrap(
        await save({
          data: {
            id: existing?.id ?? null,
            version: existing?.version ?? null,
            data: {
              code: form.code,
              title: form.title,
              type: form.type as "workshop" | "seminar" | "on_the_job" | "e_learning" | "drill",
              starts_at: new Date(form.starts_at).toISOString(),
              ends_at: new Date(form.ends_at).toISOString(),
              venue: form.venue || undefined,
              delivery_method: form.delivery_method as "in_person" | "virtual" | "hybrid",
              trainer_id: form.trainer_id || undefined,
              capacity: form.capacity ? Number(form.capacity) : undefined,
              related_competency_id: form.related_competency_id || undefined,
            },
          },
        }),
      );
      toast.success("Session saved");
      setEditing(null);
      qc.invalidateQueries({ queryKey: qk.train.all });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not save the session");
    } finally {
      setBusy(false);
    }
  };

  const doStatus = async () => {
    if (!statusChange) return;
    setBusy(true);
    try {
      unwrap(
        await setStatus({
          data: {
            id: statusChange.session.id,
            status: statusChange.to as "planned" | "in_progress" | "completed" | "cancelled",
          },
        }),
      );
      toast.success(`Session ${statusChange.to.replace(/_/g, " ")}`);
      setStatusChange(null);
      qc.invalidateQueries({ queryKey: qk.train.all });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Status change failed");
    } finally {
      setBusy(false);
    }
  };

  const doSaveTrainer = async () => {
    setBusy(true);
    try {
      unwrap(
        await saveTrainerFn({
          data: {
            id: null,
            version: null,
            data: {
              ...trainerForm,
              email: trainerForm.email || undefined,
              specialty: trainerForm.specialty || undefined,
            },
          },
        }),
      );
      toast.success("Trainer saved");
      setTrainerOpen(false);
      setTrainerForm({ name: "", email: "", specialty: "", is_external: false });
      qc.invalidateQueries({ queryKey: qk.train.trainers() });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not save the trainer");
    } finally {
      setBusy(false);
    }
  };

  const cols: ColumnDef<SessionRow, unknown>[] = [
    { header: "Code", accessorKey: "code" },
    {
      header: "Session",
      cell: ({ row }) => (
        <Link
          to="/training/sessions/$id"
          params={{ id: row.original.id }}
          className="font-bold hover:underline"
        >
          {row.original.title}
        </Link>
      ),
    },
    {
      header: "Starts",
      accessorKey: "starts_at",
      cell: ({ getValue }) => fmtDateTime(getValue() as string),
    },
    {
      header: "Delivery",
      accessorKey: "delivery_method",
      cell: ({ getValue }) => String(getValue()).replace(/_/g, " "),
    },
    { header: "Trainer", cell: ({ row }) => row.original.trainer?.name ?? "—" },
    {
      header: "Status",
      accessorKey: "status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    ...(canManage
      ? [
          {
            id: "actions",
            header: "",
            cell: ({ row }: { row: { original: SessionRow } }) => {
              const s = row.original;
              return (
                <div className="flex flex-wrap justify-end gap-1">
                  {s.status === "planned" && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => openEdit(s)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setStatusChange({ session: s, to: "in_progress" })}
                      >
                        Start
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setStatusChange({ session: s, to: "cancelled" })}
                      >
                        Cancel
                      </Button>
                    </>
                  )}
                  {s.status === "in_progress" && (
                    <Button
                      size="sm"
                      onClick={() => setStatusChange({ session: s, to: "completed" })}
                    >
                      Complete
                    </Button>
                  )}
                </div>
              );
            },
          } as ColumnDef<SessionRow, unknown>,
        ]
      : []),
  ];

  return (
    <div>
      <PageHeader
        title="Training calendar"
        description="All sessions you can see, newest first."
        actions={
          canManage ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setTrainerOpen(true)}>
                <Plus className="size-4" aria-hidden /> Trainer
              </Button>
              <Button onClick={() => openEdit("new")}>
                <Plus className="size-4" aria-hidden /> New session
              </Button>
            </div>
          ) : undefined
        }
      />
      <DataTable data={sessions.data} columns={cols} searchPlaceholder="Search sessions…" />

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "New training session" : "Edit session"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Code" htmlFor="s-code" required>
                <Input
                  id="s-code"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  maxLength={20}
                />
              </Field>
              <Field label="Type" htmlFor="s-type">
                <NativeSelect
                  id="s-type"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  <option value="workshop">Workshop</option>
                  <option value="seminar">Seminar</option>
                  <option value="on_the_job">On the job</option>
                  <option value="e_learning">E-learning</option>
                  <option value="drill">Drill</option>
                </NativeSelect>
              </Field>
            </div>
            <Field label="Title" htmlFor="s-title" required>
              <Input
                id="s-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                maxLength={160}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Starts" htmlFor="s-start" required>
                <Input
                  id="s-start"
                  type="datetime-local"
                  value={form.starts_at}
                  onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                />
              </Field>
              <Field label="Ends" htmlFor="s-end" required>
                <Input
                  id="s-end"
                  type="datetime-local"
                  value={form.ends_at}
                  onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Venue" htmlFor="s-venue">
                <Input
                  id="s-venue"
                  value={form.venue}
                  onChange={(e) => setForm({ ...form, venue: e.target.value })}
                  maxLength={200}
                />
              </Field>
              <Field label="Delivery" htmlFor="s-del">
                <NativeSelect
                  id="s-del"
                  value={form.delivery_method}
                  onChange={(e) => setForm({ ...form, delivery_method: e.target.value })}
                >
                  <option value="in_person">In person</option>
                  <option value="virtual">Virtual</option>
                  <option value="hybrid">Hybrid</option>
                </NativeSelect>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Trainer" htmlFor="s-trainer">
                <NativeSelect
                  id="s-trainer"
                  value={form.trainer_id}
                  onChange={(e) => setForm({ ...form, trainer_id: e.target.value })}
                >
                  <option value="">Unassigned</option>
                  {(trainers.data ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Capacity" htmlFor="s-cap">
                <Input
                  id="s-cap"
                  type="number"
                  min={1}
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Related competency" htmlFor="s-comp">
              <NativeSelect
                id="s-comp"
                value={form.related_competency_id}
                onChange={(e) => setForm({ ...form, related_competency_id: e.target.value })}
              >
                <option value="">None</option>
                {(competencies.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              onClick={doSave}
              disabled={
                busy || !form.code || form.title.length < 3 || !form.starts_at || !form.ends_at
              }
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={trainerOpen} onOpenChange={setTrainerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New trainer</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Field label="Name" htmlFor="t-name" required>
              <Input
                id="t-name"
                value={trainerForm.name}
                onChange={(e) => setTrainerForm({ ...trainerForm, name: e.target.value })}
                maxLength={160}
              />
            </Field>
            <Field label="Email" htmlFor="t-email">
              <Input
                id="t-email"
                type="email"
                value={trainerForm.email}
                onChange={(e) => setTrainerForm({ ...trainerForm, email: e.target.value })}
                maxLength={200}
              />
            </Field>
            <Field label="Specialty" htmlFor="t-spec">
              <Input
                id="t-spec"
                value={trainerForm.specialty}
                onChange={(e) => setTrainerForm({ ...trainerForm, specialty: e.target.value })}
                maxLength={200}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={trainerForm.is_external}
                onChange={(e) => setTrainerForm({ ...trainerForm, is_external: e.target.checked })}
                className="accent-primary"
              />
              External provider
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTrainerOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={doSaveTrainer} disabled={busy || trainerForm.name.length < 2}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!statusChange}
        onOpenChange={(o) => !o && setStatusChange(null)}
        title={`Mark session as ${statusChange?.to.replace(/_/g, " ")}?`}
        description={statusChange?.session.title}
        confirmLabel="Confirm"
        destructive={statusChange?.to === "cancelled"}
        pending={busy}
        onConfirm={doStatus}
      />
    </div>
  );
}
