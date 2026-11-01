import { createFileRoute, Link, useBlocker } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, RotateCcw, Save, Send, Undo2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { check, empName, fetchGaps, type GapRow } from "@/lib/data";
import {
  acknowledgeEvaluation,
  addEvaluationEvidence,
  addPerformanceFactorEvidence,
  reviewCriticalRequirement,
  reopenEvaluation,
  reviewEvaluation,
  saveEvaluation,
  submitEvaluation,
  saveCriticalRequirement,
} from "@/lib/api/actions.functions";
import { computePerformanceScore, computeScore } from "@/lib/rules";
import { performanceFactorCodes } from "@/lib/schemas";
import { useAction } from "@/hooks/use-action";
import { usePermissions } from "@/hooks/use-me";
import { qk } from "@/lib/query-keys";
import {
  PageHeader,
  Panel,
  StatusBadge,
  ConfirmDialog,
  LoadingRows,
  EmptyState,
  Field,
  NativeSelect,
  Tag,
  fmtDateTime,
  fmtDate,
} from "@/components/app/kit";
import { EvidenceFileLink, EvidenceUpload } from "@/components/app/evidence";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/performance/evaluations/$id")({
  head: () => ({
    meta: [
      { title: "Evaluation — Priority Handling Logistics, Inc." },
      { name: "description", content: "Evaluation form and detail." },
    ],
  }),
  component: Page,
});

type SnapItem = {
  id: string;
  label: string;
  help_text: string | null;
  item_type: string;
  weight: number;
  options: string[];
  kpi_target: number | null;
  kpi_unit: string | null;
  evidence_required: boolean;
  is_required: boolean;
  competency_id: string | null;
};
type Snapshot = {
  profile_name: string;
  version_number: number;
  rating_scale_max: number;
  instructions: string | null;
  scoring_method?: "weighted" | "equal";
  final_score_rule?: "supervisor" | "self" | "average";
  classification_thresholds?: { label: string; min: number; max: number }[];
  performance_factors?: SnapFactor[];
  sections: { id: string; title: string; description: string | null; items: SnapItem[] }[];
};
type SnapFactor = {
  factor_code: (typeof performanceFactorCodes)[number];
  title: string;
  description: string;
  indicators: string[];
  weight: number;
  evidence_required: boolean;
};
type Resp = {
  item_id: string;
  respondent: "self" | "evaluator";
  rating: number | null;
  text_value: string | null;
  choice_values: string[] | null;
  kpi_actual: number | null;
  comment: string | null;
};
type FactorResp = {
  factor_code: (typeof performanceFactorCodes)[number];
  respondent: "self" | "evaluator";
  rating: number | null;
  comment: string | null;
};
type A = {
  id: string;
  status: string;
  version: number;
  snapshot: Snapshot;
  employee_id: string;
  evaluator_id: string;
  self_evaluation: boolean;
  self_submitted_at: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  acknowledgement_comment: string | null;
  overall_score: number | null;
  self_score: number | null;
  self_profile_score: number | null;
  supervisor_score: number | null;
  final_score: number | null;
  classification: string | null;
  overall_comment: string | null;
  reopen_reason: string | null;
  employee: {
    first_name: string;
    last_name: string;
    employee_code: string;
    department: { name: string } | null;
    position: { title: string } | null;
  } | null;
  evaluator: { first_name: string; last_name: string } | null;
  cycle: {
    name: string;
    period_start: string;
    period_end: string;
    due_date: string | null;
  } | null;
};
type Development = Record<string, string>;
type CriticalRequirement = {
  id: string;
  requirement_type: string;
  name: string;
  description: string | null;
  issuing_authority: string | null;
  reference_number: string | null;
  valid_from: string | null;
  expires_on: string | null;
  file_id: string | null;
  is_safety_critical: boolean;
  is_active: boolean;
  file: { original_name: string } | null;
};
type CompetencyAssessment = {
  id: string;
  competency_id: string;
  assessor_id: string;
  assessment_date: string;
  current_level: number | null;
  evidence_summary: string | null;
  comments: string | null;
  assessment_method: string | null;
  status: string;
  reviewer_id: string | null;
  reviewed_at: string | null;
  review_comments: string | null;
  is_reassessment: boolean;
  competency: { name: string; code: string } | null;
  evidence: {
    id: string;
    file_id: string | null;
    item_id: string | null;
    note: string | null;
    file: { original_name: string } | null;
  }[];
};

function Page() {
  const { id } = Route.useParams();
  const { employeeId, has } = usePermissions();
  const q = useQuery({
    queryKey: qk.perf.assignment(id),
    queryFn: async () => {
      const a = check(
        await supabase
          .from("evaluation_assignments")
          .select(
            "*, employee:employees!evaluation_assignments_employee_id_fkey(first_name,last_name,employee_code,department:departments!employees_department_id_fkey(name),position:positions!employees_position_id_fkey(title)), evaluator:employees!evaluation_assignments_evaluator_id_fkey(first_name,last_name), cycle:evaluation_cycles(name,period_start,period_end,due_date)",
          )
          .eq("id", id)
          .maybeSingle(),
      ) as unknown as A | null;
      if (!a) return null;
      const [
        responses,
        evidence,
        factorResponses,
        reviews,
        developmentResponses,
        criticalRequirements,
        criticalReviews,
        assessments,
        supervisor,
      ] = await Promise.all([
        supabase.from("evaluation_responses").select("*").eq("assignment_id", id),
        supabase
          .from("evaluation_evidence")
          .select("*, file:file_metadata(original_name)")
          .eq("assignment_id", id)
          .order("created_at"),
        supabase.from("evaluation_factor_responses").select("*").eq("assignment_id", id),
        supabase
          .from("evaluation_reviews")
          .select("*")
          .eq("assignment_id", id)
          .order("created_at", { ascending: false }),
        supabase
          .from("evaluation_development_responses")
          .select("respondent,content")
          .eq("assignment_id", id),
        supabase
          .from("employee_critical_requirements")
          .select("*, file:file_metadata(original_name)")
          .eq("employee_id", a.employee_id)
          .eq("is_active", true)
          .order("expires_on"),
        supabase
          .from("evaluation_critical_requirement_reviews")
          .select("*")
          .eq("assignment_id", id),
        supabase
          .from("competency_assessments")
          .select(
            "id,competency_id,assessor_id,assessment_date,current_level,evidence_summary,comments,assessment_method,status,reviewer_id,reviewed_at,review_comments,is_reassessment,competency:competencies(name,code),evidence:competency_assessment_evidence(id,file_id,note,file:file_metadata(original_name))",
          )
          .eq("employee_id", a.employee_id)
          .eq("status", "approved")
          .order("assessment_date", { ascending: false }),
        supabase
          .from("reporting_relationships")
          .select(
            "supervisor:employees!reporting_relationships_supervisor_id_fkey(first_name,last_name)",
          )
          .eq("employee_id", a.employee_id)
          .eq("is_current", true)
          .maybeSingle(),
      ]);
      const compGaps = await fetchGaps({ employee: a.employee_id });
      const approvedAssessments = check(assessments) as unknown as CompetencyAssessment[];
      const assessorProfiles = approvedAssessments.length
        ? (check(
            await supabase.rpc("evaluation_competency_assessor_names", {
              _assessment_ids: approvedAssessments.map((assessment) => assessment.id),
            }),
          ) as { assessment_id: string; assessor_name: string }[])
        : [];
      return {
        a,
        responses: check(responses) as Resp[],
        factorResponses: check(factorResponses) as FactorResp[],
        evidence: check(evidence) as unknown as {
          id: string;
          file_id: string | null;
          note: string | null;
          item_id: string | null;
          factor_code: string | null;
          created_at: string;
          file: { original_name: string } | null;
        }[],
        reviews: check(reviews) as {
          id: string;
          decision: string;
          comments: string | null;
          created_at: string;
        }[],
        developmentResponses: check(developmentResponses) as {
          respondent: "self" | "evaluator";
          content: Development;
        }[],
        criticalRequirements: check(criticalRequirements) as unknown as CriticalRequirement[],
        criticalReviews: check(criticalReviews) as {
          id: string;
          requirement_id: string;
          compliance_status: string;
          comments: string | null;
          reviewed_at: string;
          reviewed_by: string;
        }[],
        assessments: approvedAssessments,
        assessorNames: Object.fromEntries(
          assessorProfiles.map((profile) => [profile.assessment_id, profile.assessor_name]),
        ),
        supervisor:
          (
            check(supervisor) as unknown as {
              supervisor: { first_name: string; last_name: string } | null;
            } | null
          )?.supervisor ?? null,
        compGaps: compGaps as GapRow[],
      };
    },
  });

  if (q.isLoading) return <LoadingRows rows={8} />;
  if (!q.data)
    return (
      <EmptyState
        title="Evaluation not found"
        description="It doesn't exist or isn't in your scope."
      />
    );
  const { a } = q.data;
  const isEvaluator = a.evaluator_id === employeeId;
  const isEmployee = a.employee_id === employeeId;
  const evaluatorEditable =
    isEvaluator &&
    (!a.self_evaluation || !!a.self_submitted_at) &&
    ["not_started", "in_progress", "reopened"].includes(a.status);
  const selfEditable =
    isEmployee &&
    a.self_evaluation &&
    (!a.self_submitted_at || a.status === "reopened") &&
    !["submitted", "under_review", "approved"].includes(a.status);
  const respondent: "self" | "evaluator" | null = evaluatorEditable
    ? "evaluator"
    : selfEditable
      ? "self"
      : null;
  const canReview =
    has("perf.approve") &&
    !isEvaluator &&
    !isEmployee &&
    ["submitted", "under_review"].includes(a.status);
  const canReopen = has("perf.approve") && !isEvaluator && !isEmployee && a.status === "approved";
  const canAcknowledge = isEmployee && a.status === "approved" && !a.acknowledged_at;
  const canManageCriticalRequirements = has("hr.employees") || has("admin.org");
  const canAssessCompetencies = has("comp.assess");
  return (
    <EvaluationView
      key={a.version}
      data={q.data}
      respondent={respondent}
      canReview={canReview}
      canViewDraftSupervisorScore={canReview || isEvaluator}
      canReopen={canReopen}
      canAcknowledge={canAcknowledge}
      canManageCriticalRequirements={canManageCriticalRequirements}
      canAssessCompetencies={canAssessCompetencies}
      showEvaluatorToEmployee={!isEmployee || a.status === "approved"}
    />
  );
}

function EvaluationView({
  data,
  respondent,
  canReview,
  canViewDraftSupervisorScore,
  canReopen,
  canAcknowledge,
  canManageCriticalRequirements,
  canAssessCompetencies,
  showEvaluatorToEmployee,
}: {
  data: {
    a: A;
    responses: Resp[];
    factorResponses: FactorResp[];
    developmentResponses: { respondent: "self" | "evaluator"; content: Development }[];
    compGaps: GapRow[];
    assessments: CompetencyAssessment[];
    assessorNames: Record<string, string>;
    supervisor: { first_name: string; last_name: string } | null;
    criticalRequirements: CriticalRequirement[];
    criticalReviews: {
      id: string;
      requirement_id: string;
      compliance_status: string;
      comments: string | null;
      reviewed_at: string;
      reviewed_by: string;
    }[];
    evidence: {
      id: string;
      file_id: string | null;
      item_id: string | null;
      note: string | null;
      created_at: string;
      factor_code: string | null;
      file: { original_name: string } | null;
    }[];
    reviews: { id: string; decision: string; comments: string | null; created_at: string }[];
  };
  respondent: "self" | "evaluator" | null;
  canReview: boolean;
  canViewDraftSupervisorScore: boolean;
  canReopen: boolean;
  canAcknowledge: boolean;
  canManageCriticalRequirements: boolean;
  canAssessCompetencies: boolean;
  showEvaluatorToEmployee: boolean;
}) {
  const { a } = data;
  const snap = a.snapshot;
  const initial = useMemo(() => {
    const m: Record<string, Resp> = {};
    data.responses.filter((r) => r.respondent === respondent).forEach((r) => (m[r.item_id] = r));
    return m;
  }, [data.responses, respondent]);
  const initialFactors = useMemo(() => {
    const values: Record<string, Partial<FactorResp>> = {};
    data.factorResponses
      .filter((response) => response.respondent === respondent)
      .forEach((response) => (values[response.factor_code] = response));
    return values;
  }, [data.factorResponses, respondent]);
  const initialDevelopment = useMemo(
    () =>
      data.developmentResponses.find((response) => response.respondent === respondent)?.content ??
      {},
    [data.developmentResponses, respondent],
  );
  const [vals, setVals] = useState<Record<string, Partial<Resp>>>(initial);
  const [factorVals, setFactorVals] = useState<Record<string, Partial<FactorResp>>>(initialFactors);
  const [development, setDevelopment] = useState<Development>(initialDevelopment);
  const [overall, setOverall] = useState(a.overall_comment ?? "");
  const [dirty, setDirty] = useState(false);
  const [confirm, setConfirm] = useState<
    null | "submit" | "approve" | "return" | "reopen" | "acknowledge"
  >(null);
  const [comment, setComment] = useState("");
  const [note, setNote] = useState("");
  const [factorEvidenceNotes, setFactorEvidenceNotes] = useState<Record<string, string>>({});
  const [itemEvidenceNotes, setItemEvidenceNotes] = useState<Record<string, string>>({});
  const [criticalDraft, setCriticalDraft] = useState({
    requirement_type: "license" as "license" | "certification" | "qualification" | "safety",
    name: "",
    description: "",
    issuing_authority: "",
    reference_number: "",
    valid_from: "",
    expires_on: "",
    is_safety_critical: false,
    file_id: null as string | null,
  });
  const [criticalStatus, setCriticalStatus] = useState<Record<string, string>>({});
  const [criticalComments, setCriticalComments] = useState<Record<string, string>>({});
  useBlocker({
    shouldBlockFn: () => dirty && !window.confirm("You have unsaved changes. Leave anyway?"),
    enableBeforeUnload: () => dirty,
  });
  useEffect(() => setVals(initial), [initial]);
  useEffect(() => setFactorVals(initialFactors), [initialFactors]);
  useEffect(() => setDevelopment(initialDevelopment), [initialDevelopment]);

  const inv = [qk.perf.all, qk.shared.approvals()];
  const save = useAction(useServerFn(saveEvaluation), {
    invalidate: inv,
    success: "Draft saved",
    onSuccess: () => setDirty(false),
  });
  const submit = useAction(useServerFn(submitEvaluation), {
    idempotent: true,
    invalidate: inv,
    success:
      respondent === "self" ? "Self-evaluation submitted" : "Evaluation submitted for review",
    onSuccess: () => setConfirm(null),
  });
  const review = useAction(useServerFn(reviewEvaluation), {
    idempotent: true,
    invalidate: inv,
    success: "Decision recorded",
    onSuccess: () => {
      setConfirm(null);
      setComment("");
    },
  });
  const reopen = useAction(useServerFn(reopenEvaluation), {
    idempotent: true,
    invalidate: inv,
    success: "Evaluation reopened",
    onSuccess: () => {
      setConfirm(null);
      setComment("");
    },
  });
  const acknowledge = useAction(useServerFn(acknowledgeEvaluation), {
    idempotent: true,
    invalidate: inv,
    success: "Evaluation acknowledgement recorded",
    onSuccess: () => {
      setConfirm(null);
      setComment("");
    },
  });
  const addEv = useAction(useServerFn(addEvaluationEvidence), {
    invalidate: inv,
    success: "Evidence added",
    onSuccess: () => setNote(""),
  });
  const addFactorEv = useAction(useServerFn(addPerformanceFactorEvidence), {
    idempotent: true,
    invalidate: inv,
    success: "Performance factor evidence added",
    onSuccess: () => setNote(""),
  });
  const addCritical = useAction(useServerFn(saveCriticalRequirement), {
    idempotent: true,
    invalidate: inv,
    success: "Critical requirement saved",
    onSuccess: () =>
      setCriticalDraft((draft) => ({
        ...draft,
        name: "",
        description: "",
        issuing_authority: "",
        reference_number: "",
        valid_from: "",
        expires_on: "",
        file_id: null,
      })),
  });
  const reviewCritical = useAction(useServerFn(reviewCriticalRequirement), {
    idempotent: true,
    invalidate: inv,
    success: "Requirement review recorded",
  });

  const set = (itemId: string, patch: Partial<Resp>) => {
    setVals((v) => ({ ...v, [itemId]: { ...v[itemId], ...patch } }));
    setDirty(true);
  };
  const setFactor = (
    factorCode: (typeof performanceFactorCodes)[number],
    patch: Partial<FactorResp>,
  ) => {
    setFactorVals((values) => ({
      ...values,
      [factorCode]: { ...values[factorCode], factor_code: factorCode, ...patch },
    }));
    setDirty(true);
  };
  const saveFactorEvidence = (
    factorCode: (typeof performanceFactorCodes)[number],
    fileId: string | null,
    evidenceNote: string | null,
  ) =>
    addFactorEv
      .mutateAsync({
        assignment_id: a.id,
        factor_code: factorCode,
        file_id: fileId,
        note: evidenceNote,
      })
      .then(() =>
        setFactorEvidenceNotes((notes) => ({
          ...notes,
          [factorCode]: "",
        })),
      );
  const saveItemEvidence = (itemId: string, fileId: string | null, evidenceNote: string | null) =>
    addEv
      .mutateAsync({
        assignment_id: a.id,
        file_id: fileId,
        note: evidenceNote,
        item_id: itemId,
      })
      .then(() =>
        setItemEvidenceNotes((notes) => ({
          ...notes,
          [itemId]: "",
        })),
      );
  const payload = () => ({
    assignment_id: a.id,
    respondent: respondent!,
    responses: Object.entries(vals).map(([item_id, r]) => ({
      item_id,
      rating: r.rating ?? null,
      text_value: r.text_value ?? null,
      choice_values: r.choice_values ?? null,
      kpi_actual: r.kpi_actual ?? null,
      comment: r.comment ?? null,
    })),
    factor_responses: (snap.performance_factors ?? []).map((factor) => ({
      factor_code: factor.factor_code,
      rating: factorVals[factor.factor_code]?.rating ?? null,
      comment: factorVals[factor.factor_code]?.comment ?? null,
    })),
    development,
    overall_comment: respondent === "evaluator" ? overall : null,
    version: a.version,
  });
  const preview = respondent
    ? computePerformanceScore(
        (snap.performance_factors ?? []).map((factor) => ({
          factor_code: factor.factor_code,
          weight: factor.weight,
          rating: factorVals[factor.factor_code]?.rating ?? null,
        })),
        snap.scoring_method ?? "equal",
      )
    : null;
  const supervisorScorePreview = computePerformanceScore(
    (snap.performance_factors ?? []).map((factor) => ({
      factor_code: factor.factor_code,
      weight: factor.weight,
      rating:
        data.factorResponses.find(
          (response) =>
            response.factor_code === factor.factor_code && response.respondent === "evaluator",
        )?.rating ?? null,
    })),
    snap.scoring_method ?? "equal",
  );
  const itemRows = snap.sections.flatMap((section) => section.items);
  const itemScorePreview = respondent
    ? computeScore(
        itemRows.map((item) => ({
          id: item.id,
          item_type: item.item_type,
          weight: item.weight,
          kpi_target: item.kpi_target,
        })),
        Object.entries(vals).map(([item_id, response]) => ({
          item_id,
          rating: response.rating ?? null,
          kpi_actual: response.kpi_actual ?? null,
        })),
        snap.rating_scale_max,
      )
    : null;
  const other = (itemId: string, who: "self" | "evaluator") =>
    data.responses.find((r) => r.item_id === itemId && r.respondent === who);

  return (
    <div className="pb-24">
      <PageHeader
        eyebrow={`${a.cycle?.name} · ${snap.profile_name} v${snap.version_number}`}
        title={empName(a.employee)}
        description={
          <>
            Assigned evaluator: {empName(a.evaluator)} · Due {fmtDate(a.cycle?.due_date)}
          </>
        }
        actions={
          <>
            <StatusBadge status={a.status} />
            {a.final_score != null && <Tag tone="primary">Final score {a.final_score} / 5</Tag>}
            {a.classification && <Tag tone="success">{a.classification}</Tag>}
            {a.acknowledged_at && <Tag tone="success">Acknowledged</Tag>}
          </>
        }
      />
      <Panel
        title="A. Employee & Job Context"
        description="Read-only employee and assignment details."
      >
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
          <ContextValue label="Employee ID" value={a.employee?.employee_code ?? "—"} />
          <ContextValue label="Employee name" value={empName(a.employee)} />
          <ContextValue label="Department" value={a.employee?.department?.name ?? "—"} />
          <ContextValue label="Job position" value={a.employee?.position?.title ?? "—"} />
          <ContextValue label="Assigned supervisor" value={empName(data.supervisor)} />
          <ContextValue label="Evaluation cycle" value={a.cycle?.name ?? "—"} />
          <ContextValue
            label="Evaluation period"
            value={
              a.cycle ? `${fmtDate(a.cycle.period_start)} – ${fmtDate(a.cycle.period_end)}` : "—"
            }
          />
          <ContextValue label="Evaluator" value={empName(a.evaluator)} />
          <ContextValue label="Due date" value={fmtDate(a.cycle?.due_date)} />
          <ContextValue
            label="Evaluation profile"
            value={`${snap.profile_name} · v${snap.version_number}`}
          />
          <ContextValue label="Evaluation status" value={a.status.replaceAll("_", " ")} />
          <ContextValue
            label="Self-evaluation submitted"
            value={a.self_submitted_at ? fmtDateTime(a.self_submitted_at) : "Not submitted"}
          />
        </dl>
      </Panel>
      {a.reopen_reason && ["reopened"].includes(a.status) && (
        <div className="mb-4 rounded-md border border-warning/40 bg-warning-soft p-3 text-sm">
          <span className="font-bold">Reopened:</span> {a.reopen_reason}
        </div>
      )}
      {snap.instructions && (
        <Panel className="mb-4">
          <p className="text-sm">{snap.instructions}</p>
        </Panel>
      )}
      {respondent && (
        <p className="mb-3 text-sm font-bold text-accent-foreground">
          You are completing the{" "}
          {respondent === "self" ? "self-evaluation" : "evaluator assessment"}. Rating scale 1–
          {snap.rating_scale_max}.
        </p>
      )}

      <Panel
        title="Evaluation Summary"
        description="Performance factor scores are calculated separately for each respondent."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ScoreSummary label="Employee self-evaluation" score={a.self_score} />
          <ScoreSummary
            label="Supervisor evaluation"
            score={
              a.supervisor_score ?? (canViewDraftSupervisorScore ? supervisorScorePreview : null)
            }
          />
          <ScoreSummary
            label="Final approved score"
            score={a.final_score}
            classification={a.classification}
          />
          <div className="rounded-md border p-3">
            <p className="text-sm text-muted-foreground">Final score rule</p>
            <p className="mt-1 font-semibold">
              {snap.final_score_rule === "average"
                ? "Configured average"
                : snap.final_score_rule === "self"
                  ? "Employee self-evaluation"
                  : "Supervisor evaluation"}
            </p>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <ScoreSummary
              label="Employee profile/KPI score"
              score={a.self_profile_score}
              suffix="/ 100"
            />
            <ScoreSummary
              label="Supervisor profile/KPI score"
              score={a.overall_score}
              suffix="/ 100"
            />
          </div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          The final score is set only when an authorized reviewer approves this evaluation. No
          official classification is applied unless HR configures score ranges in the profile.
        </p>
      </Panel>

      <Panel
        title="B. Common Organizational Criteria"
        description="Rate each position-specific indicator from 1 (Poor) to 5 (Excellent). Employee and supervisor responses are stored independently."
      >
        {(snap.performance_factors ?? []).map((factor) => {
          const value = factorVals[factor.factor_code] ?? {};
          const employeeResponse = data.factorResponses.find(
            (response) =>
              response.factor_code === factor.factor_code && response.respondent === "self",
          );
          const supervisorResponse = data.factorResponses.find(
            (response) =>
              response.factor_code === factor.factor_code && response.respondent === "evaluator",
          );
          const safetyAlert =
            factor.factor_code === "safety_consciousness_equipment" &&
            [employeeResponse?.rating, supervisorResponse?.rating].some(
              (rating) => rating !== null && rating !== undefined && rating <= 2,
            );
          return (
            <div key={factor.factor_code} className="border-b py-4 last:border-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h3 className="font-bold">{factor.title}</h3>
                {snap.scoring_method === "weighted" && <Tag>{factor.weight}%</Tag>}
                {factor.evidence_required && <Tag tone="info">Evidence required</Tag>}
                {safetyAlert && <Tag tone="warning">Safety concern: review independently</Tag>}
              </div>
              <p className="text-sm">{factor.description}</p>
              {factor.indicators.length > 0 && (
                <ul className="my-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {factor.indicators.map((indicator) => (
                    <li key={indicator}>{indicator}</li>
                  ))}
                </ul>
              )}
              {respondent && (
                <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_minmax(16rem,1fr)]">
                  <div>
                    <p className="mb-1 text-sm font-semibold">
                      {respondent === "self" ? "Employee Self-Rating" : "Supervisor Rating"}
                    </p>
                    <div
                      className="flex flex-wrap gap-1"
                      role="radiogroup"
                      aria-label={`${factor.title} rating`}
                    >
                      {Array.from({ length: 5 }, (_, index) => index + 1).map((rating) => (
                        <button
                          key={rating}
                          type="button"
                          role="radio"
                          aria-checked={value.rating === rating}
                          onClick={() => setFactor(factor.factor_code, { rating })}
                          className={`size-10 rounded-md border font-data font-bold ${value.rating === rating ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent"}`}
                          aria-label={`${rating} - ${["Poor", "Below Average", "Average", "Above Average", "Excellent"][rating - 1]}`}
                        >
                          {rating}
                        </button>
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      1 Poor · 2 Below Average · 3 Average · 4 Above Average · 5 Excellent
                    </p>
                    <Textarea
                      className="mt-2"
                      aria-label={`Comment on ${factor.title}`}
                      placeholder={
                        respondent === "self"
                          ? "Employee comments and examples"
                          : "Supervisor observations and comments"
                      }
                      maxLength={4000}
                      value={value.comment ?? ""}
                      onChange={(event) =>
                        setFactor(factor.factor_code, { comment: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2 text-sm">
                    {respondent !== "self" && (
                      <ReadFactorResp label="Employee self-rating" response={employeeResponse} />
                    )}
                    {respondent !== "evaluator" && showEvaluatorToEmployee && (
                      <ReadFactorResp label="Supervisor rating" response={supervisorResponse} />
                    )}
                    {respondent && (
                      <div className="space-y-2 rounded-md border p-3">
                        <Field
                          label="Factor evidence note"
                          htmlFor={`factor-note-${factor.factor_code}`}
                        >
                          <Input
                            id={`factor-note-${factor.factor_code}`}
                            value={factorEvidenceNotes[factor.factor_code] ?? ""}
                            maxLength={2000}
                            onChange={(event) =>
                              setFactorEvidenceNotes((notes) => ({
                                ...notes,
                                [factor.factor_code]: event.target.value,
                              }))
                            }
                          />
                        </Field>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={
                              !factorEvidenceNotes[factor.factor_code]?.trim() ||
                              addFactorEv.isPending
                            }
                            onClick={() =>
                              void saveFactorEvidence(
                                factor.factor_code,
                                null,
                                factorEvidenceNotes[factor.factor_code] ?? "",
                              )
                            }
                          >
                            Add evidence note
                          </Button>
                          <EvidenceUpload
                            employeeId={a.employee_id}
                            onUploaded={(fileId) =>
                              saveFactorEvidence(factor.factor_code, fileId, null)
                            }
                          />
                        </div>
                      </div>
                    )}
                    {data.evidence
                      .filter((evidence) => evidence.factor_code === factor.factor_code)
                      .map((evidence) => (
                        <div key={evidence.id} className="rounded-md bg-muted p-2">
                          {evidence.file_id ? (
                            <EvidenceFileLink
                              fileId={evidence.file_id}
                              name={evidence.file?.original_name ?? "Evidence file"}
                            />
                          ) : (
                            evidence.note
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}
              {!respondent && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <ReadFactorResp label="Employee self-rating" response={employeeResponse} />
                  {showEvaluatorToEmployee && (
                    <ReadFactorResp label="Supervisor rating" response={supervisorResponse} />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </Panel>

      <Panel
        title="G. Performance Rating Comparison"
        description="Employee and supervisor ratings remain independent."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="py-2 pr-3">Performance factor</th>
                <th className="py-2 pr-3">Employee Rating</th>
                <th className="py-2 pr-3">Supervisor Rating</th>
                <th className="py-2">Difference</th>
              </tr>
            </thead>
            <tbody>
              {(snap.performance_factors ?? []).map((factor) => {
                const selfRating = data.factorResponses.find(
                  (response) =>
                    response.factor_code === factor.factor_code && response.respondent === "self",
                )?.rating;
                const supervisorRating = data.factorResponses.find(
                  (response) =>
                    response.factor_code === factor.factor_code &&
                    response.respondent === "evaluator",
                )?.rating;
                return (
                  <tr key={factor.factor_code} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-medium">{factor.title}</td>
                    <td className="py-2 pr-3">{selfRating ?? "—"}</td>
                    <td className="py-2 pr-3">
                      {showEvaluatorToEmployee
                        ? (supervisorRating ?? "—")
                        : "Withheld until final review"}
                    </td>
                    <td className="py-2">
                      {selfRating != null && supervisorRating != null
                        ? Math.abs(selfRating - supervisorRating)
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Differences are absolute point differences on the 1–5 scale. Critical safety concerns
          remain independently visible and are not hidden by aggregate scores.
        </p>
      </Panel>

      <Panel
        title="C. Position-Specific Performance / KPIs"
        description="These standards come from the assigned profile snapshot. Record measured actual results and link evidence; do not estimate operational outcomes."
      >
        {itemRows.filter((item) => item.item_type === "kpi").length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No position-specific KPI items are configured in this evaluation profile.
          </p>
        ) : (
          <div className="space-y-4">
            {itemRows
              .filter((item) => item.item_type === "kpi")
              .map((item) => {
                const value = vals[item.id] ?? {};
                const employeeResponse = other(item.id, "self");
                const supervisorResponse = other(item.id, "evaluator");
                const canEditThis = !!respondent;
                return (
                  <div key={item.id} className="rounded-md border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold">{item.label}</h3>
                        {item.help_text && (
                          <p className="mt-1 text-sm text-muted-foreground">{item.help_text}</p>
                        )}
                      </div>
                      {item.evidence_required && <Tag tone="info">Evidence required</Tag>}
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <ContextValue
                        label="Expected target / standard"
                        value={`${item.kpi_target ?? "Not configured"}${item.kpi_unit ? ` ${item.kpi_unit}` : ""}`}
                      />
                      <ContextValue
                        label="Employee actual result"
                        value={
                          employeeResponse?.kpi_actual == null
                            ? "Not provided"
                            : `${employeeResponse.kpi_actual}${item.kpi_unit ? ` ${item.kpi_unit}` : ""}`
                        }
                      />
                      <ContextValue
                        label="Supervisor-validated result"
                        value={
                          supervisorResponse?.kpi_actual == null
                            ? "Not recorded"
                            : `${supervisorResponse.kpi_actual}${item.kpi_unit ? ` ${item.kpi_unit}` : ""}`
                        }
                      />
                    </div>
                    {canEditThis && (
                      <div className="mt-4 grid gap-4 lg:grid-cols-2">
                        <div className="space-y-2">
                          <Field label="Actual result (measured)" htmlFor={`kpi-actual-${item.id}`}>
                            <Input
                              id={`kpi-actual-${item.id}`}
                              type="number"
                              step="any"
                              value={value.kpi_actual ?? ""}
                              onChange={(event) =>
                                set(item.id, {
                                  kpi_actual:
                                    event.target.value === "" ? null : Number(event.target.value),
                                })
                              }
                              aria-label={`${item.label} actual result`}
                            />
                          </Field>
                          <Field
                            label="Employee/Supervisor KPI rating"
                            htmlFor={`kpi-rating-${item.id}`}
                          >
                            <div
                              id={`kpi-rating-${item.id}`}
                              role="radiogroup"
                              aria-label={`${item.label} rating`}
                              className="flex flex-wrap gap-1"
                            >
                              {Array.from({ length: 5 }, (_, index) => index + 1).map((rating) => (
                                <button
                                  key={rating}
                                  type="button"
                                  role="radio"
                                  aria-checked={value.rating === rating}
                                  onClick={() => set(item.id, { rating })}
                                  className={`size-9 rounded-md border font-data font-bold ${value.rating === rating ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent"}`}
                                  aria-label={`${rating} - ${["Poor", "Below Average", "Average", "Above Average", "Excellent"][rating - 1]}`}
                                >
                                  {rating}
                                </button>
                              ))}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              1 Poor · 2 Below Average · 3 Average · 4 Above Average · 5 Excellent
                            </p>
                          </Field>
                        </div>
                        <Field
                          label={
                            respondent === "self"
                              ? "Employee explanation/comments"
                              : "Supervisor assessment/comments"
                          }
                          htmlFor={`kpi-comment-${item.id}`}
                        >
                          <Textarea
                            id={`kpi-comment-${item.id}`}
                            maxLength={4000}
                            value={value.comment ?? ""}
                            onChange={(event) => set(item.id, { comment: event.target.value })}
                          />
                        </Field>
                      </div>
                    )}
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {respondent !== "self" && (
                        <ReadResp label="Employee response" r={employeeResponse} />
                      )}
                      {respondent !== "evaluator" && showEvaluatorToEmployee && (
                        <ReadResp label="Supervisor assessment" r={supervisorResponse} />
                      )}
                    </div>
                    {(respondent ||
                      data.evidence.some((evidence) => evidence.item_id === item.id)) && (
                      <div className="mt-3 space-y-2">
                        <p className="text-sm font-semibold">Supporting Evidence</p>
                        {data.evidence
                          .filter((evidence) => evidence.item_id === item.id)
                          .map((evidence) => (
                            <div key={evidence.id} className="rounded-md bg-muted p-2 text-sm">
                              {evidence.file_id ? (
                                <EvidenceFileLink
                                  fileId={evidence.file_id}
                                  name={evidence.file?.original_name ?? "KPI evidence"}
                                />
                              ) : (
                                evidence.note
                              )}
                            </div>
                          ))}
                        {respondent && (
                          <div className="flex flex-wrap items-end gap-2">
                            <Field label="Evidence note" htmlFor={`kpi-evidence-${item.id}`}>
                              <Input
                                id={`kpi-evidence-${item.id}`}
                                value={itemEvidenceNotes[item.id] ?? ""}
                                maxLength={2000}
                                onChange={(event) =>
                                  setItemEvidenceNotes((notes) => ({
                                    ...notes,
                                    [item.id]: event.target.value,
                                  }))
                                }
                              />
                            </Field>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={!itemEvidenceNotes[item.id]?.trim() || addEv.isPending}
                              onClick={() =>
                                void saveItemEvidence(
                                  item.id,
                                  null,
                                  itemEvidenceNotes[item.id] ?? "",
                                )
                              }
                            >
                              Add evidence note
                            </Button>
                            <EvidenceUpload
                              employeeId={a.employee_id}
                              onUploaded={(fileId) => saveItemEvidence(item.id, fileId, null)}
                            />
                          </div>
                        )}
                      </div>
                    )}
                    {employeeResponse?.rating != null && supervisorResponse?.rating != null && (
                      <p className="mt-3 text-sm">
                        Rating difference:{" "}
                        <strong>
                          {Math.abs(employeeResponse.rating - supervisorResponse.rating)} points
                        </strong>
                      </p>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </Panel>

      <Panel
        title="F. Development Outcome"
        description="Employee input and supervisor recommendations are stored separately and do not alter ratings."
      >
        {(respondent === "self" ||
          respondent === "evaluator" ||
          canReview ||
          data.developmentResponses.some((response) => response.respondent === "self")) && (
          <div className="space-y-4 border-b pb-5">
            <h3 className="font-semibold">Employee Development Input</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ["strengths", "Personal strengths"],
                ["improvement_areas", "Areas I want to improve"],
                ["accomplishments", "Key accomplishments during this period"],
                ["development_needs", "Development needs"],
                ["career_interests", "Career or learning interests"],
                ["suggested_activities", "Suggested training or learning activities"],
                ["personal_goals", "Personal development goals"],
              ].map(([key, label]) => {
                const editable = respondent === "self";
                const content = editable
                  ? (development[key] ?? "")
                  : (data.developmentResponses.find((response) => response.respondent === "self")
                      ?.content[key] ?? "");
                return (
                  <Field key={key} label={label} htmlFor={`development-self-${key}`}>
                    {editable ? (
                      <Textarea
                        id={`development-self-${key}`}
                        maxLength={4000}
                        value={content}
                        onChange={(event) => {
                          setDevelopment((current) => ({ ...current, [key]: event.target.value }));
                          setDirty(true);
                        }}
                      />
                    ) : (
                      <p className="min-h-12 whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">
                        {content || "No response provided"}
                      </p>
                    )}
                  </Field>
                );
              })}
            </div>
          </div>
        )}
        {(respondent === "evaluator" ||
          canReview ||
          showEvaluatorToEmployee ||
          data.developmentResponses.some((response) => response.respondent === "evaluator")) && (
          <div className="space-y-4 pt-5">
            <h3 className="font-semibold">Supervisor Assessment & Development Recommendation</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ["strengths", "Employee strengths identified"],
                ["improvement_areas", "Areas requiring improvement"],
                ["performance_weaknesses", "Performance weaknesses"],
                ["development_needs", "Development needs"],
                ["recommended_learning", "Recommended learning activities"],
                ["recommended_training", "Recommended training activities"],
                ["competency_improvements", "Suggested competency improvements"],
                ["target_outcomes", "Target development outcomes"],
                ["next_steps", "Recommended next steps"],
                ["advancement_considerations", "Advancement or development considerations"],
                ["overall_assessment", "Supervisor overall assessment"],
                ["observations", "Key observations"],
                ["overall_recommendation", "Overall recommendation"],
                ["development_recommendation", "Development recommendation"],
                ["improvement_priorities", "Improvement priorities"],
                ["review_comments", "Additional review comments"],
                ["rating_difference_explanations", "Explanation of significant rating differences"],
              ].map(([key, label]) => {
                const editable = respondent === "evaluator";
                const content = editable
                  ? (development[key] ?? "")
                  : (data.developmentResponses.find(
                      (response) => response.respondent === "evaluator",
                    )?.content[key] ?? "");
                return (
                  <Field key={key} label={label} htmlFor={`development-evaluator-${key}`}>
                    {editable ? (
                      <Textarea
                        id={`development-evaluator-${key}`}
                        maxLength={4000}
                        value={content}
                        onChange={(event) => {
                          setDevelopment((current) => ({ ...current, [key]: event.target.value }));
                          setDirty(true);
                        }}
                      />
                    ) : (
                      <p className="min-h-12 whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">
                        {content || "No supervisor response recorded"}
                      </p>
                    )}
                  </Field>
                );
              })}
              {respondent === "evaluator" && (
                <Field label="Supervisor overall feedback" htmlFor="overall-feedback">
                  <Textarea
                    id="overall-feedback"
                    maxLength={8000}
                    value={overall}
                    onChange={(event) => {
                      setOverall(event.target.value);
                      setDirty(true);
                    }}
                  />
                </Field>
              )}
              {respondent !== "evaluator" && showEvaluatorToEmployee && a.overall_comment && (
                <Field label="Supervisor overall feedback" htmlFor="overall-feedback-readonly">
                  <p
                    id="overall-feedback-readonly"
                    className="min-h-12 whitespace-pre-wrap rounded-md bg-muted p-3 text-sm"
                  >
                    {a.overall_comment}
                  </p>
                </Field>
              )}
            </div>
          </div>
        )}
      </Panel>

      <Panel
        title="D. Competency Assessment"
        description="Validated competency assessments and gaps are separate from performance factor ratings."
      >
        {data.compGaps.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No position competency requirements or accessible assessment results are available.
          </p>
        ) : (
          <div className="space-y-3">
            {data.compGaps.map((gap) => (
              <div
                key={`${gap.competency_id}-${gap.employee_id}`}
                className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_auto_auto_auto]"
              >
                <div>
                  <p className="font-semibold">{gap.competency_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {gap.is_safety_critical ? "Safety-critical · " : ""}
                    Assessment status: {gap.gap_status.replaceAll("_", " ")}
                  </p>
                  {(() => {
                    const latest = data.assessments.find(
                      (assessment) => assessment.competency_id === gap.competency_id,
                    );
                    if (!latest)
                      return <p className="mt-1 text-sm">No validated assessment on record.</p>;
                    return (
                      <div className="mt-2 space-y-1 text-sm">
                        <p>
                          Validated {fmtDate(latest.assessment_date)} · Method:{" "}
                          {latest.assessment_method || "Not recorded"} · Assessor:{" "}
                          {data.assessorNames[latest.id] ?? "Authorized assessor"}
                        </p>
                        {latest.reviewed_at && (
                          <p className="text-xs text-muted-foreground">
                            Approved {fmtDateTime(latest.reviewed_at)}
                            {latest.review_comments ? ` · ${latest.review_comments}` : ""}
                          </p>
                        )}
                        {latest.evidence_summary && (
                          <p className="text-muted-foreground">{latest.evidence_summary}</p>
                        )}
                        {latest.comments && (
                          <p className="text-muted-foreground">{latest.comments}</p>
                        )}
                        {latest.evidence.map((evidence) => (
                          <div key={evidence.id} className="text-xs">
                            {evidence.file_id ? (
                              <EvidenceFileLink
                                fileId={evidence.file_id}
                                name={evidence.file?.original_name ?? "Assessment evidence"}
                              />
                            ) : (
                              evidence.note
                            )}
                          </div>
                        ))}
                        {data.assessments.filter(
                          (assessment) =>
                            assessment.competency_id === gap.competency_id &&
                            assessment.id !== latest.id,
                        ).length > 0 && (
                          <details className="pt-1">
                            <summary className="cursor-pointer text-xs font-semibold">
                              Previous validated assessments
                            </summary>
                            <ul className="mt-1 space-y-1">
                              {data.assessments
                                .filter(
                                  (assessment) =>
                                    assessment.competency_id === gap.competency_id &&
                                    assessment.id !== latest.id,
                                )
                                .map((assessment) => (
                                  <li key={assessment.id}>
                                    {fmtDate(assessment.assessment_date)} · Level{" "}
                                    {assessment.current_level ?? "Not assessed"} ·{" "}
                                    {assessment.assessment_method || "Method not recorded"}
                                  </li>
                                ))}
                            </ul>
                          </details>
                        )}
                      </div>
                    );
                  })()}
                  {gap.evidence_summary && (
                    <p className="mt-1 text-sm text-muted-foreground">{gap.evidence_summary}</p>
                  )}
                </div>
                <p className="text-sm">Required: {gap.required_level}</p>
                <p className="text-sm">
                  Validated current level: {gap.current_level ?? "Not assessed"}
                </p>
                <p className="text-sm">Gap: {gap.gap === null ? "Not assessed" : gap.gap}</p>
                {canAssessCompetencies && respondent !== "self" && (
                  <Link
                    to="/competency/assess"
                    search={{
                      employee: a.employee_id,
                      competency: gap.competency_id,
                      reassess: true,
                    }}
                    className="text-sm font-semibold text-primary hover:underline"
                  >
                    Start authorized reassessment
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title="E. Critical Requirements"
        description="License, certification, qualification, and safety compliance are read-only source records with separate evaluation review findings. They do not contribute to performance scores."
      >
        {data.criticalRequirements.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No active employee critical requirements are recorded.
          </p>
        ) : (
          <div className="space-y-3">
            {data.criticalRequirements.map((requirement) => {
              const review = data.criticalReviews.find(
                (entry) => entry.requirement_id === requirement.id,
              );
              const expired =
                requirement.expires_on != null &&
                new Date(`${requirement.expires_on}T00:00:00`) <
                  new Date(new Date().toDateString());
              const notYetValid =
                requirement.valid_from != null &&
                new Date(`${requirement.valid_from}T00:00:00`) >
                  new Date(new Date().toDateString());
              const reviewStatus =
                criticalStatus[requirement.id] ?? review?.compliance_status ?? "needs_review";
              return (
                <div key={requirement.id} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{requirement.name}</h3>
                    <Tag>{requirement.requirement_type}</Tag>
                    {requirement.is_safety_critical && <Tag tone="warning">Safety-critical</Tag>}
                    {expired || notYetValid ? (
                      <Tag tone="danger">{expired ? "Expired" : "Not yet valid"}</Tag>
                    ) : (
                      <Tag tone="success">Within validity dates</Tag>
                    )}
                    {review && <StatusBadge status={review.compliance_status} />}
                  </div>
                  {requirement.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{requirement.description}</p>
                  )}
                  <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <ContextValue
                      label="Issuing authority"
                      value={requirement.issuing_authority ?? "—"}
                    />
                    <ContextValue
                      label="Reference number"
                      value={requirement.reference_number ?? "—"}
                    />
                    <ContextValue label="Valid from" value={fmtDate(requirement.valid_from)} />
                    <ContextValue label="Expires" value={fmtDate(requirement.expires_on)} />
                  </div>
                  {requirement.file_id && (
                    <div className="mt-2 text-sm">
                      Supporting documentation:{" "}
                      <EvidenceFileLink
                        fileId={requirement.file_id}
                        name={requirement.file?.original_name ?? "Requirement document"}
                      />
                    </div>
                  )}
                  {(respondent === "evaluator" || canReview) && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-[12rem_minmax(0,1fr)_auto]">
                      <Field
                        label="Compliance review"
                        htmlFor={`critical-status-${requirement.id}`}
                      >
                        <NativeSelect
                          id={`critical-status-${requirement.id}`}
                          value={reviewStatus}
                          onChange={(event) =>
                            setCriticalStatus((current) => ({
                              ...current,
                              [requirement.id]: event.target.value,
                            }))
                          }
                        >
                          <option value="compliant">Compliant</option>
                          <option value="needs_review">Needs review</option>
                          <option value="non_compliant">Non-compliant</option>
                        </NativeSelect>
                      </Field>
                      <Field
                        label="Review findings"
                        htmlFor={`critical-comments-${requirement.id}`}
                      >
                        <Input
                          id={`critical-comments-${requirement.id}`}
                          maxLength={2000}
                          value={criticalComments[requirement.id] ?? review?.comments ?? ""}
                          onChange={(event) =>
                            setCriticalComments((current) => ({
                              ...current,
                              [requirement.id]: event.target.value,
                            }))
                          }
                        />
                      </Field>
                      <Button
                        type="button"
                        variant="outline"
                        className="self-end"
                        disabled={reviewCritical.isPending}
                        onClick={() =>
                          reviewCritical.mutate({
                            assignment_id: a.id,
                            requirement_id: requirement.id,
                            compliance_status: reviewStatus as
                              "compliant" | "needs_review" | "non_compliant",
                            comments: criticalComments[requirement.id] ?? review?.comments ?? "",
                          })
                        }
                      >
                        Record review
                      </Button>
                    </div>
                  )}
                  {review && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Reviewed {fmtDateTime(review.reviewed_at)}
                    </p>
                  )}
                  {(expired || notYetValid || review?.compliance_status === "non_compliant") && (
                    <p className="mt-2 rounded-md bg-destructive/10 p-2 text-sm font-semibold text-destructive">
                      Critical requirement warning: investigate separately from the performance
                      score.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {canManageCriticalRequirements && (
          <div className="mt-5 border-t pt-4">
            <h3 className="mb-3 font-semibold">Add employee requirement record</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Requirement type" htmlFor="critical-type">
                <NativeSelect
                  id="critical-type"
                  value={criticalDraft.requirement_type}
                  onChange={(event) =>
                    setCriticalDraft((draft) => ({
                      ...draft,
                      requirement_type: event.target.value as typeof draft.requirement_type,
                    }))
                  }
                >
                  <option value="license">License</option>
                  <option value="certification">Certification</option>
                  <option value="qualification">Qualification</option>
                  <option value="safety">Safety requirement</option>
                </NativeSelect>
              </Field>
              <Field label="Requirement name" htmlFor="critical-name" required>
                <Input
                  id="critical-name"
                  maxLength={160}
                  value={criticalDraft.name}
                  onChange={(event) =>
                    setCriticalDraft((draft) => ({ ...draft, name: event.target.value }))
                  }
                />
              </Field>
              <Field label="Issuing authority" htmlFor="critical-authority">
                <Input
                  id="critical-authority"
                  maxLength={160}
                  value={criticalDraft.issuing_authority}
                  onChange={(event) =>
                    setCriticalDraft((draft) => ({
                      ...draft,
                      issuing_authority: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Reference number" htmlFor="critical-reference">
                <Input
                  id="critical-reference"
                  maxLength={120}
                  value={criticalDraft.reference_number}
                  onChange={(event) =>
                    setCriticalDraft((draft) => ({
                      ...draft,
                      reference_number: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Valid from" htmlFor="critical-valid-from">
                <Input
                  id="critical-valid-from"
                  type="date"
                  value={criticalDraft.valid_from}
                  onChange={(event) =>
                    setCriticalDraft((draft) => ({ ...draft, valid_from: event.target.value }))
                  }
                />
              </Field>
              <Field label="Expiration date" htmlFor="critical-expires">
                <Input
                  id="critical-expires"
                  type="date"
                  value={criticalDraft.expires_on}
                  onChange={(event) =>
                    setCriticalDraft((draft) => ({ ...draft, expires_on: event.target.value }))
                  }
                />
              </Field>
              <Field label="Description" htmlFor="critical-description">
                <Textarea
                  id="critical-description"
                  maxLength={2000}
                  value={criticalDraft.description}
                  onChange={(event) =>
                    setCriticalDraft((draft) => ({ ...draft, description: event.target.value }))
                  }
                />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={criticalDraft.is_safety_critical}
                  onCheckedChange={(checked) =>
                    setCriticalDraft((draft) => ({
                      ...draft,
                      is_safety_critical: checked === true,
                    }))
                  }
                />
                Safety-critical requirement
              </label>
              <div>
                <p className="mb-1 text-sm font-semibold">Supporting documentation</p>
                <EvidenceUpload
                  employeeId={a.employee_id}
                  onUploaded={(fileId) =>
                    setCriticalDraft((draft) => ({ ...draft, file_id: fileId }))
                  }
                />
                {criticalDraft.file_id && (
                  <p className="mt-1 text-xs text-muted-foreground">Document attached.</p>
                )}
              </div>
            </div>
            <Button
              type="button"
              className="mt-3"
              disabled={criticalDraft.name.trim().length < 2 || addCritical.isPending}
              onClick={() =>
                addCritical.mutate({
                  id: null,
                  employee_id: a.employee_id,
                  requirement_type: criticalDraft.requirement_type,
                  name: criticalDraft.name,
                  description: criticalDraft.description || null,
                  issuing_authority: criticalDraft.issuing_authority || null,
                  reference_number: criticalDraft.reference_number || null,
                  valid_from: criticalDraft.valid_from || null,
                  expires_on: criticalDraft.expires_on || null,
                  file_id: criticalDraft.file_id,
                  is_safety_critical: criticalDraft.is_safety_critical,
                  is_active: true,
                })
              }
            >
              Save requirement
            </Button>
          </div>
        )}
      </Panel>

      <div className="space-y-4">
        {snap.sections.map((s) => (
          <Panel key={s.id} title={s.title} description={s.description ?? undefined}>
            <div className="space-y-5">
              {s.items
                .filter((item) => item.item_type !== "kpi")
                .map((it) => {
                  const v = vals[it.id] ?? {};
                  const ro = !respondent;
                  const fid = `i-${it.id}`;
                  const selfR = other(it.id, "self");
                  const evalR = other(it.id, "evaluator");
                  return (
                    <div key={it.id} className="border-b pb-4 last:border-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Label htmlFor={fid} className="font-bold">
                          {it.label}
                          {it.is_required && <span className="text-destructive"> *</span>}
                        </Label>
                        {Number(it.weight) > 0 && <Tag>{it.weight}%</Tag>}
                        {it.evidence_required && <Tag tone="info">Evidence expected</Tag>}
                      </div>
                      {it.help_text && (
                        <p className="mb-2 text-sm text-muted-foreground">{it.help_text}</p>
                      )}
                      {respondent && (
                        <div className="max-w-xl">
                          {it.item_type === "rating" && (
                            <div
                              role="radiogroup"
                              aria-labelledby={fid}
                              className="flex flex-wrap gap-1"
                            >
                              <span id={fid} className="sr-only">
                                {it.label}
                              </span>
                              {Array.from({ length: snap.rating_scale_max }, (_, i) => i + 1).map(
                                (n) => (
                                  <button
                                    key={n}
                                    type="button"
                                    role="radio"
                                    aria-checked={v.rating === n}
                                    disabled={ro}
                                    onClick={() => set(it.id, { rating: n })}
                                    className={`size-10 rounded-md border font-data font-bold ${v.rating === n ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent"}`}
                                  >
                                    {n}
                                  </button>
                                ),
                              )}
                            </div>
                          )}
                          {it.item_type === "short_text" && (
                            <Input
                              id={fid}
                              maxLength={500}
                              value={v.text_value ?? ""}
                              onChange={(e) => set(it.id, { text_value: e.target.value })}
                            />
                          )}
                          {it.item_type === "long_text" && (
                            <Textarea
                              id={fid}
                              maxLength={8000}
                              value={v.text_value ?? ""}
                              onChange={(e) => set(it.id, { text_value: e.target.value })}
                            />
                          )}
                          {it.item_type === "yes_no" && (
                            <NativeSelect
                              id={fid}
                              className="w-40"
                              value={v.text_value ?? ""}
                              onChange={(e) => set(it.id, { text_value: e.target.value || null })}
                            >
                              <option value="">Select…</option>
                              <option value="yes">Yes</option>
                              <option value="no">No</option>
                            </NativeSelect>
                          )}
                          {it.item_type === "single_choice" && (
                            <NativeSelect
                              id={fid}
                              value={v.choice_values?.[0] ?? ""}
                              onChange={(e) =>
                                set(it.id, {
                                  choice_values: e.target.value ? [e.target.value] : null,
                                })
                              }
                            >
                              <option value="">Select…</option>
                              {it.options.map((o) => (
                                <option key={o}>{o}</option>
                              ))}
                            </NativeSelect>
                          )}
                          {it.item_type === "multi_choice" && (
                            <div className="flex flex-wrap gap-3" id={fid}>
                              {it.options.map((o) => (
                                <label key={o} className="flex items-center gap-1.5 text-sm">
                                  <Checkbox
                                    checked={v.choice_values?.includes(o) ?? false}
                                    onCheckedChange={(c) =>
                                      set(it.id, {
                                        choice_values: c
                                          ? [...(v.choice_values ?? []), o]
                                          : (v.choice_values ?? []).filter((x) => x !== o),
                                      })
                                    }
                                  />{" "}
                                  {o}
                                </label>
                              ))}
                            </div>
                          )}
                          <Input
                            aria-label={`Comment on ${it.label}`}
                            placeholder="Comment (optional)"
                            className="mt-2"
                            maxLength={4000}
                            value={v.comment ?? ""}
                            onChange={(e) => set(it.id, { comment: e.target.value })}
                          />
                        </div>
                      )}
                      <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                        {selfR && respondent !== "self" && <ReadResp label="Self" r={selfR} />}
                        {evalR && respondent !== "evaluator" && showEvaluatorToEmployee && (
                          <ReadResp label="Evaluator" r={evalR} />
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </Panel>
        ))}

        {(respondent === "evaluator" || a.overall_comment) && (
          <Panel title="Overall feedback">
            {respondent === "evaluator" ? (
              <Textarea
                aria-label="Overall feedback"
                value={overall}
                maxLength={8000}
                onChange={(e) => {
                  setOverall(e.target.value);
                  setDirty(true);
                }}
              />
            ) : (
              showEvaluatorToEmployee && (
                <p className="whitespace-pre-wrap text-sm">{a.overall_comment}</p>
              )
            )}
          </Panel>
        )}

        <Panel title="Evidence">
          {data.evidence.length === 0 ? (
            <p className="text-sm text-muted-foreground">No evidence attached.</p>
          ) : (
            <ul className="mb-3 space-y-2">
              {data.evidence.map((e) => (
                <li key={e.id} className="text-sm">
                  {e.file_id ? (
                    <EvidenceFileLink fileId={e.file_id} name={e.file?.original_name ?? "file"} />
                  ) : (
                    <span>{e.note}</span>
                  )}{" "}
                  <span className="font-data text-xs text-muted-foreground">
                    · {fmtDateTime(e.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {respondent && (
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-64 flex-1">
                <Field label="Evidence note" htmlFor="evn">
                  <Input
                    id="evn"
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
                onClick={() =>
                  addEv.mutate({ assignment_id: a.id, file_id: null, note, item_id: null })
                }
              >
                Add note
              </Button>
              <EvidenceUpload
                employeeId={a.employee_id}
                onUploaded={(fid) =>
                  addEv
                    .mutateAsync({ assignment_id: a.id, file_id: fid, note: null, item_id: null })
                    .then(() => undefined)
                }
              />
            </div>
          )}
        </Panel>

        <Panel title="Review history">
          {data.reviews.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reviews yet.</p>
          ) : (
            <ul className="space-y-2">
              {data.reviews.map((r) => (
                <li key={r.id} className="text-sm">
                  <StatusBadge
                    status={r.decision === "returned" ? "reopened" : r.decision}
                    label={
                      r.decision === "acknowledged" ? "Employee acknowledged receipt" : r.decision
                    }
                  />{" "}
                  <span className="font-data text-xs text-muted-foreground">
                    {fmtDateTime(r.created_at)}
                  </span>
                  {r.comments && <p className="mt-1">{r.comments}</p>}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 font-data text-xs text-muted-foreground">
            Submitted {fmtDateTime(a.submitted_at)} · Approved {fmtDateTime(a.approved_at)} ·
            Self-evaluation{" "}
            {a.self_submitted_at
              ? `submitted ${fmtDateTime(a.self_submitted_at)}`
              : a.self_evaluation
                ? "pending"
                : "not required"}
          </p>
          <p className="mt-2 text-sm">
            Employee acknowledgement:{" "}
            {a.acknowledged_at ? `received ${fmtDateTime(a.acknowledged_at)}` : "pending"}
          </p>
          {a.acknowledgement_comment && (
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
              Employee comment: {a.acknowledgement_comment}
            </p>
          )}
          <Link
            to="/performance/history"
            className="mt-2 inline-block text-sm font-bold text-primary hover:underline"
          >
            All evaluations
          </Link>
        </Panel>
      </div>

      {(respondent || canReview || canReopen || canAcknowledge) && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-card/95 backdrop-blur md:left-auto md:w-[calc(100%-16rem)]">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-3 sm:px-6 lg:px-8">
            {preview !== null && (
              <span className="font-data text-sm">
                Your performance factor preview: <strong>{preview}</strong> / 5
              </span>
            )}
            {itemScorePreview !== null && (
              <span className="font-data text-sm">
                Your profile/KPI preview: <strong>{itemScorePreview}</strong> / 100
              </span>
            )}
            {dirty && <Tag tone="warning">Unsaved changes</Tag>}
            <div className="flex-1" />
            {respondent && (
              <>
                <Button
                  variant="outline"
                  disabled={!dirty || save.isPending}
                  onClick={() => save.mutate(payload())}
                >
                  <Save /> Save draft
                </Button>
                <Button
                  disabled={dirty || submit.isPending}
                  title={dirty ? "Save your draft first" : undefined}
                  onClick={() => setConfirm("submit")}
                >
                  <Send />{" "}
                  {respondent === "self" ? "Submit Self-Evaluation" : "Submit for HR Review"}
                </Button>
              </>
            )}
            {canReview && (
              <>
                <Button variant="outline" onClick={() => setConfirm("return")}>
                  <Undo2 /> Return for revision
                </Button>
                <Button onClick={() => setConfirm("approve")}>
                  <CheckCircle2 /> Approve
                </Button>
              </>
            )}
            {canReopen && (
              <Button variant="outline" onClick={() => setConfirm("reopen")}>
                <RotateCcw /> Reopen
              </Button>
            )}
            {canAcknowledge && (
              <Button onClick={() => setConfirm("acknowledge")}>
                <CheckCircle2 /> Acknowledge receipt
              </Button>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={
          {
            submit:
              respondent === "self"
                ? "Submit self-evaluation?"
                : "Submit supervisor evaluation for HR review?",
            approve: "Approve evaluation?",
            return: "Return evaluation for revision?",
            reopen: "Reopen evaluation?",
            acknowledge: "Acknowledge receipt?",
          }[confirm ?? "submit"]
        }
        description={
          confirm === "submit"
            ? "The submitted responses are preserved. You won't be able to edit them unless an authorized reviewer returns the evaluation."
            : confirm === "approve"
              ? "The evaluation becomes final unless reopened with a recorded reason."
              : confirm === "acknowledge"
                ? "This records that you received the finalized evaluation; it does not change or accept the evaluation result."
                : "A reason is required and will be recorded."
        }
        confirmLabel={
          {
            submit: respondent === "self" ? "Submit Self-Evaluation" : "Submit for HR Review",
            approve: "Approve",
            return: "Return for revision",
            reopen: "Reopen",
            acknowledge: "Acknowledge",
          }[confirm ?? "submit"]
        }
        pending={submit.isPending || review.isPending || reopen.isPending || acknowledge.isPending}
        onConfirm={() => {
          if (confirm === "submit") submit.mutate({ assignment_id: a.id, respondent: respondent! });
          if (confirm === "approve")
            review.mutate({ assignment_id: a.id, decision: "approve", comments: comment });
          if (confirm === "return")
            review.mutate({ assignment_id: a.id, decision: "return", comments: comment });
          if (confirm === "reopen") reopen.mutate({ assignment_id: a.id, reason: comment });
          if (confirm === "acknowledge") acknowledge.mutate({ assignment_id: a.id, comment });
        }}
      >
        {confirm && confirm !== "submit" && (
          <div className="space-y-1.5">
            <Label htmlFor="rc">
              {confirm === "approve" || confirm === "acknowledge"
                ? confirm === "approve"
                  ? "Comments (optional)"
                  : "Employee comment (optional)"
                : "Reason (required, 5+ characters)"}
            </Label>
            <Textarea
              id="rc"
              value={comment}
              maxLength={confirm === "acknowledge" ? 4000 : 2000}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}

function ReadResp({ label, r }: { label: string; r: Resp | undefined }) {
  const v = r?.rating ?? r?.kpi_actual ?? r?.text_value ?? r?.choice_values?.join(", ") ?? "—";
  return (
    <div className="rounded-md bg-muted p-2">
      <p className="font-data text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="whitespace-pre-wrap">{String(v)}</p>
      {r?.comment && <p className="text-xs text-muted-foreground">{r.comment}</p>}
    </div>
  );
}

function ScoreSummary({
  label,
  score,
  classification,
  suffix = "/ 5",
}: {
  label: string;
  score: number | null;
  classification?: string | null;
  suffix?: string;
}) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-data text-xl font-bold">
        {score === null ? "Not submitted" : `${score} ${suffix}`}
      </p>
      {classification && <Tag tone="success">{classification}</Tag>}
    </div>
  );
}

function ContextValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium">{value}</dd>
    </div>
  );
}

function ReadFactorResp({ label, response }: { label: string; response: FactorResp | undefined }) {
  return (
    <div className="rounded-md bg-muted p-2">
      <p className="font-data text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="font-semibold">{response?.rating ?? "Not rated"}</p>
      {response?.comment && <p className="whitespace-pre-wrap text-xs">{response.comment}</p>}
    </div>
  );
}
