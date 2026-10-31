import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { fetchCategories, fetchLevels } from "@/lib/data";
import { saveCategory, saveCompetency } from "@/lib/api/actions.functions";
import { competencyFields } from "@/lib/schemas";
import { useAction } from "@/hooks/use-action";
import { qk } from "@/lib/query-keys";
import { Field, NativeSelect } from "./kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

type Comp = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  definition: string | null;
  category_id: string;
  status: string;
  is_mandatory: boolean;
  is_safety_critical: boolean;
  version: number;
};

export function CompetencyDialog({
  competency,
  indicators = [],
  onClose,
}: {
  competency: Comp | null;
  indicators?: { level: number; indicator: string }[];
  onClose: () => void;
}) {
  const cats = useQuery({ queryKey: [...qk.comp.all, "categories"], queryFn: fetchCategories });
  const levels = useQuery({ queryKey: qk.comp.levels(), queryFn: fetchLevels });
  const [f, setF] = useState({
    code: competency?.code ?? "",
    name: competency?.name ?? "",
    description: competency?.description ?? "",
    definition: competency?.definition ?? "",
    category_id: competency?.category_id ?? "",
    status: (competency?.status ?? "draft") as "draft" | "active" | "retired",
    is_mandatory: competency?.is_mandatory ?? false,
    is_safety_critical: competency?.is_safety_critical ?? false,
    indicators,
  });
  const [newCat, setNewCat] = useState("");
  const save = useAction(useServerFn(saveCompetency), {
    invalidate: [qk.comp.all],
    success: "Competency saved",
    onSuccess: onClose,
  });
  const addCat = useAction(useServerFn(saveCategory), {
    invalidate: [qk.comp.all],
    success: "Category added",
    onSuccess: (c) => {
      setF((x) => ({ ...x, category_id: (c as { id: string }).id }));
      setNewCat("");
    },
  });
  const submit = () => {
    const p = competencyFields.safeParse(f);
    if (!p.success) {
      toast.error(`${p.error.issues[0]?.path.join(".")}: ${p.error.issues[0]?.message}`);
      return;
    }
    save.mutate({ id: competency?.id ?? null, version: competency?.version ?? null, data: p.data });
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{competency ? "Edit competency" : "New competency"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Code" htmlFor="cc" required>
            <Input
              id="cc"
              value={f.code}
              maxLength={20}
              onChange={(e) => setF({ ...f, code: e.target.value })}
            />
          </Field>
          <Field label="Name" htmlFor="cn" required>
            <Input
              id="cn"
              value={f.name}
              maxLength={120}
              onChange={(e) => setF({ ...f, name: e.target.value })}
            />
          </Field>
          <Field label="Category" htmlFor="cat" required>
            <NativeSelect
              id="cat"
              value={f.category_id}
              onChange={(e) => setF({ ...f, category_id: e.target.value })}
            >
              <option value="">Select…</option>
              {cats.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Field label="Or add a category" htmlFor="nc">
                <Input
                  id="nc"
                  value={newCat}
                  maxLength={80}
                  onChange={(e) => setNewCat(e.target.value)}
                />
              </Field>
            </div>
            <Button
              variant="outline"
              disabled={newCat.trim().length < 2 || addCat.isPending}
              onClick={() => addCat.mutate({ id: null, name: newCat })}
            >
              Add
            </Button>
          </div>
          <Field label="Status" htmlFor="cs">
            <NativeSelect
              id="cs"
              value={f.status}
              onChange={(e) => setF({ ...f, status: e.target.value as typeof f.status })}
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="retired">Retired</option>
            </NativeSelect>
          </Field>
          <div className="flex items-center gap-4 pt-6">
            <label className="flex items-center gap-2 text-sm font-bold">
              <Checkbox
                checked={f.is_mandatory}
                onCheckedChange={(c) => setF({ ...f, is_mandatory: c === true })}
              />{" "}
              Mandatory
            </label>
            <label className="flex items-center gap-2 text-sm font-bold">
              <Checkbox
                checked={f.is_safety_critical}
                onCheckedChange={(c) => setF({ ...f, is_safety_critical: c === true })}
              />{" "}
              Safety-critical
            </label>
          </div>
          <div className="sm:col-span-2">
            <Field label="Description" htmlFor="cd">
              <Textarea
                id="cd"
                value={f.description}
                maxLength={2000}
                onChange={(e) => setF({ ...f, description: e.target.value })}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Definition" htmlFor="cdf">
              <Textarea
                id="cdf"
                value={f.definition}
                maxLength={4000}
                onChange={(e) => setF({ ...f, definition: e.target.value })}
              />
            </Field>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <p className="font-data text-sm font-semibold">Behavioral indicators per level</p>
            {f.indicators.map((ind, i) => (
              <div key={i} className="flex gap-2">
                <NativeSelect
                  aria-label="Level"
                  className="w-44"
                  value={ind.level}
                  onChange={(e) => {
                    const n = [...f.indicators];
                    n[i] = { ...ind, level: Number(e.target.value) };
                    setF({ ...f, indicators: n });
                  }}
                >
                  {(levels.data ?? []).map((l) => (
                    <option key={l.level} value={l.level}>
                      {l.level} – {l.label}
                    </option>
                  ))}
                </NativeSelect>
                <Input
                  aria-label="Indicator"
                  value={ind.indicator}
                  maxLength={1000}
                  onChange={(e) => {
                    const n = [...f.indicators];
                    n[i] = { ...ind, indicator: e.target.value };
                    setF({ ...f, indicators: n });
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remove indicator"
                  onClick={() => setF({ ...f, indicators: f.indicators.filter((_, j) => j !== i) })}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setF({ ...f, indicators: [...f.indicators, { level: 3, indicator: "" }] })
              }
            >
              <Plus /> Add indicator
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={save.isPending} onClick={submit}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
