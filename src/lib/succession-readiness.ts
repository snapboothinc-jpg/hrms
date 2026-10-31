export type TargetCompetencyRequirement = {
  competency_id: string;
  competency_name: string;
  required_level: number;
  is_mandatory: boolean;
  is_safety_critical: boolean;
};

export type CandidateCompetencyAssessment = {
  competency_id: string;
  current_level: number | null;
  evidence_summary: string | null;
  assessment_date: string;
  evidence: { id: string }[] | null;
};

export type ReadinessComparison = TargetCompetencyRequirement & {
  current_level: number | null;
  assessment_status: "unassessed" | "met" | "gap";
  evidence_status: "missing" | "provided" | "unassessed";
};

export function compareTargetCompetencies(
  requirements: TargetCompetencyRequirement[],
  assessments: CandidateCompetencyAssessment[],
): ReadinessComparison[] {
  const latest = new Map<string, CandidateCompetencyAssessment>();
  for (const assessment of assessments) {
    const current = latest.get(assessment.competency_id);
    if (!current || assessment.assessment_date > current.assessment_date)
      latest.set(assessment.competency_id, assessment);
  }

  return requirements.map((requirement) => {
    const assessment = latest.get(requirement.competency_id);
    const level = assessment?.current_level ?? null;
    const hasEvidence =
      !!assessment &&
      (!!assessment.evidence_summary?.trim() || (assessment.evidence?.length ?? 0) > 0);
    return {
      ...requirement,
      current_level: level,
      assessment_status:
        level === null ? "unassessed" : level >= requirement.required_level ? "met" : "gap",
      evidence_status: !assessment ? "unassessed" : hasEvidence ? "provided" : "missing",
    };
  });
}

export type TargetQualificationRequirement = {
  id: string;
  name: string;
  is_mandatory: boolean;
  active: boolean;
};

export type CandidateQualificationAssessment = {
  requirement_id: string;
  status: "met" | "gap" | "missing_evidence" | "unassessed";
  evidence_date: string | null;
  expires_on: string | null;
};

export type QualificationReadiness = TargetQualificationRequirement & {
  status: "met" | "gap" | "missing_evidence" | "unassessed" | "expired";
  mandatory_deficiency: boolean;
};

export function compareTargetQualifications(
  requirements: TargetQualificationRequirement[],
  assessments: CandidateQualificationAssessment[],
  today = new Date().toISOString().slice(0, 10),
): QualificationReadiness[] {
  const byRequirement = new Map(
    assessments.map((assessment) => [assessment.requirement_id, assessment]),
  );
  return requirements
    .filter((requirement) => requirement.active)
    .map((requirement) => {
      const assessment = byRequirement.get(requirement.id);
      const status =
        assessment?.status === "met" && assessment.expires_on && assessment.expires_on < today
          ? "expired"
          : (assessment?.status ?? "unassessed");
      return {
        ...requirement,
        status,
        mandatory_deficiency: requirement.is_mandatory && status !== "met",
      };
    });
}
