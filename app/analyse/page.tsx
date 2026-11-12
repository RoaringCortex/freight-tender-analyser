"use client";

import { useState, useEffect } from "react";
import { OFFERS, LANES, type Offer } from "@/lib/data/quotes";
import {
  calcTotal,
  scoreOffers,
  findWinner,
  type CriterionWeights,
  CONTAINERS_PER_SHIPMENT,
} from "@/lib/calculations";

type LaneNumber = 1 | 2 | 3;

const CRITERION_LABELS: Record<keyof CriterionWeights, string> = {
  cost: "Total cost",
  transit: "Transit time",
  demurrage: "Demurrage free time",
  reliability: "Schedule reliability",
};

export default function AnalysePage() {
  const [offers, setOffers] = useState<Offer[]>(OFFERS);
  const [isUploaded, setIsUploaded] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem("extractedOffers");
    if (stored) {
      try {
        setOffers(JSON.parse(stored));
        setIsUploaded(true);
      } catch {
        // malformed — fall back to demo data silently
      }
    }
  }, []);

  const [activeLane, setActiveLane] = useState<LaneNumber>(1);
  const [rawWeights, setRawWeights] = useState<CriterionWeights>({
    cost: 40,
    transit: 20,
    demurrage: 20,
    reliability: 20,
  });

  const weightSum = Object.values(rawWeights).reduce((a, b) => a + b, 0);

  const weights: CriterionWeights =
    weightSum === 0
      ? { cost: 25, transit: 25, demurrage: 25, reliability: 25 }
      : {
          cost: (rawWeights.cost / weightSum) * 100,
          transit: (rawWeights.transit / weightSum) * 100,
          demurrage: (rawWeights.demurrage / weightSum) * 100,
          reliability: (rawWeights.reliability / weightSum) * 100,
        };

  const laneOffers = offers.filter((o) => o.lane === activeLane);
  const scores = scoreOffers(laneOffers, weights);
  const winner = findWinner(scores);
  const sortedScores = [...scores].sort((a, b) => b.weightedScore - a.weightedScore);
  const laneInfo = LANES.find((l) => l.number === activeLane)!;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-amber-100 border-b border-amber-300 px-4 py-2 text-center text-sm font-medium text-amber-800">
        SYNTHETIC DATA — All companies, prices, forwarders, and routes are fictional and for academic use only.
      </div>

      {isUploaded ? (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 text-center text-sm text-blue-700">
          Showing <strong>uploaded quote data</strong> ({offers.length} offers extracted by Gemini AI).{" "}
          <button
            onClick={() => { sessionStorage.removeItem("extractedOffers"); setOffers(OFFERS); setIsUploaded(false); }}
            className="underline underline-offset-2 hover:text-blue-900"
          >
            Switch back to demo data
          </button>
        </div>
      ) : (
        <div className="bg-slate-100 border-b border-slate-200 px-4 py-2 text-center text-sm text-slate-500">
          Using demo data.{" "}
          <a href="/upload" className="underline underline-offset-2 hover:text-slate-700">
            Upload real quote files →
          </a>
        </div>
      )}

      <header className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Freight Tender Analyser</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Saint JAP · Port of Osaka → Marseille-Fos · 2027 annual contract
          </p>
        </div>
        <a
          href="/"
          className="text-sm text-slate-300 hover:text-white underline underline-offset-2 transition-colors"
        >
          ← Back
        </a>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-10">
        {/* ── Lane selector ── */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
            Select lane
          </h2>
          <div className="flex gap-2 flex-wrap">
            {LANES.map((lane) => (
              <button
                key={lane.number}
                onClick={() => setActiveLane(lane.number as LaneNumber)}
                className={`px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                  activeLane === lane.number
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-300 hover:border-slate-500"
                }`}
              >
                Lane {lane.number} — {lane.name}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500 font-mono">{laneInfo.routing}</p>
        </section>

        {/* ── Step 5: Cost breakdown ── */}
        <section>
          <h2 className="text-lg font-semibold text-slate-800 mb-1">Step 5 — Cost breakdown</h2>
          <p className="text-sm text-slate-500 mb-4">
            In-scope charges only (FOB Osaka — origin &amp; customs excluded). Cost per container,
            assuming {CONTAINERS_PER_SHIPMENT} containers per shipment.
          </p>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Forwarder</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-700">Ocean freight</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-700">Thermal</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-700">Dest. local</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-700">War risk</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-700">Total / ctr</th>
                </tr>
              </thead>
              <tbody>
                {laneOffers.map((offer) => {
                  const total = calcTotal(offer, CONTAINERS_PER_SHIPMENT);
                  const thermal =
                    offer.surcharges.find((c) => c.name.startsWith("Thermal"))?.amountUSD ?? 0;
                  const dest =
                    offer.surcharges.find((c) => c.name.startsWith("Destination"))?.amountUSD ?? 0;
                  const war =
                    offer.surcharges.find((c) => c.name.startsWith("War"))?.amountUSD ?? 0;
                  const isWinner = offer.forwarder === winner.offer.forwarder;
                  return (
                    <tr
                      key={offer.forwarder}
                      className={`border-b border-slate-100 last:border-0 ${
                        isWinner ? "bg-emerald-50" : "hover:bg-slate-50"
                      }`}
                    >
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {offer.forwarder}
                        {offer.pricingType === "spot" && (
                          <span className="ml-2 text-xs text-amber-600 font-semibold">SPOT</span>
                        )}
                        {isWinner && (
                          <span className="ml-2 text-xs text-emerald-700 font-semibold">
                            ★ WINNER
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        ${offer.oceanFreightUSD.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        ${thermal.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        ${dest.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        ${war.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900">
                        ${total.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Step 6: Scoring weights ── */}
        <section>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-semibold text-slate-800">Step 6 — Scoring weights</h2>
            <button
              onClick={() =>
                setRawWeights({ cost: 25, transit: 25, demurrage: 25, reliability: 25 })
              }
              className="text-xs text-slate-500 hover:text-slate-700 underline underline-offset-2"
            >
              Reset to equal
            </button>
          </div>
          <p className="text-sm text-slate-500 mb-5">
            Drag the sliders to reflect how much each criterion matters to your company.{" "}
            {weightSum !== 100 ? (
              <span className="text-amber-600 font-medium">
                Total = {weightSum}% — scores are normalized automatically.
              </span>
            ) : (
              <span className="text-emerald-600 font-medium">Total = 100% ✓</span>
            )}
          </p>
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
            {(["cost", "transit", "demurrage", "reliability"] as const).map((key) => (
              <div key={key}>
                <div className="flex justify-between mb-1">
                  <label className="text-sm font-medium text-slate-700">
                    {CRITERION_LABELS[key]}
                  </label>
                  <span className="text-sm font-semibold text-slate-900 w-12 text-right">
                    {rawWeights[key]}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={rawWeights[key]}
                  onChange={(e) =>
                    setRawWeights((prev) => ({ ...prev, [key]: Number(e.target.value) }))
                  }
                  className="w-full accent-slate-700"
                />
              </div>
            ))}
          </div>
        </section>

        {/* ── Step 7: Award recommendation ── */}
        <section>
          <h2 className="text-lg font-semibold text-slate-800 mb-1">
            Step 7 — Award recommendation
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            Forwarders ranked by weighted score. Higher is better (100 = best in class).
          </p>

          {/* Winner callout */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 mb-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600 mb-1">
              Recommended award — Lane {activeLane} · {laneInfo.name}
            </p>
            <p className="text-2xl font-bold text-emerald-800">{winner.offer.forwarder}</p>
            <p className="text-sm text-emerald-700 mt-1">
              Total cost ${winner.totalUSD.toLocaleString()} / container · Weighted score{" "}
              {winner.weightedScore.toFixed(1)} / 100
            </p>
            <p className="text-sm text-slate-600 mt-2 italic">{winner.offer.notes}</p>
          </div>

          {/* Ranked score table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Rank</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Forwarder</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-700">Cost</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-700">Transit</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-700">Demurrage</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-700">Reliability</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-700">
                    Weighted score
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedScores.map((s, i) => (
                  <tr
                    key={s.offer.forwarder}
                    className={`border-b border-slate-100 last:border-0 ${
                      i === 0 ? "bg-emerald-50" : "hover:bg-slate-50"
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-slate-400">#{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{s.offer.forwarder}</td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {s.costScore.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {s.transitScore.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {s.demurrageScore.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {s.reliabilityScore.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">
                      {s.weightedScore.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-slate-400 mt-3">
            All scores 0–100. Cost score: cheapest offer = 100. Transit score: fastest = 100.
            Demurrage: most free days = 100. Reliability: highest on-time % = 100.
          </p>
        </section>
      </main>
    </div>
  );
}
