import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Send, Archive } from "lucide-react";
import { toast } from "sonner";
import {
  fetchCourses,
  fetchCompetencies,
  fetchEmployees,
  empName,
  type CourseRow,
} from "@/lib/data";
import {
  saveCourse,
  saveCourseContent,
  setCourseCompetencies,
  submitCourse,
  archiveCourse,
} from "@/lib/api/development.functions";
import { unwrap, ApiError } from "@/lib/api/result";
import { usePermissions } from "@/hooks/use-me";
import { qk } from "@/lib/query-keys";
import {
  PageHeader,
  StatusBadge,
  LoadingRows,
  ErrorState,
  ConfirmDialog,
  Field,
  NativeSelect,
  DefaultNote,
} from "@/components/app/kit";
import { DataTable } from "@/components/app/data-table";
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

export const Route = createFileRoute("/_authenticated/learning/manage")({
  head: () => ({
    meta: [
      { title: "Course management — Priority Handling Logistics, Inc." },
      { name: "description", content: "Create, edit, submit and archive courses." },
    ],
  }),
  component: Page,
});

interface CourseForm {
  code: string;
  title: string;
  description: string;
  category: string;
  objectives: string;
  duration_minutes: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  enrollment_open: boolean;
  completion_rule: "all_lessons" | "quiz_pass" | "all_lessons_and_quiz";
}
const emptyForm: CourseForm = {
  code: "",
  title: "",
  description: "",
  category: "",
  objectives: "",
  duration_minutes: "",
  difficulty: "beginner",
  enrollment_open: true,
  completion_rule: "all_lessons",
};

function Page() {
  const { any } = usePermissions();
  const qc = useQueryClient();
  const courses = useQuery({ queryKey: qk.learn.courses(), queryFn: () => fetchCourses() });
  const competencies = useQuery({ queryKey: qk.comp.library(), queryFn: fetchCompetencies });
  const employees = useQuery({ queryKey: qk.org.employees(), queryFn: fetchEmployees });
  const save = useServerFn(saveCourse);
  const saveContent = useServerFn(saveCourseContent);
  const saveMappings = useServerFn(setCourseCompetencies);
  const submit = useServerFn(submitCourse);
  const archive = useServerFn(archiveCourse);

  const [editing, setEditing] = useState<CourseRow | "new" | null>(null);
  const [form, setForm] = useState<CourseForm>(emptyForm);
  const [contentFor, setContentFor] = useState<CourseRow | null>(null);
  const [sectionsText, setSectionsText] = useState("");
  const [mappingsFor, setMappingsFor] = useState<CourseRow | null>(null);
  const [mappingRows, setMappingRows] = useState<{ competency_id: string; target_level: number }[]>(
    [],
  );
  const [confirm, setConfirm] = useState<{ kind: "submit" | "archive"; course: CourseRow } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  if (courses.error) return <ErrorState error={courses.error} onRetry={() => courses.refetch()} />;
  if (!courses.data) return <LoadingRows />;

  const canEdit = any("learn.manage");

  const openEdit = (c: CourseRow | "new") => {
    setEditing(c);
    setForm(
      c === "new"
        ? emptyForm
        : {
            code: c.code,
            title: c.title,
            description: c.description ?? "",
            category: c.category ?? "",
            objectives: c.objectives ?? "",
            duration_minutes: c.duration_minutes ? String(c.duration_minutes) : "",
            difficulty: c.difficulty as CourseForm["difficulty"],
            enrollment_open: c.enrollment_open,
            completion_rule: c.completion_rule as CourseForm["completion_rule"],
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
              ...form,
              duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : undefined,
              owner_id: undefined,
            },
          },
        }),
      );
      toast.success("Course saved");
      setEditing(null);
      qc.invalidateQueries({ queryKey: qk.learn.all });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not save the course");
    } finally {
      setBusy(false);
    }
  };

  /** Sections editor: one section per line; "Section | Lesson 1; Lesson 2" keeps the editor simple and validated server-side. */
  const doSaveContent = async () => {
    if (!contentFor) return;
    setBusy(true);
    try {
      const sections = sectionsText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [title, lessonsRaw] = line.split("|");
          return {
            title: title.trim(),
            lessons: (lessonsRaw ?? "")
              .split(";")
              .map((l) => l.trim())
              .filter(Boolean)
              .map((t) => ({ title: t })),
          };
        });
      unwrap(
        await saveContent({
          data: { course_id: contentFor.id, version: contentFor.version, sections },
        }),
      );
      toast.success("Content saved");
      setContentFor(null);
      qc.invalidateQueries({ queryKey: qk.learn.all });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not save content");
    } finally {
      setBusy(false);
    }
  };

  const doSaveMappings = async () => {
    if (!mappingsFor) return;
    setBusy(true);
    try {
      unwrap(
        await saveMappings({
          data: { course_id: mappingsFor.id, mappings: mappingRows.filter((m) => m.competency_id) },
        }),
      );
      toast.success("Competency links saved");
      setMappingsFor(null);
      qc.invalidateQueries({ queryKey: qk.learn.all });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not save links");
    } finally {
      setBusy(false);
    }
  };

  const doConfirm = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm.kind === "submit") {
        unwrap(
          await submit({ data: { id: confirm.course.id, idempotencyKey: crypto.randomUUID() } }),
        );
        toast.success("Submitted for HR approval");
      } else {
        unwrap(await archive({ data: { id: confirm.course.id } }));
        toast.success("Course archived");
      }
      setConfirm(null);
      qc.invalidateQueries({ queryKey: qk.learn.all });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const cols: ColumnDef<CourseRow, unknown>[] = [
    { header: "Code", accessorKey: "code" },
    {
      header: "Title",
      accessorKey: "title",
      cell: ({ row }) => <span className="font-semibold">{row.original.title}</span>,
    },
    { header: "Owner", cell: ({ row }) => empName(row.original.owner) },
    { header: "Difficulty", accessorKey: "difficulty" },
    {
      header: "Status",
      accessorKey: "status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    ...(canEdit
      ? [
          {
            id: "actions",
            header: "",
            cell: ({ row }: { row: { original: CourseRow } }) => {
              const c = row.original;
              const editable = c.status === "draft" || c.status === "pending_review";
              return (
                <div className="flex flex-wrap justify-end gap-1">
                  {editable && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => openEdit(c)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setContentFor(c);
                          setSectionsText("");
                        }}
                      >
                        Content
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setMappingsFor(c);
                          setMappingRows([]);
                        }}
                      >
                        Competencies
                      </Button>
                    </>
                  )}
                  {c.status === "draft" && (
                    <Button size="sm" onClick={() => setConfirm({ kind: "submit", course: c })}>
                      <Send className="size-3.5" aria-hidden /> Submit
                    </Button>
                  )}
                  {c.status === "approved" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirm({ kind: "archive", course: c })}
                    >
                      <Archive className="size-3.5" aria-hidden /> Archive
                    </Button>
                  )}
                </div>
              );
            },
          } as ColumnDef<CourseRow, unknown>,
        ]
      : []),
  ];

  return (
    <div>
      <PageHeader
        title="Course management"
        description="Create courses, build sections and lessons, link competencies, then submit for HR approval."
        actions={
          canEdit ? (
            <Button onClick={() => openEdit("new")}>
              <Plus className="size-4" aria-hidden /> New course
            </Button>
          ) : undefined
        }
      />
      <DefaultNote>
        Publication route: the Operations Manager submits, the HR Administrator approves. Default -
        requires organizational validation.
      </DefaultNote>
      <div className="mt-4">
        <DataTable data={courses.data} columns={cols} searchPlaceholder="Search courses…" />
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "New course" : "Edit course"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Code" htmlFor="c-code" required>
                <Input
                  id="c-code"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  maxLength={20}
                />
              </Field>
              <Field label="Difficulty" htmlFor="c-diff">
                <NativeSelect
                  id="c-diff"
                  value={form.difficulty}
                  onChange={(e) =>
                    setForm({ ...form, difficulty: e.target.value as CourseForm["difficulty"] })
                  }
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </NativeSelect>
              </Field>
            </div>
            <Field label="Title" htmlFor="c-title" required>
              <Input
                id="c-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                maxLength={160}
              />
            </Field>
            <Field label="Description" htmlFor="c-desc">
              <Textarea
                id="c-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </Field>
            <Field label="Learning objectives" htmlFor="c-obj">
              <Textarea
                id="c-obj"
                value={form.objectives}
                onChange={(e) => setForm({ ...form, objectives: e.target.value })}
                rows={2}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Category" htmlFor="c-cat">
                <Input
                  id="c-cat"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  maxLength={80}
                />
              </Field>
              <Field label="Duration (minutes)" htmlFor="c-dur">
                <Input
                  id="c-dur"
                  type="number"
                  min={1}
                  value={form.duration_minutes}
                  onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Completion rule" htmlFor="c-rule">
                <NativeSelect
                  id="c-rule"
                  value={form.completion_rule}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      completion_rule: e.target.value as CourseForm["completion_rule"],
                    })
                  }
                >
                  <option value="all_lessons">All lessons completed</option>
                  <option value="quiz_pass">Quiz passed</option>
                  <option value="all_lessons_and_quiz">Lessons + quiz</option>
                </NativeSelect>
              </Field>
              <Field label="Self-enrollment" htmlFor="c-open">
                <NativeSelect
                  id="c-open"
                  value={form.enrollment_open ? "1" : "0"}
                  onChange={(e) => setForm({ ...form, enrollment_open: e.target.value === "1" })}
                >
                  <option value="1">Open</option>
                  <option value="0">Closed</option>
                </NativeSelect>
              </Field>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={doSave} disabled={busy || !form.code || form.title.length < 3}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!contentFor} onOpenChange={(o) => !o && setContentFor(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Sections and lessons — {contentFor?.title}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            One section per line:{" "}
            <code className="font-data text-xs">Section title | Lesson one; Lesson two</code>.
            Saving replaces the current content and is only possible while the course is a draft or
            awaiting approval.
          </p>
          <Textarea
            aria-label="Sections and lessons"
            value={sectionsText}
            onChange={(e) => setSectionsText(e.target.value)}
            rows={8}
            placeholder={
              "Route basics | Reading the brief; Compliance constraints\nMulti-stop planning | Sequencing stops"
            }
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setContentFor(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={doSaveContent} disabled={busy || !sectionsText.trim()}>
              Save content
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!mappingsFor} onOpenChange={(o) => !o && setMappingsFor(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Competency links — {mappingsFor?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {mappingRows.map((m, i) => (
              <div key={i} className="flex items-center gap-2">
                <NativeSelect
                  aria-label={`Competency ${i + 1}`}
                  value={m.competency_id}
                  onChange={(e) =>
                    setMappingRows(
                      mappingRows.map((r, j) =>
                        j === i ? { ...r, competency_id: e.target.value } : r,
                      ),
                    )
                  }
                >
                  <option value="">Choose competency…</option>
                  {(competencies.data ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </NativeSelect>
                <NativeSelect
                  aria-label={`Target level ${i + 1}`}
                  value={String(m.target_level)}
                  onChange={(e) =>
                    setMappingRows(
                      mappingRows.map((r, j) =>
                        j === i ? { ...r, target_level: Number(e.target.value) } : r,
                      ),
                    )
                  }
                >
                  {[1, 2, 3, 4, 5].map((l) => (
                    <option key={l} value={l}>
                      Level {l}
                    </option>
                  ))}
                </NativeSelect>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setMappingRows(mappingRows.filter((_, j) => j !== i))}
                >
                  Remove
                </Button>
              </div>
            ))}
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setMappingRows([...mappingRows, { competency_id: "", target_level: 3 }])
              }
            >
              <Plus className="size-3.5" aria-hidden /> Add link
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMappingsFor(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={doSaveMappings} disabled={busy}>
              Save links
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm?.kind === "submit" ? "Submit for approval?" : "Archive course?"}
        description={
          confirm?.kind === "submit"
            ? "The course goes to HR for publication approval. You cannot approve a course you submitted."
            : "Archived courses stay visible in historical records but leave the catalog."
        }
        confirmLabel={confirm?.kind === "submit" ? "Submit" : "Archive"}
        destructive={confirm?.kind === "archive"}
        pending={busy}
        onConfirm={doConfirm}
      />
    </div>
  );
}
