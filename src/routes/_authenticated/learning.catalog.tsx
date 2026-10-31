import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { BookOpen, Clock } from "lucide-react";
import { toast } from "sonner";
import { fetchCourses, fetchEnrollments } from "@/lib/data";
import { enrollCourse } from "@/lib/api/development.functions";
import { unwrap, ApiError } from "@/lib/api/result";
import { usePermissions } from "@/hooks/use-me";
import { qk } from "@/lib/query-keys";
import {
  PageHeader,
  StatusBadge,
  EmptyState,
  LoadingRows,
  ErrorState,
  Tag,
} from "@/components/app/kit";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/learning/catalog")({
  head: () => ({
    meta: [
      { title: "Course catalog — Priority Handling Logistics, Inc." },
      { name: "description", content: "Published courses open for enrollment." },
    ],
  }),
  component: Page,
});

function Page() {
  const { employeeId } = usePermissions();
  const qc = useQueryClient();
  const courses = useQuery({
    queryKey: qk.learn.courses("approved"),
    queryFn: () => fetchCourses("approved"),
  });
  const enrollments = useQuery({
    queryKey: qk.learn.enrollments({ employee: employeeId }),
    queryFn: () => fetchEnrollments({ employee: employeeId! }),
    enabled: !!employeeId,
  });
  const enroll = useServerFn(enrollCourse);
  const [busy, setBusy] = useState<string | null>(null);

  if (courses.error) return <ErrorState error={courses.error} onRetry={() => courses.refetch()} />;
  if (!courses.data) return <LoadingRows />;

  const enrolledIds = new Set((enrollments.data ?? []).map((e) => e.course_id));

  const selfEnroll = async (courseId: string) => {
    if (!employeeId) return;
    setBusy(courseId);
    try {
      unwrap(
        await enroll({
          data: {
            course_id: courseId,
            employee_id: employeeId,
            source: "direct",
            plan_item_id: null,
            idempotencyKey: crypto.randomUUID(),
          },
        }),
      );
      toast.success("Enrolled");
      qc.invalidateQueries({ queryKey: qk.learn.all });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Enrollment failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Course catalog"
        description="Published courses. Only approved courses appear here."
      />
      {courses.data.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No published courses"
          description="Courses appear here after HR approves them for publication."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.data.map((c) => (
            <article key={c.id} className="surface flex flex-col p-5">
              <div className="mb-2 flex items-start justify-between gap-2">
                <span className="font-data text-xs font-semibold text-muted-foreground">
                  {c.code}
                </span>
                <Tag tone="primary">{c.difficulty}</Tag>
              </div>
              <h2 className="text-heading font-bold">
                <Link to="/learning/course/$id" params={{ id: c.id }} className="hover:underline">
                  {c.title}
                </Link>
              </h2>
              <p className="mt-1 line-clamp-2 flex-1 text-sm text-muted-foreground">
                {c.description}
              </p>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="size-3" aria-hidden />{" "}
                  {c.duration_minutes ? `${c.duration_minutes} min` : "Self-paced"}
                </span>
                {enrolledIds.has(c.id) ? (
                  <StatusBadge status="in_progress" label="Enrolled" />
                ) : (
                  <Button
                    size="sm"
                    disabled={!employeeId || !c.enrollment_open || busy === c.id}
                    onClick={() => selfEnroll(c.id)}
                  >
                    {busy === c.id ? "Enrolling…" : "Enroll"}
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
