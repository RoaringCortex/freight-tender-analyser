"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Criterion = {
  key: string;
  label: string;
  weight: number;
  enabled: boolean;
  custom?: boolean;
  description?: string;
};

const DEFAULT_CRITERIA: Criterion[] = [
  { key: "cost",        label: "Total cost",           weight: 40, enabled: true },
  { key: "transit",     label: "Transit time",          weight: 20, enabled: true },
  { key: "demurrage",   label: "Demurrage free time",   weight: 20, enabled: true },
  { key: "reliability", label: "Schedule reliability",  weight: 20, enabled: true },
];

const SETTINGS_KEY = "tenderai_settings";

const SUPPORTED_CURRENCIES = [
  { code: "EUR", name: "Euro" },
  { code: "JPY", name: "Japanese Yen" },
  { code: "CNY", name: "Chinese Yuan" },
  { code: "GBP", name: "British Pound" },
  { code: "SGD", name: "Singapore Dollar" },
  { code: "AUD", name: "Australian Dollar" },
];


export default function SettingsPage() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [criteria, setCriteria] = useState<Criterion[]>(DEFAULT_CRITERIA);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});
  const [ratesLoading, setRatesLoading] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.companyName)   setCompanyName(parsed.companyName);
        if (parsed.criteria)      setCriteria(parsed.criteria);
        if (parsed.exchangeRates && Object.keys(parsed.exchangeRates).length > 0) {
          setExchangeRates(parsed.exchangeRates);
        }
      } catch { /* ignore */ }
    } else {
      fetchRates();
    }
  }, []);

  async function fetchRates() {
    setRatesLoading(true);
    try {
      const res = await fetch("https://open.er-api.com/v6/latest/USD");
      const data = await res.json();
      if (data.result === "success" && data.rates) {
        const picked: Record<string, number> = {};
        SUPPORTED_CURRENCIES.forEach((c) => {
          if (data.rates[c.code]) picked[c.code] = data.rates[c.code];
        });
        setExchangeRates(picked);
      }
    } catch { /* keep existing rates */ }
    finally { setRatesLoading(false); }
  }

  function updateWeight(key: string, value: number) {
    setCriteria((prev) => prev.map((c) => c.key === key ? { ...c, weight: value } : c));
  }

  function toggleCriterion(key: string) {
    setCriteria((prev) =>
      prev.map((c) => c.key === key ? { ...c, enabled: !c.enabled, weight: c.enabled ? 0 : 20 } : c),
    );
  }

  function addCustomCriterion() {
    if (!newLabel.trim()) return;
    const key = `custom_${Date.now()}`;
    setCriteria((prev) => [
      ...prev,
      { key, label: newLabel.trim(), weight: 10, enabled: true, custom: true, description: newDescription.trim() },
    ]);
    setNewLabel("");
    setNewDescription("");
    setShowAddForm(false);
  }

  function removeCustomCriterion(key: string) {
    setCriteria((prev) => prev.filter((c) => c.key !== key));
  }

  function focusOn(key: string) {
    setCriteria((prev) =>
      prev.map((c) => ({ ...c, weight: c.key === key ? 100 : 0 }))
    );
  }

  function resetToDefault() {
    setCriteria(DEFAULT_CRITERIA);
  }

  function handleSave() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ companyName, criteria, exchangeRates }));
    router.push("/upload");
  }

  const weightSum = criteria.filter((c) => c.enabled).reduce((sum, c) => sum + c.weight, 0);

  const isDefaultSettings =
    !criteria.some((c) => c.custom) &&
    criteria.length === DEFAULT_CRITERIA.length &&
    DEFAULT_CRITERIA.every((def) => {
      const current = criteria.find((c) => c.key === def.key);
      return current && current.weight === def.weight && current.enabled === def.enabled;
    });

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
          ← Back to upload
        </button>
      </nav>

      <main className="flex-1 max-w-xl mx-auto w-full px-6 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Settings</h1>
          <p className="text-slate-400 text-sm">Configure your company details and scoring preferences.</p>
        </div>

        {/* Company name */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">Company</h2>
          <input
            type="text"
            placeholder="Your company name"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-blue-500"
          />
        </section>

        {/* Currency rates */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">Currency rates</h2>
              <p className="text-xs text-slate-500 mt-0.5">1 USD = X foreign currency. Auto-fetched — edit to override.</p>
            </div>
            <button
              onClick={fetchRates}
              disabled={ratesLoading}
              className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-40 transition-colors"
            >
              {ratesLoading ? "Fetching…" : "Refresh"}
            </button>
          </div>
          {SUPPORTED_CURRENCIES.map((c) => (
            <div key={c.code} className="flex items-center justify-between gap-4">
              <div>
                <span className="text-sm font-medium text-white">{c.code}</span>
                <span className="text-xs text-slate-500 ml-2">{c.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">1 USD =</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={exchangeRates[c.code] ?? ""}
                  placeholder="—"
                  onChange={(e) => setExchangeRates((prev) => ({ ...prev, [c.code]: Number(e.target.value) }))}
                  className="w-24 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm text-right focus:outline-none focus:border-blue-500"
                />
                <span className="text-xs text-slate-400 w-8">{c.code}</span>
              </div>
            </div>
          ))}
        </section>

        {/* Scoring weights */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">Scoring weights</h2>
              {!isDefaultSettings && (
                <button
                  onClick={resetToDefault}
                  className="text-xs text-slate-500 hover:text-white transition-colors underline underline-offset-2"
                >
                  Reset to default
                </button>
              )}
            </div>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${
              weightSum === 100 ? "bg-emerald-900 text-emerald-400" : "bg-amber-900 text-amber-400"
            }`}>
              {weightSum}% {weightSum === 100 ? "✓" : "— must total 100%"}
            </span>
          </div>

          {criteria.map((c) => (
            <div key={c.key} className={`space-y-2 ${!c.enabled ? "opacity-40" : ""}`}>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <button
                    onClick={() => toggleCriterion(c.key)}
                    className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 overflow-hidden ${
                      c.enabled ? "bg-blue-600" : "bg-slate-700"
                    }`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      c.enabled ? "translate-x-5" : "translate-x-0.5"
                    }`} />
                  </button>
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-white">{c.label}</span>
                    {c.description && (
                      <span className="text-xs text-slate-500 ml-1.5">· {c.description}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={c.weight}
                      disabled={!c.enabled}
                      onChange={(e) => updateWeight(c.key, Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                      className="w-16 bg-slate-800 border border-slate-700 rounded-lg pl-2 pr-6 py-1 text-white text-sm font-semibold text-right focus:outline-none focus:border-blue-500 disabled:opacity-40 font-mono tabular-nums"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs pointer-events-none">%</span>
                  </div>
                  {c.custom && (
                    <button
                      onClick={() => removeCustomCriterion(c.key)}
                      className="text-slate-600 hover:text-red-400 text-lg leading-none transition-colors ml-1"
                    >×</button>
                  )}
                </div>
              </div>
              {c.enabled && (
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={c.weight}
                  onChange={(e) => updateWeight(c.key, Number(e.target.value))}
                  className="w-full accent-blue-500"
                />
              )}
            </div>
          ))}

          {/* Focus shortcuts */}
          {criteria.some((c) => c.enabled) && (
            <div className="border-t border-slate-800 pt-4 space-y-2">
              <p className="text-xs text-slate-500">Focus on one criterion</p>
              <div className="flex flex-wrap gap-2">
                {criteria.filter((c) => c.enabled).map((c) => (
                  <button
                    key={c.key}
                    onClick={() => focusOn(c.key)}
                    className="text-xs px-3 py-1.5 rounded-full border border-slate-700 bg-slate-800 text-slate-300 hover:border-blue-500 hover:text-white transition-colors"
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Add custom criterion */}
          {!showAddForm ? (
            <button
              onClick={() => setShowAddForm(true)}
              className="text-sm text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors"
            >
              + Add custom criterion
            </button>
          ) : (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">New criterion</p>
              <input
                type="text"
                placeholder="Criterion name (e.g. Carbon footprint)"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-blue-500"
              />
              <input
                type="text"
                placeholder="How to calculate (e.g. lower CO₂ per TEU = higher score)"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-blue-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={addCustomCriterion}
                  disabled={!newLabel.trim()}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  Add
                </button>
                <button
                  onClick={() => { setShowAddForm(false); setNewLabel(""); setNewDescription(""); }}
                  className="bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Save */}
        {weightSum !== 100 && (
          <p className="text-sm text-red-400 text-center">
            Weights must total exactly 100% — currently at {weightSum}%
          </p>
        )}
        <button
          onClick={handleSave}
          disabled={weightSum !== 100}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl text-base transition-colors"
        >
          Save & go back
        </button>
      </main>
    </div>
  );
}
