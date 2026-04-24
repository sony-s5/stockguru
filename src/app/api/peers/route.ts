import { NextRequest, NextResponse } from 'next/server'

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
  OLAELEC:    ['OLAELEC', 'TVSMOTOR', 'BAJAJ-AUTO', 'HEROMOTOCO'],
  ZOMATO:     ['ZOMATO', 'SWIGGY', 'NYKAA', 'POLICYBZR', 'PAYTM'],
  ADANIPORTS: ['ADANIPORTS', 'ADANIENT', 'ADANIGREEN', 'ADANIPOWER'],
  BAJFINANCE: ['BAJFINANCE', 'BAJAJFINSV', 'HDFCBANK', 'ICICIBANK'],
  LTIM:       ['LTIM', 'TCS', 'INFY', 'WIPRO', 'HCLTECH'],
}

async function fetchQuote(ticker: string) {
  const symbol = `${ticker}.NS`
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      next: { revalidate: 3600 },
    })

    if (!res.ok) return null
    const data = await res.json()
    const meta = data?.chart?.result?.[0]?.meta
    if (!meta?.regularMarketPrice) return null

    return {
      ticker,
      price: +meta.regularMarketPrice.toFixed(2),
      change: +((meta.regularMarketPrice - meta.previousClose) / meta.previousClose * 100).toFixed(2),
      high52: meta.fiftyTwoWeekHigh,
      low52: meta.fiftyTwoWeekLow,
      marketCap: meta.marketCap,
    }
  } catch {
    return null
  }
}

async function fetchFundamentals(ticker: string) {
  const symbol = `${ticker}.NS`
  try {
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=summaryDetail,defaultKeyStatistics,financialData`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      next: { revalidate: 3600 },
    })

    if (!res.ok) return null
    const data = await res.json()
    const r = data?.quoteSummary?.result?.[0]
    if (!r) return null

    const sd = r.summaryDetail || {}
    const ks = r.defaultKeyStatistics || {}
    const fd = r.financialData || {}

    return {
      ticker,
      pe:            sd.trailingPE?.raw ?? null,
      pb:            ks.priceToBook?.raw ?? null,
      marketCapFmt:  sd.marketCap?.fmt ?? null,
      roe:           fd.returnOnEquity?.raw ? +(fd.returnOnEquity.raw * 100).toFixed(1) : null,
      revenueGrowth: fd.revenueGrowth?.raw ? +(fd.revenueGrowth.raw * 100).toFixed(1) : null,
      profitMargin:  fd.profitMargins?.raw ? +(fd.profitMargins.raw * 100).toFixed(1) : null,
      debtToEquity:  fd.debtToEquity?.raw ?? null,
    }
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get('ticker')?.toUpperCase()
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })

  // Find peers — exact match first, then partial match
  let peerList = PEERS[ticker]

  if (!peerList) {
    // Partial match try cheyyi — e.g. "HDFC" → "HDFCBANK"
    const matchedKey = Object.keys(PEERS).find(k =>
      k.includes(ticker) || ticker.includes(k)
    )
    peerList = matchedKey ? PEERS[matchedKey] : [ticker]
  }

  // Fetch all peers in parallel
  const results = await Promise.all(
    peerList.map(async (t) => {
      const fundamentals = await fetchFundamentals(t)
      return fundamentals
    })
  )

  const filtered = results.filter(Boolean)

  // If no data from Yahoo, return basic structure
  if (filtered.length === 0) {
    return NextResponse.json(
      peerList.map(t => ({ ticker: t, pe: null, pb: null, roe: null, revenueGrowth: null, profitMargin: null, debtToEquity: null, marketCapFmt: null }))
    )
  }

  return NextResponse.json(filtered)
}
