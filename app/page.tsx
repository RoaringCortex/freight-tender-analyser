"use client";

function BoltIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="#1D4ED8" aria-hidden="true">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17.3l-6.2 4 2.4-7.4L2 9.4h7.6z" />
    </svg>
  );
}

const KPI_CARDS = [
  {
    icon: <BoltIcon />,
    headline: "Cut your workflow by 5×",
    body: "Upload all forwarder quotes at once and get a ranked recommendation in minutes — no spreadsheets, no manual comparison.",
  },
  {
    icon: <DocumentIcon />,
    headline: "Supports all quote formats",
    body: "PDF, Word, Excel, or CSV — TenderAI reads every format and extracts the numbers automatically.",
  },
  {
    icon: <CheckIcon />,
    headline: "Easy to use",
    body: "No training needed. Upload, review, adjust your scoring weights, and get a clear award recommendation in four steps.",
  },
];

const MOCK_SCORES = [
  { name: "K-Logistics Spirit",    score: 87.4, cost: "3,240", winner: true },
  { name: "Pacific Alliance",      score: 72.1, cost: "3,520", winner: false },
  { name: "Nippon Pacific Cargo",  score: 68.9, cost: "3,890", winner: false },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#F7F5F0] text-gray-900 flex flex-col">

      {/* Nav */}
      <nav className="px-8 py-5 flex items-center border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-700 rounded-md flex items-center justify-center text-white font-bold text-sm">T</div>
          <span className="font-bold text-lg tracking-tight text-gray-900">TenderAI</span>
        </div>
      </nav>

      {/* Hero — split layout */}
      <main className="flex-1 flex flex-col lg:flex-row">

        {/* Left — text */}
        <div className="flex flex-col justify-center px-10 lg:px-16 xl:px-24 py-16 lg:py-0 lg:w-[52%]">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-6">
            Synthetic data · Fictional scenario
          </p>
          <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight text-gray-900 leading-[1.1] mb-6">
            Find the best<br />forwarder.<br />
            <span className="text-blue-700">In minutes.</span>
          </h1>
          <p className="text-gray-500 text-lg max-w-md mb-10 leading-relaxed">
            Upload your tender quotes, review the extracted data, and get a clear
            award recommendation — powered by AI.
          </p>
          <a
            href="/upload"
            className="inline-block bg-blue-700 hover:bg-blue-800 text-white font-bold px-10 py-4 rounded-xl text-lg transition-colors w-fit"
          >
            Get Started →
          </a>
        </div>

        {/* Right — product mockup */}
        <div className="hidden lg:flex flex-1 relative overflow-hidden items-center justify-center min-h-[600px]">

          {/* Dot grid background */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: "radial-gradient(circle, #c7cdd6 1.5px, transparent 1.5px)",
              backgroundSize: "28px 28px",
              opacity: 0.5,
            }}
          />

          {/* Ambient glows */}
          <div className="absolute top-12 right-12 w-96 h-96 bg-blue-100 rounded-full blur-3xl opacity-80" />
          <div className="absolute bottom-20 left-8 w-56 h-56 bg-indigo-50 rounded-full blur-2xl opacity-70" />

          {/* Main product card */}
          <div
            className="relative z-10 bg-white rounded-2xl border border-gray-100 p-6 w-80"
            style={{ boxShadow: "0 24px 64px rgba(0,0,0,0.12)", transform: "rotate(2deg) translateY(-20px)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Recommendation</span>
              <span className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full font-medium">Suez Canal</span>
            </div>

            {/* Winner */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-1.5 mb-2">
                <StarIcon />
                <span className="text-xs font-semibold text-blue-700">Top recommendation</span>
              </div>
              <p className="font-bold text-gray-900 text-sm mb-0.5">K-Logistics Spirit</p>
              <p className="font-mono font-bold text-gray-900 text-xl leading-none">
                $3,240 <span className="text-sm text-gray-400 font-sans font-normal">/ container</span>
              </p>
            </div>

            {/* Score bars */}
            <div className="space-y-3">
              {MOCK_SCORES.map((f) => (
                <div key={f.name}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className={f.winner ? "font-semibold text-gray-900" : "text-gray-500"}>{f.name}</span>
                    <span className={`font-mono ${f.winner ? "text-blue-700 font-semibold" : "text-gray-400"}`}>{f.score}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${f.winner ? "bg-blue-700" : "bg-gray-200"}`}
                      style={{ width: `${f.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-400">3 offers · 3 lanes</span>
              <span className="text-xs text-emerald-600 font-semibold">✓ Analysed</span>
            </div>
          </div>

          {/* Floating stat card */}
          <div
            className="absolute z-20 bg-white border border-gray-100 rounded-xl p-3.5 w-44"
            style={{ bottom: "22%", right: "10%", boxShadow: "0 8px 32px rgba(0,0,0,0.10)", transform: "rotate(-2.5deg)" }}
          >
            <p className="text-xs text-gray-400 mb-1">Score vs. runner-up</p>
            <p className="font-mono font-bold text-gray-900 text-xl leading-none">+15.3 pts</p>
            <div className="mt-2.5 flex gap-1 items-center">
              <div className="h-1 rounded-full bg-blue-700" style={{ flex: "87.4" }} />
              <div className="h-1 rounded-full bg-gray-200" style={{ flex: "12.6" }} />
            </div>
          </div>

        </div>
      </main>

      {/* KPI Cards */}
      <section className="px-6 py-14 max-w-5xl mx-auto w-full">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {KPI_CARDS.map((card) => (
            <div key={card.headline} className="bg-white border border-gray-200 rounded-2xl p-6">
              <div className="text-blue-700 mb-3">{card.icon}</div>
              <h3 className="text-gray-900 font-semibold text-base mb-2">{card.headline}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{card.body}</p>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
