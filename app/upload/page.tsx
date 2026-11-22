"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { extractOffersFromFile } from "@/lib/extract-client";
import { OFFERS } from "@/lib/data/quotes";
import type { Offer, Charge } from "@/lib/data/quotes";

type EditableOffer = Omit<Offer, "lane"> & { lane: number; _sourceFile?: string };

const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".xlsx", ".csv"];

const FILE_COLOURS: Record<string, string> = {
  pdf:  "bg-red-900/40 text-red-300",
  docx: "bg-blue-900/40 text-blue-300",
  doc:  "bg-blue-900/40 text-blue-300",
  xlsx: "bg-green-900/40 text-green-300",
  xls:  "bg-green-900/40 text-green-300",
  csv:  "bg-slate-700 text-slate-300",
};

const SOURCE_COLOURS: Record<string, string> = {
  PDF:  "bg-red-900/40 text-red-300",
  DOCX: "bg-blue-900/40 text-blue-300",
  XLSX: "bg-green-900/40 text-green-300",
  CSV:  "bg-slate-700 text-slate-300",
};

type FileStatus = "pending" | "extracting" | "done" | "error";
type FileState = { file: File; status: FileStatus; error?: string; retryInfo?: string };

const TOUR_STEPS = [
  { key: "dropzone",  title: "Upload your quote files",       description: "Drop your forwarder quote files here, or click to browse. TenderAI supports PDF, Word, Excel, and CSV." },
  { key: "settings",  title: "Set your scoring preferences",  description: "Click the settings icon to configure how much each criterion matters — cost, transit time, free time, and reliability." },
  { key: "analyse",   title: "Proceed to analysis",           description: "Once you have reviewed all extracted data on the right, click Analyse to get your award recommendation." },
];

function fileExt(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function blankOffer(): EditableOffer {
  return {
    forwarder: "", lane: 1, source: "PDF", pricingType: "fixed",
    oceanFreightUSD: 0, surcharges: [],
    transitDaysMin: 0, transitDaysMax: 0,
    demurrageFreeTimeDays: 0, detentionFreeTimeDays: 0,
    reliabilityPctMin: 0, reliabilityPctMax: 0,
    operatingWindow: "Year-round", notes: "",
  };
}

function Field({ label, value, onChange, type = "text", min }: {
  label: string; value: string | number; onChange: (v: string) => void; type?: string; min?: number;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-xs text-slate-500">{label}</label>
      <input
        type={type} min={min} value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white w-full focus:outline-none focus:border-blue-500"
      />
    </div>
  );
}

// ── Document Viewer ──────────────────────────────────────────
function DocumentViewer({ file }: { file: File }) {
  const [content, setContent] = useState<string | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const ext = fileExt(file.name);

  useEffect(() => {
    setContent(null);
    setObjectUrl(null);

    if (ext === "pdf") {
      const url = URL.createObjectURL(file);
      setObjectUrl(url);
      return () => URL.revokeObjectURL(url);
    }

    if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) {
      const url = URL.createObjectURL(file);
      setObjectUrl(url);
      return () => URL.revokeObjectURL(url);
    }

    if (ext === "docx" || ext === "doc") {
      import("mammoth").then((mammoth) => {
        file.arrayBuffer().then((buf) => {
          mammoth.convertToHtml({ arrayBuffer: buf }).then((result) => {
            setContent(result.value);
          });
        });
      });
    }

    if (ext === "xlsx" || ext === "xls" || ext === "csv") {
      import("xlsx").then((XLSX) => {
        file.arrayBuffer().then((buf) => {
          const wb = XLSX.read(buf, { type: "buffer" });
          const html = wb.SheetNames.map((name) =>
            `<h4 style="margin:12px 0 6px;font-weight:600;color:#94a3b8">${name}</h4>` +
            XLSX.utils.sheet_to_html(wb.Sheets[name]),
          ).join("");
          setContent(html);
        });
      });
    }
  }, [file]);

  if (ext === "pdf") {
    return objectUrl
      ? <iframe src={objectUrl} className="w-full h-full border-0" title={file.name} />
      : <div className="flex items-center justify-center h-full text-slate-500 text-sm">Loading PDF…</div>;
  }

  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) {
    return objectUrl
      ? <div className="flex items-center justify-center h-full p-4"><img src={objectUrl} alt={file.name} className="max-w-full max-h-full object-contain rounded-lg" /></div>
      : <div className="flex items-center justify-center h-full text-slate-500 text-sm">Loading image…</div>;
  }

  if (content) {
    return (
      <div
        className="p-4 overflow-auto h-full text-sm text-slate-200 prose prose-invert prose-sm max-w-none
          [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-slate-700 [&_td]:px-2 [&_td]:py-1
          [&_th]:border [&_th]:border-slate-600 [&_th]:px-2 [&_th]:py-1 [&_th]:bg-slate-800 [&_th]:text-slate-300"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }

  return (
    <div className="flex items-center justify-center h-full text-slate-500 text-sm">
      Converting document…
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────
export default function UploadPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropzoneRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLButtonElement>(null);
  const analyseRef = useRef<HTMLDivElement>(null);

  const [fileStates, setFileStates] = useState<FileState[]>([]);
  const [fileObjects, setFileObjects] = useState<Map<string, File>>(new Map());
  const [offers, setOffers] = useState<EditableOffer[]>([]);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [viewingFile, setViewingFile] = useState<File | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [tourStep, setTourStep] = useState<number | null>(null);
  const [customCriteriaSettings, setCustomCriteriaSettings] = useState<{ key: string; label: string; description: string }[]>([]);

  useEffect(() => {
    const visited = localStorage.getItem("tenderai_visited");
    if (!visited) setShowModal(true);
    try {
      const s = localStorage.getItem("tenderai_settings");
      if (s) {
        const p = JSON.parse(s);
        if (p.criteria) {
          setCustomCriteriaSettings(
            p.criteria
              .filter((c: { custom?: boolean; enabled: boolean; description?: string }) => c.custom && c.enabled && c.description)
              .map((c: { key: string; label: string; description: string }) => ({ key: c.key, label: c.label, description: c.description })),
          );
        }
      }
    } catch { /* ignore */ }
  }, []);

  function startTour() { setShowModal(false); setTourStep(0); }
  function skipModal() { setShowModal(false); localStorage.setItem("tenderai_visited", "true"); }
  function nextTourStep() {
    if (tourStep === null) return;
    if (tourStep < TOUR_STEPS.length - 1) setTourStep(tourStep + 1);
    else { setTourStep(null); localStorage.setItem("tenderai_visited", "true"); }
  }
  function prevTourStep() { if (tourStep !== null && tourStep > 0) setTourStep(tourStep - 1); }
  function isTourTarget(key: string) { return tourStep !== null && TOUR_STEPS[tourStep].key === key; }

  function addFiles(incoming: FileList | null) {
    if (!incoming) return;
    const arr = Array.from(incoming);
    setFileStates((prev) => {
      const existing = new Set(prev.map((f) => f.file.name));
      const next = arr.filter((f) => !existing.has(f.name)).map((f) => ({ file: f, status: "pending" as FileStatus }));
      return [...prev, ...next];
    });
    setFileObjects((prev) => {
      const next = new Map(prev);
      arr.forEach((f) => next.set(f.name, f));
      return next;
    });
  }

  function removeFile(name: string) {
    setFileStates((prev) => prev.filter((f) => f.file.name !== name));
    if (viewingFile?.name === name) setViewingFile(null);
  }

  function setStatus(name: string, status: FileStatus, error?: string, retryInfo?: string) {
    setFileStates((prev) => prev.map((f) => f.file.name === name ? { ...f, status, error, retryInfo } : f));
  }

  async function handleExtract() {
    if (!fileStates.length || loading) return;
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      setFileStates((prev) => prev.map((f) => ({ ...f, status: "error", error: "NEXT_PUBLIC_GEMINI_API_KEY is not set" })));
      return;
    }
    let exchangeRates: Record<string, number> | undefined;
    try {
      const s = localStorage.getItem("tenderai_settings");
      if (s) { const p = JSON.parse(s); if (p.exchangeRates) exchangeRates = p.exchangeRates; }
    } catch { /* ignore */ }
    setLoading(true);
    const allOffers: EditableOffer[] = [];
    for (const { file } of fileStates) {
      setStatus(file.name, "extracting");
      try {
        const extracted = await extractOffersFromFile(file, apiKey, (attempt, max) => {
          setStatus(file.name, "extracting", undefined, `Retrying (${attempt}/${max})…`);
        }, exchangeRates, customCriteriaSettings.length > 0 ? customCriteriaSettings : undefined);
        extracted.forEach((o) => allOffers.push({ ...(o as EditableOffer), _sourceFile: file.name }));
        setStatus(file.name, "done");
      } catch (err) {
        setStatus(file.name, "error", err instanceof Error ? err.message : "Unknown error");
      }
    }
    setLoading(false);
    if (allOffers.length > 0) setOffers((prev) => [...prev, ...allOffers]);
  }

  function loadDemo() {
    setOffers(OFFERS.map((o) => ({ ...o })));
  }

  function handleOfferClick(oi: number) {
    const filename = offers[oi]._sourceFile;
    if (filename && fileObjects.has(filename)) {
      setViewingFile(fileObjects.get(filename)!);
      setSelectedOffer(oi);
    }
  }

  function updateOffer(i: number, field: keyof EditableOffer, value: unknown) {
    setOffers((prev) => prev.map((o, idx) => idx === i ? { ...o, [field]: value } : o));
  }

  function updateCustomValue(oi: number, key: string, value: number | null) {
    setOffers((prev) => prev.map((o, idx) =>
      idx === oi ? { ...o, customValues: { ...(o.customValues ?? {}), [key]: value } } : o,
    ));
  }

  function updateSurcharge(oi: number, si: number, field: keyof Charge, value: unknown) {
    setOffers((prev) => prev.map((o, idx) => {
      if (idx !== oi) return o;
      return { ...o, surcharges: o.surcharges.map((s, j) => j === si ? { ...s, [field]: value } : s) };
    }));
  }

  function addSurcharge(oi: number) {
    setOffers((prev) => prev.map((o, idx) => {
      if (idx !== oi) return o;
      return { ...o, surcharges: [...o.surcharges, { name: "", amountUSD: 0, per: "container" as const, inScope: true }] };
    }));
  }

  function removeSurcharge(oi: number, si: number) {
    setOffers((prev) => prev.map((o, idx) => {
      if (idx !== oi) return o;
      return { ...o, surcharges: o.surcharges.filter((_, j) => j !== si) };
    }));
  }

  function removeOffer(i: number) {
    setOffers((prev) => prev.filter((_, idx) => idx !== i));
    if (selectedOffer === i) { setSelectedOffer(null); setViewingFile(null); }
  }

  function handleAnalyse() {
    sessionStorage.setItem("extractedOffers", JSON.stringify(offers));
    router.push("/analyse");
  }

  const hasErrors = fileStates.some((f) => f.status === "error");

  return (
    <div className="h-screen bg-slate-950 text-white flex flex-col overflow-hidden">

      {/* ── First-time modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-2xl mx-auto mb-4">👋</div>
            <h2 className="text-xl font-bold text-white mb-2">Welcome to TenderAI</h2>
            <p className="text-slate-400 text-sm mb-6">Have you used this tool before?</p>
            <div className="flex flex-col gap-3">
              <button onClick={skipModal} className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition-colors">
                Yes, I know how it works
              </button>
              <button onClick={startTour} className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-3 rounded-xl transition-colors">
                No, show me around
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tour overlay ── */}
      {tourStep !== null && (
        <>
          <div className="fixed inset-0 z-40 bg-black/70 pointer-events-none" />
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-white rounded-2xl p-6 shadow-2xl w-80 text-center">
            <p className="text-xs text-slate-400 mb-1 font-medium">Step {tourStep + 1} of {TOUR_STEPS.length}</p>
            <h3 className="font-bold text-slate-900 text-base mb-2">{TOUR_STEPS[tourStep].title}</h3>
            <p className="text-sm text-slate-600 mb-5 leading-relaxed">{TOUR_STEPS[tourStep].description}</p>
            <div className="flex gap-2">
              {tourStep > 0 && (
                <button onClick={prevTourStep} className="flex-1 border border-slate-200 text-slate-600 font-medium py-2 rounded-lg text-sm hover:bg-slate-50 transition-colors">Back</button>
              )}
              <button onClick={nextTourStep} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 rounded-lg text-sm transition-colors">
                {tourStep < TOUR_STEPS.length - 1 ? "Next" : "Get started"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Nav ── */}
      <nav className="px-8 py-4 flex items-center justify-between border-b border-slate-800 flex-shrink-0">
        <a href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-500 rounded-md flex items-center justify-center text-white font-bold text-sm">T</div>
          <span className="font-bold text-lg tracking-tight text-white">TenderAI</span>
        </a>
        <button
          ref={settingsRef}
          onClick={() => router.push("/settings")}
          className={`p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ${isTourTarget("settings") ? "relative z-50 ring-2 ring-blue-400 text-white bg-slate-800" : ""}`}
          title="Scoring settings"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06-.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
      </nav>

      {/* ── Split layout ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left panel — drop zone / document viewer */}
        <div className={`w-2/5 flex-shrink-0 border-r border-slate-800 flex flex-col overflow-hidden ${isTourTarget("dropzone") ? "relative z-50" : ""}`}>
          {viewingFile ? (
            <>
              <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
                <p className="text-xs text-slate-400 truncate">{viewingFile.name}</p>
                <button onClick={() => { setViewingFile(null); setSelectedOffer(null); }} className="text-slate-500 hover:text-white text-xs ml-2 shrink-0 transition-colors">
                  ✕ Close
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <DocumentViewer file={viewingFile} />
              </div>
            </>
          ) : (
            <div className="flex flex-col h-full p-5 gap-4 overflow-y-auto">
              {/* Drop zone */}
              <div
                ref={dropzoneRef}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
                onClick={() => inputRef.current?.click()}
                className={`rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors flex-shrink-0 ${
                  dragging ? "border-blue-400 bg-slate-800" : "border-slate-700 bg-slate-900 hover:border-slate-500 hover:bg-slate-800"
                }`}
              >
                <input ref={inputRef} type="file" multiple accept={ACCEPTED_EXTENSIONS.join(",")} className="hidden" onChange={(e) => addFiles(e.target.files)} />
                <p className="text-3xl mb-2">📂</p>
                <p className="font-semibold text-white text-sm">Drop files here, or click to browse</p>
                <p className="text-xs text-slate-400 mt-1">PDF · DOCX · XLSX · CSV</p>
              </div>

              {/* File list */}
              {fileStates.length > 0 && (
                <ul className="space-y-2">
                  {fileStates.map(({ file, status, error, retryInfo }) => (
                    <li key={file.name} className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded uppercase shrink-0 ${FILE_COLOURS[fileExt(file.name)] ?? "bg-slate-700 text-slate-300"}`}>
                            {fileExt(file.name)}
                          </span>
                          <span className="text-xs text-slate-300 truncate">{file.name}</span>
                        </div>
                        <div className="flex items-center gap-2 ml-2 shrink-0">
                          {status === "pending"    && <span className="text-xs text-slate-500">Pending</span>}
                          {status === "extracting" && <span className="text-xs text-blue-400 animate-pulse">{retryInfo ?? "Extracting…"}</span>}
                          {status === "done"       && <span className="text-xs text-emerald-400 font-medium">✓</span>}
                          {status === "error"      && <span className="text-xs text-red-400 font-medium">✗</span>}
                          {!loading && <button onClick={() => removeFile(file.name)} className="text-slate-600 hover:text-red-400 text-base leading-none transition-colors">×</button>}
                        </div>
                      </div>
                      {status === "error" && error && <p className="mt-1.5 text-xs text-red-400 leading-relaxed">{error}</p>}
                    </li>
                  ))}
                </ul>
              )}

              {/* Extract button */}
              <div className="flex flex-col gap-2 mt-auto">
                <button
                  onClick={handleExtract}
                  disabled={!fileStates.length || loading}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl text-sm transition-colors"
                >
                  {loading ? "Extracting…" : `Extract${fileStates.length ? ` (${fileStates.length} file${fileStates.length > 1 ? "s" : ""})` : ""}`}
                </button>
                {hasErrors && !loading && (
                  <button onClick={handleExtract} className="text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2 text-center transition-colors">
                    Retry failed files
                  </button>
                )}
                <button onClick={loadDemo} className="text-xs text-slate-500 hover:text-slate-300 underline underline-offset-2 text-center transition-colors">
                  Use demo data
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right panel — offer cards */}
        <div className="flex-1 overflow-y-auto flex flex-col">
          {offers.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
              <p className="text-4xl mb-4">📋</p>
              <p className="text-slate-400 text-sm max-w-xs">
                Upload your quote files and click <strong className="text-white">Extract</strong> — the AI will read each file and populate the offer cards here for you to review.
              </p>
            </div>
          ) : (
            <div className="p-6 space-y-5">
              {/* Summary */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400">
                  <strong className="text-white">{offers.length}</strong> offer{offers.length !== 1 ? "s" : ""} across{" "}
                  <strong className="text-white">{new Set(offers.map((o) => o.lane)).size}</strong> lane{new Set(offers.map((o) => o.lane)).size !== 1 ? "s" : ""}
                </p>
                <button onClick={() => setOffers((prev) => [...prev, blankOffer()])} className="text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors">
                  + Add offer manually
                </button>
              </div>

              {/* Offer cards */}
              {offers.map((offer, oi) => (
                <div
                  key={oi}
                  className={`bg-slate-900 border rounded-2xl overflow-hidden transition-colors ${
                    selectedOffer === oi ? "border-blue-500" : "border-slate-800"
                  }`}
                >
                  {/* Card header */}
                  <div className="bg-slate-800 border-b border-slate-700 px-5 py-3 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase ${SOURCE_COLOURS[offer.source] ?? "bg-slate-700 text-slate-300"}`}>
                        {offer.source}
                      </span>
                      <span className="font-semibold text-white text-sm">{offer.forwarder || "Unnamed"}</span>
                      <span className="text-xs text-slate-400">— Lane {offer.lane}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {offer._sourceFile && (
                        <button
                          onClick={() => handleOfferClick(oi)}
                          className="text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors"
                        >
                          View source
                        </button>
                      )}
                      <span className="text-xs text-slate-500">#{oi + 1}</span>
                      <button onClick={() => removeOffer(oi)} className="text-slate-600 hover:text-red-400 text-lg leading-none transition-colors">×</button>
                    </div>
                  </div>

                  <div className="p-5 space-y-5">
                    {/* Fields */}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Freight &amp; metrics</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <Field label="Forwarder name" value={offer.forwarder} onChange={(v) => updateOffer(oi, "forwarder", v)} />
                        <div className="flex flex-col gap-0.5">
                          <label className="text-xs text-slate-500">Lane</label>
                          <select value={offer.lane} onChange={(e) => updateOffer(oi, "lane", Number(e.target.value))}
                            className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500">
                            <option value={1}>Lane 1 — Cape</option>
                            <option value={2}>Lane 2 — Suez</option>
                            <option value={3}>Lane 3 — Arctic</option>
                          </select>
                        </div>
                        <Field label="Operating window" value={offer.operatingWindow} onChange={(v) => updateOffer(oi, "operatingWindow", v)} />
                        <div className="flex flex-col gap-0.5">
                          <label className="text-xs text-slate-500">Ocean freight (USD)</label>
                          <input type="number" min={0} value={offer.oceanFreightUSD}
                            onChange={(e) => updateOffer(oi, "oceanFreightUSD", Number(e.target.value))}
                            className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white w-full focus:outline-none focus:border-blue-500"
                          />
                          {offer._originalCurrency && offer._originalCurrency !== "USD" && (
                            <p className="text-xs text-slate-500 mt-0.5">
                              converted from {offer._originalOceanFreight?.toLocaleString()} {offer._originalCurrency}
                            </p>
                          )}
                        </div>
                        <Field label="Transit min (days)" type="number" min={0} value={offer.transitDaysMin} onChange={(v) => updateOffer(oi, "transitDaysMin", Number(v))} />
                        <Field label="Transit max (days)" type="number" min={0} value={offer.transitDaysMax} onChange={(v) => updateOffer(oi, "transitDaysMax", Number(v))} />
                        <Field label="Demurrage free (days)" type="number" min={0} value={offer.demurrageFreeTimeDays} onChange={(v) => updateOffer(oi, "demurrageFreeTimeDays", Number(v))} />
                        <Field label="Detention free (days)" type="number" min={0} value={offer.detentionFreeTimeDays} onChange={(v) => updateOffer(oi, "detentionFreeTimeDays", Number(v))} />
                        <Field label="Reliability min (%)" type="number" min={0} value={offer.reliabilityPctMin} onChange={(v) => updateOffer(oi, "reliabilityPctMin", Number(v))} />
                        <Field label="Reliability max (%)" type="number" min={0} value={offer.reliabilityPctMax} onChange={(v) => updateOffer(oi, "reliabilityPctMax", Number(v))} />
                      </div>
                    </div>

                    {/* Custom criteria */}
                    {customCriteriaSettings.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Custom criteria</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {customCriteriaSettings.map((c) => (
                            <div key={c.key} className="flex flex-col gap-0.5">
                              <label className="text-xs text-slate-500">{c.label}</label>
                              <input
                                type="number"
                                placeholder="not found"
                                value={offer.customValues?.[c.key] ?? ""}
                                onChange={(e) => updateCustomValue(oi, c.key, e.target.value ? Number(e.target.value) : null)}
                                className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white w-full focus:outline-none focus:border-blue-500 placeholder:text-slate-600"
                              />
                              {offer.customValues?.[c.key] === null && (
                                <p className="text-xs text-amber-500">Not found in document</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Surcharges */}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Surcharges</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-700">
                              <th className="text-left pb-2 font-medium text-slate-500 w-1/2">Charge name</th>
                              <th className="text-right pb-2 font-medium text-slate-500 pr-3">Amount (USD)</th>
                              <th className="text-center pb-2 font-medium text-slate-500 pr-3">Per</th>
                              <th className="text-center pb-2 font-medium text-slate-500 pr-3">In scope</th>
                              <th className="pb-2 w-6" />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800">
                            {offer.surcharges.map((charge, si) => (
                              <tr key={si} className={charge.inScope ? "" : "opacity-40"}>
                                <td className="py-2 pr-3">
                                  <input type="text" value={charge.name} onChange={(e) => updateSurcharge(oi, si, "name", e.target.value)}
                                    className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white w-full focus:outline-none focus:border-blue-500" />
                                </td>
                                <td className="py-2 pr-3">
                                  <input type="number" min={0} value={charge.amountUSD} onChange={(e) => updateSurcharge(oi, si, "amountUSD", Number(e.target.value))}
                                    className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white w-24 text-right focus:outline-none focus:border-blue-500 ml-auto block" />
                                </td>
                                <td className="py-2 pr-3 text-center">
                                  <select value={charge.per} onChange={(e) => updateSurcharge(oi, si, "per", e.target.value)}
                                    className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500">
                                    <option value="container">container</option>
                                    <option value="shipment">shipment</option>
                                    <option value="filing">filing</option>
                                  </select>
                                </td>
                                <td className="py-2 pr-3 text-center">
                                  <input type="checkbox" checked={charge.inScope} onChange={(e) => updateSurcharge(oi, si, "inScope", e.target.checked)} className="w-4 h-4 accent-blue-500" />
                                </td>
                                <td className="py-2 text-center">
                                  <button onClick={() => removeSurcharge(oi, si)} className="text-slate-600 hover:text-red-400 text-lg leading-none transition-colors">×</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <p className="text-xs text-slate-500">Unchecked = out of scope (FOB Osaka).</p>
                        <button onClick={() => addSurcharge(oi)} className="text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors">+ Add surcharge</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Analyse button */}
              <div
                ref={analyseRef}
                className={`flex items-center justify-between pt-2 border-t border-slate-800 ${isTourTarget("analyse") ? "relative z-50" : ""}`}
              >
                <p className="text-sm text-slate-500">{offers.length} offer{offers.length !== 1 ? "s" : ""} ready.</p>
                <button onClick={handleAnalyse} className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 py-3 rounded-xl transition-colors">
                  Analyse →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
