import { NextRequest, NextResponse } from 'next/server'

// Sector peer map — expand as needed
const PEERS: Record<string, string[]> = {
  TCS:        ['TCS', 'INFY', 'WIPRO', 'HCLTECH', 'TECHM'],
  INFY:       ['INFY', 'TCS', 'WIPRO', 'HCLTECH', 'TECHM'],
  WIPRO:      ['WIPRO', 'TCS', 'INFY', 'HCLTECH', 'TECHM'],
  HCLTECH:    ['HCLTECH', 'TCS', 'INFY', 'WIPRO', 'TECHM'],
  RELIANCE:   ['RELIANCE', 'ONGC', 'IOC', 'BPCL', 'HINDPETRO'],
  HDFCBANK:   ['HDFCBANK', 'ICICIBANK', 'KOTAKBANK', 'AXISBANK', 'SBIN'],
  ICICIBANK:  ['ICICIBANK', 'HDFCBANK', 'KOTAKBANK', 'AXISBANK', 'SBIN'],
  KOTAKBANK:  ['KOTAKBANK', 'HDFCBANK', 'ICICIBANK', 'AXISBANK', 'SBIN'],
  ITC:        ['ITC', 'HINDUNILVR', 'NESTLEIND', 'BRITANNIA', 'DABUR'],
  TATAMOTORS: ['TATAMOTORS', 'MARUTI', 'M&M', 'BAJAJ-AUTO', 'HEROMOTOCO'],
  OLAELEC:    ['OLAELEC', 'TVSMOTOR', 'BAJAJ-AUTO', 'HEROMOTOCO', 'ATHER'],
  ZOMATO:     ['ZOMATO', 'SWIGGY', 'NYKAA', 'POLICYBZR', 'PAYTM'],
}

async function fetchQuote(ticker: string) {
  const symbol = `${ticker}.NS`
  try {
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=summaryDetail,defaultKeyStatistics,financialData`
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 3600 } })
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
      price:         sd.regularMarketPrice?.raw ?? null,
    }
  } catch { return null }
}

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get('ticker')?.toUpperCase()
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })

  const peers = PEERS[ticker] || [ticker]
  const results = await Promise.all(peers.map(fetchQuote))
  return NextResponse.json(results.filter(Boolean))
}
