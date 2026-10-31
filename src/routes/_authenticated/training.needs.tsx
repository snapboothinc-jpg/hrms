import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { fetchAiRecommendations, fetchGaps } from "@/lib/data";
import type { AiRecRow, CourseRow, GapRow, PathRow, SessionRow } from "@/lib/data";
import { fetchCourses, fetchLearningPaths, fetchSessions } from "@/lib/data";
import { buildTrainingNeeds, type TrainingNeedRow } from "@/lib/training-needs";
import { qk } from "@/lib/query-keys";
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  PageHeader,
  SafetyTags,
  StatusBadge,
  Tag,
} from "@/components/app/kit";
import { DataTable } from "@/components/app/data-table";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/training/needs")({
  head: () => ({
    meta: [
      { title: "Training needs — Priority Handling Logistics, Inc." },
      {
        name: "description",
        content: "Validated competency gaps and reviewed training recommendations.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  const gaps = useQuery({ queryKey: qk.comp.gaps({}), queryFn: () => fetchGaps() });
  const recommendations = useQuery({
    queryKey: qk.ai.recs(),
    queryFn: () => fetchAiRecommendations(),
  });
  const courses = useQuery({ queryKey: qk.learn.courses(), queryFn: () => fetchCourses() });
  const paths = useQuery({ queryKey: qk.learn.paths(), queryFn: fetchLearningPaths });
  const sessions = useQuery({ queryKey: qk.train.sessions(), queryFn: () => fetchSessions() });

  const error =
    gaps.error ?? recommendations.error ?? courses.error ?? paths.error ?? sessions.error;
  if (error)
    return (
      <ErrorState
        error={error}
        onRetry={() => {
          void Promise.all([
            gaps.refetch(),
            recommendations.refetch(),
            courses.refetch(),
            paths.refetch(),
            sessions.refetch(),
          ]);
        }}
      />
    );
  if (!gaps.data || !recommendations.data || !courses.data || !paths.data || !sessions.data) {
    return <LoadingRows />;
  }

  const needs = buildTrainingNeeds(gaps.data, recommendations.data);
  const courseById = new Map(courses.data.map((course: CourseRow) => [course.id, course.title]));
  const pathById = new Map(paths.data.map((path: PathRow) => [path.id, path.title]));
  const sessionById = new Map(
    sessions.data.map((session: SessionRow) => [session.id, session.title]),
  );

  const resourceName = (recommendation: AiRecRow) => {
    switch (recommendation.recommendation_type) {
      case "course":
        return courseById.get(recommendation.resource_id);
      case "learning_path":
        return pathById.get(recommendation.resource_id);
      case "training":
        return sessionById.get(recommendation.resource_id);
      default:
        return undefined;
    }
  };

  const columns: ColumnDef<TrainingNeedRow, unknown>[] = [
    {
      header: "Employee",
      accessorFn: (row) => row.gap.employee_name,
    },
    {
      header: "Competency",
      accessorFn: (row) => row.gap.competency_name,
      cell: ({ row }) => (
        <span>
          {row.original.gap.competency_name}{" "}
          <SafetyTags
            mandatory={row.original.gap.is_mandatory}
            safety={row.original.gap.is_safety_critical}
          />
        </span>
      ),
    },
    {
      header: "Required / current",
      cell: ({ row }) =>
        `${row.original.gap.required_level} / ${row.original.gap.current_level ?? "Not assessed"}`,
    },
    {
      header: "Need",
      cell: ({ row }) =>
        row.original.gap.gap_status === "not_assessed" ? (
          <StatusBadge status="not_assessed" label="Assessment needed" />
        ) : (
          <StatusBadge status="gap" label={`Gap of ${row.original.gap.gap}`} />
        ),
    },
    {
      header: "Recommendation",
      cell: ({ row }) => {
        const recommendation = row.original.recommendation;
        if (!recommendation) return <span className="text-muted-foreground">None generated</span>;
        const resource = resourceName(recommendation);
        return (
          <div className="max-w-72">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={recommendation.status} />
              <Tag>{recommendation.recommendation_type.replace(/_/g, " ")}</Tag>
            </div>
            <p className="mt-1 text-xs">{resource ?? "No mapped resource available"}</p>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {recommendation.rationale}
            </p>
          </div>
        );
      },
    },
    {
      header: "",
      id: "actions",
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <Button asChild size="sm" variant="outline">
            <Link
              to="/competency/gaps"
              search={{
                employee: row.original.gap.employee_id,
                department: row.original.gap.department_id,
                position: row.original.gap.position_id,
                category: row.original.gap.category_id,
                status: row.original.gap.gap_status as "gap" | "not_assessed",
              }}
            >
              Evidence
            </Link>
          </Button>
          {row.original.recommendation && (
            <Button asChild size="sm" variant="outline">
              <Link to="/ai/queue">Review details</Link>
            </Button>
          )}
        </div>
      ),
    },
  ];

  const openCount = needs.length;
  const waitingCount = needs.filter(
    (need) => need.recommendation?.status === "pending_review",
  ).length;

  return (
    <div>
      <PageHeader
        title="Training needs"
        description="Validated competency gaps and mapped AI recommendations. Suggestions remain advisory until a human reviewer acts."
        actions={
          <Button asChild variant="outline">
            <Link to="/ai/queue">Open recommendation queue</Link>
          </Button>
        }
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Open or unassessed competency needs</p>
          <p className="mt-1 font-data text-2xl font-bold">{openCount}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Recommendations awaiting review</p>
          <p className="mt-1 font-data text-2xl font-bold">{waitingCount}</p>
        </div>
      </div>
      {needs.length === 0 ? (
        <EmptyState
          title="No open training needs"
          description="There are no validated competency gaps or unassessed requirements in your access scope."
        />
      ) : (
        <DataTable
          columns={columns}
          data={needs}
          pageSize={25}
          searchPlaceholder="Search employee or competency…"
        />
      )}
    </div>
  );
}
