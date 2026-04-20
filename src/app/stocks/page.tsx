'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { StockAnalysis, scoreColor, scoreBg } from '@/lib/types'

interface StockRow {
  id: string
  name: string
  ticker: string
  sector: string
  analysis: StockAnalysis
}

export default function StocksPage() {
  const [stocks, setStocks] = useState<StockRow[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<StockRow | null>(null)

  useEffect(() => {
    fetch('/api/stocks')
      .then(r => r.json())
      .then(d => { setStocks(d || []); setLoading(false) })
  }, [])

  const filtered = stocks.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.ticker.toLowerCase().includes(search.toLowerCase()) ||
    s.sector?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={null} />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-gray-900">Stock Database</h1>
          <Link href="/analyze" className="text-sm bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
            + Analyze New
          </Link>
        </div>
        <p className="text-sm text-gray-500 mb-6">{stocks.length} stocks analyzed — click any to view full 12-step report</p>

        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, ticker, sector..."
          className="w-full border rounded-xl px-4 py-3 text-sm mb-4 bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
        />

        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">Loading stocks...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            No stocks found.{' '}
            <Link href="/analyze" className="text-green-600">Analyze one now →</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.map(s => {
              const score = s.analysis?.overallScore ?? 0
              return (
                <button
                  key={s.id}
                  onClick={() => setSelected(s)}
                  className="bg-white border rounded-xl p-4 text-left hover:border-green-400 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${scoreBg(score)} ${scoreColor(score)}`}>
                      {score}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{s.name}</p>
                      <p className="text-xs text-gray-400">{s.ticker} · {s.sector}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${scoreColor(score)} ${scoreBg(score)}`}>
                      {s.analysis?.verdict ?? '—'}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selected && (
        <div
          className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-end md:items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-5"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-bold text-lg">{selected.name}</h2>
                <p className="text-xs text-gray-400">{selected.ticker} · {selected.sector}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            {selected.analysis && (
              <>
                <div className={`text-center py-3 rounded-xl mb-4 ${scoreBg(selected.analysis.overallScore)}`}>
                  <span className={`text-3xl font-bold ${scoreColor(selected.analysis.overallScore)}`}>
                    {selected.analysis.overallScore}
                  </span>
                  <p className="text-sm font-medium text-gray-700 mt-1">{selected.analysis.verdict}</p>
                  <p className="text-xs text-gray-500 mt-1 px-4">{selected.analysis.summary}</p>
                </div>
                <div className="flex flex-col gap-2">
                  {selected.analysis.steps?.map(step => (
                    <div key={step.num} className="border rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-gray-400">Step {step.num}</span>
                        <span className="flex-1 text-sm font-medium">{step.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                          step.status === 'PASS' ? 'bg-green-100 text-green-700' :
                          step.status === 'FAIL' ? 'bg-red-100 text-red-700' :
                          step.status === 'CAUTION' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>{step.status}</span>
                      </div>
                      <p className="text-xs text-gray-500">{step.detail}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
