import { NextRequest, NextResponse } from 'next/server'

// Yahoo Finance unofficial API — free, no key needed
// NSE stocks use ".NS" suffix  e.g. TCS.NS, RELIANCE.NS
export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get('ticker')
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })

  const symbol = ticker.includes('.') ? ticker : `${ticker}.NS`

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 300 }, // cache 5 mins
    })
    const data = await res.json()
    const meta = data?.chart?.result?.[0]?.meta

    if (!meta) return NextResponse.json({ error: 'Stock not found' }, { status: 404 })

    return NextResponse.json({
      ticker: symbol,
      name: meta.shortName || meta.longName || ticker,
      price: meta.regularMarketPrice,
      prevClose: meta.previousClose,
      change: +(meta.regularMarketPrice - meta.previousClose).toFixed(2),
      changePct: +(((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100).toFixed(2),
      high52: meta.fiftyTwoWeekHigh,
      low52:  meta.fiftyTwoWeekLow,
      volume: meta.regularMarketVolume,
      currency: meta.currency,
      exchange: meta.exchangeName,
      marketState: meta.marketState, // REGULAR | PRE | POST | CLOSED
    })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch quote' }, { status: 500 })
  }
}
