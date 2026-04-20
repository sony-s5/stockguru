'use client'
import { useEffect, useState } from 'react'

interface Quote {
  price: number
  change: number
  changePct: number
  high52: number
  low52: number
  volume: number
  marketState: string
}

export default function LiveQuoteCard({ ticker }: { ticker: string }) {
  const [quote, setQuote] = useState<Quote | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/quote?ticker=${ticker}`)
      .then(r => r.json())
      .then(d => { setQuote(d); setLoading(false) })
  }, [ticker])

  if (loading) return (
    <div className="bg-white border rounded-xl p-4 animate-pulse">
      <div className="h-8 bg-gray-100 rounded w-32 mb-2" />
      <div className="h-4 bg-gray-100 rounded w-24" />
    </div>
  )

  if (!quote || (quote as any).error) return null

  const isUp = quote.change >= 0
  const changeColor = isUp ? 'text-green-600' : 'text-red-500'
  const changeBg    = isUp ? 'bg-green-50'   : 'bg-red-50'

  return (
    <div className="bg-white border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-xs text-gray-400 uppercase tracking-wide">{ticker} · NSE</span>
          {quote.marketState === 'REGULAR' && (
            <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Live</span>
          )}
          {quote.marketState === 'CLOSED' && (
            <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Closed</span>
          )}
        </div>
      </div>

      <div className="flex items-end gap-3 mb-3">
        <span className="text-3xl font-bold text-gray-900">
          ₹{quote.price?.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
        </span>
        <span className={`text-sm font-semibold px-2 py-1 rounded-lg ${changeBg} ${changeColor}`}>
          {isUp ? '▲' : '▼'} {Math.abs(quote.change).toFixed(2)} ({Math.abs(quote.changePct).toFixed(2)}%)
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: '52W High', value: `₹${quote.high52?.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` },
          { label: '52W Low',  value: `₹${quote.low52?.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` },
          { label: 'Volume',   value: quote.volume > 1e7 ? `${(quote.volume/1e7).toFixed(1)}Cr` : quote.volume > 1e5 ? `${(quote.volume/1e5).toFixed(1)}L` : quote.volume?.toLocaleString() },
        ].map(item => (
          <div key={item.label} className="bg-gray-50 rounded-lg p-2">
            <p className="text-xs text-gray-400">{item.label}</p>
            <p className="text-sm font-semibold text-gray-800">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
