"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { extractOffersFromFile } from "@/lib/extract-client";

const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".xlsx", ".csv"];

const FILE_COLOURS: Record<string, string> = {
  pdf:  "bg-red-100 text-red-700",
  docx: "bg-blue-100 text-blue-700",
  doc:  "bg-blue-100 text-blue-700",
  xlsx: "bg-green-100 text-green-700",
  xls:  "bg-green-100 text-green-700",
  csv:  "bg-slate-100 text-slate-700",
};

type FileStatus = "pending" | "extracting" | "done" | "error";

type FileState = {
  file: File;
  status: FileStatus;
  error?: string;
  retryInfo?: string;
};

function fileExt(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

export default function UploadPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileStates, setFileStates] = useState<FileState[]>([]);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);

  function setStatus(name: string, status: FileStatus, error?: string, retryInfo?: string) {
    setFileStates((prev) =>
      prev.map((f) => (f.file.name === name ? { ...f, status, error, retryInfo } : f)),
    );
  }

  function addFiles(incoming: FileList | null) {
    if (!incoming) return;
    setFileStates((prev) => {
      const existing = new Set(prev.map((f) => f.file.name));
      const next = Array.from(incoming)
        .filter((f) => !existing.has(f.name))
        .map((f) => ({ file: f, status: "pending" as FileStatus }));
      return [...prev, ...next];
    });
  }

  function removeFile(name: string) {
    setFileStates((prev) => prev.filter((f) => f.file.name !== name));
  }

  async function handleExtract() {
    if (!fileStates.length || loading) return;

    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      setFileStates((prev) =>
        prev.map((f) => ({ ...f, status: "error", error: "NEXT_PUBLIC_GEMINI_API_KEY is not set" })),
      );
      return;
    }

    setLoading(true);
    const allOffers: object[] = [];

    for (const { file } of fileStates) {
      setStatus(file.name, "extracting");
      try {
        const offers = await extractOffersFromFile(file, apiKey, (attempt, max) => {
          setStatus(file.name, "extracting", undefined, `Busy — retrying (${attempt}/${max})…`);
        });
        allOffers.push(...offers);
        setStatus(file.name, "done");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setStatus(file.name, "error", msg);
      }
    }

    setLoading(false);

    if (allOffers.length > 0) {
      sessionStorage.setItem("extractedOffers", JSON.stringify(allOffers));
      router.push("/analyse");
    }
  }

  const hasErrors = fileStates.some((f) => f.status === "error");
  const allDone = fileStates.length > 0 && fileStates.every((f) => f.status === "done");

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
            Gemini AI reads each file and extracts the charges directly in your browser.
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
        {fileStates.length > 0 && (
          <ul className="space-y-2">
            {fileStates.map(({ file, status, error, retryInfo }) => {
              const ext = fileExt(file.name);
              return (
                <li key={file.name} className="bg-white border border-slate-200 rounded-lg px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase shrink-0 ${FILE_COLOURS[ext] ?? "bg-slate-100 text-slate-600"}`}>
                        {ext}
                      </span>
                      <span className="text-sm text-slate-700 truncate">{file.name}</span>
                      <span className="text-xs text-slate-400 shrink-0">
                        {(file.size / 1024).toFixed(0)} KB
                      </span>
                    </div>
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      {status === "pending"    && <span className="text-xs text-slate-400">Pending</span>}
                      {status === "extracting" && (
                        <span className="text-xs text-blue-600 animate-pulse">
                          {retryInfo ?? "Extracting…"}
                        </span>
                      )}
                      {status === "done"       && <span className="text-xs text-emerald-600 font-medium">✓ Done</span>}
                      {status === "error"      && <span className="text-xs text-red-500 font-medium">✗ Error</span>}
                      {!loading && (
                        <button
                          onClick={() => removeFile(file.name)}
                          className="text-slate-300 hover:text-red-400 text-lg leading-none transition-colors"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                  {status === "error" && error && (
                    <p className="mt-2 text-xs text-red-600 leading-relaxed">{error}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {/* Actions */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleExtract}
            disabled={!fileStates.length || loading}
            className="bg-blue-700 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-lg text-base transition-colors"
          >
            {loading
              ? "Extracting…"
              : `Extract & Analyse${fileStates.length ? ` (${fileStates.length} file${fileStates.length > 1 ? "s" : ""})` : ""}`}
          </button>

          {hasErrors && !loading && (
            <button
              onClick={handleExtract}
              className="text-sm text-blue-600 hover:text-blue-800 underline underline-offset-2"
            >
              Retry failed files
            </button>
          )}

          <a href="/analyse" className="text-sm text-slate-500 hover:text-slate-700 underline underline-offset-2">
            Skip — use demo data
          </a>
        </div>

        {allDone && (
          <p className="text-sm text-emerald-600 font-medium">
            All files extracted — redirecting to analysis…
          </p>
        )}

        <p className="text-xs text-slate-400">
          Files are processed locally in your browser by Gemini AI. Nothing is uploaded to our servers or stored permanently.
        </p>
      </main>
    </div>
  );
}
