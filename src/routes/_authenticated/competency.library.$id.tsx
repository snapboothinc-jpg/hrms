import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { check, fetchLevels } from "@/lib/data";
import { usePermissions } from "@/hooks/use-me";
import { qk } from "@/lib/query-keys";
import {
  PageHeader,
  Panel,
  StatusBadge,
  LoadingRows,
  EmptyState,
  SafetyTags,
  DefaultNote,
} from "@/components/app/kit";
import { Button } from "@/components/ui/button";
import { CompetencyDialog } from "@/components/app/competency-dialog";

export const Route = createFileRoute("/_authenticated/competency/library/$id")({
  head: () => ({
    meta: [
      { title: "Competency — Priority Handling Logistics, Inc." },
      { name: "description", content: "Competency definition and indicators." },
    ],
  }),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const { has } = usePermissions();
  const q = useQuery({
    queryKey: qk.comp.competency(id),
    queryFn: async () => {
      const c = check(
        await supabase
          .from("competencies")
          .select("*, category:competency_categories(name)")
          .eq("id", id)
          .maybeSingle(),
      ) as unknown as {
        id: string;
        code: string;
        name: string;
        description: string | null;
        definition: string | null;
        category_id: string;
        status: string;
        is_mandatory: boolean;
        is_safety_critical: boolean;
        version: number;
        category: { name: string } | null;
      } | null;
      const ind = check(
        await supabase
          .from("behavioral_indicators")
          .select("level, indicator")
          .eq("competency_id", id)
          .order("level"),
      ) as { level: number; indicator: string }[];
      const req = check(
        await supabase
          .from("position_competency_requirements")
          .select("required_level, is_mandatory, is_safety_critical, position:positions(title)")
          .eq("competency_id", id)
          .eq("is_current", true),
      ) as unknown as {
        required_level: number;
        is_mandatory: boolean;
        is_safety_critical: boolean;
        position: { title: string } | null;
      }[];
      return { c, ind, req };
    },
  });
  const levels = useQuery({ queryKey: qk.comp.levels(), queryFn: fetchLevels });
  const [editing, setEditing] = useState(false);
  if (q.isLoading) return <LoadingRows />;
  const c = q.data?.c;
  if (!c) return <EmptyState title="Competency not found" />;
  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={`${c.code} · ${c.category?.name ?? ""}`}
        title={c.name}
        description={c.description ?? undefined}
        actions={
          <>
            <StatusBadge status={c.status} />
            <SafetyTags mandatory={c.is_mandatory} safety={c.is_safety_critical} />
            {has("comp.manage") && (
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil /> Edit
              </Button>
            )}
          </>
        }
      />
      {c.definition && (
        <Panel title="Definition">
          <p className="whitespace-pre-wrap text-sm">{c.definition}</p>
        </Panel>
      )}
      <Panel title="Proficiency levels and indicators">
        <DefaultNote />
        <ol className="mt-3 space-y-3">
          {levels.data?.map((l) => (
            <li key={l.level} className="flex gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-md bg-secondary font-data font-bold text-primary">
                {l.level}
              </span>
              <div>
                <p className="font-bold">{l.label}</p>
                <ul className="list-disc pl-5 text-sm">
                  {q
                    .data!.ind.filter((i) => i.level === l.level)
                    .map((i, k) => (
                      <li key={k}>{i.indicator}</li>
                    ))}
                  {!q.data!.ind.some((i) => i.level === l.level) && (
                    <li className="list-none text-muted-foreground">{l.description}</li>
                  )}
                </ul>
              </div>
            </li>
          ))}
        </ol>
      </Panel>
      <Panel title="Applicable positions">
        {!q.data!.req.length ? (
          <p className="text-sm text-muted-foreground">Not required by any position yet.</p>
        ) : (
          <ul className="divide-y">
            {q.data!.req.map((r, i) => (
              <li key={i} className="flex justify-between py-2 text-sm">
                <span className="font-bold">{r.position?.title}</span>
                <span className="flex gap-2 font-data">
                  Level {r.required_level}{" "}
                  <SafetyTags mandatory={r.is_mandatory} safety={r.is_safety_critical} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      {editing && (
        <CompetencyDialog
          competency={c}
          indicators={q.data!.ind}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}
