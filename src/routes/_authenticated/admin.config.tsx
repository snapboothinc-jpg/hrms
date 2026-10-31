import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { fetchRecognitionCategories, fetchReadinessClasses } from "@/lib/data";
import { saveRecognitionCategory, saveReadinessClass } from "@/lib/api/succession.functions";
import { unwrap, ApiError } from "@/lib/api/result";
import { qk } from "@/lib/query-keys";
import {
  PageHeader,
  Panel,
  LoadingRows,
  ErrorState,
  Field,
  StatusBadge,
  DefaultNote,
} from "@/components/app/kit";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/config")({
  head: () => ({
    meta: [
      { title: "Configuration — Priority Handling Logistics, Inc." },
      { name: "description", content: "Recognition categories and succession readiness classes." },
    ],
  }),
  component: Page,
});

type Category = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  version: number;
};
type ReadinessClass = {
  id: string;
  code: string;
  label: string;
  description: string | null;
  sort_order: number;
  requires_validation: boolean;
  version: number;
};

function Page() {
  const categories = useQuery({
    queryKey: qk.rec.categories(),
    queryFn: fetchRecognitionCategories,
  });
  const classes = useQuery({ queryKey: qk.succ.classes(), queryFn: fetchReadinessClasses });

  if (categories.error)
    return <ErrorState error={categories.error} onRetry={() => categories.refetch()} />;
  if (!categories.data || !classes.data) return <LoadingRows />;

  return (
    <div>
      <PageHeader
        title="Configuration"
        description="Recognition categories and succession readiness classes."
      />
      <DefaultNote>These values are defaults that require organizational validation.</DefaultNote>
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <CategoriesPanel categories={categories.data} />
        <ReadinessPanel classes={classes.data} />
      </div>
    </div>
  );
}

function CategoriesPanel({ categories }: { categories: Category[] }) {
  const qc = useQueryClient();
  const save = useServerFn(saveRecognitionCategory);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: "", description: "", active: true });
  const [busy, setBusy] = useState(false);

  const doSave = async () => {
    setBusy(true);
    try {
      unwrap(
        await save({
          data: {
            id: editing?.id ?? null,
            version: editing?.version ?? null,
            data: {
              name: form.name,
              description: form.description || undefined,
              active: form.active,
            },
          },
        }),
      );
      toast.success("Category saved");
      setOpen(false);
      setEditing(null);
      setForm({ name: "", description: "", active: true });
      qc.invalidateQueries({ queryKey: qk.rec.categories() });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      title="Recognition categories"
      actions={
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setForm({ name: "", description: "", active: true });
            setOpen(true);
          }}
        >
          Add
        </Button>
      }
    >
      <ul className="divide-y">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-2 py-2.5">
            <div>
              <p className="text-sm font-semibold">{c.name}</p>
              {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge
                status={c.active ? "active" : "archived"}
                label={c.active ? "Active" : "Inactive"}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditing(c);
                  setForm({ name: c.name, description: c.description ?? "", active: c.active });
                  setOpen(true);
                }}
              >
                Edit
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit category" : "Add category"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Field label="Name" htmlFor="cat-name" required>
              <Input
                id="cat-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                maxLength={80}
              />
            </Field>
            <Field label="Description" htmlFor="cat-desc">
              <Textarea
                id="cat-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                maxLength={1000}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
                className="accent-primary"
              />
              Active
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={doSave} disabled={busy || form.name.trim().length < 2}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Panel>
  );
}

function ReadinessPanel({ classes }: { classes: ReadinessClass[] }) {
  const qc = useQueryClient();
  const save = useServerFn(saveReadinessClass);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ReadinessClass | null>(null);
  const [form, setForm] = useState({ code: "", label: "", description: "", sort_order: 0 });
  const [busy, setBusy] = useState(false);

  const doSave = async () => {
    setBusy(true);
    try {
      unwrap(
        await save({
          data: {
            id: editing?.id ?? null,
            version: editing?.version ?? null,
            data: {
              code: form.code,
              label: form.label,
              description: form.description || undefined,
              sort_order: form.sort_order,
            },
          },
        }),
      );
      toast.success("Readiness class saved");
      setOpen(false);
      setEditing(null);
      setForm({ code: "", label: "", description: "", sort_order: 0 });
      qc.invalidateQueries({ queryKey: qk.succ.classes() });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      title="Succession readiness classes"
      actions={
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setForm({ code: "", label: "", description: "", sort_order: classes.length });
            setOpen(true);
          }}
        >
          Add
        </Button>
      }
    >
      <ul className="divide-y">
        {classes.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-2 py-2.5">
            <div>
              <p className="text-sm font-semibold">
                {c.label}{" "}
                <span className="font-data text-xs text-muted-foreground">({c.code})</span>
              </p>
              {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditing(c);
                setForm({
                  code: c.code,
                  label: c.label,
                  description: c.description ?? "",
                  sort_order: c.sort_order,
                });
                setOpen(true);
              }}
            >
              Edit
            </Button>
          </li>
        ))}
      </ul>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit readiness class" : "Add readiness class"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Field label="Code" htmlFor="rc-code" required>
              <Input
                id="rc-code"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                maxLength={30}
              />
            </Field>
            <Field label="Label" htmlFor="rc-label" required>
              <Input
                id="rc-label"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                maxLength={80}
              />
            </Field>
            <Field label="Description" htmlFor="rc-desc">
              <Textarea
                id="rc-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                maxLength={1000}
              />
            </Field>
            <Field label="Sort order" htmlFor="rc-order">
              <Input
                id="rc-order"
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
                min={0}
                max={100}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              onClick={doSave}
              disabled={busy || !form.code.trim() || form.label.trim().length < 2}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Panel>
  );
}
