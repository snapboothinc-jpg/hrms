import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { getAiStatus, updateAiSettings } from "@/lib/api/development.functions";
import { unwrap, ApiError } from "@/lib/api/result";
import { qk } from "@/lib/query-keys";
import {
  PageHeader,
  Panel,
  StatusBadge,
  Field,
  DefaultNote,
  fmtDateTime,
} from "@/components/app/kit";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/ai")({
  head: () => ({
    meta: [
      { title: "AI settings — Priority Handling Logistics, Inc." },
      { name: "description", content: "AI provider status and model configuration." },
    ],
  }),
  component: Page,
});

function Page() {
  const qc = useQueryClient();
  const status = useQuery({ queryKey: [...qk.ai.all, "status"], queryFn: () => getAiStatus() });
  const update = useServerFn(updateAiSettings);
  const [form, setForm] = useState({ model: "gemini-2.5-flash" });
  const [busy, setBusy] = useState(false);

  const s = status.data as
    | {
        configured: boolean;
        provider: string;
        model: string;
        missing?: string;
        db: {
          provider: string;
          model: string;
          last_status: string | null;
          last_error: string | null;
          last_checked_at: string | null;
          version: number;
        } | null;
      }
    | undefined;

  useEffect(() => {
    if (s?.db) setForm({ model: s.db.model });
  }, [s?.db]);

  const save = async () => {
    if (!s?.db) return;
    setBusy(true);
    try {
      unwrap(
        await update({
          data: { provider: "gemini", model: form.model, version: s.db.version },
        }),
      );
      toast.success("AI settings saved");
      qc.invalidateQueries({ queryKey: qk.ai.all });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not save settings");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="AI settings"
        description="Provider status and model configuration. Keys are never displayed or logged."
      />
      <DefaultNote>
        AI output is advisory only. It never changes ratings and never makes promotion, dismissal,
        compensation, or succession decisions.
      </DefaultNote>
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <Panel title="Provider status">
          {!s ? (
            <p className="text-sm text-muted-foreground">Checking…</p>
          ) : (
            <dl className="grid gap-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  {s.configured ? (
                    <StatusBadge status="approved" label="Configured" />
                  ) : (
                    <StatusBadge status="rejected" label="Not configured" />
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Active provider</dt>
                <dd className="font-semibold">Gemini API (direct key)</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Model</dt>
                <dd className="font-data">{s.model}</dd>
              </div>
              {!s.configured && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3">
                  <p className="font-semibold text-destructive">
                    Missing environment variable: {s.missing}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Set the GEMINI_API_KEY environment variable on the server to enable the direct
                    Gemini provider. Until then, no recommendations are generated and none are
                    fabricated.
                  </p>
                </div>
              )}
              {s.db?.last_checked_at && (
                <>
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Last check</dt>
                    <dd>{fmtDateTime(s.db.last_checked_at)}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Last result</dt>
                    <dd>{s.db.last_status ?? "—"}</dd>
                  </div>
                  {s.db.last_error && <p className="text-xs text-destructive">{s.db.last_error}</p>}
                </>
              )}
            </dl>
          )}
        </Panel>
        <Panel title="Configuration">
          <div className="grid gap-3">
            <p className="text-sm text-muted-foreground">
              Provider: Gemini API (direct key). Add GEMINI_API_KEY to the server environment;
              provider credentials are never sent to the browser.
            </p>
            <Field label="Model" htmlFor="ai-model">
              <Input
                id="ai-model"
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                maxLength={120}
              />
            </Field>
            <div>
              <Button onClick={save} disabled={busy || !s?.db}>
                Save configuration
              </Button>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
