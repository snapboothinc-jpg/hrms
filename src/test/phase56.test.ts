import { describe, expect, it } from "vitest";
import {
  nominationSchema,
  readinessClassSchema,
  categorySchema,
  aiSettingsSchema,
  reportSchema,
  enrollSchema,
  planSchema,
} from "@/lib/schemas";
import {
  aiResponseSchema,
  filterAiRecommendations,
  getAiConfig,
  aiConfigStatus,
} from "@/lib/ai/ai.server";

const uuid = () => crypto.randomUUID();

describe("nomination validation", () => {
  const base = {
    recipient_id: uuid(),
    category_id: uuid(),
    message: "Great work on the depot turnaround",
    idempotencyKey: uuid(),
  };
  it("accepts a valid nomination", () => {
    expect(nominationSchema.safeParse(base).success).toBe(true);
  });
  it("rejects an empty message", () => {
    expect(nominationSchema.safeParse({ ...base, message: " " }).success).toBe(false);
  });
  it("rejects missing idempotency key", () => {
    const { idempotencyKey: _k, ...rest } = base;
    expect(nominationSchema.safeParse(rest).success).toBe(false);
  });
  it("rejects unknown fields", () => {
    expect(nominationSchema.safeParse({ ...base, extra: 1 }).success).toBe(false);
  });
});

describe("readiness classes and categories", () => {
  it("readiness class requires code, label and sort order", () => {
    expect(
      readinessClassSchema.safeParse({
        id: null,
        version: null,
        data: { code: "R1", label: "Ready now", sort_order: 1 },
      }).success,
    ).toBe(true);
    expect(
      readinessClassSchema.safeParse({
        id: null,
        version: null,
        data: { code: "", label: "x", sort_order: 1 },
      }).success,
    ).toBe(false);
  });
  it("category name has a minimum length", () => {
    expect(categorySchema.safeParse({ id: null, version: null, data: { name: "S" } }).success).toBe(
      false,
    );
    expect(
      categorySchema.safeParse({ id: null, version: null, data: { name: "Safety" } }).success,
    ).toBe(true);
  });
});

describe("AI settings", () => {
  it("only allows the Gemini provider", () => {
    expect(aiSettingsSchema.safeParse({ provider: "gemini", model: "m", version: 1 }).success).toBe(
      true,
    );
    expect(aiSettingsSchema.safeParse({ provider: "other", model: "m", version: 1 }).success).toBe(
      false,
    );
  });

  it("defaults to Gemini 2.5 Flash and reports missing credentials without exposing values", () => {
    const previous = {
      model: process.env["AI_MODEL"],
      geminiKey: process.env["GEMINI_API_KEY"],
    };
    delete process.env["AI_MODEL"];
    delete process.env["GEMINI_API_KEY"];
    try {
      const config = getAiConfig(null, null);
      expect(config.provider).toBe("gemini");
      expect(config.model).toBe("gemini-2.5-flash");
      expect(config.key).toBeNull();
      expect(aiConfigStatus(config)).toEqual({
        configured: false,
        provider: "gemini",
        model: "gemini-2.5-flash",
        missing: "GEMINI_API_KEY",
      });
    } finally {
      if (previous.model === undefined) delete process.env["AI_MODEL"];
      else process.env["AI_MODEL"] = previous.model;
      if (previous.geminiKey === undefined) delete process.env["GEMINI_API_KEY"];
      else process.env["GEMINI_API_KEY"] = previous.geminiKey;
    }
  });

  it("rejects unsupported database providers", () => {
    expect(() => getAiConfig("other", null)).toThrow("provider must be gemini");
  });
});

describe("AI response validation", () => {
  const item = {
    competency_id: uuid(),
    recommendation_type: "course",
    resource_id: uuid(),
    priority: "high",
    rationale: "Gap of 2 levels in load planning",
    expected_outcome: "Reach level 4",
    assessment_method: "Complete a supervisor-observed load-planning exercise.",
  } as const;
  it("accepts a well-formed response", () => {
    expect(aiResponseSchema.safeParse({ recommendations: [item] }).success).toBe(true);
  });
  it("rejects recommendations without a rationale (no fabricated output)", () => {
    expect(
      aiResponseSchema.safeParse({ recommendations: [{ ...item, rationale: "" }] }).success,
    ).toBe(false);
  });
  it("rejects unknown fields in items", () => {
    expect(aiResponseSchema.safeParse({ recommendations: [{ ...item, score: 5 }] }).success).toBe(
      false,
    );
  });
  it("caps responses at 20 recommendations", () => {
    expect(aiResponseSchema.safeParse({ recommendations: Array(21).fill(item) }).success).toBe(
      false,
    );
  });

  it("keeps only resources that match a validated gap and resource type", () => {
    const gap = uuid();
    const otherGap = uuid();
    const resource = uuid();
    const recommendation = { ...item, competency_id: gap, resource_id: resource };
    const result = filterAiRecommendations(
      {
        employee: { id: uuid(), name: "Test", position: "Test", department: "Test" },
        performance_results: null,
        position_kpis: [],
        development_outcomes: null,
        development_comments: [],
        learning_history: [],
        gaps: [
          {
            competency_id: gap,
            competency: "Safety",
            required_level: 4,
            current_level: 2,
            gap: 2,
            is_mandatory: true,
            is_safety_critical: false,
          },
        ],
        resources: [
          { type: "course", id: resource, title: "Course", summary: "", competency_id: gap },
        ],
      },
      [
        recommendation,
        { ...recommendation, competency_id: otherGap },
        { ...recommendation, recommendation_type: "training" },
      ],
    );
    expect(result.items).toEqual([recommendation]);
    expect(result.rejectedUnknown).toBe(2);
  });
});

describe("reports", () => {
  it("only allows the six report kinds", () => {
    for (const kind of [
      "performance",
      "gaps",
      "learning",
      "training",
      "recognition",
      "succession",
    ]) {
      expect(reportSchema.safeParse({ kind }).success).toBe(true);
    }
    expect(reportSchema.safeParse({ kind: "everything" }).success).toBe(false);
  });
});

describe("learning and training deadlines", () => {
  it("accepts valid course due dates and rejects malformed dates", () => {
    const assignment = {
      course_id: uuid(),
      employee_id: uuid(),
      source: "direct",
      plan_item_id: null,
      due_date: "2026-12-31",
      idempotencyKey: uuid(),
    };
    expect(enrollSchema.safeParse(assignment).success).toBe(true);
    expect(enrollSchema.safeParse({ ...assignment, due_date: "2026-02-30" }).success).toBe(false);
  });

  it("accepts an optional development-plan reassessment date", () => {
    const plan = {
      id: null,
      version: null,
      data: {
        employee_id: uuid(),
        title: "Forklift safety refresher",
        reassessment_due_date: "2026-12-31",
      },
    };
    expect(planSchema.safeParse(plan).success).toBe(true);
    expect(
      planSchema.safeParse({
        ...plan,
        data: { ...plan.data, reassessment_due_date: "not-a-date" },
      }).success,
    ).toBe(false);
  });
});
