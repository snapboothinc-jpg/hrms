import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Inbox } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { check } from "@/lib/data";
import { reviewAssessment } from "@/lib/api/actions.functions";
import {
  reviewCourse,
  reviewPersonalGoal,
  reviewDevelopmentPlan,
} from "@/lib/api/development.functions";
import { reviewSuccessionPlan } from "@/lib/api/succession.functions";
import { usePermissions } from "@/hooks/use-me";
import { useAction } from "@/hooks/use-action";
import { qk } from "@/lib/query-keys";
import {
  PageHeader,
  StatusBadge,
  EmptyState,
  ConfirmDialog,
  fmtDateTime,
  NativeSelect,
} from "@/components/app/kit";
import { DataTable } from "@/components/app/data-table";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/approvals")({
  head: () => ({
    meta: [
      { title: "Approval center — Priority Handling Logistics, Inc." },
      { name: "description", content: "Pending approvals you can act on." },
    ],
  }),
  component: Page,
});

type Task = {
  id: string;
  workflow_type: string;
  record_id: string;
  record_label: string;
  status: string;
  created_at: string;
  submitted_by: string | null;
  decided_at: string | null;
  comments: string | null;
  assignee_role: string | null;
  assignee_user: string | null;
  submitter: { full_name: string | null; email: string } | null;
  version?: number;
};

const WF: Record<string, string> = {
  evaluation: "Performance evaluation",
  competency_assessment: "Competency assessment",
  course_publication: "Course publication",
  personal_goal: "Employee personal goal",
  development_plan: "Development plan",
  succession_plan: "Succession plan",
  ai_recommendation: "AI recommendation",
  recognition_nomination: "Social recognition",
};

function Page() {
  const { me, has } = usePermissions();
  const [status, setStatus] = useState("pending");
  const q = useQuery({
    queryKey: [...qk.shared.approvals(), status],
    queryFn: async () => {
      const tasks = check(
        await supabase
          .from("approval_tasks")
          .select("*")
          .eq("status", status)
          .order("created_at", { ascending: false })
          .limit(500),
      ) as Omit<Task, "submitter">[];
      const ids = [...new Set(tasks.map((t) => t.submitted_by).filter(Boolean))] as string[];
      const developmentIds = tasks
        .filter((task) => task.workflow_type === "development_plan")
        .map((task) => task.record_id);
      const successionIds = tasks
        .filter((task) => task.workflow_type === "succession_plan")
        .map((task) => task.record_id);
      const [developmentRows, successionRows] = await Promise.all([
        developmentIds.length
          ? check(
              await supabase
                .from("development_plans")
                .select("id,version")
                .in("id", developmentIds),
            )
          : [],
        successionIds.length
          ? check(
              await supabase.from("succession_plans").select("id,version").in("id", successionIds),
            )
          : [],
      ]);
      const profiles = ids.length
        ? (check(await supabase.from("profiles").select("id, full_name, email").in("id", ids)) as {
            id: string;
            full_name: string | null;
            email: string;
          }[])
        : [];
      return tasks.map((t) => ({
        ...t,
        version: (t.workflow_type === "development_plan"
          ? developmentRows
          : t.workflow_type === "succession_plan"
            ? successionRows
            : []
        ).find((record) => record.id === t.record_id)?.version,
        submitter: profiles.find((p) => p.id === t.submitted_by) ?? null,
      })) as Task[];
    },
  });
  const [act, setAct] = useState<{ task: Task; decision: "approve" | "reject" } | null>(null);
  const [comments, setComments] = useState("");
  const review = useAction(useServerFn(reviewAssessment), {
    idempotent: true,
    invalidate: [qk.shared.approvals(), qk.comp.all],
    success: "Decision recorded",
    onSuccess: () => {
      setAct(null);
      setComments("");
    },
  });
  const courseReview = useAction(useServerFn(reviewCourse), {
    idempotent: true,
    invalidate: [qk.shared.approvals(), qk.learn.all],
    success: "Course publication decision recorded",
    onSuccess: () => {
      setAct(null);
      setComments("");
    },
  });
  const personalGoalReview = useAction(useServerFn(reviewPersonalGoal), {
    idempotent: true,
    invalidate: [qk.shared.approvals(), qk.train.all],
    success: "Personal goal decision recorded",
    onSuccess: () => {
      setAct(null);
      setComments("");
    },
  });
  const developmentPlanReview = useAction(useServerFn(reviewDevelopmentPlan), {
    idempotent: true,
    invalidate: [qk.shared.approvals(), qk.train.all],
    success: "Development plan decision recorded",
    onSuccess: () => {
      setAct(null);
      setComments("");
    },
  });
  const successionPlanReview = useAction(useServerFn(reviewSuccessionPlan), {
    idempotent: true,
    invalidate: [qk.shared.approvals(), qk.succ.all],
    success: "Succession plan decision recorded",
    onSuccess: () => {
      setAct(null);
      setComments("");
    },
  });

  const cols: ColumnDef<Task, unknown>[] = [
    {
      header: "Record",
      accessorKey: "record_label",
      cell: ({ row }) => <span className="font-bold">{row.original.record_label}</span>,
    },
    { header: "Workflow", accessorFn: (r) => WF[r.workflow_type] },
    {
      header: "Submitted by",
      accessorFn: (r) => r.submitter?.full_name ?? r.submitter?.email ?? "—",
    },
    {
      header: "Submitted",
      accessorKey: "created_at",
      cell: ({ getValue }) => fmtDateTime(getValue() as string),
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: ({ getValue }) => <StatusBadge status={getValue() as string} />,
    },
    {
      header: "Actions",
      id: "actions",
      cell: ({ row }) => {
        const t = row.original;
        if (t.workflow_type === "evaluation")
          return (
            <Button asChild size="sm" variant="outline">
              <Link to="/performance/evaluations/$id" params={{ id: t.record_id }}>
                {t.status === "pending" ? "Review" : "Open"}
              </Link>
            </Button>
          );
        if (t.workflow_type === "course_publication")
          return (
            <div className="flex flex-wrap justify-end gap-1">
              <Button asChild size="sm" variant="outline">
                <Link to="/learning/course/$id" params={{ id: t.record_id }}>
                  {t.status === "pending" ? "Inspect" : "Open"}
                </Link>
              </Button>
              {t.status === "pending" && (
                <>
                  <Button size="sm" onClick={() => setAct({ task: t, decision: "approve" })}>
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setAct({ task: t, decision: "reject" })}
                  >
                    Return to draft
                  </Button>
                </>
              )}
            </div>
          );
        if (t.workflow_type === "personal_goal" && t.status === "pending")
          return (
            <div className="flex gap-1">
              <Button size="sm" onClick={() => setAct({ task: t, decision: "approve" })}>
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAct({ task: t, decision: "reject" })}
              >
                Return
              </Button>
            </div>
          );
        if (t.workflow_type === "personal_goal")
          return (
            <Button asChild size="sm" variant="outline">
              <Link to="/goals">Open goals</Link>
            </Button>
          );
        if (t.workflow_type === "development_plan" || t.workflow_type === "succession_plan")
          return (
            <div className="flex flex-wrap justify-end gap-1">
              <Button asChild size="sm" variant="outline">
                {t.workflow_type === "development_plan" ? (
                  <Link to="/training/plans/$id" params={{ id: t.record_id }}>
                    Open
                  </Link>
                ) : (
                  <Link to="/succession/positions">Open plans</Link>
                )}
              </Button>
              {t.status === "pending" &&
                t.version !== undefined &&
                (t.workflow_type === "development_plan"
                  ? t.assignee_role === "hr_admin" && has("learn.approve")
                  : t.assignee_user === me?.user_id
                    ? has("succession.dept") || has("succession.manage")
                    : t.assignee_role === "hr_admin" && has("succession.manage")) && (
                  <>
                    <Button size="sm" onClick={() => setAct({ task: t, decision: "approve" })}>
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAct({ task: t, decision: "reject" })}
                    >
                      Return
                    </Button>
                  </>
                )}
            </div>
          );
        if (t.workflow_type === "ai_recommendation")
          return (
            <Button asChild size="sm" variant="outline">
              <Link to="/ai/queue">Open recommendations</Link>
            </Button>
          );
        if (t.workflow_type === "recognition_nomination")
          return (
            <Button asChild size="sm" variant="outline">
              <Link to="/recognition/queue">Open nomination</Link>
            </Button>
          );
        if (t.status !== "pending") return null;
        return (
          <div className="flex gap-1">
            <Button size="sm" onClick={() => setAct({ task: t, decision: "approve" })}>
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAct({ task: t, decision: "reject" })}
            >
              Reject
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="Approval center"
        description="Only items you are allowed to act on are listed. You cannot approve items you submitted."
      />
      <DataTable
        columns={cols}
        data={q.data}
        loading={q.isLoading}
        error={q.error}
        onRetry={() => q.refetch()}
        searchPlaceholder="Search approvals"
        toolbar={
          <NativeSelect
            aria-label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-40"
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </NativeSelect>
        }
        empty={
          <EmptyState
            icon={Inbox}
            title="No approvals"
            description="Nothing is waiting for your decision."
          />
        }
      />
      <ConfirmDialog
        open={!!act}
        onOpenChange={(o) => !o && setAct(null)}
        title={
          act?.decision === "approve"
            ? "Approve submission?"
            : act?.task.workflow_type === "personal_goal"
              ? "Return goal for revision?"
              : ["development_plan", "succession_plan"].includes(act?.task.workflow_type ?? "")
                ? "Return plan for revision?"
                : act?.task.workflow_type === "course_publication"
                  ? "Return course to draft?"
                  : "Reject assessment?"
        }
        description={act?.task.record_label}
        confirmLabel={
          act?.decision === "approve"
            ? "Approve"
            : act?.task.workflow_type === "personal_goal"
              ? "Return for revision"
              : act?.task.workflow_type === "course_publication"
                ? "Return to draft"
                : "Reject"
        }
        destructive={act?.decision === "reject"}
        pending={
          review.isPending ||
          courseReview.isPending ||
          personalGoalReview.isPending ||
          developmentPlanReview.isPending ||
          successionPlanReview.isPending
        }
        onConfirm={() => {
          if (!act) return;
          if (act.task.workflow_type === "course_publication") {
            courseReview.mutate({
              id: act.task.record_id,
              decision: act.decision === "approve" ? "approve" : "return",
              comments,
            });
          } else if (act.task.workflow_type === "personal_goal") {
            personalGoalReview.mutate({
              id: act.task.record_id,
              decision: act.decision === "approve" ? "approve" : "return",
              comments,
            });
          } else if (act.task.workflow_type === "development_plan") {
            if (act.task.version === undefined) {
              toast.error("The development plan version could not be loaded. Refresh and retry.");
              return;
            }
            developmentPlanReview.mutate({
              id: act.task.record_id,
              version: act.task.version,
              decision: act.decision === "approve" ? "approve" : "return",
              comments,
            });
          } else if (act.task.workflow_type === "succession_plan") {
            if (act.task.version === undefined) {
              toast.error("The succession plan version could not be loaded. Refresh and retry.");
              return;
            }
            successionPlanReview.mutate({
              id: act.task.record_id,
              version: act.task.version,
              decision: act.decision === "approve" ? "approve" : "return",
              comments,
            });
          } else {
            review.mutate({
              id: act.task.record_id,
              decision: act.decision === "approve" ? "approve" : "reject",
              comments,
            });
          }
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="cm">
            Comments
            {act?.decision === "reject" &&
              !["course_publication", "personal_goal"].includes(act.task.workflow_type) &&
              " (required)"}
          </Label>
          <Textarea
            id="cm"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            maxLength={4000}
          />
        </div>
      </ConfirmDialog>
    </div>
  );
}
