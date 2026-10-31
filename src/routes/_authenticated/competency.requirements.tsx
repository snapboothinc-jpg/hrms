import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  check,
  fetchCompetencies,
  fetchPositions,
  fetchRequirements,
  fetchLevels,
} from "@/lib/data";
import { setRequirement } from "@/lib/api/actions.functions";
import { useAction } from "@/hooks/use-action";
import { usePermissions } from "@/hooks/use-me";
import { qk } from "@/lib/query-keys";
import {
  PageHeader,
  Panel,
  EmptyState,
  LoadingRows,
  NativeSelect,
  Field,
  ConfirmDialog,
  SafetyTags,
  fmtDate,
} from "@/components/app/kit";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/competency/requirements")({
  head: () => ({
    meta: [
      { title: "Job competency requirements — Priority Handling Logistics, Inc." },
      { name: "description", content: "Required competency levels per position." },
    ],
  }),
  component: Page,
});

function Page() {
  const { has } = usePermissions();
  const canEdit = has("comp.manage");
  const positions = useQuery({ queryKey: qk.org.positions(), queryFn: fetchPositions });
  const [pos, setPos] = useState("");
  useEffect(() => {
    if (!pos && positions.data?.[0]) setPos(positions.data[0].id);
  }, [positions.data, pos]);
  const req = useQuery({
    queryKey: qk.comp.requirements(pos),
    enabled: !!pos,
    queryFn: () => fetchRequirements(pos),
  });
  const hist = useQuery({
    queryKey: [...qk.comp.requirements(pos), "history"],
    enabled: !!pos,
    queryFn: async () =>
      check(
        await supabase
          .from("position_competency_requirements")
          .select(
            "id, required_level, effective_from, effective_to, change_reason, competency:competencies(name)",
          )
          .eq("position_id", pos)
          .eq("is_current", false)
          .order("effective_to", { ascending: false })
          .limit(50),
      ) as unknown as {
        id: string;
        required_level: number;
        effective_from: string;
        effective_to: string | null;
        change_reason: string | null;
        competency: { name: string } | null;
      }[],
  });
  const comps = useQuery({ queryKey: qk.comp.library(), queryFn: fetchCompetencies });
  const levels = useQuery({ queryKey: qk.comp.levels(), queryFn: fetchLevels });
  const save = useAction(useServerFn(setRequirement), {
    invalidate: [qk.comp.all],
    success: "Requirement saved (previous version kept in history)",
  });
  const [add, setAdd] = useState({
    competency_id: "",
    required_level: 3,
    is_mandatory: false,
    is_safety_critical: false,
    reason: "",
  });
  const [remove, setRemove] = useState<string | null>(null);
  const used = new Set((req.data ?? []).map((r) => r.competency_id));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Job competency requirements"
        description="Changes are versioned: the previous requirement is closed with an end date and kept in history."
      />
      <div className="max-w-sm">
        <Field label="Position" htmlFor="pos">
          <NativeSelect id="pos" value={pos} onChange={(e) => setPos(e.target.value)}>
            {positions.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      {!positions.data?.length ? (
        <EmptyState title="No positions" description="Create positions first." />
      ) : req.isLoading ? (
        <LoadingRows />
      ) : (
        <Panel title="Current requirements">
          {!req.data?.length ? (
            <p className="mb-3 text-sm text-muted-foreground">
              No requirements for this position yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="font-data">
                <TableHeader>
                  <TableRow>
                    <TableHead>Competency</TableHead>
                    <TableHead>Required level</TableHead>
                    <TableHead>Mandatory</TableHead>
                    <TableHead>Safety-critical</TableHead>
                    <TableHead>Effective</TableHead>
                    {canEdit && <TableHead />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {req.data.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-bold">{r.competency?.name}</TableCell>
                      <TableCell>
                        {canEdit ? (
                          <NativeSelect
                            aria-label={`Required level for ${r.competency?.name}`}
                            className="w-40"
                            value={r.required_level}
                            onChange={(e) =>
                              save.mutate({
                                position_id: pos,
                                competency_id: r.competency_id,
                                required_level: Number(e.target.value),
                                is_mandatory: r.is_mandatory,
                                is_safety_critical: r.is_safety_critical,
                                reason: "Level changed",
                                remove: false,
                              })
                            }
                          >
                            {levels.data?.map((l) => (
                              <option key={l.level} value={l.level}>
                                {l.level} – {l.label}
                              </option>
                            ))}
                          </NativeSelect>
                        ) : (
                          r.required_level
                        )}
                      </TableCell>
                      <TableCell>
                        <Checkbox
                          aria-label="Mandatory"
                          checked={r.is_mandatory}
                          disabled={!canEdit}
                          onCheckedChange={(c) =>
                            save.mutate({
                              position_id: pos,
                              competency_id: r.competency_id,
                              required_level: r.required_level,
                              is_mandatory: c === true,
                              is_safety_critical: r.is_safety_critical,
                              reason: "Mandatory flag changed",
                              remove: false,
                            })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Checkbox
                          aria-label="Safety-critical"
                          checked={r.is_safety_critical}
                          disabled={!canEdit}
                          onCheckedChange={(c) =>
                            save.mutate({
                              position_id: pos,
                              competency_id: r.competency_id,
                              required_level: r.required_level,
                              is_mandatory: r.is_mandatory,
                              is_safety_critical: c === true,
                              reason: "Safety flag changed",
                              remove: false,
                            })
                          }
                        />
                      </TableCell>
                      <TableCell>{fmtDate(r.effective_from)}</TableCell>
                      {canEdit && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Remove requirement"
                            onClick={() => setRemove(r.competency_id)}
                          >
                            <Trash2 />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {canEdit && (
            <div className="mt-4 grid items-end gap-3 border-t pt-4 md:grid-cols-[1fr_10rem_auto_auto_1fr_auto]">
              <Field label="Add competency" htmlFor="ac">
                <NativeSelect
                  id="ac"
                  value={add.competency_id}
                  onChange={(e) => setAdd({ ...add, competency_id: e.target.value })}
                >
                  <option value="">Select…</option>
                  {comps.data
                    ?.filter((c) => c.status === "active" && !used.has(c.id))
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </NativeSelect>
              </Field>
              <Field label="Level" htmlFor="al">
                <NativeSelect
                  id="al"
                  value={add.required_level}
                  onChange={(e) => setAdd({ ...add, required_level: Number(e.target.value) })}
                >
                  {[1, 2, 3, 4, 5].map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </NativeSelect>
              </Field>
              <label className="flex items-center gap-2 pb-2 text-sm">
                <Checkbox
                  checked={add.is_mandatory}
                  onCheckedChange={(c) => setAdd({ ...add, is_mandatory: c === true })}
                />{" "}
                Mandatory
              </label>
              <label className="flex items-center gap-2 pb-2 text-sm">
                <Checkbox
                  checked={add.is_safety_critical}
                  onCheckedChange={(c) => setAdd({ ...add, is_safety_critical: c === true })}
                />{" "}
                Safety-critical
              </label>
              <Field label="Reason" htmlFor="ar">
                <Input
                  id="ar"
                  value={add.reason}
                  maxLength={1000}
                  onChange={(e) => setAdd({ ...add, reason: e.target.value })}
                />
              </Field>
              <Button
                disabled={!add.competency_id || save.isPending}
                onClick={() => {
                  save.mutate({ position_id: pos, ...add, remove: false });
                  setAdd({
                    competency_id: "",
                    required_level: 3,
                    is_mandatory: false,
                    is_safety_critical: false,
                    reason: "",
                  });
                }}
              >
                <Plus /> Add
              </Button>
            </div>
          )}
        </Panel>
      )}
      {!!hist.data?.length && (
        <Panel title="Requirement history">
          <ul className="divide-y font-data text-sm">
            {hist.data.map((h) => (
              <li key={h.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span className="font-bold">
                  {h.competency?.name} · level {h.required_level}
                </span>
                <span className="text-muted-foreground">
                  {fmtDate(h.effective_from)} – {fmtDate(h.effective_to)}{" "}
                  {h.change_reason && `· replaced: ${h.change_reason}`}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      <ConfirmDialog
        open={!!remove}
        onOpenChange={(o) => !o && setRemove(null)}
        title="Remove requirement?"
        description="It will be closed with today's date and kept in history."
        destructive
        confirmLabel="Remove"
        pending={save.isPending}
        onConfirm={() => {
          if (remove)
            save.mutate({
              position_id: pos,
              competency_id: remove,
              required_level: 1,
              is_mandatory: false,
              is_safety_critical: false,
              reason: "Removed",
              remove: true,
            });
          setRemove(null);
        }}
      />
      <SafetyTags />
    </div>
  );
}
