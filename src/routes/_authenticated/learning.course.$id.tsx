import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CheckCircle2, Circle, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import {
  fetchCourse,
  fetchCourseContent,
  fetchCourseMappings,
  fetchCourseQuiz,
  fetchEnrollments,
  fetchLessonProgress,
  fetchQuizAttempts,
} from "@/lib/data";
import {
  getQuizQuestions,
  saveLessonProgress,
  submitQuizAttempt,
} from "@/lib/api/development.functions";
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
  Tag,
  fmtDate,
  fmtDateTime,
} from "@/components/app/kit";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/learning/course/$id")({
  head: () => ({
    meta: [
      { title: "Course — Priority Handling Logistics, Inc." },
      { name: "description", content: "Course content, lessons, progress and quiz." },
    ],
  }),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const { employeeId, has } = usePermissions();
  const qc = useQueryClient();
  const course = useQuery({ queryKey: qk.learn.course(id), queryFn: () => fetchCourse(id) });
  const content = useQuery({
    queryKey: qk.learn.content(id),
    queryFn: () => fetchCourseContent(id),
  });
  const mappings = useQuery({
    queryKey: [...qk.learn.course(id), "mappings"],
    queryFn: () => fetchCourseMappings(id),
  });
  const quiz = useQuery({ queryKey: qk.learn.quiz(id), queryFn: () => fetchCourseQuiz(id) });
  const enrollments = useQuery({
    queryKey: qk.learn.enrollments({ course: id, employee: employeeId }),
    queryFn: () => fetchEnrollments({ course: id, employee: employeeId! }),
    enabled: !!employeeId,
  });
  const enrollment = enrollments.data?.[0] ?? null;
  const progress = useQuery({
    queryKey: [...qk.learn.enrollments(), "progress", enrollment?.id],
    queryFn: () => fetchLessonProgress(enrollment!.id),
    enabled: !!enrollment,
  });
  const attempts = useQuery({
    queryKey: qk.learn.attempts(quiz.data?.id ?? "none"),
    queryFn: () => fetchQuizAttempts(quiz.data!.id, employeeId ?? undefined),
    enabled: !!quiz.data && !!employeeId,
  });
  const saveProgress = useServerFn(saveLessonProgress);
  const [busyLesson, setBusyLesson] = useState<string | null>(null);

  if (course.error) return <ErrorState error={course.error} onRetry={() => course.refetch()} />;
  if (!course.data || !content.data) return <LoadingRows />;
  if (!course.data.id)
    return (
      <EmptyState
        title="Course not found"
        description="It may be unpublished or outside your access."
      />
    );

  const allLessons = content.data.flatMap((s) =>
    s.lessons.map((l) => ({ ...l, section: s.title })),
  );
  const done = new Set((progress.data ?? []).filter((p) => p.completed_at).map((p) => p.lesson_id));
  const pct = allLessons.length ? Math.round((done.size / allLessons.length) * 100) : 0;

  const toggle = async (lessonId: string, completed: boolean) => {
    if (!enrollment) return;
    setBusyLesson(lessonId);
    try {
      unwrap(
        await saveProgress({
          data: { enrollment_id: enrollment.id, lesson_id: lessonId, completed },
        }),
      );
      qc.invalidateQueries({ queryKey: qk.learn.all });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not save progress");
    } finally {
      setBusyLesson(null);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow={course.data.code}
        title={course.data.title}
        description={course.data.description}
        actions={<StatusBadge status={course.data.status} />}
      />
      {has("learn.manage") &&
        (course.data.status === "pending_review" || course.data.reviewed_at) && (
          <Panel title="Publication review" className="mb-6">
            {course.data.status === "pending_review" ? (
              <p className="text-sm">Awaiting an authorized HR publication decision.</p>
            ) : (
              <>
                <p className="text-sm">
                  Reviewed {fmtDateTime(course.data.reviewed_at)} ·{" "}
                  {course.data.status === "approved"
                    ? "Approved"
                    : course.data.status === "draft"
                      ? "Returned to draft"
                      : "Archived after review"}
                </p>
                {course.data.review_comments && (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                    {course.data.review_comments}
                  </p>
                )}
              </>
            )}
          </Panel>
        )}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {enrollment && (
            <Panel>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-semibold">Your progress</span>
                <span className="font-data text-muted-foreground">{pct}%</span>
              </div>
              <Progress value={pct} aria-label={`Course progress ${pct} percent`} />
              <p className="mt-2 text-xs text-muted-foreground">
                Status: <StatusBadge status={enrollment.status} /> · Completing a course does not
                close a competency gap — that needs a reassessment with evidence.
              </p>
              {enrollment.due_date && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Due {fmtDate(enrollment.due_date)}
                </p>
              )}
            </Panel>
          )}
          {content.data.map((section) => (
            <Panel
              key={section.id}
              title={section.title}
              description={section.description ?? undefined}
            >
              {section.lessons.length === 0 ? (
                <p className="text-sm text-muted-foreground">No lessons yet.</p>
              ) : (
                <ul className="divide-y">
                  {section.lessons.map((l) => {
                    const isDone = done.has(l.id);
                    return (
                      <li key={l.id} className="py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2">
                            {isDone ? (
                              <CheckCircle2 className="mt-0.5 size-4 text-success" aria-hidden />
                            ) : (
                              <Circle className="mt-0.5 size-4 text-muted-foreground" aria-hidden />
                            )}
                            <div>
                              <p className="text-sm font-semibold">{l.title}</p>
                              {l.content && (
                                <p className="mt-1 text-sm text-muted-foreground">{l.content}</p>
                              )}
                              {l.duration_minutes && (
                                <p className="mt-1 font-data text-xs text-muted-foreground">
                                  {l.duration_minutes} min
                                </p>
                              )}
                            </div>
                          </div>
                          {enrollment && enrollment.status !== "completed" && (
                            <Button
                              size="sm"
                              variant={isDone ? "outline" : "default"}
                              disabled={busyLesson === l.id}
                              onClick={() => toggle(l.id, !isDone)}
                            >
                              {isDone ? "Mark not done" : "Mark complete"}
                            </Button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          ))}
          {quiz.data && enrollment && (
            <QuizPanel
              quizId={quiz.data.id}
              title={quiz.data.title}
              passScore={quiz.data.pass_score}
              maxAttempts={quiz.data.max_attempts}
              enrollmentId={enrollment.id}
              attempts={attempts.data ?? []}
              onDone={() => qc.invalidateQueries({ queryKey: qk.learn.all })}
            />
          )}
        </div>
        <div className="space-y-6">
          <Panel title="Competency links">
            {!mappings.data?.length ? (
              <p className="text-sm text-muted-foreground">Not mapped to competencies.</p>
            ) : (
              <ul className="space-y-2">
                {mappings.data.map((m) => (
                  <li key={m.id} className="flex items-center justify-between text-sm">
                    <span>{m.competency?.name}</span>
                    <Tag tone="info">Target level {m.target_level}</Tag>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Details">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Difficulty</dt>
                <dd className="font-semibold">{course.data.difficulty}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Duration</dt>
                <dd className="font-semibold">
                  {course.data.duration_minutes ? `${course.data.duration_minutes} min` : "—"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Completion</dt>
                <dd className="font-semibold">{course.data.completion_rule.replace(/_/g, " ")}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Self-enrollment</dt>
                <dd className="font-semibold">{course.data.enrollment_open ? "Open" : "Closed"}</dd>
              </div>
            </dl>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function QuizPanel({
  quizId,
  title,
  passScore,
  maxAttempts,
  enrollmentId,
  attempts,
  onDone,
}: {
  quizId: string;
  title: string;
  passScore: number;
  maxAttempts: number;
  enrollmentId: string;
  attempts: {
    id: string;
    attempt_no: number;
    score: number;
    passed: boolean;
    submitted_at: string;
  }[];
  onDone: () => void;
}) {
  const loadQuestions = useServerFn(getQuizQuestions);
  const submit = useServerFn(submitQuizAttempt);
  const [questions, setQuestions] = useState<
    { id: string; question: string; options: string[] }[] | null
  >(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    try {
      const qs = unwrap(await loadQuestions({ data: { quiz_id: quizId } }));
      setQuestions(qs);
      setAnswers({});
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not load the quiz");
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    setBusy(true);
    try {
      const r = unwrap(
        await submit({
          data: {
            quiz_id: quizId,
            enrollment_id: enrollmentId,
            answers,
            idempotencyKey: crypto.randomUUID(),
          },
        }),
      );
      toast.success(
        r.passed ? `Passed with ${r.score}%` : `Scored ${r.score}% (pass mark ${passScore}%)`,
      );
      setQuestions(null);
      onDone();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not submit the quiz");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      title={title}
      description={`Pass mark ${passScore}%. Attempts are timestamped and stored.`}
    >
      {attempts.length > 0 && (
        <ul className="mb-4 space-y-1 text-sm">
          {attempts.map((a) => (
            <li key={a.id} className="flex items-center justify-between">
              <span>
                Attempt {a.attempt_no} · {fmtDateTime(a.submitted_at)}
              </span>
              <StatusBadge
                status={a.passed ? "approved" : "rejected"}
                label={`${a.score}% ${a.passed ? "passed" : "failed"}`}
              />
            </li>
          ))}
        </ul>
      )}
      {!questions ? (
        <Button onClick={start} disabled={busy || attempts.length >= maxAttempts}>
          <PlayCircle className="size-4" aria-hidden />
          {attempts.length >= maxAttempts
            ? "No attempts left"
            : attempts.length
              ? "Retry quiz"
              : "Start quiz"}
        </Button>
      ) : (
        <div className="space-y-5">
          {questions.map((q, qi) => (
            <fieldset key={q.id}>
              <legend className="mb-2 text-sm font-semibold">
                {qi + 1}. {q.question}
              </legend>
              <div className="space-y-1.5">
                {q.options.map((opt, oi) => (
                  <label key={oi} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name={q.id}
                      checked={answers[q.id] === oi}
                      onChange={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
                      className="accent-primary"
                    />
                    {opt}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <div className="flex gap-2">
            <Button
              onClick={send}
              disabled={busy || Object.keys(answers).length < questions.length}
            >
              Submit answers
            </Button>
            <Button variant="outline" onClick={() => setQuestions(null)} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Panel>
  );
}
