import type { AiRecRow, GapRow } from "@/lib/data";

export type TrainingNeedRow = {
  gap: GapRow;
  recommendation: AiRecRow | null;
};

export function buildTrainingNeeds(gaps: GapRow[], recommendations: AiRecRow[]) {
  const latestRecommendations = new Map<string, AiRecRow>();
  for (const recommendation of recommendations) {
    const key = `${recommendation.employee_id}:${recommendation.competency_id}`;
    if (!latestRecommendations.has(key)) latestRecommendations.set(key, recommendation);
  }

  return gaps
    .filter((gap) => gap.gap_status !== "met")
    .map((gap): TrainingNeedRow => ({
      gap,
      recommendation: latestRecommendations.get(`${gap.employee_id}:${gap.competency_id}`) ?? null,
    }));
}
