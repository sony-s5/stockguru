import { NextRequest, NextResponse } from 'next/server'

const AV_KEY = process.env.ALPHA_VANTAGE_KEY

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get('ticker')
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })

  // Alpha Vantage uses BSE/NSE format — e.g. TCS.BSE or TCS.NSE
  const symbol = `${ticker}.BSE`

  try {
    const [overviewRes, quoteRes] = await Promise.all([
      fetch(`https://www.alphavantage.co/query?function=OVERVIEW&symbol=${symbol}&apikey=${AV_KEY}`, { next: { revalidate: 3600 } }),
      fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${AV_KEY}`, { next: { revalidate: 300 } }),
    ])

    const [overview, quoteData] = await Promise.all([
      overviewRes.json(),
      quoteRes.json(),
    ])

    // If empty response or error
    if (!overview || overview?.Note || overview?.Information || !overview.Symbol) {
      console.log('Alpha Vantage overview empty:', overview)
      return NextResponse.json({ error: 'Data not found' }, { status: 404 })
    }

    const quote = quoteData?.['Global Quote'] || {}

    return NextResponse.json({
      // Company info
      name:          overview.Name,
      sector:        overview.Sector,
      industry:      overview.Industry,
      marketCapFmt:  formatMarketCap(parseFloat(overview.MarketCapitalization)),
      description:   overview.Description,

      // Valuation
      pe:            parseFloatSafe(overview.PERatio),
      forwardPE:     parseFloatSafe(overview.ForwardPE),
      pb:            parseFloatSafe(overview.PriceToBookRatio),
      ps:            parseFloatSafe(overview.PriceToSalesRatioTTM),
      evEbitda:      parseFloatSafe(overview.EVToEBITDA),

      // Profitability
      roe:           toPercent(overview.ReturnOnEquityTTM),
      roa:           toPercent(overview.ReturnOnAssetsTTM),
      operatingMargin: toPercent(overview.OperatingMarginTTM),
      netMargin:     toPercent(overview.ProfitMargin),

      // Growth
      revenueGrowth:    toPercent(overview.QuarterlyRevenueGrowthYOY),
      epsGrowth:        toPercent(overview.QuarterlyEarningsGrowthYOY),

      // Financial Health
      debtToEquity:  parseFloatSafe(overview.DebtToEquityRatio),
      currentRatio:  parseFloatSafe(overview.CurrentRatio),

      // Dividends
      dividendYield: toPercent(overview.DividendYield),
      eps:           parseFloatSafe(overview.EPS),

      // 52 week
      high52:        parseFloatSafe(overview['52WeekHigh']),
      low52:         parseFloatSafe(overview['52WeekLow']),

      // Live price from quote
      price:         parseFloatSafe(quote['05. price']),
      change:        parseFloatSafe(quote['09. change']),
      changePct:     quote['10. change percent']?.replace('%', '') || null,
    })
  } catch (e: any) {
    console.error('Alpha Vantage error:', e?.message)
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
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
  // AV returns decimals like 0.42 = 42%
  return n < 1 && n > -1 ? +( n * 100).toFixed(2) : +n.toFixed(2)
}

function formatMarketCap(cap: number): string {
  if (!cap || isNaN(cap)) return '—'
  if (cap >= 1e12) return `₹${(cap / 1e12).toFixed(1)}T`
  if (cap >= 1e9)  return `$${(cap / 1e9).toFixed(1)}B`
  if (cap >= 1e6)  return `$${(cap / 1e6).toFixed(1)}M`
  return `$${cap.toLocaleString()}`
}
