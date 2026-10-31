import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Pencil, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { check, fetchAssignments, fetchEmployees, fetchCycles, empName } from "@/lib/data";
import { createAssignments, setCycleStatus } from "@/lib/api/actions.functions";
import { useAction } from "@/hooks/use-action";
import { qk } from "@/lib/query-keys";
import {
  PageHeader,
  StatusBadge,
  ConfirmDialog,
  LoadingRows,
  EmptyState,
  fmtDate,
  Panel,
} from "@/components/app/kit";
import { AssignmentsTable } from "@/components/app/assignments-table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CycleDialog } from "@/components/app/cycle-dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/performance/cycles/$id")({
  head: () => ({
    meta: [
      { title: "Evaluation cycle — Priority Handling Logistics, Inc." },
      { name: "description", content: "Cycle assignments and status." },
    ],
  }),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const cycles = useQuery({ queryKey: qk.perf.cycles(), queryFn: fetchCycles });
  const cycle = cycles.data?.find((c) => c.id === id);
  const a = useQuery({
    queryKey: qk.perf.assignments({ cycle: id }),
    queryFn: () => fetchAssignments({ cycle: id }),
  });
  const [assigning, setAssigning] = useState(false);
  const [editing, setEditing] = useState(false);
  const [next, setNext] = useState<"open" | "closed" | null>(null);
  const status = useAction(useServerFn(setCycleStatus), {
    invalidate: [qk.perf.all],
    success: "Cycle status updated",
    onSuccess: () => setNext(null),
  });

  if (cycles.isLoading) return <LoadingRows />;
  if (!cycle) return <EmptyState title="Cycle not found" />;
  const counts = (a.data ?? []).reduce<Record<string, number>>(
    (m, x) => ({ ...m, [x.status]: (m[x.status] ?? 0) + 1 }),
    {},
  );
  return (
    <div>
      <PageHeader
        eyebrow="Evaluation cycle"
        title={cycle.name}
        description={`${fmtDate(cycle.period_start)} – ${fmtDate(cycle.period_end)} · due ${fmtDate(cycle.due_date)}`}
        actions={
          <>
            <StatusBadge status={cycle.status} />
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil /> Edit
            </Button>
            {cycle.status !== "open" && (
              <Button variant="outline" onClick={() => setNext("open")}>
                Open cycle
              </Button>
            )}
            {cycle.status === "open" && (
              <Button variant="outline" onClick={() => setNext("closed")}>
                Close cycle
              </Button>
            )}
            <Button onClick={() => setAssigning(true)} disabled={cycle.status === "closed"}>
              <UserPlus /> Assign employees
            </Button>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {Object.entries(counts).map(([s, n]) => (
          <span key={s} className="inline-flex items-center gap-1">
            <StatusBadge status={s} /> <span className="font-data text-sm">{n}</span>
          </span>
        ))}
      </div>
      <AssignmentsTable
        rows={a.data}
        loading={a.isLoading}
        error={a.error}
        onRetry={() => a.refetch()}
        emptyTitle="No assignments yet"
        emptyText="Assign employees to this cycle. Each needs a current supervisor and an active profile for their position."
      />
      {assigning && (
        <AssignDialog
          cycleId={id}
          existing={new Set((a.data ?? []).map((x) => x.employee_id))}
          onClose={() => setAssigning(false)}
        />
      )}
      {editing && <CycleDialog cycle={cycle} onClose={() => setEditing(false)} />}
      <ConfirmDialog
        open={!!next}
        onOpenChange={(o) => !o && setNext(null)}
        title={next === "open" ? "Open this cycle?" : "Close this cycle?"}
        description={
          next === "closed"
            ? "No new assignments can be added once closed."
            : "Evaluators can start working once the cycle is open."
        }
        pending={status.isPending}
        onConfirm={() => next && status.mutate({ id, status: next })}
      />
    </div>
  );
}

function AssignDialog({
  cycleId,
  existing,
  onClose,
}: {
  cycleId: string;
  existing: Set<string>;
  onClose: () => void;
}) {
  const emps = useQuery({ queryKey: qk.org.employees(), queryFn: fetchEmployees });
  const active = useQuery({
    queryKey: [...qk.perf.profiles(), "active-positions"],
    queryFn: async () =>
      new Set(
        (
          check(
            await supabase
              .from("evaluation_profile_versions")
              .select("position_id")
              .eq("status", "active"),
          ) as { position_id: string }[]
        ).map((r) => r.position_id),
      ),
  });
  const [sel, setSel] = useState<Set<string>>(new Set());
  const create = useAction(useServerFn(createAssignments), {
    idempotent: true,
    invalidate: [qk.perf.all],
    onSuccess: (r) => {
      toast.success(`${r.created} assignment(s) created`);
      if (r.skipped.length)
        toast.warning(`${r.skipped.length} skipped`, {
          description: r.skipped
            .map(
              (s: { employee_id: string; reason: string }) =>
                `${empName(emps.data?.find((e) => e.id === s.employee_id))}: ${s.reason}`,
            )
            .join("; "),
        });
      onClose();
    },
  });
  const list = (emps.data ?? []).filter(
    (e) => e.employment_status === "active" && !existing.has(e.id),
  );
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Assign employees</DialogTitle>
        </DialogHeader>
        <Panel className="max-h-[50vh] overflow-y-auto p-0">
          {list.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              Everyone eligible is already assigned.
            </p>
          ) : (
            <ul className="divide-y">
              <li className="flex items-center gap-2 p-3">
                <Checkbox
                  id="all"
                  checked={sel.size === list.length}
                  onCheckedChange={(c) => setSel(c ? new Set(list.map((e) => e.id)) : new Set())}
                />
                <label htmlFor="all" className="text-sm font-bold">
                  Select all ({list.length})
                </label>
              </li>
              {list.map((e) => (
                <li key={e.id} className="flex items-center gap-2 p-3">
                  <Checkbox
                    id={e.id}
                    checked={sel.has(e.id)}
                    onCheckedChange={(c) => {
                      const n = new Set(sel);
                      if (c) n.add(e.id);
                      else n.delete(e.id);
                      setSel(n);
                    }}
                  />
                  <label htmlFor={e.id} className="flex-1 text-sm">
                    <span className="font-bold">{empName(e)}</span>{" "}
                    <span className="text-muted-foreground">· {e.position?.title}</span>
                  </label>
                  {!active.data?.has(e.position_id) && (
                    <span className="font-data text-xs text-warning">No active profile</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!sel.size || create.isPending}
            onClick={() => create.mutate({ cycle_id: cycleId, employee_ids: [...sel] })}
          >
            Assign {sel.size || ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
