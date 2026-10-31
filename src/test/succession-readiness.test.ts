import { describe, expect, it } from "vitest";
import { compareTargetCompetencies, compareTargetQualifications } from "@/lib/succession-readiness";

describe("target-position competency readiness", () => {
  const requirements = [
    {
      competency_id: "met",
      competency_name: "Safety",
      required_level: 3,
      is_mandatory: true,
      is_safety_critical: true,
    },
    {
      competency_id: "gap",
      competency_name: "Routing",
      required_level: 4,
      is_mandatory: false,
      is_safety_critical: false,
    },
    {
      competency_id: "unassessed",
      competency_name: "Customs",
      required_level: 2,
      is_mandatory: true,
      is_safety_critical: false,
    },
  ];

  it("keeps unmet, met, missing evidence, and unassessed states distinct", () => {
    const result = compareTargetCompetencies(requirements, [
      {
        competency_id: "met",
        current_level: 4,
        evidence_summary: "Passed observed check",
        assessment_date: "2026-03-01",
        evidence: [],
      },
      {
        competency_id: "gap",
        current_level: 2,
        evidence_summary: null,
        assessment_date: "2026-03-01",
        evidence: [],
      },
    ]);

    expect(
      result.map(({ assessment_status, evidence_status }) => [assessment_status, evidence_status]),
    ).toEqual([
      ["met", "provided"],
      ["gap", "missing"],
      ["unassessed", "unassessed"],
    ]);
    expect(result[2]?.current_level).toBeNull();
  });

  describe("target-position qualification readiness", () => {
    it("distinguishes unassessed, met, gaps, missing evidence, and expired evidence", () => {
      const result = compareTargetQualifications(
        [
          { id: "met", name: "License A", is_mandatory: true, active: true },
          { id: "gap", name: "Certificate B", is_mandatory: false, active: true },
          { id: "missing", name: "Certificate C", is_mandatory: true, active: true },
          { id: "unassessed", name: "Certificate D", is_mandatory: true, active: true },
          { id: "expired", name: "License E", is_mandatory: true, active: true },
          { id: "inactive", name: "Old license", is_mandatory: true, active: false },
        ],
        [
          {
            requirement_id: "met",
            status: "met",
            evidence_date: "2026-02-01",
            expires_on: null,
          },
          {
            requirement_id: "gap",
            status: "gap",
            evidence_date: "2026-02-01",
            expires_on: null,
          },
          {
            requirement_id: "missing",
            status: "missing_evidence",
            evidence_date: null,
            expires_on: null,
          },
          {
            requirement_id: "expired",
            status: "met",
            evidence_date: "2025-01-01",
            expires_on: "2025-12-31",
          },
        ],
        "2026-04-01",
      );

      expect(result.map((item) => item.status)).toEqual([
        "met",
        "gap",
        "missing_evidence",
        "unassessed",
        "expired",
      ]);
      expect(result.map((item) => item.mandatory_deficiency)).toEqual([
        false,
        false,
        true,
        true,
        true,
      ]);
    });
  });

  it("uses the most recent approved assessment without treating an absent score as zero", () => {
    const result = compareTargetCompetencies(
      [requirements[0]!],
      [
        {
          competency_id: "met",
          current_level: 5,
          evidence_summary: "Earlier result",
          assessment_date: "2026-02-01",
          evidence: [],
        },
        {
          competency_id: "met",
          current_level: null,
          evidence_summary: null,
          assessment_date: "2026-03-01",
          evidence: [],
        },
      ],
    );
    expect(result[0]?.assessment_status).toBe("unassessed");
    expect(result[0]?.current_level).toBeNull();
  });
});
