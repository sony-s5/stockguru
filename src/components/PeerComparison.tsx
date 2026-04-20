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
  const [peers, setPeers] = useState<Peer[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/peers?ticker=${ticker}`)
      .then(r => r.json())
      .then(d => { setPeers(Array.isArray(d) ? d : []); setLoading(false) })
  }, [ticker])

  if (loading) return <div className="bg-white border rounded-xl p-4 text-sm text-gray-400 animate-pulse">Loading peers...</div>
  if (!peers.length) return null

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
              const allROE = peers.map(x => x.roe).filter(Boolean) as number[]
              const allPE  = peers.map(x => x.pe).filter(Boolean) as number[]
              const bestROE = Math.max(...allROE)
              const bestPE  = Math.min(...allPE)
              return (
                <tr key={p.ticker} className={isMain ? 'bg-green-50' : 'hover:bg-gray-50'}>
                  <td className={`px-3 py-2.5 text-sm font-semibold ${isMain ? 'text-green-700' : 'text-gray-800'}`}>
                    {p.ticker} {isMain && '★'}
                  </td>
                  <Cell value={p.pe?.toFixed(1) ?? null}          isMain={isMain} good={p.pe === bestPE} bad={p.pe !== null && p.pe > 40} />
                  <Cell value={p.roe ? `${p.roe}%` : null}        isMain={isMain} good={p.roe === bestROE} bad={(p.roe ?? 0) < 10} />
                  <Cell value={p.revenueGrowth ? `${p.revenueGrowth}%` : null} isMain={isMain} good={(p.revenueGrowth ?? 0) > 15} bad={(p.revenueGrowth ?? 0) < 0} />
                  <Cell value={p.profitMargin ? `${p.profitMargin}%` : null}   isMain={isMain} good={(p.profitMargin ?? 0) > 15} />
                  <Cell value={p.debtToEquity?.toFixed(2) ?? null} isMain={isMain} good={(p.debtToEquity ?? 99) < 0.3} bad={(p.debtToEquity ?? 0) > 2} />
                  <Cell value={p.marketCapFmt}                     isMain={isMain} />
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
