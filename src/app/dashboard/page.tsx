'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface PortfolioItem {
  id: string
  ticker: string
  stock_name: string
  buy_price: number
  quantity: number
  notes: string
}

interface LivePrices { [ticker: string]: number }

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([])
  const [livePrices, setLivePrices] = useState<LivePrices>({})
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ ticker: '', stock_name: '', buy_price: '', quantity: '', notes: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/auth'); return }
      setUser(data.user)
      fetchPortfolio(data.user.id)
    })
  }, [])

  async function fetchPortfolio(userId: string) {
    const res = await fetch('/api/portfolio', { headers: { 'x-user-id': userId } })
    const data = await res.json()
    const items = data || []
    setPortfolio(items)
    setLoading(false)
    // fetch live prices for all tickers
    if (items.length) fetchLivePrices(items.map((x: PortfolioItem) => x.ticker))
  }

  async function fetchLivePrices(tickers: string[]) {
    const unique = [...new Set(tickers)]
    const prices: LivePrices = {}
    await Promise.all(unique.map(async ticker => {
      try {
        const res = await fetch(`/api/quote?ticker=${ticker}`)
        const d = await res.json()
        if (d.price) prices[ticker.toUpperCase()] = d.price
      } catch {}
    }))
    setLivePrices(prices)
  }

  async function addStock() {
    if (!form.ticker || !form.buy_price || !form.quantity) return
    setSaving(true)
    await fetch('/api/portfolio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, user_id: user.id, buy_price: parseFloat(form.buy_price), quantity: parseFloat(form.quantity) }),
    })
    setForm({ ticker: '', stock_name: '', buy_price: '', quantity: '', notes: '' })
    setShowAdd(false)
    setSaving(false)
    fetchPortfolio(user.id)
  }

  async function removeStock(id: string) {
    await fetch('/api/portfolio', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setPortfolio(p => p.filter(x => x.id !== id))
  }

  const totalInvested   = portfolio.reduce((s, p) => s + p.buy_price * p.quantity, 0)
  const totalCurrentVal = portfolio.reduce((s, p) => {
    const live = livePrices[p.ticker.toUpperCase()]
    return s + (live ?? p.buy_price) * p.quantity
  }, 0)
  const totalPnL    = totalCurrentVal - totalInvested
  const totalPnLPct = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0
  const isProfit    = totalPnL >= 0

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} />
      <div className="max-w-3xl mx-auto px-4 py-8">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Portfolio</h1>
            <p className="text-xs text-gray-400">{user?.email}</p>
          </div>
          <button onClick={() => setShowAdd(!showAdd)} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700">
            + Add Stock
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Stocks', value: `${portfolio.length}` },
            { label: 'Invested', value: `₹${totalInvested.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` },
            { label: 'Current Value', value: `₹${totalCurrentVal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` },
            {
              label: 'Total P&L',
              value: `${isProfit ? '+' : ''}₹${Math.abs(totalPnL).toLocaleString('en-IN', { maximumFractionDigits: 0 })} (${isProfit ? '+' : ''}${totalPnLPct.toFixed(1)}%)`,
              color: isProfit ? 'text-green-600' : 'text-red-500'
            },
          ].map(c => (
            <div key={c.label} className="bg-white border rounded-xl p-3 text-center">
              <p className="text-xs text-gray-400 mb-1">{c.label}</p>
              <p className={`text-base font-bold ${(c as any).color || 'text-gray-900'}`}>{c.value}</p>
            </div>
          ))}
        </div>

        {/* Add form */}
        {showAdd && (
          <div className="bg-white border rounded-xl p-5 mb-5">
            <h3 className="font-semibold mb-4 text-sm">Add Stock</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'ticker', placeholder: 'Ticker (TCS, INFY...)' },
                { key: 'stock_name', placeholder: 'Company Name' },
                { key: 'buy_price', placeholder: 'Buy Price (₹)' },
                { key: 'quantity', placeholder: 'Quantity' },
              ].map(f => (
                <input key={f.key} value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              ))}
            </div>
            <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="Notes — why buy chesavu?" className="w-full mt-3 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            <div className="flex gap-2 mt-4">
              <button onClick={addStock} disabled={saving} className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-60">
                {saving ? 'Saving...' : 'Add'}
              </button>
              <button onClick={() => setShowAdd(false)} className="flex-1 border py-2 rounded-lg text-sm text-gray-600">Cancel</button>
            </div>
          </div>
        )}

        {/* Portfolio list */}
        {loading ? (
          <div className="text-center py-16 text-gray-300 text-sm">Loading...</div>
        ) : portfolio.length === 0 ? (
          <div className="text-center py-16 text-gray-300">
            <p className="text-5xl mb-3">📭</p>
            <p className="text-sm text-gray-400">Portfolio empty!</p>
            <Link href="/analyze" className="mt-3 inline-block text-sm text-green-600">Analyze a stock first →</Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {portfolio.map(item => {
              const livePrice = livePrices[item.ticker.toUpperCase()]
              const invested  = item.buy_price * item.quantity
              const current   = (livePrice ?? item.buy_price) * item.quantity
              const pnl       = current - invested
              const pnlPct    = (pnl / invested) * 100
              const profit    = pnl >= 0
              return (
                <div key={item.id} className="bg-white border rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center font-bold text-green-700 text-sm flex-shrink-0">
                      {item.ticker.slice(0,2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-gray-900">{item.stock_name || item.ticker}</p>
                        <button onClick={() => removeStock(item.id)} className="text-xs text-gray-300 hover:text-red-400">✕</button>
                      </div>
                      <p className="text-xs text-gray-400">{item.ticker} · {item.quantity} shares @ ₹{item.buy_price}</p>
                      {item.notes && <p className="text-xs text-gray-300 mt-0.5 truncate">"{item.notes}"</p>}
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="bg-gray-50 rounded-lg p-2">
                      <p className="text-xs text-gray-400">Invested</p>
                      <p className="text-sm font-semibold text-gray-700">₹{invested.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <p className="text-xs text-gray-400">Current {livePrice ? '🟢' : '⚪'}</p>
                      <p className="text-sm font-semibold text-gray-700">₹{current.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                    </div>
                    <div className={`rounded-lg p-2 ${profit ? 'bg-green-50' : 'bg-red-50'}`}>
                      <p className="text-xs text-gray-400">P&L</p>
                      <p className={`text-sm font-bold ${profit ? 'text-green-600' : 'text-red-500'}`}>
                        {profit ? '+' : ''}₹{Math.abs(pnl).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        <span className="text-xs ml-1">({profit ? '+' : ''}{pnlPct.toFixed(1)}%)</span>
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
