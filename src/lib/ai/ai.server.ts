/**
 * The single AI service module. All AI calls go through here, server-side only.
 * Credentials come from environment variables; the model defaults to Gemini 2.5 Flash.
 * Secrets are never logged, returned, or included in error messages.
 */
import { z } from "zod";

export interface AiConfig {
  provider: "gemini";
  model: string;
  key: string | null;
  keyVar: string;
}

export function getAiConfig(dbProvider?: string | null, dbModel?: string | null): AiConfig {
  const provider = dbProvider ?? "gemini";
  if (provider !== "gemini") throw new Error("INVALID: provider must be gemini");
  const model = process.env["AI_MODEL"] ?? dbModel ?? "gemini-2.5-flash";
  const keyVar = "GEMINI_API_KEY";
  const key = process.env[keyVar] ?? null;
  return { provider, model, key, keyVar };
}

/** Status for the AI settings page. Names the missing variable; never exposes values. */
export function aiConfigStatus(cfg: AiConfig): {
  configured: boolean;
  provider: string;
  model: string;
  missing?: string;
} {
  if (!cfg.key)
    return { configured: false, provider: cfg.provider, model: cfg.model, missing: cfg.keyVar };
  return { configured: true, provider: cfg.provider, model: cfg.model };
}

export const aiItemSchema = z
  .object({
    competency_id: z.string().uuid(),
    recommendation_type: z.enum(["course", "learning_path", "training"]),
    resource_id: z.string().uuid(),
    rationale: z.string().min(3).max(4000),
    expected_outcome: z.string().min(3).max(4000),
    assessment_method: z.string().min(3).max(4000),
    priority: z.enum(["high", "medium", "low"]).default("medium"),
  })
  .strict();

export const aiResponseSchema = z
  .object({ recommendations: z.array(aiItemSchema).max(20) })
  .strict();
export type AiItem = z.infer<typeof aiItemSchema>;

export interface AiContext {
  employee: { id: string; name: string; position: string; department: string };
  performance_results: {
    cycle: string;
    score: number | null;
    classification: string | null;
    factors: {
      title: string;
      employee_rating: number | null;
      supervisor_rating: number | null;
      employee_comment: string | null;
      supervisor_comment: string | null;
    }[];
  } | null;
  development_comments: string[];
  learning_history: { title: string; type: string; status: string; completed_at: string | null }[];
  gaps: {
    competency_id: string;
    competency: string;
    required_level: number;
    current_level: number | null;
    gap: number;
    is_mandatory: boolean;
    is_safety_critical: boolean;
  }[];
  resources: { type: string; id: string; title: string; summary: string; competency_id: string }[];
}

function buildPrompt(ctx: AiContext): string {
  return [
    "You are an HR development advisor for a freight and logistics organization.",
    "Suggest learning resources for the employee's validated competency gaps.",
    "Rules: use ONLY resource IDs from the supplied resource list; one recommendation per gap at most;",
    "prefer mandatory and safety-critical gaps; recommendation_type must match the resource's type;",
    "never infer or change ratings; use performance results only to contextualize development needs.",
    "Employee: " + JSON.stringify(ctx.employee),
    "Latest finalized performance results: " + JSON.stringify(ctx.performance_results),
    "Development comments: " + JSON.stringify(ctx.development_comments),
    "Previous learning history: " + JSON.stringify(ctx.learning_history),
    "Gaps: " + JSON.stringify(ctx.gaps),
    "Available resources: " + JSON.stringify(ctx.resources),
  ].join("\n");
}

const RECS_JSON_SCHEMA = {
  type: "object",
  properties: {
    recommendations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          competency_id: { type: "string" },
          recommendation_type: { type: "string", enum: ["course", "learning_path", "training"] },
          resource_id: { type: "string" },
          rationale: { type: "string" },
          expected_outcome: { type: "string" },
          assessment_method: { type: "string" },
          priority: { type: "string", enum: ["high", "medium", "low"] },
        },
        required: [
          "competency_id",
          "recommendation_type",
          "resource_id",
          "rationale",
          "expected_outcome",
          "assessment_method",
          "priority",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["recommendations"],
  additionalProperties: false,
} as const;

const GEMINI_RECS_SCHEMA = {
  type: "object",
  properties: {
    recommendations: {
      type: "array",
      items: {
        type: "object",
        properties: RECS_JSON_SCHEMA.properties.recommendations.items.properties,
        required: RECS_JSON_SCHEMA.properties.recommendations.items.required,
      },
    },
  },
  required: ["recommendations"],
} as const;

async function callGemini(cfg: AiConfig, prompt: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": cfg.key as string },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: GEMINI_RECS_SCHEMA,
        },
      }),
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!res.ok) {
    if (res.status === 429) throw new Error("AI_RATE_LIMIT");
    if (res.status === 408 || res.status === 504) throw new Error("AI_TIMEOUT");
    throw new Error(`AI_PROVIDER_ERROR:${res.status}`);
  }
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
}

export interface AiRunResult {
  items: AiItem[];
  rejectedUnknown: number;
  model: string;
  latencyMs: number;
}

export function filterAiRecommendations(
  ctx: AiContext,
  recommendations: AiItem[],
): { items: AiItem[]; rejectedUnknown: number } {
  const gapIds = new Set(ctx.gaps.map((gap) => gap.competency_id));
  const resources = new Map(ctx.resources.map((resource) => [resource.id, resource]));
  const items: AiItem[] = [];
  const recommendedGaps = new Set<string>();
  let rejectedUnknown = 0;
  for (const item of recommendations) {
    const resource = resources.get(item.resource_id);
    if (
      gapIds.has(item.competency_id) &&
      resource?.competency_id === item.competency_id &&
      resource.type === item.recommendation_type &&
      !recommendedGaps.has(item.competency_id)
    ) {
      items.push(item);
      recommendedGaps.add(item.competency_id);
    } else {
      rejectedUnknown += 1;
    }
  }
  return { items, rejectedUnknown };
}

/**
 * Generate recommendations for the given context. Throws on provider errors;
 * invalid or unparseable output throws with status "invalid". Resource IDs not
 * present in the supplied context are discarded, never saved.
 */
export async function runRecommendationCall(cfg: AiConfig, ctx: AiContext): Promise<AiRunResult> {
  const started = Date.now();
  const prompt = buildPrompt(ctx);
  let raw: string;
  try {
    raw = await callGemini(cfg, prompt);
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") throw new Error("AI_TIMEOUT");
    throw error;
  }
  const latencyMs = Date.now() - started;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("INVALID_OUTPUT: the AI response was not valid JSON");
  }
  const checked = aiResponseSchema.safeParse(parsed);
  if (!checked.success)
    throw new Error("INVALID_OUTPUT: the AI response did not match the required structure");
  const { items, rejectedUnknown } = filterAiRecommendations(ctx, checked.data.recommendations);
  return { items, rejectedUnknown, model: cfg.model, latencyMs };
}
