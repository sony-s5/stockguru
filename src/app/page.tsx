'use client'
import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="border-b px-6 py-4 flex items-center justify-between">
        <span className="text-xl font-bold text-green-700">📈 StockGuru</span>
        <div className="flex gap-3">
          <Link href="/auth" className="text-sm text-gray-600 hover:text-gray-900 px-3 py-2">Login</Link>
          <Link href="/auth?signup=true" className="text-sm bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">Get Started</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-3xl mx-auto text-center py-20 px-6">
        <span className="text-sm bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">
          Indian Stock Market • Fundamental Analysis
        </span>
        <h1 className="mt-6 text-4xl font-bold text-gray-900 leading-tight">
          12-Step Investment<br />Framework Analyzer
        </h1>
        <p className="mt-4 text-lg text-gray-500">
          Any Indian stock ni 12 proven steps lo analyze cheyyi. <br />
          Industry, Moat, Promoter, Financials, Valuation — anni oka click lo.
        </p>
        <div className="mt-8 flex gap-3 justify-center">
          <Link href="/analyze" className="bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700">
            Analyze a Stock →
          </Link>
          <Link href="/stocks" className="border px-6 py-3 rounded-lg font-medium text-gray-700 hover:bg-gray-50">
            Browse Database
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 px-6 pb-20">
        {[
          { icon: '🔍', title: '12-Step Analysis', desc: 'Industry, Moat, Promoter, Risk, Management, Financials + more' },
          { icon: '🤖', title: 'AI Powered', desc: 'AI-powered instant deep analysis for any stock' },
          { icon: '📄', title: 'PDF Download', desc: 'Download analysis report as PDF — share anywhere' },
          { icon: '💼', title: 'Portfolio Tracker', desc: 'Track your stocks — view live P&L' },
          { icon: '🗄️', title: 'Stock Database', desc: 'TCS, Infosys, Reliance + 50+ stocks pre-analyzed' },
          { icon: '🔒', title: 'Secure Login', desc: 'Your data is safe — protected with Supabase auth' },
        ].map(f => (
          <div key={f.title} className="border rounded-xl p-5 bg-white">
            <div className="text-2xl mb-2">{f.icon}</div>
            <h3 className="font-semibold text-gray-900">{f.title}</h3>
            <p className="text-sm text-gray-500 mt-1">{f.desc}</p>
          </div>
        ))}
      </section>

      <footer className="border-t text-center py-6 text-sm text-gray-400">
        ⚠️ Educational purpose only — not investment advice
      </footer>
    </main>
  )
}
