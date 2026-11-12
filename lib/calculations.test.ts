import { describe, it, expect } from "vitest";
import { OFFERS } from "./data/quotes";
import { calcTotal, scoreOffers, findWinner, CONTAINERS_PER_SHIPMENT } from "./calculations";

// Hand-calculated in-scope totals (per container, 2 containers per shipment)
// In-scope = oceanFreight + per-container surcharges + (per-shipment surcharges / 2)
// Origin Local Charges (per shipment, inScope:false) and Customs (per filing, inScope:false) are excluded.
//
// K-Logistics Spirit
//   L1: 2450 + 350 + 450 + 530 = 3780
//   L2: 2150 + 350 + 450 + 880 = 3830
//   L3: 2800 + 550 + 450 + 530 = 4330
//
// LHD Global Wave
//   L1: 2400 + 420 + 460 + 530 = 3810
//   L2: 2100 + 420 + 460 + 910 = 3890
//   L3: 2850 + 580 + 460 + 530 = 4420
//
// Nippon Pacific Cargo
//   L1: 2500 + 390 + 440 + 530 = 3860
//   L2: 2200 + 390 + 440 + 850 = 3880
//   L3: 2750 + 520 + 440 + 530 = 4240
//
// Pacific Alliance Logistics
//   L1: 2650 + 450 + 420 + 530 = 4050
//   L2: 2350 + 450 + 420 + 930 = 4150
//   L3: 2950 + 600 + 420 + 530 = 4500

const EXPECTED: Record<string, Record<number, number>> = {
  "K-Logistics Spirit":        { 1: 3780, 2: 3830, 3: 4330 },
  "LHD Global Wave":           { 1: 3810, 2: 3890, 3: 4420 },
  "Nippon Pacific Cargo":      { 1: 3860, 2: 3880, 3: 4240 },
  "Pacific Alliance Logistics":{ 1: 4050, 2: 4150, 3: 4500 },
};

describe("calcTotal", () => {
  for (const offer of OFFERS) {
    it(`${offer.forwarder} lane ${offer.lane} = $${EXPECTED[offer.forwarder][offer.lane]}`, () => {
      expect(calcTotal(offer, CONTAINERS_PER_SHIPMENT)).toBe(
        EXPECTED[offer.forwarder][offer.lane],
      );
    });
  }
});

describe("scoreOffers — cost scores sum check", () => {
  for (const lane of [1, 2, 3] as const) {
    it(`lane ${lane}: cheapest forwarder gets cost score 100`, () => {
      const laneOffers = OFFERS.filter((o) => o.lane === lane);
      const weights = { cost: 100, transit: 0, demurrage: 0, reliability: 0 };
      const scores = scoreOffers(laneOffers, weights);
      const maxScore = Math.max(...scores.map((s) => s.costScore));
      expect(maxScore).toBeCloseTo(100, 5);
    });
  }
});

describe("findWinner — cost-only", () => {
  const weights = { cost: 100, transit: 0, demurrage: 0, reliability: 0 };

  it("lane 1 cheapest is K-Logistics Spirit ($3,780)", () => {
    const scores = scoreOffers(OFFERS.filter((o) => o.lane === 1), weights);
    expect(findWinner(scores).offer.forwarder).toBe("K-Logistics Spirit");
  });

  it("lane 2 cheapest is K-Logistics Spirit ($3,830)", () => {
    const scores = scoreOffers(OFFERS.filter((o) => o.lane === 2), weights);
    expect(findWinner(scores).offer.forwarder).toBe("K-Logistics Spirit");
  });

  it("lane 3 cheapest is Nippon Pacific Cargo ($4,240)", () => {
    const scores = scoreOffers(OFFERS.filter((o) => o.lane === 3), weights);
    expect(findWinner(scores).offer.forwarder).toBe("Nippon Pacific Cargo");
  });
});
