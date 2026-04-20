'use client'
import { useEffect, useState } from 'react'

interface Fundamentals {
  pe: number | null
  forwardPE: number | null
  pb: number | null
  marketCapFmt: string | null
  dividendYield: number | null
  roe: number | null
  debtToEquity: number | null
  revenueGrowth: number | null
  earningsGrowth: number | null
  grossMargin: number | null
  operatingMargin: number | null
  profitMargin: number | null
  freeCashflowFmt: string | null
}

function Metric({ label, value, good, bad }: { label: string; value: string | null; good?: boolean; bad?: boolean }) {
  const color = good ? 'text-green-600' : bad ? 'text-red-500' : 'text-gray-800'
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm font-semibold ${color}`}>{value ?? '—'}</span>
    </div>
  )
}

export default function FundamentalsCard({ ticker }: { ticker: string }) {
  const [data, setData] = useState<Fundamentals | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/quote/fundamentals?ticker=${ticker}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
  }, [ticker])

  if (loading) return (
    <div className="bg-white border rounded-xl p-4 animate-pulse space-y-2">
      {[...Array(6)].map((_, i) => <div key={i} className="h-4 bg-gray-100 rounded" />)}
    </div>
  )
  if (!data || (data as any).error) return null

  return (
    <div className="bg-white border rounded-xl p-4">
      <h3 className="font-semibold text-gray-900 mb-3 text-sm">Fundamentals</h3>
      <Metric label="PE Ratio (TTM)"       value={data.pe ? data.pe.toFixed(1) : null}               good={data.pe !== null && data.pe < 25} bad={data.pe !== null && data.pe > 40} />
      <Metric label="Forward PE"           value={data.forwardPE ? data.forwardPE.toFixed(1) : null} />
      <Metric label="Price / Book"         value={data.pb ? data.pb.toFixed(2) : null} />
      <Metric label="Market Cap"           value={data.marketCapFmt} />
      <Metric label="Dividend Yield"       value={data.dividendYield ? `${data.dividendYield}%` : null} good={(data.dividendYield ?? 0) > 2} />
      <Metric label="ROE"                  value={data.roe ? `${data.roe}%` : null}                  good={(data.roe ?? 0) > 15} bad={(data.roe ?? 0) < 8} />
      <Metric label="Debt / Equity"        value={data.debtToEquity ? data.debtToEquity.toFixed(2) : null} good={(data.debtToEquity ?? 99) < 0.5} bad={(data.debtToEquity ?? 0) > 2} />
      <Metric label="Revenue Growth (YoY)" value={data.revenueGrowth ? `${data.revenueGrowth}%` : null} good={(data.revenueGrowth ?? 0) > 10} bad={(data.revenueGrowth ?? 0) < 0} />
      <Metric label="Profit Margin"        value={data.profitMargin ? `${data.profitMargin}%` : null} good={(data.profitMargin ?? 0) > 15} bad={(data.profitMargin ?? 0) < 5} />
      <Metric label="Operating Margin"     value={data.operatingMargin ? `${data.operatingMargin}%` : null} />
      <Metric label="Free Cash Flow"       value={data.freeCashflowFmt} />
    </div>
  )
}
