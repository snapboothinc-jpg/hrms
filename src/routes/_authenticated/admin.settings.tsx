import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { check, fetchLevels } from "@/lib/data";
import { updateProficiencyLevel, updateSetting } from "@/lib/api/actions.functions";
import { useAction } from "@/hooks/use-action";
import { usePermissions } from "@/hooks/use-me";
import { qk } from "@/lib/query-keys";
import { PageHeader, Panel, DefaultNote, LoadingRows, Field } from "@/components/app/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Priority Handling Logistics, Inc." },
      { name: "description", content: "System and framework configuration." },
    ],
  }),
  component: Page,
});

type S = {
  id: string;
  key: string;
  value: unknown;
  description: string | null;
  requires_validation: boolean;
  version: number;
};

function Page() {
  const { has, any } = usePermissions();
  const levels = useQuery({ queryKey: qk.comp.levels(), queryFn: fetchLevels });
  const settings = useQuery({
    queryKey: qk.shared.settings(),
    queryFn: async () =>
      check(await supabase.from("system_settings").select("*").order("key")) as S[],
  });
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Policies here are configurable. Values marked as defaults need confirmation by your organization."
      />
      <Panel
        title="Proficiency framework"
        description="Five levels used by all competencies. Labels and descriptions are editable; the 1–5 scale is fixed."
      >
        <DefaultNote />
        {levels.isLoading ? (
          <LoadingRows />
        ) : (
          <div className="mt-4 space-y-3">
            {levels.data?.map((l) => (
              <LevelRow key={l.id} level={l} canEdit={has("comp.manage")} />
            ))}
          </div>
        )}
      </Panel>
      <Panel title="Workflow policies">
        {settings.isLoading ? (
          <LoadingRows />
        ) : (
          <div className="space-y-3">
            {settings.data?.map((s) => (
              <SettingRow key={s.id} s={s} canEdit={any("admin.settings", "perf.manage")} />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function LevelRow({
  level,
  canEdit,
}: {
  level: { level: number; label: string; description: string; version: number };
  canEdit: boolean;
}) {
  const [label, setLabel] = useState(level.label);
  const [desc, setDesc] = useState(level.description);
  const save = useAction(useServerFn(updateProficiencyLevel), {
    invalidate: [qk.comp.levels()],
    success: `Level ${level.level} saved`,
  });
  const dirty = label !== level.label || desc !== level.description;
  return (
    <div className="grid gap-3 rounded-md border p-3 md:grid-cols-[4rem_12rem_1fr_auto] md:items-end">
      <p className="font-data text-2xl font-bold text-primary">{level.level}</p>
      <Field label="Label" htmlFor={`l${level.level}`}>
        <Input
          id={`l${level.level}`}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          disabled={!canEdit}
          maxLength={60}
        />
      </Field>
      <Field label="Description" htmlFor={`d${level.level}`}>
        <Textarea
          id={`d${level.level}`}
          rows={2}
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          disabled={!canEdit}
          maxLength={1000}
        />
      </Field>
      {canEdit && (
        <Button
          disabled={!dirty || save.isPending}
          onClick={() =>
            save.mutate({ level: level.level, label, description: desc, version: level.version })
          }
        >
          Save
        </Button>
      )}
    </div>
  );
}

function SettingRow({ s, canEdit }: { s: S; canEdit: boolean }) {
  const [val, setVal] = useState(JSON.stringify(s.value));
  const save = useAction(useServerFn(updateSetting), {
    invalidate: [qk.shared.settings()],
    success: "Setting saved",
  });
  return (
    <div className="grid gap-2 rounded-md border p-3 md:grid-cols-[1fr_14rem_auto] md:items-center">
      <div>
        <p className="font-data font-bold">{s.key}</p>
        <p className="text-sm text-muted-foreground">{s.description}</p>
      </div>
      <Input
        aria-label={s.key}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        disabled={!canEdit}
      />
      {canEdit && (
        <Button
          variant="outline"
          disabled={val === JSON.stringify(s.value) || save.isPending}
          onClick={() => {
            let v: unknown;
            try {
              v = JSON.parse(val);
            } catch {
              v = val;
            }
            save.mutate({ key: s.key, value: v as string, version: s.version });
          }}
        >
          Save
        </Button>
      )}
    </div>
  );
}
