import { NextRequest, NextResponse } from 'next/server'

const AV_KEY = process.env.ALPHA_VANTAGE_KEY

const PEERS: Record<string, string[]> = {
  TCS:        ['TCS', 'INFY', 'WIPRO', 'HCLTECH', 'TECHM'],
  INFY:       ['INFY', 'TCS', 'WIPRO', 'HCLTECH', 'TECHM'],
  WIPRO:      ['WIPRO', 'TCS', 'INFY', 'HCLTECH', 'TECHM'],
  HCLTECH:    ['HCLTECH', 'TCS', 'INFY', 'WIPRO', 'TECHM'],
  TECHM:      ['TECHM', 'TCS', 'INFY', 'WIPRO', 'HCLTECH'],
  RELIANCE:   ['RELIANCE', 'ONGC', 'IOC', 'BPCL', 'HINDPETRO'],
  HDFCBANK:   ['HDFCBANK', 'ICICIBANK', 'KOTAKBANK', 'AXISBANK', 'SBIN'],
  ICICIBANK:  ['ICICIBANK', 'HDFCBANK', 'KOTAKBANK', 'AXISBANK', 'SBIN'],
  KOTAKBANK:  ['KOTAKBANK', 'HDFCBANK', 'ICICIBANK', 'AXISBANK', 'SBIN'],
  AXISBANK:   ['AXISBANK', 'HDFCBANK', 'ICICIBANK', 'KOTAKBANK', 'SBIN'],
  SBIN:       ['SBIN', 'HDFCBANK', 'ICICIBANK', 'KOTAKBANK', 'AXISBANK'],
  ITC:        ['ITC', 'HINDUNILVR', 'NESTLEIND', 'BRITANNIA', 'DABUR'],
  HINDUNILVR: ['HINDUNILVR', 'ITC', 'NESTLEIND', 'BRITANNIA', 'DABUR'],
  TATAMOTORS: ['TATAMOTORS', 'MARUTI', 'M&M', 'BAJAJ-AUTO', 'HEROMOTOCO'],
  MARUTI:     ['MARUTI', 'TATAMOTORS', 'M&M', 'BAJAJ-AUTO', 'HEROMOTOCO'],
  BAJFINANCE: ['BAJFINANCE', 'BAJAJFINSV', 'HDFCBANK', 'ICICIBANK'],
  LTIM:       ['LTIM', 'TCS', 'INFY', 'WIPRO', 'HCLTECH'],
  ZOMATO:     ['ZOMATO', 'NYKAA', 'POLICYBZR', 'PAYTM'],
}

async function fetchPeerData(ticker: string) {
  const symbol = `${ticker}.BSE`
  try {
    const res = await fetch(
      `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${symbol}&apikey=${AV_KEY}`,
      { next: { revalidate: 3600 } }
    )
    const data = await res.json()

    if (!data?.Symbol || data?.Note || data?.Information) return null

    const pe  = parseFloatSafe(data.PERatio)
    const roe = toPercent(data.ReturnOnEquityTTM)
    const pm  = toPercent(data.ProfitMargin)
    const rg  = toPercent(data.QuarterlyRevenueGrowthYOY)
    const de  = parseFloatSafe(data.DebtToEquityRatio)
    const mc  = parseFloat(data.MarketCapitalization)

    return {
      ticker,
      pe,
      pb:            parseFloatSafe(data.PriceToBookRatio),
      roe,
      revenueGrowth: rg,
      profitMargin:  pm,
      debtToEquity:  de,
      marketCapFmt:  formatMarketCap(mc),
    }
  } catch {
    return null
  }
}

function parseFloatSafe(val: any): number | null {
  if (!val || val === 'None' || val === '-') return null
  const n = parseFloat(val)
  return isNaN(n) ? null : +n.toFixed(2)
}

function toPercent(val: any): number | null {
  if (!val || val === 'None' || val === '-') return null
  const n = parseFloat(val)
  if (isNaN(n)) return null
  return n < 1 && n > -1 ? +(n * 100).toFixed(2) : +n.toFixed(2)
}

function formatMarketCap(cap: number): string {
  if (!cap || isNaN(cap)) return '—'
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(1)}T`
  if (cap >= 1e9)  return `$${(cap / 1e9).toFixed(1)}B`
  if (cap >= 1e6)  return `$${(cap / 1e6).toFixed(1)}M`
  return `$${cap.toLocaleString()}`
}

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get('ticker')?.toUpperCase()
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })

  let peerList = PEERS[ticker]
  if (!peerList) {
    const matchedKey = Object.keys(PEERS).find(k => k.includes(ticker) || ticker.includes(k))
    peerList = matchedKey ? PEERS[matchedKey] : [ticker]
  }

  // Alpha Vantage free tier — 25 requests/day
  // Fetch only 3 peers to save quota
  const limitedPeers = peerList.slice(0, 3)
  const results = await Promise.all(limitedPeers.map(t => fetchPeerData(t)))
  const filtered = results.filter(Boolean)

  if (filtered.length === 0) {
    return NextResponse.json(
      peerList.map(t => ({
        ticker: t, pe: null, pb: null, roe: null,
        revenueGrowth: null, profitMargin: null,
        debtToEquity: null, marketCapFmt: null
      }))
    )
  }

  return NextResponse.json(filtered)
}
