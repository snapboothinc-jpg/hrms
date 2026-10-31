import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  fetchLearningPaths,
  fetchPathCourses,
  fetchCourses,
  fetchCompetencies,
  type PathRow,
} from "@/lib/data";
import { saveLearningPath, setPathCourses } from "@/lib/api/development.functions";
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

export const Route = createFileRoute("/_authenticated/learning/paths")({
  head: () => ({
    meta: [
      { title: "Learning paths — Priority Handling Logistics, Inc." },
      { name: "description", content: "Ordered course collections tied to competencies." },
    ],
  }),
  component: Page,
});

function Page() {
  const { any } = usePermissions();
  const qc = useQueryClient();
  const paths = useQuery({ queryKey: qk.learn.paths(), queryFn: fetchLearningPaths });
  const competencies = useQuery({ queryKey: qk.comp.library(), queryFn: fetchCompetencies });
  const courses = useQuery({ queryKey: qk.learn.courses(), queryFn: () => fetchCourses() });
  const save = useServerFn(saveLearningPath);
  const saveCourses = useServerFn(setPathCourses);

  const [editing, setEditing] = useState<PathRow | "new" | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    competency_id: "",
    status: "draft" as string,
  });
  const [coursesFor, setCoursesFor] = useState<PathRow | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  if (paths.error) return <ErrorState error={paths.error} onRetry={() => paths.refetch()} />;
  if (!paths.data) return <LoadingRows />;

  const canEdit = any("learn.manage");

  const openEdit = (p: PathRow | "new") => {
    setEditing(p);
    setForm(
      p === "new"
        ? { title: "", description: "", competency_id: "", status: "draft" }
        : {
            title: p.title,
            description: p.description ?? "",
            competency_id: p.competency_id ?? "",
            status: p.status,
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
              title: form.title,
              description: form.description || undefined,
              competency_id: form.competency_id || undefined,
              status: form.status as "draft" | "active" | "archived",
            },
          },
        }),
      );
      toast.success("Path saved");
      setEditing(null);
      qc.invalidateQueries({ queryKey: qk.learn.all });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not save the path");
    } finally {
      setBusy(false);
    }
  };

  const openCourses = async (p: PathRow) => {
    setCoursesFor(p);
    try {
      const rows = await fetchPathCourses(p.id);
      setSelected(rows.map((r) => r.course_id));
    } catch {
      setSelected([]);
    }
  };

  const doSaveCourses = async () => {
    if (!coursesFor) return;
    setBusy(true);
    try {
      unwrap(await saveCourses({ data: { path_id: coursesFor.id, course_ids: selected } }));
      toast.success("Path courses saved");
      setCoursesFor(null);
      qc.invalidateQueries({ queryKey: qk.learn.all });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not save courses");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Learning paths"
        description="Ordered collections of courses tied to a competency. Paths can be linked to gaps and development plans."
        actions={
          canEdit ? (
            <Button onClick={() => openEdit("new")}>
              <Plus className="size-4" aria-hidden /> New path
            </Button>
          ) : undefined
        }
      />
      {paths.data.length === 0 ? (
        <EmptyState
          title="No learning paths"
          description="Create a path to sequence courses for a competency."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {paths.data.map((p) => (
            <Panel key={p.id} className="flex flex-col">
              <div className="mb-1 flex items-start justify-between gap-2">
                <h2 className="text-heading font-bold">{p.title}</h2>
                <StatusBadge status={p.status} />
              </div>
              <p className="flex-1 text-sm text-muted-foreground">{p.description}</p>
              <div className="mt-3 flex items-center justify-between">
                {p.competency ? (
                  <Tag tone="info">{p.competency.name}</Tag>
                ) : (
                  <span className="text-xs text-muted-foreground">General</span>
                )}
                {canEdit && (
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => openCourses(p)}>
                      Courses
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                      Edit
                    </Button>
                  </div>
                )}
              </div>
            </Panel>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing === "new" ? "New learning path" : "Edit learning path"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Field label="Title" htmlFor="p-title" required>
              <Input
                id="p-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                maxLength={160}
              />
            </Field>
            <Field label="Description" htmlFor="p-desc">
              <Textarea
                id="p-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </Field>
            <Field label="Competency" htmlFor="p-comp">
              <NativeSelect
                id="p-comp"
                value={form.competency_id}
                onChange={(e) => setForm({ ...form, competency_id: e.target.value })}
              >
                <option value="">General</option>
                {(competencies.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Status" htmlFor="p-status">
              <NativeSelect
                id="p-status"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </NativeSelect>
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={doSave} disabled={busy || form.title.length < 3}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!coursesFor} onOpenChange={(o) => !o && setCoursesFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Courses in “{coursesFor?.title}”</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Selected courses run in the order shown below.
          </p>
          <div className="max-h-72 space-y-1 overflow-auto">
            {(courses.data ?? [])
              .filter((c) => c.status === "approved")
              .map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.includes(c.id)}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked ? [...selected, c.id] : selected.filter((x) => x !== c.id),
                      )
                    }
                    className="accent-primary"
                  />
                  <Link to="/learning/course/$id" params={{ id: c.id }} className="hover:underline">
                    {c.title}
                  </Link>
                </label>
              ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCoursesFor(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={doSaveCourses} disabled={busy}>
              Save courses
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
