import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Download, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  fetchPlan,
  fetchPlanItems,
  fetchCourses,
  fetchLearningPaths,
  fetchSessions,
  fetchCompetencies,
  empName,
  type PlanItemRow,
} from "@/lib/data";
import {
  savePlanItem,
  setPlanItemStatus,
  submitDevelopmentPlan,
} from "@/lib/api/development.functions";
import { exportPdf } from "@/lib/api/succession.functions";
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
  ConfirmDialog,
  Tag,
  fmtDate,
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

export const Route = createFileRoute("/_authenticated/training/plans/$id")({
  head: () => ({
    meta: [
      { title: "Development plan — Priority Handling Logistics, Inc." },
      { name: "description", content: "Plan objectives, activities, progress and evidence." },
    ],
  }),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const { any, employeeId } = usePermissions();
  const qc = useQueryClient();
  const plan = useQuery({ queryKey: qk.train.plan(id), queryFn: () => fetchPlan(id) });
  const items = useQuery({ queryKey: qk.train.items(id), queryFn: () => fetchPlanItems(id) });
  const courses = useQuery({ queryKey: qk.learn.courses(), queryFn: () => fetchCourses() });
  const paths = useQuery({ queryKey: qk.learn.paths(), queryFn: fetchLearningPaths });
  const sessions = useQuery({ queryKey: qk.train.sessions(), queryFn: () => fetchSessions() });
  const competencies = useQuery({ queryKey: qk.comp.library(), queryFn: fetchCompetencies });
  const saveItem = useServerFn(savePlanItem);
  const setStatus = useServerFn(setPlanItemStatus);
  const submit = useServerFn(submitDevelopmentPlan);
  const pdf = useServerFn(exportPdf);

  const [itemOpen, setItemOpen] = useState(false);
  const [itemForm, setItemForm] = useState({
    item_type: "course",
    title: "",
    description: "",
    competency_id: "",
    course_id: "",
    learning_path_id: "",
    training_session_id: "",
    priority: "medium",
    target_date: "",
  });
  const [completeItem, setCompleteItem] = useState<PlanItemRow | null>(null);
  const [evidence, setEvidence] = useState("");
  const [busy, setBusy] = useState(false);

  if (plan.error) return <ErrorState error={plan.error} onRetry={() => plan.refetch()} />;
  if (!plan.data || !items.data) return <LoadingRows />;
  if (!plan.data.id)
    return <EmptyState title="Plan not found" description="It may be outside your access." />;

  const p = plan.data;
  const isOwn = p.employee_id === employeeId;
  const canManage = any("train.manage", "hr.employees", "team.view");

  const doSaveItem = async () => {
    setBusy(true);
    try {
      unwrap(
        await saveItem({
          data: {
            id: null,
            plan_id: id,
            version: null,
            data: {
              item_type: itemForm.item_type as "course" | "learning_path" | "training" | "other",
              title: itemForm.title,
              description: itemForm.description || undefined,
              competency_id: itemForm.competency_id || undefined,
              course_id: itemForm.course_id || undefined,
              learning_path_id: itemForm.learning_path_id || undefined,
              training_session_id: itemForm.training_session_id || undefined,
              priority: itemForm.priority as "high" | "medium" | "low",
              target_date: itemForm.target_date || undefined,
            },
          },
        }),
      );
      toast.success("Activity added");
      setItemOpen(false);
      qc.invalidateQueries({ queryKey: qk.train.items(id) });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not add the activity");
    } finally {
      setBusy(false);
    }
  };

  const doStatus = async (
    item: PlanItemRow,
    status: "in_progress" | "completed" | "cancelled",
    ev?: string,
  ) => {
    setBusy(true);
    try {
      unwrap(await setStatus({ data: { item_id: item.id, status, evidence: ev } }));
      toast.success(`Activity ${status.replace(/_/g, " ")}`);
      setCompleteItem(null);
      setEvidence("");
      qc.invalidateQueries({ queryKey: qk.train.items(id) });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Status change failed");
    } finally {
      setBusy(false);
    }
  };

  const doPdf = async () => {
    setBusy(true);
    try {
      const r = unwrap(await pdf({ data: { kind: "development_plan", id } }));
      const link = document.createElement("a");
      link.href = `data:application/pdf;base64,${r.base64}`;
      link.download = r.filename;
      link.click();
      toast.success("PDF downloaded (export audited)");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  };

  const doSubmit = async () => {
    setBusy(true);
    try {
      unwrap(
        await submit({
          data: { id: p.id, version: p.version, idempotencyKey: crypto.randomUUID() },
        }),
      );
      toast.success("Plan submitted for review");
      await qc.invalidateQueries({ queryKey: qk.train.all });
      await qc.invalidateQueries({ queryKey: qk.shared.approvals() });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not submit the plan");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={p.title}
        description={`${empName(p.employee)} · responsible: ${empName(p.responsible)} · target ${fmtDate(p.target_date)}${p.reassessment_due_date ? ` · reassessment due ${fmtDate(p.reassessment_due_date)}` : ""}`}
        actions={
          <div className="flex gap-2">
            <StatusBadge status={p.status} />
            <StatusBadge status={p.approval_status} />
            {canManage &&
              ["draft", "returned"].includes(p.approval_status) &&
              !["completed", "cancelled"].includes(p.status) && (
                <Button size="sm" onClick={doSubmit} disabled={busy}>
                  Submit for review
                </Button>
              )}
            <Button variant="outline" size="sm" onClick={doPdf} disabled={busy}>
              <Download className="size-4" aria-hidden /> PDF
            </Button>
            {canManage && (
              <Button size="sm" onClick={() => setItemOpen(true)}>
                <Plus className="size-4" aria-hidden /> Add activity
              </Button>
            )}
          </div>
        }
      />
      {p.review_comments && (
        <Panel title="Review feedback" className="mb-6">
          <p className="whitespace-pre-wrap text-sm">{p.review_comments}</p>
        </Panel>
      )}
      {p.objectives && (
        <Panel title="Objectives" className="mb-6">
          <p className="text-sm">{p.objectives}</p>
        </Panel>
      )}
      <Panel
        title="Activities"
        description="Courses, paths, training and other development activities."
      >
        {items.data.length === 0 ? (
          <EmptyState
            title="No activities"
            description="Add activities or accept AI recommendations to fill this plan."
          />
        ) : (
          <ul className="divide-y">
            {items.data.map((i) => (
              <li key={i.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{i.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {i.item_type.replace(/_/g, " ")}
                    {i.competency ? ` · ${i.competency.name}` : ""}
                    {i.course ? ` · ${i.course.title}` : ""}
                    {i.target_date ? ` · due ${fmtDate(i.target_date)}` : ""}
                    {i.ai_recommendation_id ? " · from AI recommendation" : ""}
                  </p>
                  {i.evidence && (
                    <p className="mt-1 text-xs text-muted-foreground">Evidence: {i.evidence}</p>
                  )}
                  {i.assessment_method && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Suggested assessment: {i.assessment_method}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Tag
                    tone={
                      i.priority === "high"
                        ? "danger"
                        : i.priority === "medium"
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {i.priority}
                  </Tag>
                  <StatusBadge status={i.status} />
                  {i.status === "pending" && (isOwn || canManage) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => doStatus(i, "in_progress")}
                      disabled={busy}
                    >
                      Start
                    </Button>
                  )}
                  {i.status === "in_progress" && (isOwn || canManage) && (
                    <Button size="sm" onClick={() => setCompleteItem(i)} disabled={busy}>
                      Complete
                    </Button>
                  )}
                  {i.course_id && (
                    <Button asChild size="sm" variant="outline">
                      <Link to="/learning/course/$id" params={{ id: i.course_id }}>
                        Open course
                      </Link>
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Dialog open={itemOpen} onOpenChange={setItemOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add activity</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type" htmlFor="i-type" required>
                <NativeSelect
                  id="i-type"
                  value={itemForm.item_type}
                  onChange={(e) => setItemForm({ ...itemForm, item_type: e.target.value })}
                >
                  <option value="course">Course</option>
                  <option value="learning_path">Learning path</option>
                  <option value="training">Training session</option>
                  <option value="other">Other</option>
                </NativeSelect>
              </Field>
              <Field label="Priority" htmlFor="i-prio">
                <NativeSelect
                  id="i-prio"
                  value={itemForm.priority}
                  onChange={(e) => setItemForm({ ...itemForm, priority: e.target.value })}
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </NativeSelect>
              </Field>
            </div>
            <Field label="Title" htmlFor="i-title" required>
              <Input
                id="i-title"
                value={itemForm.title}
                onChange={(e) => setItemForm({ ...itemForm, title: e.target.value })}
                maxLength={200}
              />
            </Field>
            <Field label="Description" htmlFor="i-desc">
              <Textarea
                id="i-desc"
                value={itemForm.description}
                onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                rows={2}
              />
            </Field>
            <Field label="Competency" htmlFor="i-comp">
              <NativeSelect
                id="i-comp"
                value={itemForm.competency_id}
                onChange={(e) => setItemForm({ ...itemForm, competency_id: e.target.value })}
              >
                <option value="">None</option>
                {(competencies.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            {itemForm.item_type === "course" && (
              <Field label="Course" htmlFor="i-course">
                <NativeSelect
                  id="i-course"
                  value={itemForm.course_id}
                  onChange={(e) => setItemForm({ ...itemForm, course_id: e.target.value })}
                >
                  <option value="">Choose…</option>
                  {(courses.data ?? [])
                    .filter((c) => c.status === "approved")
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                </NativeSelect>
              </Field>
            )}
            {itemForm.item_type === "learning_path" && (
              <Field label="Learning path" htmlFor="i-path">
                <NativeSelect
                  id="i-path"
                  value={itemForm.learning_path_id}
                  onChange={(e) => setItemForm({ ...itemForm, learning_path_id: e.target.value })}
                >
                  <option value="">Choose…</option>
                  {(paths.data ?? []).map((p2) => (
                    <option key={p2.id} value={p2.id}>
                      {p2.title}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            )}
            {itemForm.item_type === "training" && (
              <Field label="Training session" htmlFor="i-sess">
                <NativeSelect
                  id="i-sess"
                  value={itemForm.training_session_id}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, training_session_id: e.target.value })
                  }
                >
                  <option value="">Choose…</option>
                  {(sessions.data ?? [])
                    .filter((s) => s.status === "planned")
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                </NativeSelect>
              </Field>
            )}
            <Field label="Target date" htmlFor="i-date">
              <Input
                id="i-date"
                type="date"
                value={itemForm.target_date}
                onChange={(e) => setItemForm({ ...itemForm, target_date: e.target.value })}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={doSaveItem} disabled={busy || itemForm.title.length < 3}>
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!completeItem}
        onOpenChange={(o) => !o && setCompleteItem(null)}
        title="Complete this activity?"
        description="Completing an activity does not close a competency gap — that requires a reassessment with evidence."
        confirmLabel="Complete"
        pending={busy}
        onConfirm={() => completeItem && doStatus(completeItem, "completed", evidence || undefined)}
      >
        <Field label="Evidence note" htmlFor="complete-evidence">
          <Textarea
            id="complete-evidence"
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            rows={2}
            maxLength={4000}
          />
        </Field>
      </ConfirmDialog>
    </div>
  );
}
