"use client";

import { useState, useEffect, useRef } from "react";
import { toPng } from "html-to-image";
import { useRouter } from "next/navigation";
import {
  scoreOffers,
  findWinner,
  type CriterionWeights,
  type CustomCriterionDef,
  type DroppedCriterion,
  CONTAINERS_PER_SHIPMENT,
} from "@/lib/calculations";
import type { Offer } from "@/lib/data/quotes";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent";

const SETTINGS_KEY = "tenderai_settings";

const LANE_NAMES: Record<1 | 2 | 3, string> = {
  1: "Cape of Good Hope",
  2: "Suez Canal",
  3: "Arctic Northern Sea Route",
};

type LaneWinner = {
  forwarder: string;
  score: number;
  totalUSD: number;
  transitDaysMin: number;
  transitDaysMax: number;
} | null;

type AiResult = {
  overall: string;
  lane1: string | null;
  lane2: string | null;
  lane3: string | null;
};

function TrophyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-700 rounded-full"
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
      <span className="font-mono text-xs tabular-nums text-gray-400 w-10 text-right shrink-0">
        {score.toFixed(1)}
      </span>
    </div>
  );
}

export default function AwardPage() {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [laneWinners, setLaneWinners] = useState<Record<1 | 2 | 3, LaneWinner>>({ 1: null, 2: null, 3: null });
  const [overallWinner, setOverallWinner] = useState<string | null>(null);
  const [overallWinnerLanes, setOverallWinnerLanes] = useState<number[]>([]);
  const [overallAvgScore, setOverallAvgScore] = useState(0);
  const [overallAvgTotal, setOverallAvgTotal] = useState(0);
  const [aiResult, setAiResult] = useState<AiResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [imageExporting, setImageExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("extractedOffers");
    if (!stored) { router.replace("/upload"); return; }

    let offers: Offer[];
    try { offers = JSON.parse(stored); } catch { router.replace("/upload"); return; }

    let w: CriterionWeights = { cost: 40, transit: 20, demurrage: 20, reliability: 20 };
    let exchangeRates: Record<string, number> = {};
    let customCriteria: CustomCriterionDef[] = [];
    try {
      const s = localStorage.getItem(SETTINGS_KEY);
      if (s) {
        const parsed = JSON.parse(s);
        if (parsed.criteria) {
          const enabled = parsed.criteria.filter((c: { enabled: boolean }) => c.enabled);
          const total = enabled.reduce((sum: number, c: { weight: number }) => sum + c.weight, 0) || 100;
          const pick = (key: string) => {
            const c = enabled.find((c: { key: string }) => c.key === key);
            return c ? (c.weight / total) * 100 : 0;
          };
          w = { cost: pick("cost"), transit: pick("transit"), demurrage: pick("demurrage"), reliability: pick("reliability") };
          customCriteria = enabled
            .filter((c: { custom?: boolean }) => c.custom)
            .map((c: { key: string; label: string; weight: number }) => ({ key: c.key, label: c.label, weight: c.weight }));
        }
        if (parsed.exchangeRates) exchangeRates = parsed.exchangeRates;
      }
    } catch { /* use defaults */ }

    const winners: Record<1 | 2 | 3, LaneWinner> = { 1: null, 2: null, 3: null };
    const allDropped: DroppedCriterion[] = [];
    ([1, 2, 3] as const).forEach((lane) => {
      const laneOffers = offers.filter((o) => o.lane === lane);
      const { scores, droppedCriteria } = scoreOffers(laneOffers, w, CONTAINERS_PER_SHIPMENT, exchangeRates, customCriteria);
      droppedCriteria.forEach((d) => { if (!allDropped.find((x) => x.key === d.key)) allDropped.push(d); });
      const winner = findWinner(scores);
      if (winner) {
        winners[lane] = {
          forwarder: winner.offer.forwarder,
          score: winner.weightedScore,
          totalUSD: winner.totalUSD,
          transitDaysMin: winner.offer.transitDaysMin,
          transitDaysMax: winner.offer.transitDaysMax,
        };
      }
    });
    setLaneWinners(winners);

    const tally: Record<string, { count: number; scoreSum: number; totalSum: number }> = {};
    ([1, 2, 3] as const).forEach((lane) => {
      const w = winners[lane];
      if (!w) return;
      if (!tally[w.forwarder]) tally[w.forwarder] = { count: 0, scoreSum: 0, totalSum: 0 };
      tally[w.forwarder].count++;
      tally[w.forwarder].scoreSum += w.score;
      tally[w.forwarder].totalSum += w.totalUSD;
    });

    const best = Object.entries(tally).sort(
      (a, b) => b[1].count - a[1].count || b[1].scoreSum - a[1].scoreSum,
    )[0];

    let bestForwarder: string | null = null;
    if (best) {
      bestForwarder = best[0];
      const wonLanes = ([1, 2, 3] as const).filter((l) => winners[l]?.forwarder === best[0]);
      setOverallWinner(best[0]);
      setOverallWinnerLanes(wonLanes);
      setOverallAvgScore(best[1].scoreSum / best[1].count);
      setOverallAvgTotal(best[1].totalSum / best[1].count);
    }

    setLoaded(true);

    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey || !bestForwarder) return;

    setAiLoading(true);

    const scoringSummary = ([1, 2, 3] as const).map((lane) => {
      const laneOffers = offers.filter((o) => o.lane === lane);
      const { scores } = scoreOffers(laneOffers, w, CONTAINERS_PER_SHIPMENT, exchangeRates, customCriteria);
      return {
        lane,
        name: LANE_NAMES[lane],
        offers: scores.map((s) => ({
          forwarder: s.offer.forwarder,
          totalUSD: s.totalUSD,
          transitDays: `${s.offer.transitDaysMin}–${s.offer.transitDaysMax}`,
          demurrageDays: s.offer.demurrageFreeTimeDays,
          reliabilityPct: `${s.offer.reliabilityPctMin}–${s.offer.reliabilityPctMax}%`,
          weightedScore: +s.weightedScore.toFixed(1),
          costScore: +s.costScore.toFixed(1),
          transitScore: +s.transitScore.toFixed(1),
          demurrageScore: +s.demurrageScore.toFixed(1),
          reliabilityScore: +s.reliabilityScore.toFixed(1),
        })),
      };
    });

    const wonLanesList = ([1, 2, 3] as const)
      .filter((l) => winners[l]?.forwarder === bestForwarder)
      .map((l) => `Lane ${l}`)
      .join(" and ");

    const droppedNote = allDropped.length > 0
      ? `\n\nNOTE — The following custom criteria were excluded from scoring because at least one forwarder did not provide a value: ${allDropped.map((d) => d.label).join(", ")}. Mention this briefly in the "overall" paragraph.`
      : "";

    const prompt = `You are a freight procurement analyst. Based on the tender scoring results below, write a short award recommendation report.

SCORING RESULTS:
${JSON.stringify(scoringSummary, null, 2)}

OVERALL WINNER: ${bestForwarder} (won ${wonLanesList})${droppedNote}

Return a JSON object with exactly these 4 keys:
- "overall": 3-4 sentences. Why this company is the best overall choice. Then 1-2 sentences on negotiation opportunities — what to push back on compared to the other forwarders (e.g. transit time, demurrage days). Do NOT compare to market averages.
- "lane1": 1-2 sentences on why the Lane 1 winner was selected.
- "lane2": 1-2 sentences on why the Lane 2 winner was selected.
- "lane3": 1-2 sentences on why the Lane 3 winner was selected. If no offers exist for a lane, return null.

Tone: professional, concise, suitable for a procurement presentation.
No markdown, no bullet points inside the text.`;

    fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    })
      .then((res) => res.json())
      .then((json) => {
        const text: string | undefined = json?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error(`Gemini error: ${JSON.stringify(json).slice(0, 200)}`);
        const raw = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
        setAiResult(JSON.parse(raw));
      })
      .catch((err) => setAiError(err instanceof Error ? err.message : "Failed to generate AI analysis"))
      .finally(() => setAiLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleExport() {
    const lines: string[] = [
      "FREIGHT TENDER AWARD RECOMMENDATION",
      `Generated: ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`,
      "",
      `OVERALL RECOMMENDATION: ${overallWinner ?? "—"}`,
      overallWinnerLanes.length
        ? `Wins Lane ${overallWinnerLanes.slice(0, -1).join(", ")}${overallWinnerLanes.length > 1 ? ` & Lane ${overallWinnerLanes[overallWinnerLanes.length - 1]}` : overallWinnerLanes[0]}`
        : "",
      "",
    ];
    if (aiResult?.overall) lines.push(aiResult.overall, "");

    ([1, 2, 3] as const).forEach((lane) => {
      const w = laneWinners[lane];
      lines.push(`LANE ${lane} — ${LANE_NAMES[lane].toUpperCase()}`);
      if (w) {
        lines.push(`Winner: ${w.forwarder}`);
        lines.push(`Cost: $${w.totalUSD.toLocaleString()}/container | Transit: ${w.transitDaysMin}–${w.transitDaysMax} days | Score: ${w.score.toFixed(1)}/100`);
      } else {
        lines.push("No offers submitted for this lane.");
      }
      const key = `lane${lane}` as keyof AiResult;
      if (aiResult?.[key]) lines.push(aiResult[key] as string);
      lines.push("");
    });

    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  async function handleImageExport() {
    if (!exportRef.current) return;
    setImageExporting(true);
    try {
      const dataUrl = await toPng(exportRef.current, {
        pixelRatio: 2,
        backgroundColor: "#F7F5F0",
      });
      const link = document.createElement("a");
      link.download = "tender-award.png";
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Image export failed", err);
    } finally {
      setImageExporting(false);
    }
  }

  if (!loaded) {
    return (
      <div className="min-h-screen bg-[#F7F5F0] flex items-center justify-center">
        <p className="text-gray-400 text-sm animate-pulse">Loading results…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F5F0] text-gray-900 flex flex-col">
      {/* Nav */}
      <nav className="px-8 py-5 flex items-center justify-between border-b border-gray-200 bg-[#F7F5F0]">
        <a href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-700 rounded-md flex items-center justify-center text-white font-bold text-sm">T</div>
          <span className="font-bold text-lg tracking-tight text-gray-900">TenderAI</span>
        </a>
        <button
          onClick={() => router.push("/review")}
          className="text-sm text-gray-400 hover:text-gray-900 transition-colors"
        >
          ← Back to review
        </button>
      </nav>

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-10 space-y-10">
        <div ref={exportRef} className="space-y-10 py-2">

          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
            Award recommendation
          </h1>

          {/* Overall winner */}
          {overallWinner ? (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-8 pt-8 pb-7">
                <div className="flex items-start gap-4">
                  <div className="mt-0.5 w-9 h-9 rounded-lg bg-blue-100 border border-blue-200 flex items-center justify-center shrink-0 text-blue-700">
                    <TrophyIcon />
                  </div>
                  <div className="min-w-0">
                    <p className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight leading-tight">
                      {overallWinner}
                    </p>
                    <p className="text-blue-700 text-sm mt-1.5 font-medium">
                      {overallWinnerLanes.length === 1
                        ? `Wins Lane ${overallWinnerLanes[0]}`
                        : `Wins ${overallWinnerLanes.slice(0, -1).map((l) => `Lane ${l}`).join(", ")} & Lane ${overallWinnerLanes[overallWinnerLanes.length - 1]}`}
                    </p>
                  </div>
                </div>

                <div className="mt-7 flex flex-wrap items-start gap-x-8 gap-y-4">
                  <div>
                    <p className="font-mono text-2xl font-bold text-gray-900 tabular-nums">
                      ${Math.round(overallAvgTotal).toLocaleString()}
                    </p>
                    <p className="text-gray-400 text-xs mt-0.5">avg. per container</p>
                  </div>
                  <div className="hidden sm:block w-px bg-gray-200 self-stretch" />
                  <div>
                    <p className="font-mono text-2xl font-bold text-gray-900 tabular-nums">
                      {overallAvgScore.toFixed(1)}
                      <span className="text-gray-400 font-normal text-base"> / 100</span>
                    </p>
                    <p className="text-gray-400 text-xs mt-0.5">avg. weighted score</p>
                  </div>
                </div>
              </div>

              <div className="px-8 py-6 border-t border-gray-100 bg-gray-50">
                {aiLoading && (
                  <div className="animate-pulse space-y-2.5">
                    <div className="h-3 bg-gray-200 rounded-full w-5/6" />
                    <div className="h-3 bg-gray-200 rounded-full w-4/6" />
                    <div className="h-3 bg-gray-200 rounded-full w-2/5" />
                  </div>
                )}
                {aiError && <p className="text-red-600 text-sm">{aiError}</p>}
                {aiResult?.overall && (
                  <p className="text-gray-700 text-sm leading-relaxed">{aiResult.overall}</p>
                )}
                {!aiLoading && !aiResult && !aiError && (
                  <p className="text-gray-400 text-sm">AI analysis unavailable — API key not configured.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl p-7 text-gray-500 text-sm">
              No offers were found. Go back and upload quote files.
            </div>
          )}

          {/* Lane results */}
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-5">Lane results</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {([1, 2, 3] as const).map((lane) => {
                const w = laneWinners[lane];
                const aiKey = `lane${lane}` as keyof AiResult;
                const isOverall = w?.forwarder === overallWinner;
                return (
                  <div
                    key={lane}
                    className={`rounded-2xl p-5 flex flex-col gap-5 ${
                      isOverall
                        ? "bg-blue-50 border border-blue-200"
                        : "bg-white border border-gray-200"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs bg-gray-100 border border-gray-200 text-gray-500 px-2.5 py-1 rounded-full font-medium">
                        Lane {lane}
                      </span>
                      {isOverall && (
                        <span className="text-xs bg-blue-100 border border-blue-200 text-blue-700 px-2.5 py-1 rounded-full font-semibold">
                          Overall winner
                        </span>
                      )}
                    </div>

                    {w ? (
                      <>
                        <div>
                          <p className="text-xs text-gray-400 mb-1">{LANE_NAMES[lane]}</p>
                          <p className="text-lg font-bold text-gray-900 leading-snug">{w.forwarder}</p>
                        </div>

                        <div className="space-y-2 text-sm">
                          <div className="flex items-baseline justify-between gap-4">
                            <span className="text-gray-400 shrink-0">Cost</span>
                            <span className="font-mono text-gray-900 tabular-nums text-right">
                              ${w.totalUSD.toLocaleString()}
                              <span className="text-gray-400 font-normal"> /cont.</span>
                            </span>
                          </div>
                          <div className="flex items-baseline justify-between gap-4">
                            <span className="text-gray-400 shrink-0">Transit</span>
                            <span className="font-mono text-gray-900 tabular-nums text-right">
                              {w.transitDaysMin}–{w.transitDaysMax}
                              <span className="text-gray-400 font-normal"> days</span>
                            </span>
                          </div>
                        </div>

                        <div>
                          <p className="text-xs text-gray-400 mb-2">Weighted score</p>
                          <ScoreBar score={w.score} />
                        </div>

                        {aiLoading && (
                          <div className="animate-pulse space-y-1.5 pt-1 border-t border-gray-200">
                            <div className="h-2.5 bg-gray-200 rounded-full w-full mt-3" />
                            <div className="h-2.5 bg-gray-200 rounded-full w-3/4" />
                          </div>
                        )}
                        {aiResult?.[aiKey] && (
                          <p className="text-xs text-gray-500 leading-relaxed pt-4 border-t border-gray-200">
                            {aiResult[aiKey] as string}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-gray-400 flex-1">No offers for this lane.</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Export actions */}
        <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
          <button
            onClick={handleExport}
            className="bg-white hover:bg-gray-50 active:bg-gray-100 border border-gray-300 text-gray-700 font-semibold px-6 py-3 rounded-xl text-sm transition-colors"
          >
            {copied ? "Copied ✓" : "Copy as text"}
          </button>
          <button
            onClick={handleImageExport}
            disabled={imageExporting}
            className="bg-blue-700 hover:bg-blue-800 active:bg-blue-900 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-xl text-sm transition-colors"
          >
            {imageExporting ? "Saving…" : "Save as image"}
          </button>
        </div>
      </main>
    </div>
  );
}
