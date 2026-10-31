import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { fetchAssignments, fetchPersonalGoals, type PersonalGoalRow } from "@/lib/data";
import {
  reviewPersonalGoal,
  savePersonalGoal,
  submitPersonalGoal,
  updatePersonalGoalProgress,
} from "@/lib/api/development.functions";
import { ApiError, unwrap, type ApiResult } from "@/lib/api/result";
import { usePermissions } from "@/hooks/use-me";
import { qk } from "@/lib/query-keys";
import {
  ErrorState,
  Field,
  LoadingRows,
  NativeSelect,
  PageHeader,
  Panel,
} from "@/components/app/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/goals")({
  head: () => ({ meta: [{ title: "Personal goals — Priority Handling Logistics, Inc." }] }),
  component: PersonalGoalsPage,
});

function PersonalGoalsPage() {
  const { employeeId, role } = usePermissions();
  const qc = useQueryClient();
  const goals = useQuery({ queryKey: qk.train.goals(), queryFn: fetchPersonalGoals });
  const assignments = useQuery({
    queryKey: qk.perf.assignments({ employee: employeeId }),
    queryFn: () => fetchAssignments({ employee: employeeId ?? undefined }),
    enabled: !!employeeId,
  });
  const save = useServerFn(savePersonalGoal);
  const submit = useServerFn(submitPersonalGoal);
  const updateProgress = useServerFn(updatePersonalGoalProgress);
  const review = useServerFn(reviewPersonalGoal);
  const [editing, setEditing] = useState<PersonalGoalRow | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [criteria, setCriteria] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [evaluationAssignmentId, setEvaluationAssignmentId] = useState("");
  const [saving, setSaving] = useState(false);
  const idempotencyKeys = useRef(new Map<string, string>());

  if (goals.error) return <ErrorState error={goals.error} onRetry={() => goals.refetch()} />;
  if (!goals.data) return <LoadingRows />;
  if (assignments.error)
    return <ErrorState error={assignments.error} onRetry={() => assignments.refetch()} />;
  const mayReview = role === "supervisor" || role === "dept_head" || role === "hr_admin";

  const reset = () => {
    setEditing(null);
    setTitle("");
    setDescription("");
    setCriteria("");
    setTargetDate("");
    setEvaluationAssignmentId("");
  };
  const run = async (
    key: string,
    action: (idempotencyKey: string) => Promise<unknown>,
    message: string,
  ) => {
    const idempotencyKey = idempotencyKeys.current.get(key) ?? crypto.randomUUID();
    idempotencyKeys.current.set(key, idempotencyKey);
    setSaving(true);
    try {
      unwrap((await action(idempotencyKey)) as ApiResult<unknown>);
      await qc.invalidateQueries({ queryKey: qk.train.goals() });
      idempotencyKeys.current.delete(key);
      toast.success(message);
      reset();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "The goal could not be updated.");
    } finally {
      setSaving(false);
    }
  };

  const edit = (goal: PersonalGoalRow) => {
    setEditing(goal);
    setTitle(goal.title);
    setDescription(goal.description ?? "");
    setCriteria(goal.success_criteria ?? "");
    setTargetDate(goal.target_date ?? "");
    setEvaluationAssignmentId(goal.evaluation_assignment_id ?? "");
  };

  const saveGoal = () =>
    run(
      editing ? `save:${editing.id}` : "save:new",
      (idempotencyKey) =>
        save({
          data: {
            id: editing?.id ?? null,
            version: editing?.version ?? null,
            idempotencyKey,
            data: {
              title,
              description,
              success_criteria: criteria,
              target_date: targetDate,
              evaluation_assignment_id: evaluationAssignmentId,
            },
          },
        }),
      editing ? "Goal updated." : "Goal saved as a draft.",
    );

  return (
    <div>
      <PageHeader
        title="Personal goals"
        description="Goals belong to you, can be connected to an evaluation, and have a separate review and progress history."
      />
      {employeeId && (
        <Panel title={editing ? "Edit draft goal" : "Create a personal goal"}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Goal" htmlFor="goal-title" required>
              <Input
                id="goal-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </Field>
            <Field label="Target date" htmlFor="goal-date">
              <Input
                id="goal-date"
                type="date"
                value={targetDate}
                onChange={(event) => setTargetDate(event.target.value)}
              />
            </Field>
            <Field label="Description" htmlFor="goal-description">
              <Textarea
                id="goal-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={4000}
              />
            </Field>
            <Field label="Success criteria" htmlFor="goal-criteria">
              <Textarea
                id="goal-criteria"
                value={criteria}
                onChange={(event) => setCriteria(event.target.value)}
                maxLength={4000}
              />
            </Field>
            <Field label="Related evaluation (optional)" htmlFor="goal-evaluation">
              <NativeSelect
                id="goal-evaluation"
                value={evaluationAssignmentId}
                onChange={(event) => setEvaluationAssignmentId(event.target.value)}
              >
                <option value="">Not linked</option>
                {(assignments.data ?? []).map((assignment) => (
                  <option key={assignment.id} value={assignment.id}>
                    {assignment.cycle?.name ?? "Evaluation"} · {assignment.status}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={saveGoal} disabled={saving || title.trim().length < 3}>
              {saving ? "Saving…" : "Save draft"}
            </Button>
            {editing && (
              <Button variant="outline" onClick={reset} disabled={saving}>
                Cancel
              </Button>
            )}
          </div>
        </Panel>
      )}
      <div className="mt-6 space-y-4">
        {goals.data.length === 0 ? (
          <Panel title="Your goals">
            <p className="text-sm text-muted-foreground">No personal goals are recorded yet.</p>
          </Panel>
        ) : (
          goals.data.map((goal) => {
            const isOwner = goal.employee_id === employeeId;
            return (
              <Panel
                key={goal.id}
                title={goal.title}
                description={`${goal.status.replaceAll("_", " ")}${goal.target_date ? ` · due ${goal.target_date}` : ""}`}
                actions={
                  isOwner && ["draft", "returned"].includes(goal.status) ? (
                    <Button variant="outline" size="sm" onClick={() => edit(goal)}>
                      Edit
                    </Button>
                  ) : undefined
                }
              >
                {goal.description && <p className="mb-2 text-sm">{goal.description}</p>}
                {goal.success_criteria && (
                  <p className="mb-3 text-sm text-muted-foreground">
                    Success criteria: {goal.success_criteria}
                  </p>
                )}
                {goal.review_comment && (
                  <p className="mb-3 text-sm text-muted-foreground">
                    Reviewer: {goal.review_comment}
                  </p>
                )}
                {goal.status === "approved" && isOwner && (
                  <ProgressEditor
                    goal={goal}
                    onSave={(progress, comment) =>
                      run(
                        `progress:${goal.id}`,
                        (idempotencyKey) =>
                          updateProgress({
                            data: {
                              id: goal.id,
                              version: goal.version,
                              progress,
                              comment,
                              idempotencyKey,
                            },
                          }),
                        "Progress updated.",
                      )
                    }
                    saving={saving}
                  />
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {isOwner && ["draft", "returned"].includes(goal.status) && (
                    <Button
                      size="sm"
                      disabled={saving}
                      onClick={() =>
                        run(
                          `submit:${goal.id}`,
                          (idempotencyKey) =>
                            submit({
                              data: { id: goal.id, version: goal.version, idempotencyKey },
                            }),
                          "Goal submitted for review.",
                        )
                      }
                    >
                      Submit for review
                    </Button>
                  )}
                  {!isOwner && mayReview && goal.status === "pending_review" && (
                    <>
                      <Button
                        size="sm"
                        disabled={saving}
                        onClick={() =>
                          run(
                            `review:${goal.id}`,
                            (idempotencyKey) =>
                              review({
                                data: {
                                  id: goal.id,
                                  decision: "approve",
                                  comments: "",
                                  idempotencyKey,
                                },
                              }),
                            "Goal approved.",
                          )
                        }
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={saving}
                        onClick={() =>
                          run(
                            `review:${goal.id}`,
                            (idempotencyKey) =>
                              review({
                                data: {
                                  id: goal.id,
                                  decision: "return",
                                  comments: "Please revise this goal.",
                                  idempotencyKey,
                                },
                              }),
                            "Goal returned for revision.",
                          )
                        }
                      >
                        Return
                      </Button>
                    </>
                  )}
                  {!isOwner && mayReview && goal.status === "approved" && goal.progress === 100 && (
                    <Button
                      size="sm"
                      disabled={saving}
                      onClick={() =>
                        run(
                          `review:${goal.id}`,
                          (idempotencyKey) =>
                            review({
                              data: {
                                id: goal.id,
                                decision: "complete",
                                comments: "",
                                idempotencyKey,
                              },
                            }),
                          "Goal marked complete.",
                        )
                      }
                    >
                      Confirm completion
                    </Button>
                  )}
                </div>
              </Panel>
            );
          })
        )}
      </div>
    </div>
  );
}

function ProgressEditor({
  goal,
  onSave,
  saving,
}: {
  goal: PersonalGoalRow;
  onSave: (progress: number, comment: string) => void;
  saving: boolean;
}) {
  const [progress, setProgress] = useState(goal.progress);
  const [comment, setComment] = useState(goal.progress_comment ?? "");
  return (
    <div className="grid gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
      <Field label={`Progress (${progress}%)`} htmlFor={`goal-progress-${goal.id}`}>
        <Input
          id={`goal-progress-${goal.id}`}
          type="number"
          min={0}
          max={100}
          value={progress}
          onChange={(event) => setProgress(Number(event.target.value))}
        />
      </Field>
      <Field label="Progress update" htmlFor={`goal-comment-${goal.id}`}>
        <Input
          id={`goal-comment-${goal.id}`}
          value={comment}
          maxLength={4000}
          onChange={(event) => setComment(event.target.value)}
        />
      </Field>
      <Button
        variant="outline"
        disabled={
          saving || (progress === goal.progress && comment === (goal.progress_comment ?? ""))
        }
        onClick={() => onSave(progress, comment)}
      >
        Save progress
      </Button>
    </div>
  );
}
