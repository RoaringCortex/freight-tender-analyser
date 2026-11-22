import type { Offer } from "./data/quotes";

export const CONTAINERS_PER_SHIPMENT = 2;

export function calcTotal(
  offer: Offer,
  containersPerShipment = CONTAINERS_PER_SHIPMENT,
  exchangeRates?: Record<string, number>,
): number {
  const perContainerSum = offer.surcharges
    .filter((c) => c.inScope && c.per === "container")
    .reduce((sum, c) => sum + c.amountUSD, 0);

  const perShipmentSum = offer.surcharges
    .filter((c) => c.inScope && c.per === "shipment")
    .reduce((sum, c) => sum + c.amountUSD / containersPerShipment, 0);

  const raw = offer.oceanFreightUSD + perContainerSum + perShipmentSum;

  // Convert to USD if the quote is in a different currency
  const currency = offer.currency ?? "USD";
  const rate = currency !== "USD" && exchangeRates?.[currency] ? exchangeRates[currency] : null;
  return rate ? raw / rate : raw;
}

export function transitMid(offer: Offer): number {
  return (offer.transitDaysMin + offer.transitDaysMax) / 2;
}

export function reliabilityMid(offer: Offer): number {
  return (offer.reliabilityPctMin + offer.reliabilityPctMax) / 2;
}

export type CriterionWeights = {
  cost: number;
  transit: number;
  demurrage: number;
  reliability: number;
};

export type CustomCriterionDef = {
  key: string;
  label: string;
  weight: number;
};

export type DroppedCriterion = {
  key: string;
  label: string;
};

export type OfferScore = {
  offer: Offer;
  totalUSD: number;
  costScore: number;
  transitScore: number;
  demurrageScore: number;
  reliabilityScore: number;
  customScores: Record<string, number>;
  weightedScore: number;
};

export type ScoringResult = {
  scores: OfferScore[];
  droppedCriteria: DroppedCriterion[];
};

export function scoreOffers(
  offers: Offer[],
  weights: CriterionWeights,
  containersPerShipment = CONTAINERS_PER_SHIPMENT,
  exchangeRates?: Record<string, number>,
  customCriteria: CustomCriterionDef[] = [],
): ScoringResult {
  if (!offers.length) return { scores: [], droppedCriteria: [] };

  const totals = offers.map((o) => calcTotal(o, containersPerShipment, exchangeRates));
  const transits = offers.map(transitMid);
  const reliabilities = offers.map(reliabilityMid);
  const demurrages = offers.map((o) => o.demurrageFreeTimeDays);

  const minTotal = Math.min(...totals);
  const minTransit = Math.min(...transits);
  const maxDemurrage = Math.max(...demurrages) || 1;
  const maxReliability = Math.max(...reliabilities) || 1;

  // Drop custom criteria where any forwarder is missing a value
  const droppedCriteria: DroppedCriterion[] = [];
  const activeCriteria = customCriteria.filter((c) => {
    const allHave = offers.every((o) => {
      const v = o.customValues?.[c.key];
      return v !== null && v !== undefined;
    });
    if (!allHave) droppedCriteria.push({ key: c.key, label: c.label });
    return allHave;
  });

  // Normalize all weights together
  const standardSum = weights.cost + weights.transit + weights.demurrage + weights.reliability;
  const customSum = activeCriteria.reduce((s, c) => s + c.weight, 0);
  const totalWeight = (standardSum + customSum) || 100;

  // Max values for custom scoring
  const customMaxes: Record<string, number> = {};
  activeCriteria.forEach((c) => {
    const vals = offers.map((o) => o.customValues?.[c.key] ?? 0);
    customMaxes[c.key] = Math.max(...vals) || 1;
  });

  const scores = offers.map((offer, i) => {
    const costScore = (minTotal / totals[i]) * 100;
    const transitScore = (minTransit / transits[i]) * 100;
    const demurrageScore = (demurrages[i] / maxDemurrage) * 100;
    const reliabilityScore = (reliabilities[i] / maxReliability) * 100;

    const customScores: Record<string, number> = {};
    activeCriteria.forEach((c) => {
      customScores[c.key] = ((offer.customValues?.[c.key] ?? 0) / customMaxes[c.key]) * 100;
    });

    const standardWeighted =
      costScore * weights.cost +
      transitScore * weights.transit +
      demurrageScore * weights.demurrage +
      reliabilityScore * weights.reliability;

    const customWeighted = activeCriteria.reduce(
      (sum, c) => sum + customScores[c.key] * c.weight, 0,
    );

    const weightedScore = (standardWeighted + customWeighted) / totalWeight;

    return { offer, totalUSD: totals[i], costScore, transitScore, demurrageScore, reliabilityScore, customScores, weightedScore };
  });

  return { scores, droppedCriteria };
}

export function findWinner(scores: OfferScore[]): OfferScore | null {
  if (!scores.length) return null;
  return scores.reduce((best, s) => (s.weightedScore > best.weightedScore ? s : best));
}

export function findSensitivity(
  offers: Offer[],
  weights: CriterionWeights,
  containersPerShipment = CONTAINERS_PER_SHIPMENT,
): string {
  const { scores } = scoreOffers(offers, weights, containersPerShipment);
  const winner = findWinner(scores);
  if (!winner) return "No offers to analyse.";
  const winnerForwarder = winner.offer.forwarder;

  const criteria = ["cost", "transit", "demurrage", "reliability"] as const;
  const results: string[] = [];

  for (const criterion of criteria) {
    for (let w = 0; w <= 100; w++) {
      const remaining = 100 - w;
      const otherCriteria = criteria.filter((c) => c !== criterion);
      const otherWeightEach = remaining / otherCriteria.length;
      const testWeights = { ...weights } as CriterionWeights;
      testWeights[criterion] = w;
      for (const c of otherCriteria) testWeights[c] = otherWeightEach;

      const { scores: testScores } = scoreOffers(offers, testWeights, containersPerShipment);
      const testWinner = findWinner(testScores);
      if (testWinner && testWinner.offer.forwarder !== winnerForwarder) {
        results.push(`Winner changes if ${criterion} weight reaches ${w}%`);
        break;
      }
    }
  }

  return results.length > 0 ? results.join("; ") : "Winner is robust across all weight combinations tested";
}
