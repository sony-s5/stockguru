'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import ScoreBanner from '@/components/ScoreBanner'
import StepCard from '@/components/StepCard'
import LiveQuoteCard from '@/components/LiveQuoteCard'
import FundamentalsCard from '@/components/FundamentalsCard'
import PeerComparison from '@/components/PeerComparison'
import NewsCard from '@/components/NewsCard'
import { StockAnalysis } from '@/lib/types'
import { useLanguage } from '@/lib/language'
import { supabase } from '@/lib/supabase'

export default function AnalyzePage() {
  const [query, setQuery]     = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<StockAnalysis | null>(null)
  const [error, setError]     = useState('')
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [tab, setTab]         = useState<'steps' | 'data' | 'peers' | 'news'>('steps')
  const [user, setUser]       = useState<any>(null)
  const [showLoginPrompt, setShowLoginPrompt] = useState(false)
  const { language }          = useLanguage()
  const router                = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  async function analyze() {
    if (!query.trim()) return
    if (!user) { setShowLoginPrompt(true); return }

    setLoading(true)
    setError('')
    setResult(null)
    setSaved(false)
    setTab('steps')

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stockName: query, language }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResult(data)
    } catch (err: any) {
  if (err?.message?.includes('429') || err?.message?.includes('Rate limit')) {
    setError('Too many requests! Please wait 1 minute and try again. ⏱️')
  } else {
    setError('Stock not found! Please enter correct stock name — e.g. TCS, Infosys, Reliance')
  }
}
    setLoading(false)
  }

  async function saveToDatabase() {
    if (!result) return
    setSaving(true)
    await fetch('/api/stocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: result.company, ticker: result.ticker, sector: result.sector, analysis: result }),
    })
    setSaving(false)
    setSaved(true)
  }

  async function downloadPDF() {
    if (!result) return
    const { default: jsPDF } = await import('jspdf')
    const doc = new jsPDF()
    const green: [number, number, number] = [22, 163, 74]
    const gray:  [number, number, number] = [107, 114, 128]

    doc.setFillColor(...green)
    doc.rect(0, 0, 210, 22, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('StockGuru — 12-Step Investment Analysis', 14, 14)

    doc.setTextColor(0, 0, 0)
    doc.setFontSize(18)
    doc.text(`${result.company} (${result.ticker})`, 14, 34)
    doc.setFontSize(10)
    doc.setTextColor(...gray)
    doc.text(`Sector: ${result.sector}   Score: ${result.overallScore}/100   Verdict: ${result.verdict}`, 14, 42)
    const summaryLines = doc.splitTextToSize(result.summary, 182)
    doc.setTextColor(60, 60, 60)
    doc.text(summaryLines, 14, 50)

    let y = 65
    result.steps.forEach(step => {
      if (y > 265) { doc.addPage(); y = 20 }
      const c: [number, number, number] =
        step.status === 'PASS'    ? [22, 163, 74] :
        step.status === 'FAIL'    ? [220, 38, 38] :
        step.status === 'CAUTION' ? [202, 138, 4] : [37, 99, 235]
      doc.setFillColor(...c)
      doc.roundedRect(14, y - 4, 32, 7, 1, 1, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'bold')
      doc.text(`Step ${step.num}: ${step.status}`, 15.5, y + 1)
      doc.setTextColor(0, 0, 0)
      doc.setFontSize(10)
      doc.text(step.name, 52, y + 1)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(...gray)
      const lines = doc.splitTextToSize(step.detail, 148)
      doc.text(lines, 52, y + 6)
      y += 12 + lines.length * 4.2
    })

    doc.setFontSize(8)
    doc.setTextColor(180, 180, 180)
    doc.text('Educational purpose only — not investment advice | StockGuru', 14, 290)
    doc.save(`${result.ticker}_StockGuru.pdf`)
  }

  const tabs = [
    { id: 'steps', label: '12 Steps' },
    { id: 'data',  label: 'Live Data' },
    { id: 'peers', label: 'Peers' },
    { id: 'news',  label: 'News' },
  ] as const

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} />

      {/* Login Prompt Modal */}
      {showLoginPrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="text-center mb-4">
              <div className="text-4xl mb-2">🔒</div>
              <h2 className="text-lg font-bold text-gray-900">Login Required</h2>
              <p className="text-sm text-gray-500 mt-1">
                Login to analyze stocks — sign up for free!
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={() => router.push('/auth')} className="w-full bg-green-600 text-white py-2.5 rounded-xl font-medium hover:bg-green-700">
                Login / Sign Up
              </button>
              <button onClick={() => setShowLoginPrompt(false)} className="w-full border py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">12-Step Analyzer</h1>
        <p className="text-sm text-gray-400 mb-5">AI analysis + live data + news + peer comparison</p>

        <div className="flex gap-2 mb-6">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && analyze()}
            placeholder="TCS, Infosys, Reliance, Ola Electric..."
            className="flex-1 border rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button onClick={analyze} disabled={loading} className="bg-green-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-green-700 disabled:opacity-60 text-sm">
            {loading ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>

        {loading && (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3 animate-pulse">🔍</div>
            <p className="text-sm">AI analyzing {query}...</p>
          </div>
        )}
        {error && <p className="text-red-500 text-sm text-center py-4">{error}</p>}

        {result && !loading && (
          <>
            <ScoreBanner data={result} />

            {/* Action buttons */}
            <div className="flex gap-2 mb-4">
              <button onClick={downloadPDF} className="flex-1 border rounded-xl py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                📄 PDF Download
              </button>
              <button onClick={saveToDatabase} disabled={saving || saved} className="flex-1 border rounded-xl py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60">
                {saved ? '✅ Saved!' : saving ? 'Saving...' : '💾 Save to DB'}
              </button>
            </div>

            {/* ── Verify Banner ── */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4">
              <p className="text-xs font-medium text-blue-700 mb-2">
                📊 Steps 3, 6, 8 కి latest data verify చేయి:
              </p>
              <div className="flex gap-2">
                <a
                  href={`https://www.screener.in/company/${result.ticker}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-center text-xs bg-white border border-blue-200 text-blue-700 py-2 rounded-lg hover:bg-blue-50 font-medium"
                >
                  Screener.in →
                </a>
                <a
                  href={`https://www.moneycontrol.com/india/stockpricequote/${result.ticker}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-center text-xs bg-white border border-blue-200 text-blue-700 py-2 rounded-lg hover:bg-blue-50 font-medium"
                >
                  Moneycontrol →
                </a>
                <a
                  href={`https://finance.yahoo.com/quote/${result.ticker}.NS`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-center text-xs bg-white border border-blue-200 text-blue-700 py-2 rounded-lg hover:bg-blue-50 font-medium"
                >
                  Yahoo Finance →
                </a>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-4">
              {tabs.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                    tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === 'steps' && (
              <div className="flex flex-col gap-3">
                {result.steps.map(step => <StepCard key={step.num} step={step} ticker={result.ticker} />)}
              </div>
            )}
            {tab === 'data'  && <div className="flex flex-col gap-3"><LiveQuoteCard ticker={result.ticker} /><FundamentalsCard ticker={result.ticker} /></div>}
            {tab === 'peers' && <PeerComparison ticker={result.ticker} />}
            {tab === 'news'  && <NewsCard stockName={result.company} />}

            <p className="text-xs text-gray-300 text-center mt-6">⚠️ Educational only — not investment advice</p>
          </>
        )}
      </div>
    </div>
  )
}
