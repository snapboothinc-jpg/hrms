import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Grid3x3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { check, fetchPositions, fetchDepartments } from "@/lib/data";
import { qk } from "@/lib/query-keys";
import { PageHeader, EmptyState, LoadingRows, StatusBadge, Tag } from "@/components/app/kit";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/performance/matrix")({
  head: () => ({
    meta: [
      { title: "Position evaluation matrix — Priority Handling Logistics, Inc." },
      { name: "description", content: "Which evaluation profile applies to each position." },
    ],
  }),
  component: Page,
});

function Page() {
  const positions = useQuery({ queryKey: qk.org.positions(), queryFn: fetchPositions });
  const depts = useQuery({ queryKey: qk.org.departments(), queryFn: fetchDepartments });
  const versions = useQuery({
    queryKey: [...qk.perf.profiles(), "matrix"],
    queryFn: async () =>
      check(
        await supabase
          .from("evaluation_profile_versions")
          .select(
            "id, profile_id, position_id, version_number, status, effective_date, profile:evaluation_profiles(name), items:evaluation_items(item_type, weight)",
          ),
      ) as unknown as {
        id: string;
        profile_id: string;
        position_id: string;
        version_number: number;
        status: string;
        effective_date: string | null;
        profile: { name: string } | null;
        items: { item_type: string; weight: number }[];
      }[],
  });
  if (positions.isLoading || versions.isLoading) return <LoadingRows />;
  if (!positions.data?.length)
    return <EmptyState icon={Grid3x3} title="No positions" description="Create positions first." />;
  return (
    <div>
      <PageHeader
        title="Position evaluation matrix"
        description="Shared standards (process and rating framework) apply to all; criteria, KPIs and weights vary by position."
      />
      <div className="surface overflow-x-auto">
        <Table className="font-data">
          <TableHeader>
            <TableRow>
              <TableHead>Position</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Active profile</TableHead>
              <TableHead>Ratings</TableHead>
              <TableHead>KPIs</TableHead>
              <TableHead>Other items</TableHead>
              <TableHead>Draft</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {positions.data.map((p) => {
              const vs = (versions.data ?? []).filter((v) => v.position_id === p.id);
              const act = vs.find((v) => v.status === "active");
              const draft = vs.find((v) => v.status === "draft");
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-bold">{p.title}</TableCell>
                  <TableCell>{depts.data?.find((d) => d.id === p.department_id)?.name}</TableCell>
                  <TableCell>
                    {act ? (
                      <Link
                        to="/performance/profiles/$id"
                        params={{ id: act.profile_id }}
                        className="text-primary hover:underline"
                      >
                        {act.profile?.name} v{act.version_number}
                      </Link>
                    ) : (
                      <Tag tone="warning">No active profile</Tag>
                    )}
                  </TableCell>
                  <TableCell>
                    {act ? act.items.filter((i) => i.item_type === "rating").length : "—"}
                  </TableCell>
                  <TableCell>
                    {act ? act.items.filter((i) => i.item_type === "kpi").length : "—"}
                  </TableCell>
                  <TableCell>
                    {act
                      ? act.items.filter((i) => !["rating", "kpi"].includes(i.item_type)).length
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {draft ? (
                      <Link to="/performance/profiles/$id" params={{ id: draft.profile_id }}>
                        <StatusBadge status="draft" label={`v${draft.version_number} draft`} />
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
