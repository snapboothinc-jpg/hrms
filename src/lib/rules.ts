/**
 * Pure business rules. The database functions (competency_gaps,
 * compute_evaluation_score, activate_profile_version) are authoritative;
 * these mirrors are used for previews in the UI and are unit-tested to match.
 */

export type GapStatus = "not_assessed" | "met" | "gap";

/** Numeric gap = max(0, required - current). Not assessed is never level 0. */
export function computeGap(
  required: number,
  current: number | null | undefined,
): {
  gap: number | null;
  status: GapStatus;
} {
  if (current === null || current === undefined) return { gap: null, status: "not_assessed" };
  const gap = Math.max(0, required - current);
  return { gap, status: gap === 0 ? "met" : "gap" };
}

export interface WeightedItem {
  item_type: string;
  weight: number;
}

export function weightTotal(items: WeightedItem[]): number {
  return Math.round(items.reduce((s, i) => s + (Number(i.weight) || 0), 0) * 100) / 100;
}

export function canActivateProfile(items: WeightedItem[]): { ok: boolean; reason?: string } {
  if (items.length === 0) return { ok: false, reason: "Add at least one item before activating" };
  const total = weightTotal(items);
  if (total !== 100)
    return { ok: false, reason: `Item weights must total 100 percent (currently ${total})` };
  return { ok: true };
}

export function canActivateEvaluationProfile(
  factors: { factor_code: string; weight: number }[],
  scoringMethod: "weighted" | "equal",
  criteria?: { item_type: string; weight: number }[],
): { ok: boolean; reason?: string } {
  if (criteria) {
    if (criteria.length === 0)
      return { ok: false, reason: "Add at least one job-specific rating criterion" };
    if (criteria.some((criterion) => criterion.item_type !== "rating"))
      return { ok: false, reason: "Every evaluation criterion must use the 1–5 rating scale" };
    const weighted = criteria.filter((criterion) => Number(criterion.weight) > 0);
    if (weighted.length > 0) {
      const total = weightTotal(
        weighted.map((criterion) => ({ item_type: "rating", weight: criterion.weight })),
      );
      if (total !== 100) {
        return {
          ok: false,
          reason: "Configured criterion weights must total 100 percent",
        };
      }
    }
    return { ok: true };
  }
  const codes = new Set(factors.map((factor) => factor.factor_code));
  if (factors.length !== 10 || codes.size !== 10)
    return { ok: false, reason: "Configure all ten performance factors before activating" };
  if (scoringMethod === "weighted") {
    const total = weightTotal(
      factors.map((factor) => ({ item_type: "rating", weight: factor.weight })),
    );
    if (total !== 100)
      return {
        ok: false,
        reason: `Factor weights must total 100 percent (currently ${total})`,
      };
  }
  return { ok: true };
}

export interface ScoreItem {
  id: string;
  item_type: string;
  weight: number;
  kpi_target?: number | null;
}
export interface ScoreResponse {
  item_id: string;
  rating?: number | null;
  kpi_actual?: number | null;
}

/** Weighted score 0-100. Ratings scale by max; KPIs by actual/target capped at 100%. */
export function computeScore(
  items: ScoreItem[],
  responses: ScoreResponse[],
  scaleMax: number,
): number {
  const byId = new Map(responses.map((r) => [r.item_id, r]));
  let total = 0;
  for (const it of items) {
    const w = Number(it.weight) || 0;
    if (w <= 0) continue;
    const r = byId.get(it.id);
    if (it.item_type === "rating") total += (w * (r?.rating ?? 0)) / scaleMax;
    else if (it.item_type === "kpi" && it.kpi_target && it.kpi_target > 0)
      total += w * Math.min(Math.max(r?.kpi_actual ?? 0, 0) / it.kpi_target, 1);
  }
  return Math.round(total * 100) / 100;
}

export interface PerformanceFactorScore {
  factor_code: string;
  weight: number;
  rating: number | null;
}

/** Performance factor score uses the configured weights and remains on the 1–5 scale. */
export function computePerformanceScore(
  factors: PerformanceFactorScore[],
  scoringMethod: "weighted" | "equal",
): number | null {
  const rated = factors.filter((factor) => factor.rating !== null);
  if (!rated.length) return null;
  const weightOf = (factor: PerformanceFactorScore) =>
    scoringMethod === "equal" ? 1 : Number(factor.weight);
  const denominator = rated.reduce((sum, factor) => sum + weightOf(factor), 0);
  if (denominator <= 0) return null;
  const score =
    rated.reduce((sum, factor) => sum + Number(factor.rating) * weightOf(factor), 0) / denominator;
  return Math.round(score * 100) / 100;
}

export function classifyPerformanceScore(
  score: number | null,
  thresholds: { label: string; min: number; max: number }[],
): string | null {
  if (score === null) return null;
  return (
    thresholds.find((threshold) => score >= threshold.min && score <= threshold.max)?.label ?? null
  );
}
