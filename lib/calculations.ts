import type { Offer } from "./data/quotes";

export const CONTAINERS_PER_SHIPMENT = 2;

export function calcTotal(offer: Offer, containersPerShipment = CONTAINERS_PER_SHIPMENT): number {
  const perContainerSum = offer.surcharges
    .filter((c) => c.inScope && c.per === "container")
    .reduce((sum, c) => sum + c.amountUSD, 0);

  const perShipmentSum = offer.surcharges
    .filter((c) => c.inScope && c.per === "shipment")
    .reduce((sum, c) => sum + c.amountUSD / containersPerShipment, 0);

  return offer.oceanFreightUSD + perContainerSum + perShipmentSum;
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

export type OfferScore = {
  offer: Offer;
  totalUSD: number;
  costScore: number;
  transitScore: number;
  demurrageScore: number;
  reliabilityScore: number;
  weightedScore: number;
};

export function scoreOffers(
  offers: Offer[],
  weights: CriterionWeights,
  containersPerShipment = CONTAINERS_PER_SHIPMENT,
): OfferScore[] {
  const totals = offers.map((o) => calcTotal(o, containersPerShipment));
  const transits = offers.map(transitMid);
  const reliabilities = offers.map(reliabilityMid);
  const demurrages = offers.map((o) => o.demurrageFreeTimeDays);

  const minTotal = Math.min(...totals);
  const minTransit = Math.min(...transits);
  const maxDemurrage = Math.max(...demurrages);
  const maxReliability = Math.max(...reliabilities);

  return offers.map((offer, i) => {
    const costScore = (minTotal / totals[i]) * 100;
    const transitScore = (minTransit / transits[i]) * 100;
    const demurrageScore = (demurrages[i] / maxDemurrage) * 100;
    const reliabilityScore = (reliabilities[i] / maxReliability) * 100;

    const weightedScore =
      (costScore * weights.cost +
        transitScore * weights.transit +
        demurrageScore * weights.demurrage +
        reliabilityScore * weights.reliability) /
      100;

    return {
      offer,
      totalUSD: totals[i],
      costScore,
      transitScore,
      demurrageScore,
      reliabilityScore,
      weightedScore,
    };
  });
}

export function findWinner(scores: OfferScore[]): OfferScore {
  return scores.reduce((best, s) => (s.weightedScore > best.weightedScore ? s : best));
}

export function findSensitivity(
  offers: Offer[],
  weights: CriterionWeights,
  containersPerShipment = CONTAINERS_PER_SHIPMENT,
): string {
  const scores = scoreOffers(offers, weights, containersPerShipment);
  const winner = findWinner(scores);
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

      const testScores = scoreOffers(offers, testWeights, containersPerShipment);
      const testWinner = findWinner(testScores);
      if (testWinner.offer.forwarder !== winnerForwarder) {
        results.push(`Winner changes if ${criterion} weight reaches ${w}%`);
        break;
      }
    }
  }

  return results.length > 0 ? results.join("; ") : "Winner is robust across all weight combinations tested";
}
