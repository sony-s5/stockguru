'use client'
import { useEffect, useState } from 'react'

interface Peer {
  ticker: string
  pe: number | null
  pb: number | null
  roe: number | null
  revenueGrowth: number | null
  profitMargin: number | null
  debtToEquity: number | null
  marketCapFmt: string | null
}

function Cell({ value, isMain, good, bad }: { value: string | null; isMain?: boolean; good?: boolean; bad?: boolean }) {
  const color = good ? 'text-green-600' : bad ? 'text-red-500' : 'text-gray-700'
  return (
    <td className={`px-3 py-2.5 text-sm text-right ${color} ${isMain ? 'font-bold bg-green-50' : ''}`}>
      {value ?? '—'}
    </td>
  )
}

export default function PeerComparison({ ticker }: { ticker: string }) {
  const [peers, setPeers]   = useState<Peer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(false)
    fetch(`/api/peers?ticker=${ticker}`)
      .then(r => r.json())
      .then(d => {
        setPeers(Array.isArray(d) ? d : [])
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }, [ticker])

  if (loading) return (
    <div className="bg-white border rounded-xl p-6 text-center">
      <div className="text-2xl mb-2 animate-pulse">📊</div>
      <p className="text-sm text-gray-400">Peer data loading...</p>
    </div>
  )

  if (error) return (
    <div className="bg-white border rounded-xl p-6 text-center">
      <p className="text-sm text-gray-400">Peer data unavailable. Try again later.</p>
    </div>
  )

  // Check if we have any actual data
  const hasData = peers.some(p => p.pe !== null || p.roe !== null || p.profitMargin !== null)

  if (!hasData) return (
    <div className="bg-white border rounded-xl p-6">
      <h3 className="font-semibold text-gray-900 text-sm mb-3">Peer Comparison</h3>
      <div className="text-center py-4">
        <p className="text-sm text-gray-500 mb-2">Live peer data temporarily unavailable.</p>
        <p className="text-xs text-gray-400">Sector peers:</p>
        <div className="flex flex-wrap gap-2 justify-center mt-2">
          {peers.map(p => (
            <span key={p.ticker} className={`text-xs px-3 py-1 rounded-full ${p.ticker === ticker ? 'bg-green-100 text-green-700 font-semibold' : 'bg-gray-100 text-gray-600'}`}>
              {p.ticker}
            </span>
          ))}
        </div>
      </div>
    </div>
  )

  const allROE = peers.map(x => x.roe).filter(Boolean) as number[]
  const allPE  = peers.map(x => x.pe).filter(Boolean) as number[]
  const bestROE = allROE.length ? Math.max(...allROE) : null
  const bestPE  = allPE.length  ? Math.min(...allPE)  : null

  return (
    <div className="bg-white border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b">
        <h3 className="font-semibold text-gray-900 text-sm">Peer Comparison</h3>
        <p className="text-xs text-gray-400 mt-0.5">Green = best in peer group</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Ticker</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">PE</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">ROE%</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Rev Growth%</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Net Margin%</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">D/E</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Mkt Cap</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {peers.map(p => {
              const isMain = p.ticker.toUpperCase() === ticker.toUpperCase()
              return (
                <tr key={p.ticker} className={isMain ? 'bg-green-50' : 'hover:bg-gray-50'}>
                  <td className={`px-3 py-2.5 text-sm font-semibold ${isMain ? 'text-green-700' : 'text-gray-800'}`}>
                    {p.ticker} {isMain && '★'}
                  </td>
                  <Cell value={p.pe ? p.pe.toFixed(1) : null}                  isMain={isMain} good={bestPE !== null && p.pe === bestPE} bad={p.pe !== null && p.pe > 40} />
                  <Cell value={p.roe ? `${p.roe}%` : null}                     isMain={isMain} good={bestROE !== null && p.roe === bestROE} bad={(p.roe ?? 0) < 10} />
                  <Cell value={p.revenueGrowth ? `${p.revenueGrowth}%` : null} isMain={isMain} good={(p.revenueGrowth ?? 0) > 15} bad={(p.revenueGrowth ?? 0) < 0} />
                  <Cell value={p.profitMargin ? `${p.profitMargin}%` : null}   isMain={isMain} good={(p.profitMargin ?? 0) > 15} />
                  <Cell value={p.debtToEquity ? p.debtToEquity.toFixed(2) : null} isMain={isMain} good={(p.debtToEquity ?? 99) < 0.3} bad={(p.debtToEquity ?? 0) > 2} />
                  <Cell value={p.marketCapFmt}                                 isMain={isMain} />
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
