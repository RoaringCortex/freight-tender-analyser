const LANES = [
  {
    number: 1,
    name: "Cape of Good Hope",
    routing: "JPOSA → CNNGB → TWKHH → SGSIN → ESVLC → FRFOS",
    transit: "38–45 days",
  },
  {
    number: 2,
    name: "Suez Canal",
    routing: "JPOSA → CNNGB → CNXMN → SGSIN → ITGIT → FRFOS",
    transit: "28–34 days",
  },
  {
    number: 3,
    name: "Arctic (NSR)",
    routing: "JPOSA → KRPUS → RUPEV → RUSBW → NLRTM → FRFOS",
    transit: "22–25 days",
  },
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
          <h1 className="text-xl font-bold tracking-tight">Freight Tender Analyser</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Saint JAP · Port of Osaka → Marseille-Fos · 2027 annual contract
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

        {/* Lane overview cards */}
        <section>
          <h2 className="text-slate-800 font-semibold text-lg mb-4">Lanes</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {LANES.map((lane) => (
              <div
                key={lane.number}
                className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm"
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Lane {lane.number}
                  </span>
                  <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                    4 offers
                  </span>
                </div>
                <h3 className="font-semibold text-slate-800 mb-2">{lane.name}</h3>
                <p className="text-xs text-slate-500 font-mono leading-relaxed mb-3">
                  {lane.routing}
                </p>
                <p className="text-xs text-slate-500">Typical transit: {lane.transit}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
