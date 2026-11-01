import { describe, expect, it } from "vitest";
import { NAV, canSee } from "@/lib/policy";
import type { AiRecRow, GapRow } from "@/lib/data";
import { buildTrainingNeeds } from "@/lib/training-needs";

const gap = (overrides: Partial<GapRow> = {}): GapRow => ({
  employee_id: "employee-1",
  employee_name: "Ana Cruz",
  employee_code: "E001",
  department_id: "department-1",
  department_name: "Operations",
  position_id: "position-1",
  position_title: "Logistics Coordinator",
  competency_id: "competency-1",
  competency_name: "Route planning",
  category_id: "category-1",
  category_name: "Operations",
  required_level: 4,
  current_level: 2,
  gap: 2,
  gap_status: "gap",
  is_mandatory: false,
  is_safety_critical: false,
  assessment_id: "assessment-1",
  assessment_date: "2026-10-01",
  evidence_summary: "Observed on shift",
  ...overrides,
});

const recommendation = (overrides: Partial<AiRecRow> = {}): AiRecRow => ({
  id: "recommendation-1",
  employee_id: "employee-1",
  competency_id: "competency-1",
  required_level: 4,
  current_level: 2,
  gap: 2,
  recommendation_type: "course",
  resource_id: "course-1",
  rationale: "Mapped course addresses the validated gap",
  expected_outcome: "Demonstrate route planning",
  assessment_method: null,
  priority: "high",
  status: "pending_review",
  model: "gemini-2.5-flash",
  created_at: "2026-10-10T00:00:00Z",
  generated_by: "reviewer-1",
  employee: { first_name: "Ana", last_name: "Cruz", employee_code: "E001" },
  competency: { name: "Route planning", code: "OPS-01" },
  ...overrides,
});

describe("training needs", () => {
  it("shows unmet and unassessed requirements but excludes met competencies", () => {
    const needs = buildTrainingNeeds(
      [
        gap(),
        gap({ competency_id: "competency-2", gap_status: "not_assessed", current_level: null }),
        gap({ competency_id: "competency-3", gap_status: "met", gap: 0 }),
      ],
      [],
    );

    expect(needs.map((need) => need.gap.competency_id)).toEqual(["competency-1", "competency-2"]);
    expect(needs[1]?.recommendation).toBeNull();
  });

  it("matches the latest recommendation to both the employee and competency", () => {
    const needs = buildTrainingNeeds(
      [gap()],
      [
        recommendation({ id: "latest" }),
        recommendation({ id: "other-employee", employee_id: "employee-2" }),
        recommendation({ id: "other-competency", competency_id: "competency-2" }),
        recommendation({ id: "older" }),
      ],
    );

    expect(needs[0]?.recommendation?.id).toBe("latest");
  });

  it("shows the training-needs route only to roles with competency or training scope", () => {
    const item = NAV.flatMap((group) => group.items).find((nav) => nav.to === "/training/needs");
    expect(item).toBeDefined();
    expect(canSee(item!, new Set(["comp.view_all"]), false)).toBe(true);
    expect(canSee(item!, new Set(["comp.assess"]), false)).toBe(true);
    expect(canSee(item!, new Set(["train.manage"]), false)).toBe(true);
    expect(canSee(item!, new Set(["self.service"]), true)).toBe(false);
  });

  it("keeps explicit Department Head succession navigation grant-scoped", () => {
    const item = NAV.flatMap((group) => group.items).find((nav) => nav.to === "/succession");
    expect(item).toBeDefined();
    expect(canSee(item!, new Set(["succession.dept"]), false)).toBe(true);
    expect(canSee(item!, new Set(["team.view"]), false)).toBe(false);
    expect(canSee(item!, new Set(["self.service"]), true)).toBe(false);
  });
});
