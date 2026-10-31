import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import {
  fetchCourses,
  fetchEmployees,
  fetchEnrollments,
  empName,
  type EnrollmentRow,
} from "@/lib/data";
import { enrollCourse } from "@/lib/api/development.functions";
import { unwrap, ApiError } from "@/lib/api/result";
import { usePermissions } from "@/hooks/use-me";
import { qk } from "@/lib/query-keys";
import {
  PageHeader,
  StatusBadge,
  LoadingRows,
  ErrorState,
  fmtDate,
  Field,
  NativeSelect,
} from "@/components/app/kit";
import { DataTable } from "@/components/app/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/learning/progress")({
  head: () => ({
    meta: [
      { title: "Learner progress — Priority Handling Logistics, Inc." },
      {
        name: "description",
        content: "Enrollment and completion status across learners in your scope.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  const { any } = usePermissions();
  const queryClient = useQueryClient();
  const canAssign = any("learn.manage", "train.manage", "hr.employees", "team.view");
  const enrollments = useQuery({
    queryKey: qk.learn.enrollments(),
    queryFn: () => fetchEnrollments(),
  });
  const employees = useQuery({
    queryKey: qk.org.employees(),
    queryFn: fetchEmployees,
    enabled: canAssign,
  });
  const courses = useQuery({
    queryKey: qk.learn.courses("approved"),
    queryFn: () => fetchCourses("approved"),
    enabled: canAssign,
  });
  const enroll = useServerFn(enrollCourse);
  const [dueFilter, setDueFilter] = useState("all");
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [assignment, setAssignment] = useState({ employee_id: "", course_id: "", due_date: "" });
  const [busy, setBusy] = useState(false);

  const assignCourse = async () => {
    setBusy(true);
    try {
      unwrap(
        await enroll({
          data: {
            course_id: assignment.course_id,
            employee_id: assignment.employee_id,
            source: "direct",
            plan_item_id: null,
            due_date: assignment.due_date || null,
            idempotencyKey: crypto.randomUUID(),
          },
        }),
      );
      toast.success("Course assigned");
      setAssignmentOpen(false);
      setAssignment({ employee_id: "", course_id: "", due_date: "" });
      await queryClient.invalidateQueries({ queryKey: qk.learn.all });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Course assignment failed");
    } finally {
      setBusy(false);
    }
  };

  const error = enrollments.error ?? (canAssign ? (employees.error ?? courses.error) : undefined);
  if (error)
    return (
      <ErrorState
        error={error}
        onRetry={() =>
          void Promise.all(
            canAssign
              ? [enrollments.refetch(), employees.refetch(), courses.refetch()]
              : [enrollments.refetch()],
          )
        }
      />
    );
  if (!enrollments.data) return <LoadingRows />;

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = new Date(`${today}T00:00:00.000Z`);
  upcoming.setUTCDate(upcoming.getUTCDate() + 7);
  const upcomingThrough = upcoming.toISOString().slice(0, 10);
  const rows = enrollments.data.filter((enrollment) => {
    if (dueFilter === "no_due_date") return enrollment.due_date === null;
    if (dueFilter === "overdue")
      return (
        enrollment.status !== "completed" && !!enrollment.due_date && enrollment.due_date < today
      );
    if (dueFilter === "upcoming")
      return (
        enrollment.status !== "completed" &&
        !!enrollment.due_date &&
        enrollment.due_date >= today &&
        enrollment.due_date <= upcomingThrough
      );
    return true;
  });

  const cols: ColumnDef<EnrollmentRow, unknown>[] = [
    {
      header: "Employee",
      cell: ({ row }) => (
        <Link
          to="/people/employees/$id"
          params={{ id: row.original.employee_id }}
          className="font-bold hover:underline"
        >
          {empName(row.original.employee)}
        </Link>
      ),
    },
    { header: "Course", cell: ({ row }) => row.original.course?.title ?? "—" },
    {
      header: "Source",
      accessorKey: "source",
      cell: ({ getValue }) => String(getValue()).replace(/_/g, " "),
    },
    {
      header: "Assigned",
      accessorKey: "assigned_at",
      cell: ({ getValue }) => fmtDate(getValue() as string),
    },
    {
      header: "Due date",
      accessorKey: "due_date",
      cell: ({ getValue }) => fmtDate(getValue() as string),
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      header: "",
      id: "open",
      cell: ({ row }) => (
        <Button asChild size="sm" variant="outline">
          <Link to="/learning/course/$id" params={{ id: row.original.course_id }}>
            Open
          </Link>
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Learner progress"
        description="Enrollments in your scope (own team, department, or all for learning managers)."
        actions={
          canAssign ? (
            <Button
              onClick={() => setAssignmentOpen(true)}
              disabled={employees.isLoading || courses.isLoading}
            >
              Assign course
            </Button>
          ) : undefined
        }
      />
      <div className="mb-4 max-w-xs">
        <Field label="Due date" htmlFor="learning-due-filter">
          <NativeSelect
            id="learning-due-filter"
            value={dueFilter}
            onChange={(event) => setDueFilter(event.target.value)}
          >
            <option value="all">All assignments</option>
            <option value="overdue">Overdue</option>
            <option value="upcoming">Due within seven days</option>
            <option value="no_due_date">No due date</option>
          </NativeSelect>
        </Field>
      </div>
      <DataTable data={rows} columns={cols} searchPlaceholder="Search enrollments…" />
      <Dialog open={assignmentOpen} onOpenChange={setAssignmentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign a course</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Field label="Employee" htmlFor="assignment-employee" required>
              <NativeSelect
                id="assignment-employee"
                value={assignment.employee_id}
                onChange={(event) =>
                  setAssignment({ ...assignment, employee_id: event.target.value })
                }
              >
                <option value="">Choose employee…</option>
                {(employees.data ?? []).map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {empName(employee)} ({employee.employee_code})
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Course" htmlFor="assignment-course" required>
              <NativeSelect
                id="assignment-course"
                value={assignment.course_id}
                onChange={(event) =>
                  setAssignment({ ...assignment, course_id: event.target.value })
                }
              >
                <option value="">Choose course…</option>
                {(courses.data ?? []).map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Due date" htmlFor="assignment-due-date">
              <Input
                id="assignment-due-date"
                type="date"
                value={assignment.due_date}
                onChange={(event) => setAssignment({ ...assignment, due_date: event.target.value })}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignmentOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              onClick={() => void assignCourse()}
              disabled={busy || !assignment.employee_id || !assignment.course_id}
            >
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
