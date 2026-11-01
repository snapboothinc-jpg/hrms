import { describe, expect, it } from "vitest";
import {
  computeGap,
  weightTotal,
  canActivateProfile,
  computeScore,
  computePerformanceScore,
  classifyPerformanceScore,
} from "@/lib/rules";
import { canTransition, EVALUATION_TRANSITIONS, ASSESSMENT_TRANSITIONS } from "@/lib/policy";
import { mapDbError } from "@/lib/api/result";
import { NAV, ROLE_MENU, canSee, getRoleNavigation } from "@/lib/policy";
import {
  profileContentSchema,
  responseSchema,
  acknowledgeEvaluationSchema,
  personalGoalSchema,
  personalGoalProgressSchema,
  reportSchema,
  savedReportSchema,
  performanceFactorCodes,
  performanceFactorTitles,
  developmentResponseSchema,
  saveCriticalRequirementSchema,
} from "@/lib/schemas";

describe("gap calculation", () => {
  it("gap = max(0, required - current)", () => {
    expect(computeGap(4, 2)).toEqual({ gap: 2, status: "gap" });
  });
  it("never negative when current exceeds required", () => {
    expect(computeGap(3, 5)).toEqual({ gap: 0, status: "met" });
  });
  it("not assessed is distinct and never level 0", () => {
    expect(computeGap(3, null)).toEqual({ gap: null, status: "not_assessed" });
    expect(computeGap(3, 0)).toEqual({ gap: 3, status: "gap" });
  });
});

describe("profile weights", () => {
  it("activation requires exactly 100 percent", () => {
    expect(
      canActivateProfile([
        { item_type: "rating", weight: 60 },
        { item_type: "kpi", weight: 30 },
      ]).ok,
    ).toBe(false);
    expect(
      canActivateProfile([
        { item_type: "rating", weight: 70 },
        { item_type: "kpi", weight: 30 },
      ]).ok,
    ).toBe(true);
  });
  it("rejects an empty profile", () => {
    expect(canActivateProfile([]).ok).toBe(false);
  });
  it("totals decimals precisely", () => {
    expect(
      weightTotal([
        { item_type: "rating", weight: 33.33 },
        { item_type: "rating", weight: 33.33 },
        { item_type: "rating", weight: 33.34 },
      ]),
    ).toBe(100);
  });
});

describe("scoring", () => {
  const items = [
    { id: "a", item_type: "rating", weight: 50 },
    { id: "b", item_type: "kpi", weight: 50, kpi_target: 95 },
    { id: "c", item_type: "long_text", weight: 0 },
  ];
  it("weights ratings by scale and KPIs by target, capped at 100%", () => {
    expect(
      computeScore(
        items,
        [
          { item_id: "a", rating: 4 },
          { item_id: "b", kpi_actual: 120 },
        ],
        5,
      ),
    ).toBe(90);
  });
  it("unanswered items score 0", () => {
    expect(computeScore(items, [], 5)).toBe(0);
  });
  it("calculates weighted and equal performance scores on the 1-5 scale", () => {
    const factors = [
      { factor_code: "quality_of_work", weight: 75, rating: 4 },
      { factor_code: "safety_consciousness_equipment", weight: 25, rating: 2 },
    ];
    expect(computePerformanceScore(factors, "weighted")).toBe(3.5);
    expect(computePerformanceScore(factors, "equal")).toBe(3);
    expect(computePerformanceScore([], "equal")).toBeNull();
  });
  it("applies only explicitly configured performance classifications", () => {
    const ranges = [
      { label: "Needs improvement", min: 1, max: 2.49 },
      { label: "Effective", min: 2.5, max: 5 },
    ];
    expect(classifyPerformanceScore(2.49, ranges)).toBe("Needs improvement");
    expect(classifyPerformanceScore(2.5, ranges)).toBe("Effective");
    expect(classifyPerformanceScore(4, [])).toBeNull();
  });
});

describe("evaluation scale and acknowledgement validation", () => {
  const profile = {
    rating_scale_max: 5,
    scoring_method: "equal" as const,
    final_score_rule: "supervisor" as const,
    classification_thresholds: [],
    performance_factors: performanceFactorCodes.map((factor_code, sort_order) => ({
      factor_code,
      title: performanceFactorTitles[factor_code],
      description: `Description for ${factor_code}`,
      indicators: ["Demonstrates this performance factor"],
      weight: 10,
      evidence_required: false,
      sort_order,
    })),
    sections: [],
  };
  it("only accepts the fixed 1–5 profile scale", () => {
    expect(profileContentSchema.safeParse(profile).success).toBe(true);
    expect(profileContentSchema.safeParse({ ...profile, rating_scale_max: 10 }).success).toBe(
      false,
    );
    expect(profileContentSchema.safeParse({ ...profile, rating_scale_max: 3 }).success).toBe(false);
  });
  it("requires configured rating and KPI item weights to total 100 percent", () => {
    const weightedItems = {
      ...profile,
      sections: [
        {
          title: "Position criteria",
          items: [
            {
              label: "Configured rating",
              item_type: "rating" as const,
              weight: 60,
              options: [],
              evidence_required: false,
              is_required: true,
            },
            {
              label: "Configured KPI",
              item_type: "kpi" as const,
              weight: 40,
              options: [],
              kpi_target: 10,
              evidence_required: false,
              is_required: true,
            },
          ],
        },
      ],
    };
    expect(profileContentSchema.safeParse(weightedItems).success).toBe(true);
    expect(
      profileContentSchema.safeParse({
        ...weightedItems,
        sections: [
          {
            ...weightedItems.sections[0]!,
            items: weightedItems.sections[0]!.items.map((item) => ({ ...item, weight: 30 })),
          },
        ],
      }).success,
    ).toBe(false);
  });
  it("validates structured development responses and critical requirement dates", () => {
    expect(
      developmentResponseSchema.safeParse({
        strengths: "Reliable",
        rating_difference_explanations: "Discussed with the employee.",
      }).success,
    ).toBe(true);
    expect(developmentResponseSchema.safeParse({ unknown_section: "not accepted" }).success).toBe(
      false,
    );
    expect(
      saveCriticalRequirementSchema.safeParse({
        id: null,
        employee_id: crypto.randomUUID(),
        requirement_type: "license",
        name: "Operator license",
        description: null,
        issuing_authority: null,
        reference_number: null,
        valid_from: "2026-03-01",
        expires_on: "2026-02-01",
        file_id: null,
        is_safety_critical: false,
        is_active: true,
        idempotencyKey: crypto.randomUUID(),
      }).success,
    ).toBe(false);
  });
  it("rejects fractional and out-of-range evaluation ratings", () => {
    const item_id = crypto.randomUUID();
    expect(responseSchema.safeParse({ item_id, rating: 1 }).success).toBe(true);
    expect(responseSchema.safeParse({ item_id, rating: 5 }).success).toBe(true);
    expect(responseSchema.safeParse({ item_id, rating: 5.5 }).success).toBe(false);
    expect(responseSchema.safeParse({ item_id, rating: 6 }).success).toBe(false);
  });
  it("validates acknowledgement action shape and comment length", () => {
    const base = { assignment_id: crypto.randomUUID(), idempotencyKey: crypto.randomUUID() };
    expect(acknowledgeEvaluationSchema.safeParse(base).success).toBe(true);
    expect(
      acknowledgeEvaluationSchema.safeParse({ ...base, comment: "x".repeat(4001) }).success,
    ).toBe(false);
  });
});

describe("explicit Department Head succession navigation", () => {
  const succession = NAV.flatMap((group) => group.items).find((item) =>
    item.to.startsWith("/succession"),
  )!;
  it("shows succession links only when the explicit grant is reflected in context permissions", () => {
    expect(canSee(succession, new Set(["succession.dept"]), true)).toBe(true);
    expect(canSee(succession, new Set(), true)).toBe(false);
    expect(canSee(succession, new Set(["self.service"]), true)).toBe(false);
  });
});

describe("role-specific sidebar matrix", () => {
  it("matches the required entries for each of the seven roles", () => {
    const expected: Record<keyof typeof ROLE_MENU, string[]> = {
      super_admin: [
        "System Overview",
        "Global Roles & Permissions",
        "Security & Audit",
        "System-wide Configuration",
        "Integration Settings",
        "My Profile",
      ],
      admin: [
        "Dashboard",
        "User Management",
        "Organization Setup",
        "Operational Configuration",
        "Notifications",
        "Support & System Status",
        "My Profile",
      ],
      hr_admin: [
        "Dashboard",
        "Employee Management",
        "Performance Management",
        "Competency Management",
        "Succession Planning",
        "Social Recognition",
        "HR Reports & Analytics",
        "Approval Center",
        "Notifications",
        "My Profile",
      ],
      dept_head: [
        "Department Dashboard",
        "Department Performance",
        "Competency & Gap Overview",
        "Learning & Training Overview",
        "Succession Planning",
        "Recognition Overview",
        "Department Reports",
        "Delegated Approvals",
        "Notifications",
        "My Profile",
      ],
      supervisor: [
        "Dashboard",
        "My Team",
        "Performance Management",
        "Competency Management",
        "Development Follow-up",
        "AI Recommendations",
        "Learning & Training Progress",
        "Social Recognition",
        "Team Reports",
        "Notifications",
        "My Profile",
      ],
      employee: [
        "My Dashboard",
        "My Profile",
        "My Performance",
        "My Competencies",
        "My Development Plan",
        "Learning Center",
        "My Training",
        "Social Recognition",
        "My Career Development",
        "Notifications",
        "Help & Support",
      ],
      ops_manager: [
        "Dashboard",
        "Competency Gaps",
        "AI Recommendations",
        "Development Plans",
        "Course & Learning Content Management",
        "Learning Paths",
        "Quiz & Assessment Management",
        "Learner Progress",
        "Training Calendar",
        "Training Sessions & Attendance",
        "Assessment & Reassessment",
        "Training Effectiveness",
        "Learning & Training Reports",
        "Notifications",
        "My Profile",
      ],
    };
    for (const role of Object.keys(expected) as (keyof typeof ROLE_MENU)[]) {
      expect(ROLE_MENU[role].flatMap((group) => group.items.map(([, label]) => label))).toEqual(
        expected[role],
      );
      const nav = getRoleNavigation(role).flatMap((group) => group.items);
      expect(nav).toHaveLength(expected[role].length);
      expect(nav.every((item) => item.to)).toBe(true);
    }
  });

  describe("report filter validation", () => {
    const reportBase = {
      kind: "audit" as const,
      actor: crypto.randomUUID(),
      from: "2025-01-01",
      to: "2025-01-31",
    };
    it("accepts scoped audit filters and rejects reversed or malformed date ranges", () => {
      expect(reportSchema.safeParse(reportBase).success).toBe(true);
      expect(reportSchema.safeParse({ ...reportBase, to: "2024-12-31" }).success).toBe(false);
      expect(reportSchema.safeParse({ ...reportBase, from: "not-a-date" }).success).toBe(false);
      expect(reportSchema.safeParse({ ...reportBase, from: "2025-02-31" }).success).toBe(false);
    });
    it("validates saved filters against the selected report type", () => {
      const base = {
        id: null,
        version: null,
        name: "Monthly audit",
        kind: "audit" as const,
        filters: { actor: crypto.randomUUID() },
        columns: ["action", "table_name"],
        idempotencyKey: crypto.randomUUID(),
      };
      expect(savedReportSchema.safeParse(base).success).toBe(true);
      expect(
        savedReportSchema.safeParse({ ...base, filters: { unsupported: "value" } }).success,
      ).toBe(false);
    });
  });

  it("only exposes explicitly granted succession access in the Department Head menu", () => {
    const succession = getRoleNavigation("dept_head")
      .flatMap((group) => group.items)
      .find((item) => item.to === "/succession")!;
    expect(canSee(succession, new Set(["succession.dept"]), true)).toBe(true);
    expect(canSee(succession, new Set(), true)).toBe(false);
  });
});

describe("employee-owned personal goal validation", () => {
  const valid = {
    id: null,
    version: null,
    idempotencyKey: crypto.randomUUID(),
    data: { title: "Complete cross-training", success_criteria: "Pass the role checklist" },
  };
  it("accepts a goal linked to the employee's evaluation without gap/recommendation coupling", () => {
    expect(
      personalGoalSchema.safeParse({
        ...valid,
        data: { ...valid.data, evaluation_assignment_id: crypto.randomUUID() },
      }).success,
    ).toBe(true);
    expect(
      personalGoalSchema.safeParse({
        ...valid,
        data: { ...valid.data, competency_gap_id: crypto.randomUUID() },
      }).success,
    ).toBe(false);
  });
  it("bounds progress and validates the idempotency key", () => {
    const base = {
      id: crypto.randomUUID(),
      version: 1,
      progress: 50,
      idempotencyKey: crypto.randomUUID(),
    };
    expect(personalGoalProgressSchema.safeParse(base).success).toBe(true);
    expect(personalGoalProgressSchema.safeParse({ ...base, progress: 101 }).success).toBe(false);
    expect(personalGoalProgressSchema.safeParse({ ...base, idempotencyKey: "bad" }).success).toBe(
      false,
    );
  });
});

describe("state machines", () => {
  it("an approved evaluation can only be reopened", () => {
    expect(canTransition(EVALUATION_TRANSITIONS, "approved", "reopened")).toBe(true);
    expect(canTransition(EVALUATION_TRANSITIONS, "approved", "in_progress")).toBe(false);
  });
  it("a draft evaluation cannot jump to approved", () => {
    expect(canTransition(EVALUATION_TRANSITIONS, "in_progress", "approved")).toBe(false);
  });
  it("approved assessments are final", () => {
    expect(ASSESSMENT_TRANSITIONS.approved).toEqual([]);
  });
});

describe("error mapping", () => {
  it("NOT_FOUND never leaks detail", () => {
    expect(mapDbError("NOT_FOUND: secret employee", "r").message).toBe("The record was not found.");
  });
  it("maps conflicts and rule violations", () => {
    expect(mapDbError("CONFLICT: changed", "r").code).toBe("CONFLICT");
    expect(mapDbError("RULE: item weights must total 100 percent (currently 90)", "r").code).toBe(
      "RULE",
    );
  });
  it("unknown errors are generic", () => {
    const e = mapDbError("relation foo does not exist at line 3", "r");
    expect(e.code).toBe("SERVER_ERROR");
    expect(e.message).not.toContain("relation");
  });
});
