"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".xlsx", ".csv"];

const FILE_COLOURS: Record<string, string> = {
  pdf:  "bg-red-100 text-red-700",
  docx: "bg-blue-100 text-blue-700",
  doc:  "bg-blue-100 text-blue-700",
  xlsx: "bg-green-100 text-green-700",
  xls:  "bg-green-100 text-green-700",
  csv:  "bg-slate-100 text-slate-700",
};

function fileExt(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

export default function UploadPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addFiles(incoming: FileList | null) {
    if (!incoming) return;
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name));
      const next = Array.from(incoming).filter((f) => !existing.has(f.name));
      return [...prev, ...next];
    });
    setError(null);
  }

  function removeFile(name: string) {
    setFiles((prev) => prev.filter((f) => f.name !== name));
  }

  async function handleExtract() {
    if (!files.length) return;
    setLoading(true);
    setError(null);

    try {
      const form = new FormData();
      files.forEach((f) => form.append("files", f));

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 55000);
      let res: Response;
      try {
        res = await fetch("/api/extract", { method: "POST", body: form, signal: controller.signal });
      } finally {
        clearTimeout(timeout);
      }
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? "Extraction failed");

      sessionStorage.setItem("extractedOffers", JSON.stringify(data.offers));
      router.push("/analyse");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setError(msg.includes("aborted") ? "Request timed out — Gemini took too long. Please try again." : msg);
    } finally {
      setLoading(false);
    }
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
        <a href="/" className="text-sm text-slate-300 hover:text-white underline underline-offset-2 transition-colors">
          ← Back
        </a>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12 space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 mb-1">Import tender quotes</h2>
          <p className="text-slate-500 text-sm">
            Upload one file per forwarder. Supported formats: PDF, DOCX, XLSX, CSV.
            Gemini AI will read each file and extract the charges automatically.
          </p>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
          className={`rounded-xl border-2 border-dashed p-10 text-center cursor-pointer transition-colors ${
            dragging
              ? "border-blue-400 bg-blue-50"
              : "border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPTED_EXTENSIONS.join(",")}
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
          <p className="text-3xl mb-3">📂</p>
          <p className="font-semibold text-slate-700">Drop files here, or click to browse</p>
          <p className="text-sm text-slate-400 mt-1">PDF · DOCX · XLSX · CSV</p>
        </div>

        {/* File list */}
        {files.length > 0 && (
          <ul className="space-y-2">
            {files.map((f) => {
              const ext = fileExt(f.name);
              return (
                <li
                  key={f.name}
                  className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-4 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase ${FILE_COLOURS[ext] ?? "bg-slate-100 text-slate-600"}`}>
                      {ext}
                    </span>
                    <span className="text-sm text-slate-700 truncate">{f.name}</span>
                    <span className="text-xs text-slate-400 shrink-0">
                      {(f.size / 1024).toFixed(0)} KB
                    </span>
                  </div>
                  <button
                    onClick={() => removeFile(f.name)}
                    className="ml-4 text-slate-400 hover:text-red-500 text-lg leading-none transition-colors"
                    title="Remove"
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleExtract}
            disabled={!files.length || loading}
            className="bg-blue-700 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-lg text-base transition-colors"
          >
            {loading ? "Extracting…" : `Extract & Analyse${files.length ? ` (${files.length} file${files.length > 1 ? "s" : ""})` : ""}`}
          </button>

          <a
            href="/analyse"
            className="text-sm text-slate-500 hover:text-slate-700 underline underline-offset-2"
          >
            Skip — use demo data
          </a>
        </div>

        <p className="text-xs text-slate-400">
          Files are sent to Google Gemini AI for text extraction. Nothing is stored permanently — data lives in your browser session only.
        </p>
      </main>
    </div>
  );
}
