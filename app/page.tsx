import LaneMap from "@/components/LaneMap";

const LANES = [
  { color: "#1D9E75", name: "Lane 1 — Cape of Good Hope", routing: "JPOSA → CNNGB → TWKHH → SGSIN → ESVLC → FRFOS", transit: "38–44 days" },
  { color: "#D85A30", name: "Lane 2 — Suez Canal",         routing: "JPOSA → CNNGB → CNXMN → SGSIN → ITGIT → FRFOS", transit: "27–33 days" },
  { color: "#7F77DD", name: "Lane 3 — Arctic (NSR)",       routing: "JPOSA → KRPUS → RUPEV → RUSBW → NLRTM → FRFOS", transit: "21–24 days" },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Synthetic-data warning — must be visible at all times */}
      <div className="bg-amber-100 border-b border-amber-300 px-4 py-2 text-center text-sm font-medium text-amber-800">
        SYNTHETIC DATA — All companies, prices, forwarders, and routes are fictional and for academic use only.
      </div>

      {/* Top navigation bar */}
      <header className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Maison Japonaise</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Annual Freight Tender Analyser
          </p>
        </div>
        <a
          href="/method-note"
          className="text-sm text-slate-300 hover:text-white underline underline-offset-2 transition-colors"
        >
          Method note
        </a>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        {/* Description and primary action */}
        <div className="mb-10">
          <p className="text-slate-600 text-lg mb-6 max-w-2xl leading-relaxed">
            Upload forwarder quotes in any format, convert all charges to USD, and find the
            best-value carrier per lane — with editable scoring weights and a clear explanation.
          </p>
          <a
            href="/upload"
            className="inline-block bg-blue-700 hover:bg-blue-800 text-white font-semibold px-6 py-3 rounded-lg text-base transition-colors"
          >
            Import tender →
          </a>
          <p className="text-xs text-slate-400 mt-2">
            Upload PDF, DOCX, XLSX, or CSV quote files.{" "}
            <a href="/analyse" className="underline hover:text-slate-600">Skip to demo →</a>
          </p>
        </div>

        {/* Lane map */}
        <section>
          <h2 className="text-slate-800 font-semibold text-lg mb-4">Shipping Lanes</h2>
          <LaneMap />
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {LANES.map((lane) => (
              <div key={lane.name} className="flex gap-3">
                <div
                  className="w-0.5 rounded-full flex-shrink-0 mt-1"
                  style={{ background: lane.color, alignSelf: "stretch" }}
                />
                <div>
                  <p className="text-sm font-semibold text-slate-700">{lane.name}</p>
                  <p className="text-xs text-slate-500 font-mono mt-0.5 leading-relaxed">{lane.routing}</p>
                  <p className="text-xs text-slate-500 mt-1">Transit: {lane.transit}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
