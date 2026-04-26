import { NextRequest, NextResponse } from 'next/server'

const FMP_KEY = process.env.FMP_API_KEY

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get('ticker')
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })

  // FMP uses NSE tickers directly — e.g. TCS.NS
  const symbol = ticker.includes('.') ? ticker : `${ticker}.NS`

  try {
    // Fetch key metrics + ratios in parallel
    const [profileRes, ratiosRes, growthRes] = await Promise.all([
      fetch(`https://financialmodelingprep.com/api/v3/profile/${symbol}?apikey=${FMP_KEY}`, { next: { revalidate: 3600 } }),
      fetch(`https://financialmodelingprep.com/api/v3/ratios-ttm/${symbol}?apikey=${FMP_KEY}`, { next: { revalidate: 3600 } }),
      fetch(`https://financialmodelingprep.com/api/v3/financial-growth/${symbol}?limit=1&apikey=${FMP_KEY}`, { next: { revalidate: 3600 } }),
    ])

    const [profileData, ratiosData, growthData] = await Promise.all([
      profileRes.json(),
      ratiosRes.json(),
      growthRes.json(),
    ])

    const profile = profileData?.[0]
    const ratios  = ratiosData?.[0]
    const growth  = growthData?.[0]

    if (!profile) {
      return NextResponse.json({ error: 'Stock not found' }, { status: 404 })
    }

    return NextResponse.json({
      // Profile
      name:          profile.companyName,
      sector:        profile.sector,
      industry:      profile.industry,
      marketCap:     profile.marketCap,
      marketCapFmt:  formatMarketCap(profile.marketCap),
      price:         profile.price,
      beta:          profile.beta,
      website:       profile.website,
      description:   profile.description,

      // Valuation
      pe:            ratios?.peRatioTTM ? +ratios.peRatioTTM.toFixed(2) : null,
      pb:            ratios?.priceToBookRatioTTM ? +ratios.priceToBookRatioTTM.toFixed(2) : null,
      ps:            ratios?.priceToSalesRatioTTM ? +ratios.priceToSalesRatioTTM.toFixed(2) : null,
      evEbitda:      ratios?.enterpriseValueMultipleTTM ? +ratios.enterpriseValueMultipleTTM.toFixed(2) : null,

      // Profitability
      roe:           ratios?.returnOnEquityTTM ? +(ratios.returnOnEquityTTM * 100).toFixed(2) : null,
      roa:           ratios?.returnOnAssetsTTM ? +(ratios.returnOnAssetsTTM * 100).toFixed(2) : null,
      grossMargin:   ratios?.grossProfitMarginTTM ? +(ratios.grossProfitMarginTTM * 100).toFixed(2) : null,
      operatingMargin: ratios?.operatingProfitMarginTTM ? +(ratios.operatingProfitMarginTTM * 100).toFixed(2) : null,
      netMargin:     ratios?.netProfitMarginTTM ? +(ratios.netProfitMarginTTM * 100).toFixed(2) : null,
      fcfMargin:     ratios?.freeCashFlowPerShareTTM ? +ratios.freeCashFlowPerShareTTM.toFixed(2) : null,

      // Leverage
      debtToEquity:  ratios?.debtEquityRatioTTM ? +ratios.debtEquityRatioTTM.toFixed(2) : null,
      currentRatio:  ratios?.currentRatioTTM ? +ratios.currentRatioTTM.toFixed(2) : null,
      interestCoverage: ratios?.interestCoverageTTM ? +ratios.interestCoverageTTM.toFixed(2) : null,

      // Dividends
      dividendYield: ratios?.dividendYielTTM ? +(ratios.dividendYielTTM * 100).toFixed(2) : null,
      payoutRatio:   ratios?.payoutRatioTTM ? +(ratios.payoutRatioTTM * 100).toFixed(2) : null,

      // Growth
      revenueGrowth: growth?.revenueGrowth ? +(growth.revenueGrowth * 100).toFixed(2) : null,
      epsGrowth:     growth?.epsgrowth ? +(growth.epsgrowth * 100).toFixed(2) : null,
      netIncomeGrowth: growth?.netIncomeGrowth ? +(growth.netIncomeGrowth * 100).toFixed(2) : null,
    })
  } catch (e: any) {
    console.error('FMP fundamentals error:', e?.message)
    return NextResponse.json({ error: 'Failed to fetch fundamentals' }, { status: 500 })
  }
}

function formatMarketCap(cap: number): string {
  if (!cap) return '—'
  if (cap >= 1e12) return `₹${(cap / 1e12).toFixed(1)}T`
  if (cap >= 1e9)  return `₹${(cap / 1e9).toFixed(1)}B`
  if (cap >= 1e7)  return `₹${(cap / 1e7).toFixed(1)}Cr`
  return `₹${cap.toLocaleString()}`
}
