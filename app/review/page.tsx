"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Offer, Charge } from "@/lib/data/quotes";

type EditableOffer = Omit<Offer, "lane"> & { lane: number };

const SOURCE_COLOURS: Record<string, string> = {
  PDF:  "bg-red-100 text-red-700",
  DOCX: "bg-blue-100 text-blue-700",
  XLSX: "bg-green-100 text-green-700",
  CSV:  "bg-slate-100 text-slate-700",
};

function Field({
  label, value, onChange, type = "text", min,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  min?: number;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-xs text-slate-500">{label}</label>
      <input
        type={type}
        min={min}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-slate-200 rounded px-2 py-1 text-sm text-slate-800 w-full focus:outline-none focus:border-blue-400"
      />
    </div>
  );
}

export default function ReviewPage() {
  const router = useRouter();
  const [offers, setOffers] = useState<EditableOffer[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem("extractedOffers");
    if (!stored) {
      router.replace("/upload");
      return;
    }
    try {
      setOffers(JSON.parse(stored));
    } catch {
      router.replace("/upload");
      return;
    }
    setReady(true);
  }, [router]);

  function updateOffer(i: number, field: keyof EditableOffer, value: unknown) {
    setOffers((prev) =>
      prev.map((o, idx) => (idx === i ? { ...o, [field]: value } : o)),
    );
  }

  function updateSurcharge(oi: number, si: number, field: keyof Charge, value: unknown) {
    setOffers((prev) =>
      prev.map((o, idx) => {
        if (idx !== oi) return o;
        const surcharges = o.surcharges.map((s, j) =>
          j === si ? { ...s, [field]: value } : s,
        );
        return { ...o, surcharges };
      }),
    );
  }

  function handleConfirm() {
    sessionStorage.setItem("extractedOffers", JSON.stringify(offers));
    router.push("/analyse");
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-amber-100 border-b border-amber-300 px-4 py-2 text-center text-sm font-medium text-amber-800">
        SYNTHETIC DATA — All companies, prices, forwarders, and routes are fictional and for academic use only.
      </div>

      <header className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Freight Tender Analyser</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Saint JAP · Port of Osaka → Marseille-Fos · 2027 annual contract
          </p>
        </div>
        <a href="/upload" className="text-sm text-slate-300 hover:text-white underline underline-offset-2 transition-colors">
          ← Back to upload
        </a>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 mb-1">Review extracted data</h2>
          <p className="text-slate-500 text-sm max-w-2xl">
            AI extracted the values below from your files. Check each figure against the original
            document and correct any mistakes before they enter the comparison.
            <span className="font-medium text-slate-700"> All fields are editable.</span>
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 text-sm text-blue-800">
          <strong>{offers.length} offer{offers.length !== 1 ? "s" : ""}</strong> extracted across{" "}
          <strong>{new Set(offers.map((o) => o.lane)).size} lane{new Set(offers.map((o) => o.lane)).size !== 1 ? "s" : ""}</strong>.
          Review each one, then click <strong>Confirm & Analyse</strong> at the bottom.
        </div>

        {offers.map((offer, oi) => (
          <div key={oi} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            {/* Card header */}
            <div className="bg-slate-50 border-b border-slate-200 px-5 py-4 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase ${SOURCE_COLOURS[offer.source] ?? "bg-slate-100 text-slate-600"}`}>
                  {offer.source}
                </span>
                <span className="font-semibold text-slate-800">{offer.forwarder}</span>
                <span className="text-sm text-slate-500">— Lane {offer.lane}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  offer.pricingType === "spot"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-slate-100 text-slate-600"
                }`}>
                  {offer.pricingType}
                </span>
              </div>
              <span className="text-xs text-slate-400">Offer #{oi + 1}</span>
            </div>

            <div className="p-5 space-y-6">
              {/* Ocean freight + key metrics */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
                  Freight &amp; metrics
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Field
                    label="Ocean freight (USD)"
                    type="number"
                    min={0}
                    value={offer.oceanFreightUSD}
                    onChange={(v) => updateOffer(oi, "oceanFreightUSD", Number(v))}
                  />
                  <Field
                    label="Transit min (days)"
                    type="number"
                    min={0}
                    value={offer.transitDaysMin}
                    onChange={(v) => updateOffer(oi, "transitDaysMin", Number(v))}
                  />
                  <Field
                    label="Transit max (days)"
                    type="number"
                    min={0}
                    value={offer.transitDaysMax}
                    onChange={(v) => updateOffer(oi, "transitDaysMax", Number(v))}
                  />
                  <Field
                    label="Operating window"
                    value={offer.operatingWindow}
                    onChange={(v) => updateOffer(oi, "operatingWindow", v)}
                  />
                  <Field
                    label="Demurrage free (days)"
                    type="number"
                    min={0}
                    value={offer.demurrageFreeTimeDays}
                    onChange={(v) => updateOffer(oi, "demurrageFreeTimeDays", Number(v))}
                  />
                  <Field
                    label="Detention free (days)"
                    type="number"
                    min={0}
                    value={offer.detentionFreeTimeDays}
                    onChange={(v) => updateOffer(oi, "detentionFreeTimeDays", Number(v))}
                  />
                  <Field
                    label="Reliability min (%)"
                    type="number"
                    min={0}
                    value={offer.reliabilityPctMin}
                    onChange={(v) => updateOffer(oi, "reliabilityPctMin", Number(v))}
                  />
                  <Field
                    label="Reliability max (%)"
                    type="number"
                    min={0}
                    value={offer.reliabilityPctMax}
                    onChange={(v) => updateOffer(oi, "reliabilityPctMax", Number(v))}
                  />
                </div>
              </div>

              {/* Surcharges */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
                  Surcharges
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left pb-2 font-medium text-slate-500 w-1/2">Charge name</th>
                        <th className="text-right pb-2 font-medium text-slate-500 pr-3">Amount (USD)</th>
                        <th className="text-center pb-2 font-medium text-slate-500 pr-3">Per</th>
                        <th className="text-center pb-2 font-medium text-slate-500">In scope</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {offer.surcharges.map((charge, si) => (
                        <tr key={si} className={charge.inScope ? "" : "opacity-50"}>
                          <td className="py-2 pr-3">
                            <input
                              type="text"
                              value={charge.name}
                              onChange={(e) => updateSurcharge(oi, si, "name", e.target.value)}
                              className="border border-slate-200 rounded px-2 py-1 text-sm w-full focus:outline-none focus:border-blue-400"
                            />
                          </td>
                          <td className="py-2 pr-3">
                            <input
                              type="number"
                              min={0}
                              value={charge.amountUSD}
                              onChange={(e) => updateSurcharge(oi, si, "amountUSD", Number(e.target.value))}
                              className="border border-slate-200 rounded px-2 py-1 text-sm w-24 text-right focus:outline-none focus:border-blue-400 ml-auto block"
                            />
                          </td>
                          <td className="py-2 pr-3 text-center">
                            <select
                              value={charge.per}
                              onChange={(e) => updateSurcharge(oi, si, "per", e.target.value)}
                              className="border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-400"
                            >
                              <option value="container">container</option>
                              <option value="shipment">shipment</option>
                              <option value="filing">filing</option>
                            </select>
                          </td>
                          <td className="py-2 text-center">
                            <input
                              type="checkbox"
                              checked={charge.inScope}
                              onChange={(e) => updateSurcharge(oi, si, "inScope", e.target.checked)}
                              className="w-4 h-4 accent-blue-600"
                              title={charge.inScope ? "In scope — included in cost" : "Out of scope — excluded from cost"}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Unchecked = out of scope (excluded from total cost under FOB Osaka incoterm).
                </p>
              </div>
            </div>
          </div>
        ))}

        {/* Confirm button */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          <p className="text-sm text-slate-500">
            {offers.length} offer{offers.length !== 1 ? "s" : ""} ready to analyse.
          </p>
          <button
            onClick={handleConfirm}
            className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold px-8 py-3 rounded-lg text-base transition-colors"
          >
            Confirm &amp; Analyse →
          </button>
        </div>
      </main>
    </div>
  );
}
