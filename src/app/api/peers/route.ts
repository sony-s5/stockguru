import { NextRequest, NextResponse } from 'next/server'

const FMP_KEY = process.env.FMP_API_KEY

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
  ADANIPORTS: ['ADANIPORTS', 'ADANIENT', 'ADANIGREEN'],
  ZOMATO:     ['ZOMATO', 'NYKAA', 'POLICYBZR', 'PAYTM'],
}

async function fetchPeerData(ticker: string) {
  const symbol = `${ticker}.NS`
  try {
    const [ratiosRes, profileRes] = await Promise.all([
      fetch(`https://financialmodelingprep.com/api/v3/ratios-ttm/${symbol}?apikey=${FMP_KEY}`, { next: { revalidate: 3600 } }),
      fetch(`https://financialmodelingprep.com/api/v3/profile/${symbol}?apikey=${FMP_KEY}`, { next: { revalidate: 3600 } }),
    ])

    const [ratiosData, profileData] = await Promise.all([
      ratiosRes.json(),
      profileRes.json(),
    ])

    const ratios  = ratiosData?.[0]
    const profile = profileData?.[0]

    if (!ratios && !profile) return null

    return {
      ticker,
      pe:            ratios?.peRatioTTM ? +ratios.peRatioTTM.toFixed(1) : null,
      pb:            ratios?.priceToBookRatioTTM ? +ratios.priceToBookRatioTTM.toFixed(1) : null,
      roe:           ratios?.returnOnEquityTTM ? +(ratios.returnOnEquityTTM * 100).toFixed(1) : null,
      revenueGrowth: null, // needs separate call
      profitMargin:  ratios?.netProfitMarginTTM ? +(ratios.netProfitMarginTTM * 100).toFixed(1) : null,
      debtToEquity:  ratios?.debtEquityRatioTTM ? +ratios.debtEquityRatioTTM.toFixed(2) : null,
      marketCapFmt:  profile?.marketCap ? formatMarketCap(profile.marketCap) : null,
    }
  } catch {
    return null
  }
}

function formatMarketCap(cap: number): string {
  if (!cap) return '—'
  if (cap >= 1e12) return `₹${(cap / 1e12).toFixed(1)}T`
  if (cap >= 1e9)  return `₹${(cap / 1e9).toFixed(1)}B`
  if (cap >= 1e7)  return `₹${(cap / 1e7).toFixed(1)}Cr`
  return `₹${cap.toLocaleString()}`
}

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get('ticker')?.toUpperCase()
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })

  // Find peer list
  let peerList = PEERS[ticker]
  if (!peerList) {
    const matchedKey = Object.keys(PEERS).find(k => k.includes(ticker) || ticker.includes(k))
    peerList = matchedKey ? PEERS[matchedKey] : [ticker]
  }

  // Fetch all peers in parallel
  const results = await Promise.all(peerList.map(t => fetchPeerData(t)))
  const filtered = results.filter(Boolean)

  if (filtered.length === 0) {
    // Return basic list without data
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
