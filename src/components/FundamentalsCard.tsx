'use client'
import { useEffect, useState } from 'react'

interface Fundamentals {
  pe: number | null
  pb: number | null
  roe: number | null
  roa: number | null
  grossMargin: number | null
  operatingMargin: number | null
  netMargin: number | null
  debtToEquity: number | null
  currentRatio: number | null
  dividendYield: number | null
  revenueGrowth: number | null
  epsGrowth: number | null
  marketCapFmt: string | null
  sector: string | null
  description: string | null
}

function Metric({ label, value, good, bad, neutral }: {
  label: string
  value: string | null
  good?: boolean
  bad?: boolean
  neutral?: boolean
}) {
  const color = good ? 'text-green-600' : bad ? 'text-red-500' : 'text-gray-800'
  const bg    = good ? 'bg-green-50' : bad ? 'bg-red-50' : ''
  return (
    <div className={`flex items-center justify-between py-2 border-b last:border-0 px-1 rounded ${bg}`}>
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm font-semibold ${color}`}>{value ?? '—'}</span>
    </div>
  )
}

export default function FundamentalsCard({ ticker }: { ticker: string }) {
  const [data, setData]       = useState<Fundamentals | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/quote/fundamentals?ticker=${ticker}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(true); setLoading(false); return }
        setData(d)
        setLoading(false)
      })
      .catch(() => { setError(true); setLoading(false) })
  }, [ticker])

  if (loading) return (
    <div className="bg-white border rounded-xl p-4 animate-pulse space-y-3">
      <div className="h-4 bg-gray-100 rounded w-32" />
      {[...Array(6)].map((_, i) => <div key={i} className="h-4 bg-gray-100 rounded" />)}
    </div>
  )

  if (error || !data) return (
    <div className="bg-white border rounded-xl p-4 text-center">
      <p className="text-sm text-gray-400">Fundamentals data unavailable.</p>
    </div>
  )

  return (
    <div className="bg-white border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900 text-sm">Fundamentals</h3>
        {data.sector && <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-full">{data.sector}</span>}
      </div>

      {/* Valuation */}
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Valuation</p>
      <Metric label="PE Ratio (TTM)"   value={data.pe ? `${data.pe}x` : null}  good={data.pe !== null && data.pe < 20} bad={data.pe !== null && data.pe > 40} />
      <Metric label="Price / Book"     value={data.pb ? `${data.pb}x` : null}  good={data.pb !== null && data.pb < 3} />
      <Metric label="Market Cap"       value={data.marketCapFmt} />
      <Metric label="Dividend Yield"   value={data.dividendYield ? `${data.dividendYield}%` : null} good={(data.dividendYield ?? 0) > 2} />

      {/* Profitability */}
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mt-3 mb-1">Profitability</p>
      <Metric label="ROE"              value={data.roe ? `${data.roe}%` : null}           good={(data.roe ?? 0) > 15} bad={(data.roe ?? 0) < 8} />
      <Metric label="ROA"              value={data.roa ? `${data.roa}%` : null}           good={(data.roa ?? 0) > 10} />
      <Metric label="Gross Margin"     value={data.grossMargin ? `${data.grossMargin}%` : null} good={(data.grossMargin ?? 0) > 40} />
      <Metric label="Operating Margin" value={data.operatingMargin ? `${data.operatingMargin}%` : null} good={(data.operatingMargin ?? 0) > 20} />
      <Metric label="Net Margin"       value={data.netMargin ? `${data.netMargin}%` : null} good={(data.netMargin ?? 0) > 15} bad={(data.netMargin ?? 0) < 5} />

      {/* Growth */}
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mt-3 mb-1">Growth (YoY)</p>
      <Metric label="Revenue Growth"   value={data.revenueGrowth ? `${data.revenueGrowth}%` : null} good={(data.revenueGrowth ?? 0) > 10} bad={(data.revenueGrowth ?? 0) < 0} />
      <Metric label="EPS Growth"       value={data.epsGrowth ? `${data.epsGrowth}%` : null}         good={(data.epsGrowth ?? 0) > 10} bad={(data.epsGrowth ?? 0) < 0} />

      {/* Financial Health */}
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mt-3 mb-1">Financial Health</p>
      <Metric label="Debt / Equity"    value={data.debtToEquity ? `${data.debtToEquity}x` : null} good={(data.debtToEquity ?? 99) < 0.5} bad={(data.debtToEquity ?? 0) > 2} />
      <Metric label="Current Ratio"    value={data.currentRatio ? `${data.currentRatio}x` : null}  good={(data.currentRatio ?? 0) > 1.5} bad={(data.currentRatio ?? 0) < 1} />

      <p className="text-xs text-gray-300 mt-3">Source: Financial Modeling Prep • Updated daily</p>
    </div>
  )
}
