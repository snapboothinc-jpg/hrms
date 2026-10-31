import { createFileRoute, useBlocker } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, CheckCircle2, CopyPlus, Plus, Save, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { check, fetchCompetencies } from "@/lib/data";
import {
  activateProfileVersion,
  newProfileVersion,
  saveProfileVersion,
} from "@/lib/api/actions.functions";
import { profileContentSchema, itemTypes, ITEM_TYPE_LABELS } from "@/lib/schemas";
import { canActivateProfile, weightTotal } from "@/lib/rules";
import { useAction } from "@/hooks/use-action";
import { qk } from "@/lib/query-keys";
import {
  PageHeader,
  Panel,
  StatusBadge,
  ConfirmDialog,
  LoadingRows,
  EmptyState,
  Field,
  NativeSelect,
  fmtDate,
  Tag,
} from "@/components/app/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/performance/profiles/$id")({
  head: () => ({
    meta: [
      { title: "Profile builder — Priority Handling Logistics, Inc." },
      { name: "description", content: "Build and version an evaluation profile." },
    ],
  }),
  component: Page,
});

type Item = {
  label: string;
  help_text?: string;
  item_type: (typeof itemTypes)[number];
  weight: number;
  options: string[];
  kpi_target?: number | "" | null;
  kpi_unit?: string;
  competency_id?: string | null;
  evidence_required: boolean;
  is_required: boolean;
};
type Section = { title: string; description?: string; items: Item[] };
type Version = {
  id: string;
  version_number: number;
  status: string;
  effective_date: string | null;
  rating_scale_max: number;
  instructions: string | null;
  version: number;
  activated_at: string | null;
};

function Page() {
  const { id } = Route.useParams();
  const profile = useQuery({
    queryKey: qk.perf.profile(id),
    queryFn: async () => {
      const p = check(
        await supabase
          .from("evaluation_profiles")
          .select("*, position:positions(title)")
          .eq("id", id)
          .maybeSingle(),
      ) as {
        id: string;
        name: string;
        description: string | null;
        position: { title: string } | null;
      } | null;
      const versions = check(
        await supabase
          .from("evaluation_profile_versions")
          .select("*")
          .eq("profile_id", id)
          .order("version_number", { ascending: false }),
      ) as Version[];
      return { p, versions };
    },
  });
  const [selected, setSelected] = useState<string | null>(null);
  const versions = profile.data?.versions ?? [];
  const current =
    versions.find((v) => v.id === selected) ??
    versions.find((v) => v.status === "draft") ??
    versions[0];
  const newVer = useAction(useServerFn(newProfileVersion), {
    invalidate: [qk.perf.all],
    success: "New draft version created",
    onSuccess: (v) => setSelected((v as { id: string }).id),
  });

  if (profile.isLoading) return <LoadingRows />;
  if (!profile.data?.p) return <EmptyState title="Profile not found" />;
  return (
    <div>
      <PageHeader
        eyebrow={profile.data.p.position?.title}
        title={profile.data.p.name}
        description={profile.data.p.description ?? undefined}
        actions={
          !versions.some((v) => v.status === "draft") && (
            <Button
              variant="outline"
              disabled={newVer.isPending}
              onClick={() => newVer.mutate({ profile_id: id })}
            >
              <CopyPlus /> New version from latest
            </Button>
          )
        }
      />
      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Versions">
        {versions.map((v) => (
          <button
            key={v.id}
            role="tab"
            aria-selected={current?.id === v.id}
            onClick={() => setSelected(v.id)}
            className={cn(
              "flex items-center gap-2 rounded-md border px-3 py-1.5 font-data text-sm",
              current?.id === v.id
                ? "border-primary bg-secondary font-bold"
                : "bg-card hover:bg-accent",
            )}
          >
            v{v.version_number} <StatusBadge status={v.status} />
          </button>
        ))}
      </div>
      {current && <VersionEditor key={current.id + current.version} version={current} />}
    </div>
  );
}

function VersionEditor({ version }: { version: Version }) {
  const editable = version.status === "draft";
  const content = useQuery({
    queryKey: [...qk.perf.all, "version-content", version.id, version.version],
    queryFn: async () => {
      const secs = check(
        await supabase
          .from("evaluation_sections")
          .select("*")
          .eq("version_id", version.id)
          .order("sort_order"),
      ) as { id: string; title: string; description: string | null }[];
      const items = check(
        await supabase
          .from("evaluation_items")
          .select("*")
          .eq("version_id", version.id)
          .order("sort_order"),
      ) as (Item & { section_id: string; options: string[] })[];
      return secs.map((s) => ({
        title: s.title,
        description: s.description ?? "",
        items: items
          .filter((i) => i.section_id === s.id)
          .map((i) => ({
            label: i.label,
            help_text: i.help_text ?? "",
            item_type: i.item_type,
            weight: Number(i.weight),
            options: i.options ?? [],
            kpi_target: i.kpi_target ?? "",
            kpi_unit: i.kpi_unit ?? "",
            competency_id: i.competency_id ?? "",
            evidence_required: i.evidence_required,
            is_required: i.is_required,
          })),
      })) as Section[];
    },
  });
  const comps = useQuery({ queryKey: qk.comp.library(), queryFn: fetchCompetencies });
  const [sections, setSections] = useState<Section[] | null>(null);
  const [meta, setMeta] = useState({
    rating_scale_max: version.rating_scale_max,
    instructions: version.instructions ?? "",
    effective_date: version.effective_date ?? "",
  });
  const [dirty, setDirty] = useState(false);
  const [confirmActivate, setConfirmActivate] = useState(false);
  useEffect(() => {
    if (content.data && !sections) setSections(content.data);
  }, [content.data, sections]);
  useBlocker({
    shouldBlockFn: () => dirty && !window.confirm("You have unsaved changes. Leave anyway?"),
    enableBeforeUnload: () => dirty,
  });

  const all = useMemo(() => (sections ?? []).flatMap((s) => s.items), [sections]);
  const total = weightTotal(all);
  const save = useAction(useServerFn(saveProfileVersion), {
    invalidate: [qk.perf.all],
    success: "Draft saved",
    onSuccess: () => setDirty(false),
  });
  const activate = useAction(useServerFn(activateProfileVersion), {
    invalidate: [qk.perf.all],
    success: "Version activated. The previous active version was archived.",
    onSuccess: () => setConfirmActivate(false),
  });

  const update = (fn: (s: Section[]) => Section[]) => {
    setSections((s) => fn(structuredClone(s ?? [])));
    setDirty(true);
  };
  const doSave = () => {
    const body = { ...meta, sections: sections ?? [] };
    const parsed = profileContentSchema.safeParse(body);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the profile items");
      return;
    }
    save.mutate({ version_id: version.id, version: version.version, content: parsed.data });
  };

  if (content.isLoading || !sections) return <LoadingRows />;
  const act = canActivateProfile(all);
  return (
    <div className="space-y-4">
      <Panel>
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Rating scale maximum" htmlFor="rs">
            <Input id="rs" value="5" readOnly aria-readonly="true" />
          </Field>
          <Field label="Effective date" htmlFor="ed">
            <Input
              id="ed"
              type="date"
              value={meta.effective_date}
              disabled={!editable}
              onChange={(e) => {
                setMeta({ ...meta, effective_date: e.target.value });
                setDirty(true);
              }}
            />
          </Field>
          <div className="md:col-span-2">
            <p className="font-data text-sm font-semibold">Weight total</p>
            <p
              className={cn(
                "font-data text-2xl font-bold",
                total === 100 ? "text-success" : "text-destructive",
              )}
              aria-live="polite"
            >
              {total}%{" "}
              {total === 100 ? (
                <CheckCircle2 className="inline size-5" aria-label="valid" />
              ) : (
                <span className="text-sm">(must be 100%)</span>
              )}
            </p>
          </div>
          <div className="md:col-span-4">
            <Field label="Instructions" htmlFor="in">
              <Textarea
                id="in"
                value={meta.instructions}
                disabled={!editable}
                onChange={(e) => {
                  setMeta({ ...meta, instructions: e.target.value });
                  setDirty(true);
                }}
              />
            </Field>
          </div>
        </div>
        {!editable && (
          <p className="mt-3 text-sm text-muted-foreground">
            This version is {version.status}
            {version.activated_at ? ` (activated ${fmtDate(version.activated_at)})` : ""} and cannot
            be edited. Create a new version to make changes; existing evaluations keep the version
            they were created with.
          </p>
        )}
      </Panel>

      {sections.map((s, si) => (
        <Panel key={si}>
          <div className="mb-3 flex flex-wrap items-end gap-2">
            <div className="min-w-48 flex-1">
              <Field label={`Section ${si + 1} title`} htmlFor={`st${si}`}>
                <Input
                  id={`st${si}`}
                  value={s.title}
                  disabled={!editable}
                  onChange={(e) =>
                    update((x) => {
                      x[si].title = e.target.value;
                      return x;
                    })
                  }
                />
              </Field>
            </div>
            {editable && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remove section"
                onClick={() => update((x) => x.filter((_, i) => i !== si))}
              >
                <Trash2 />
              </Button>
            )}
          </div>
          <div className="space-y-3">
            {s.items.map((it, ii) => (
              <div key={ii} className="rounded-md border bg-background p-3">
                <div className="grid gap-3 md:grid-cols-12">
                  <div className="md:col-span-5">
                    <Field label="Item" htmlFor={`l${si}-${ii}`}>
                      <Input
                        id={`l${si}-${ii}`}
                        value={it.label}
                        disabled={!editable}
                        onChange={(e) =>
                          update((x) => {
                            x[si].items[ii].label = e.target.value;
                            return x;
                          })
                        }
                      />
                    </Field>
                  </div>
                  <div className="md:col-span-3">
                    <Field label="Type" htmlFor={`t${si}-${ii}`}>
                      <NativeSelect
                        id={`t${si}-${ii}`}
                        value={it.item_type}
                        disabled={!editable}
                        onChange={(e) =>
                          update((x) => {
                            const t = e.target.value as Item["item_type"];
                            x[si].items[ii].item_type = t;
                            if (!["rating", "kpi"].includes(t)) x[si].items[ii].weight = 0;
                            return x;
                          })
                        }
                      >
                        {itemTypes.map((t) => (
                          <option key={t} value={t}>
                            {ITEM_TYPE_LABELS[t]}
                          </option>
                        ))}
                      </NativeSelect>
                    </Field>
                  </div>
                  <div className="md:col-span-2">
                    <Field label="Weight %" htmlFor={`w${si}-${ii}`}>
                      <Input
                        id={`w${si}-${ii}`}
                        type="number"
                        min={0}
                        max={100}
                        value={it.weight}
                        disabled={!editable || !["rating", "kpi"].includes(it.item_type)}
                        onChange={(e) =>
                          update((x) => {
                            x[si].items[ii].weight = Number(e.target.value);
                            return x;
                          })
                        }
                      />
                    </Field>
                  </div>
                  <div className="flex items-end justify-end gap-1 md:col-span-2">
                    {editable && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Move up"
                          disabled={ii === 0}
                          onClick={() =>
                            update((x) => {
                              const a = x[si].items;
                              [a[ii - 1], a[ii]] = [a[ii], a[ii - 1]];
                              return x;
                            })
                          }
                        >
                          <ArrowUp />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Move down"
                          disabled={ii === s.items.length - 1}
                          onClick={() =>
                            update((x) => {
                              const a = x[si].items;
                              [a[ii + 1], a[ii]] = [a[ii], a[ii + 1]];
                              return x;
                            })
                          }
                        >
                          <ArrowDown />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Remove item"
                          onClick={() =>
                            update((x) => {
                              x[si].items.splice(ii, 1);
                              return x;
                            })
                          }
                        >
                          <Trash2 />
                        </Button>
                      </>
                    )}
                  </div>
                  {it.item_type === "kpi" && (
                    <>
                      <div className="md:col-span-3">
                        <Field label="KPI target" htmlFor={`k${si}-${ii}`}>
                          <Input
                            id={`k${si}-${ii}`}
                            type="number"
                            value={it.kpi_target ?? ""}
                            disabled={!editable}
                            onChange={(e) =>
                              update((x) => {
                                x[si].items[ii].kpi_target =
                                  e.target.value === "" ? "" : Number(e.target.value);
                                return x;
                              })
                            }
                          />
                        </Field>
                      </div>
                      <div className="md:col-span-2">
                        <Field label="Unit" htmlFor={`u${si}-${ii}`}>
                          <Input
                            id={`u${si}-${ii}`}
                            value={it.kpi_unit ?? ""}
                            disabled={!editable}
                            onChange={(e) =>
                              update((x) => {
                                x[si].items[ii].kpi_unit = e.target.value;
                                return x;
                              })
                            }
                          />
                        </Field>
                      </div>
                    </>
                  )}
                  {["single_choice", "multi_choice"].includes(it.item_type) && (
                    <div className="md:col-span-5">
                      <Field label="Options (comma separated)" htmlFor={`o${si}-${ii}`}>
                        <Input
                          id={`o${si}-${ii}`}
                          value={it.options.join(", ")}
                          disabled={!editable}
                          onChange={(e) =>
                            update((x) => {
                              x[si].items[ii].options = e.target.value
                                .split(",")
                                .map((o) => o.trim())
                                .filter(Boolean);
                              return x;
                            })
                          }
                        />
                      </Field>
                    </div>
                  )}
                  <div className="md:col-span-4">
                    <Field label="Linked competency" htmlFor={`c${si}-${ii}`}>
                      <NativeSelect
                        id={`c${si}-${ii}`}
                        value={it.competency_id ?? ""}
                        disabled={!editable}
                        onChange={(e) =>
                          update((x) => {
                            x[si].items[ii].competency_id = e.target.value;
                            return x;
                          })
                        }
                      >
                        <option value="">None</option>
                        {comps.data
                          ?.filter((c) => c.status === "active")
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                      </NativeSelect>
                    </Field>
                  </div>
                  <div className="flex items-center gap-4 md:col-span-12">
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={it.is_required}
                        disabled={!editable}
                        onCheckedChange={(c) =>
                          update((x) => {
                            x[si].items[ii].is_required = c === true;
                            return x;
                          })
                        }
                      />{" "}
                      Required
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={it.evidence_required}
                        disabled={!editable}
                        onCheckedChange={(c) =>
                          update((x) => {
                            x[si].items[ii].evidence_required = c === true;
                            return x;
                          })
                        }
                      />{" "}
                      Evidence expected
                    </label>
                  </div>
                </div>
              </div>
            ))}
            {editable && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  update((x) => {
                    x[si].items.push({
                      label: "",
                      item_type: "rating",
                      weight: 0,
                      options: [],
                      evidence_required: false,
                      is_required: true,
                      competency_id: "",
                      kpi_target: "",
                      kpi_unit: "",
                      help_text: "",
                    });
                    return x;
                  })
                }
              >
                <Plus /> Add item
              </Button>
            )}
          </div>
        </Panel>
      ))}
      {editable && (
        <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-2 border-t bg-background/95 py-3 backdrop-blur">
          <Button
            variant="outline"
            onClick={() =>
              update((x) => [...x, { title: "New section", description: "", items: [] }])
            }
          >
            <Plus /> Add section
          </Button>
          <div className="flex-1" />
          {dirty && <Tag tone="warning">Unsaved changes</Tag>}
          <Button variant="outline" disabled={!dirty || save.isPending} onClick={doSave}>
            <Save /> Save draft
          </Button>
          <Button
            disabled={dirty || !act.ok || activate.isPending}
            title={dirty ? "Save first" : act.reason}
            onClick={() => setConfirmActivate(true)}
          >
            <CheckCircle2 /> Activate
          </Button>
        </div>
      )}
      {editable && !act.ok && (
        <p className="text-sm text-destructive" role="status">
          {act.reason}
        </p>
      )}
      <ConfirmDialog
        open={confirmActivate}
        onOpenChange={setConfirmActivate}
        title={`Activate v${version.version_number}?`}
        description="The current active version for this position will be archived for new evaluations. Existing evaluations keep their version."
        confirmLabel="Activate"
        pending={activate.isPending}
        onConfirm={() => activate.mutate({ version_id: version.id })}
      />
    </div>
  );
}
