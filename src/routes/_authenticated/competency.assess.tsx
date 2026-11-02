import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Save, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { check, fetchEmployees, fetchLevels, fetchRequirements, empName } from "@/lib/data";
import {
  addAssessmentEvidence,
  saveAssessment,
  submitAssessment,
} from "@/lib/api/actions.functions";
import { useAction } from "@/hooks/use-action";
import { usePermissions } from "@/hooks/use-me";
import { qk } from "@/lib/query-keys";
import {
  PageHeader,
  Panel,
  Field,
  NativeSelect,
  ConfirmDialog,
  LoadingRows,
  EmptyState,
  SafetyTags,
  Tag,
  fmtDateTime,
} from "@/components/app/kit";
import { EvidenceFileLink, EvidenceUpload } from "@/components/app/evidence";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

const search = z.object({
  id: z.string().uuid().optional(),
  employee: z.string().uuid().optional(),
  competency: z.string().uuid().optional(),
  reassess: z.boolean().optional(),
});

export const Route = createFileRoute("/_authenticated/competency/assess")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Competency assessment — Priority Handling Logistics, Inc." },
      { name: "description", content: "Record a competency assessment with evidence." },
    ],
  }),
  component: Page,
});

type Draft = {
  id: string;
  employee_id: string;
  competency_id: string;
  current_level: number | null;
  evidence_summary: string | null;
  comments: string | null;
  is_reassessment: boolean;
  status: string;
  version: number;
};

function Page() {
  const s = Route.useSearch();
  const { has, employeeId } = usePermissions();
  const navigate = useNavigate();
  const existing = useQuery({
    queryKey: [...qk.comp.assessments(), "draft", s.id],
    enabled: !!s.id,
    queryFn: async () =>
      check(
        await supabase.from("competency_assessments").select("*").eq("id", s.id!).maybeSingle(),
      ) as Draft | null,
  });
  const emps = useQuery({ queryKey: qk.org.employees(), queryFn: fetchEmployees });
  const levels = useQuery({ queryKey: qk.comp.levels(), queryFn: fetchLevels });
  const [d, setD] = useState({
    id: null as string | null,
    version: null as number | null,
    employee_id: s.employee ?? "",
    competency_id: s.competency ?? "",
    current_level: null as number | null,
    evidence_summary: "",
    comments: "",
    is_reassessment: s.reassess ?? false,
  });
  useEffect(() => {
    const x = existing.data;
    if (x)
      setD({
        id: x.id,
        version: x.version,
        employee_id: x.employee_id,
        competency_id: x.competency_id,
        current_level: x.current_level,
        evidence_summary: x.evidence_summary ?? "",
        comments: x.comments ?? "",
        is_reassessment: x.is_reassessment,
      });
  }, [existing.data]);
  const emp = emps.data?.find((e) => e.id === d.employee_id);
  const reqs = useQuery({
    queryKey: qk.comp.requirements(emp?.position_id),
    enabled: !!emp,
    queryFn: () => fetchRequirements(emp!.position_id),
  });
  const req = reqs.data?.find((r) => r.competency_id === d.competency_id);
  const evidence = useQuery({
    queryKey: [...qk.comp.assessments(), "evidence", d.id],
    enabled: !!d.id,
    queryFn: async () =>
      check(
        await supabase
          .from("competency_assessment_evidence")
          .select("*, file:file_metadata(original_name)")
          .eq("assessment_id", d.id!)
          .order("created_at"),
      ) as unknown as {
        id: string;
        file_id: string | null;
        note: string | null;
        created_at: string;
        file: { original_name: string } | null;
      }[],
  });
  const [confirm, setConfirm] = useState(false);
  const [note, setNote] = useState("");
  const save = useAction(useServerFn(saveAssessment), {
    invalidate: [qk.comp.all],
    success: "Draft saved",
    onSuccess: (r) => {
      setD((x) => ({ ...x, id: r.id, version: r.version }));
      if (!s.id) navigate({ to: "/competency/assess", search: { id: r.id }, replace: true });
    },
  });
  const submit = useAction(useServerFn(submitAssessment), {
    idempotent: true,
    invalidate: [qk.comp.all, qk.shared.approvals()],
    success: "Submitted for approval",
    onSuccess: () => navigate({ to: "/competency/history" }),
  });
  const addEv = useAction(useServerFn(addAssessmentEvidence), {
    invalidate: [qk.comp.assessments()],
    success: "Evidence added",
    onSuccess: () => setNote(""),
  });

  if (!has("comp.assess"))
    return (
      <EmptyState
        title="Not available"
        description="Only authorized assessors can record assessments."
      />
    );
  if (s.id && existing.isLoading) return <LoadingRows />;
  if (s.id && existing.data && existing.data.status !== "draft")
    return (
      <EmptyState
        title="This assessment is no longer a draft"
        description="Submitted assessments can't be edited."
      />
    );
  const team = (emps.data ?? []).filter(
    (e) => e.id !== employeeId && e.employment_status === "active",
  );
  const locked = !!d.id;
  const doSave = () =>
    save.mutate({
      id: d.id,
      version: d.version,
      employee_id: d.employee_id,
      competency_id: d.competency_id,
      current_level: d.current_level,
      evidence_summary: d.evidence_summary,
      comments: d.comments,
      is_reassessment: d.is_reassessment,
    });

  return (
    <div className="max-w-4xl space-y-4">
      <PageHeader
        title={d.is_reassessment ? "Competency reassessment" : "Competency assessment"}
        description="You cannot assess yourself, and a different reviewer approves your assessment. Evidence is required before submitting."
      />
      <Panel>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Employee" htmlFor="em" required>
            <NativeSelect
              id="em"
              value={d.employee_id}
              disabled={locked}
              onChange={(e) => setD({ ...d, employee_id: e.target.value, competency_id: "" })}
            >
              <option value="">Select…</option>
              {team.map((e) => (
                <option key={e.id} value={e.id}>
                  {empName(e)} — {e.position?.title}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field
            label="Competency"
            htmlFor="co"
            required
            hint={emp && !reqs.data?.length ? "This position has no requirements." : undefined}
          >
            <NativeSelect
              id="co"
              value={d.competency_id}
              disabled={locked || !emp}
              onChange={(e) => setD({ ...d, competency_id: e.target.value })}
            >
              <option value="">Select…</option>
              {reqs.data
                ?.filter((r) => r.competency?.status === "active")
                .map((r) => (
                  <option key={r.competency_id} value={r.competency_id}>
                    {r.competency?.name}
                  </option>
                ))}
            </NativeSelect>
          </Field>
          {req && (
            <p className="flex items-center gap-2 text-sm sm:col-span-2">
              Required level <Tag tone="primary">{req.required_level}</Tag>{" "}
              <SafetyTags mandatory={req.is_mandatory} safety={req.is_safety_critical} />
            </p>
          )}
          <label className="flex items-center gap-2 text-sm font-bold sm:col-span-2">
            <Checkbox
              checked={d.is_reassessment}
              onCheckedChange={(c) => setD({ ...d, is_reassessment: c === true })}
            />{" "}
            This is a reassessment after learning or training
          </label>
        </div>
      </Panel>
      <Panel title="Current proficiency level">
        <div
          role="radiogroup"
          aria-label="Current proficiency level"
          className="grid gap-2 sm:grid-cols-5"
        >
          {levels.data?.map((l) => (
            <button
              key={l.level}
              type="button"
              role="radio"
              aria-checked={d.current_level === l.level}
              onClick={() => setD({ ...d, current_level: l.level })}
              className={cn(
                "rounded-md border p-3 text-left",
                d.current_level === l.level
                  ? "border-primary bg-secondary ring-2 ring-primary"
                  : "bg-card hover:bg-accent",
              )}
            >
              <span className="font-data text-xl font-bold text-primary">{l.level}</span>
              <span className="block font-bold">{l.label}</span>
              <span className="block text-xs text-muted-foreground">{l.description}</span>
            </button>
          ))}
        </div>
      </Panel>
      <Panel title="Evidence and comments">
        <div className="space-y-4">
          <Field
            label="Evidence summary"
            htmlFor="ev"
            hint="What did you observe or review? Required unless you attach evidence below."
          >
            <Textarea
              id="ev"
              value={d.evidence_summary}
              maxLength={4000}
              onChange={(e) => setD({ ...d, evidence_summary: e.target.value })}
            />
          </Field>
          <Field label="Comments" htmlFor="cm">
            <Textarea
              id="cm"
              value={d.comments}
              maxLength={4000}
              onChange={(e) => setD({ ...d, comments: e.target.value })}
            />
          </Field>
          {d.id ? (
            <div>
              <ul className="mb-2 space-y-1">
                {evidence.data?.map((e) => (
                  <li key={e.id} className="text-sm">
                    {e.file_id ? (
                      <EvidenceFileLink fileId={e.file_id} name={e.file?.original_name ?? "file"} />
                    ) : (
                      e.note
                    )}{" "}
                    <span className="font-data text-xs text-muted-foreground">
                      · {fmtDateTime(e.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-64 flex-1">
                  <Field label="Evidence note" htmlFor="en">
                    <Input
                      id="en"
                      value={note}
                      maxLength={2000}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </Field>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!note.trim() || addEv.isPending}
                  onClick={() => addEv.mutate({ assessment_id: d.id!, file_id: null, note })}
                >
                  Add note
                </Button>
                <EvidenceUpload
                  employeeId={d.employee_id}
                  onUploaded={(fid) =>
                    addEv
                      .mutateAsync({ assessment_id: d.id!, file_id: fid, note: null })
                      .then(() => undefined)
                  }
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Save the draft to attach files.</p>
          )}
        </div>
      </Panel>
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          disabled={!d.employee_id || !d.competency_id || save.isPending}
          onClick={doSave}
        >
          <Save /> Save draft
        </Button>
        <Button
          disabled={!d.id || submit.isPending}
          title={!d.id ? "Save the draft first" : undefined}
          onClick={() => setConfirm(true)}
        >
          <Send /> Submit for approval
        </Button>
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Submit assessment?"
        description="Make sure your latest changes are saved. A reviewer other than you will approve or reject it."
        pending={submit.isPending}
        onConfirm={() => d.id && submit.mutate({ id: d.id })}
      />
    </div>
  );
}
