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

    // Load weights, exchange rates, and custom criteria from settings
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

    // Score each lane
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

    // Find overall winner — most lane wins, then highest avg score
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

    // AI explanations
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
      const node = exportRef.current;
      const dataUrl = await toPng(node, {
        pixelRatio: 2,
        backgroundColor: "#020617",
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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-slate-400 text-sm animate-pulse">Loading results…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Nav */}
      <nav className="px-8 py-5 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-500 rounded-md flex items-center justify-center text-white font-bold text-sm">T</div>
          <span className="font-bold text-lg tracking-tight text-white">TenderAI</span>
        </a>
        <button
          onClick={() => router.push("/upload")}
          className="text-sm text-slate-400 hover:text-white transition-colors"
        >
          ← Back to review
        </button>
      </nav>

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-8 space-y-8">
        <div ref={exportRef} className="space-y-8 px-6 py-6 rounded-2xl">
        <div>
          <p className="text-blue-400 text-xs font-semibold uppercase tracking-widest mb-1">
            Award Recommendation
          </p>
          <h1 className="text-3xl font-extrabold text-white">Here is your winner.</h1>
        </div>

        {/* Overall winner box */}
        {overallWinner ? (
          <div className="bg-blue-950 border border-blue-700 rounded-2xl p-7">
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-400 mb-2">
              Overall recommendation
            </p>
            <p className="text-4xl font-extrabold text-white mb-1">{overallWinner}</p>
            <p className="text-blue-300 text-sm mb-1">
              {overallWinnerLanes.length === 1
                ? `Wins Lane ${overallWinnerLanes[0]}`
                : `Wins Lane ${overallWinnerLanes.slice(0, -1).join(", ")} & Lane ${overallWinnerLanes[overallWinnerLanes.length - 1]}`}
            </p>
            <p className="text-blue-200 text-sm mb-5">
              Avg. cost ${Math.round(overallAvgTotal).toLocaleString()} / container · Avg. score{" "}
              {overallAvgScore.toFixed(1)} / 100
            </p>
            <div className="border-t border-blue-800 pt-4 min-h-[48px]">
              {aiLoading && (
                <p className="text-blue-400 text-sm animate-pulse">Generating AI analysis…</p>
              )}
              {aiError && <p className="text-red-400 text-sm">{aiError}</p>}
              {aiResult?.overall && (
                <p className="text-slate-200 text-sm leading-relaxed">{aiResult.overall}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-7 text-slate-400 text-sm">
            No offers were found. Go back and upload quote files.
          </div>
        )}

        {/* Lane winner cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {([1, 2, 3] as const).map((lane) => {
            const w = laneWinners[lane];
            const aiKey = `lane${lane}` as keyof AiResult;
            const isOverall = w?.forwarder === overallWinner;
            return (
              <div
                key={lane}
                className={`bg-slate-900 border rounded-2xl p-5 space-y-3 ${
                  isOverall ? "border-blue-700" : "border-slate-800"
                }`}
              >
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                    Lane {lane}
                  </p>
                  <p className="text-sm text-slate-300 mt-0.5">{LANE_NAMES[lane]}</p>
                </div>

                {w ? (
                  <>
                    <div>
                      <p className="text-lg font-bold text-white">{w.forwarder}</p>
                      {isOverall && (
                        <span className="text-xs text-blue-400 font-semibold">Overall winner</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 space-y-0.5">
                      <p>${w.totalUSD.toLocaleString()} / container</p>
                      <p>{w.transitDaysMin}–{w.transitDaysMax} days transit</p>
                      <p>Score: {w.score.toFixed(1)} / 100</p>
                    </div>
                    {aiLoading && (
                      <p className="text-xs text-slate-500 animate-pulse">Generating…</p>
                    )}
                    {aiResult?.[aiKey] && (
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {aiResult[aiKey] as string}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-slate-600">No offers for this lane.</p>
                )}
              </div>
            );
          })}
        </div>

        </div>

        {/* Export — outside captured area */}
        <div className="flex justify-end gap-3 py-6">
          <button
            onClick={handleExport}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold px-6 py-3 rounded-xl text-sm transition-colors"
          >
            {copied ? "Copied ✓" : "Copy as text"}
          </button>
          <button
            onClick={handleImageExport}
            disabled={imageExporting}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold px-6 py-3 rounded-xl text-sm transition-colors"
          >
            {imageExporting ? "Saving…" : "Save as image"}
          </button>
        </div>
      </main>
    </div>
  );
}
