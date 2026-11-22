"use client";

const KPI_CARDS = [
  {
    icon: "⚡",
    headline: "Cut your workflow by 5×",
    body: "Upload all forwarder quotes at once and get a ranked recommendation in minutes — no spreadsheets, no manual comparison.",
  },
  {
    icon: "📄",
    headline: "Supports all quote formats",
    body: "PDF, Word, Excel, or CSV — TenderAI reads every format and extracts the numbers automatically.",
  },
  {
    icon: "🎯",
    headline: "Easy to use",
    body: "No training needed. Upload, review, adjust your scoring weights, and get a clear award recommendation in four steps.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Nav */}
      <nav className="px-8 py-5 flex items-center">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-500 rounded-md flex items-center justify-center text-white font-bold text-sm">
            T
          </div>
          <span className="font-bold text-lg tracking-tight text-white">TenderAI</span>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center pb-10">
        <p className="text-blue-400 text-sm font-semibold uppercase tracking-widest mb-4">
          Freight Tender Analyser
        </p>
        <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight max-w-3xl mb-6">
          Find the best forwarder.<br />
          <span className="text-blue-400">In minutes.</span>
        </h1>
        <p className="text-slate-400 text-lg max-w-xl mb-10 leading-relaxed">
          Upload your tender quotes, review the extracted data, and get a clear
          award recommendation — powered by AI.
        </p>
        <a
          href="/upload"
          className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-10 py-4 rounded-xl text-lg transition-colors shadow-lg shadow-blue-900/40"
        >
          Get Started →
        </a>
      </main>

      {/* KPI Cards */}
      <section className="px-6 pb-16 max-w-5xl mx-auto w-full">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {KPI_CARDS.map((card) => (
            <div
              key={card.headline}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-6"
            >
              <div className="text-3xl mb-3">{card.icon}</div>
              <h3 className="text-white font-semibold text-base mb-2">{card.headline}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{card.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
