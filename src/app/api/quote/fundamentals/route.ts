import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get('ticker')
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })

  const symbol = ticker.includes('.') ? ticker : `${ticker}.NS`

  try {
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=summaryDetail,defaultKeyStatistics,financialData,assetProfile`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 3600 }, // cache 1 hour
    })
    const data = await res.json()
    const result = data?.quoteSummary?.result?.[0]

    if (!result) return NextResponse.json({ error: 'Data not found' }, { status: 404 })

    const sd  = result.summaryDetail || {}
    const ks  = result.defaultKeyStatistics || {}
    const fd  = result.financialData || {}
    const ap  = result.assetProfile || {}

    return NextResponse.json({
      pe:               sd.trailingPE?.raw ?? null,
      forwardPE:        sd.forwardPE?.raw ?? null,
      pb:               ks.priceToBook?.raw ?? null,
      marketCap:        sd.marketCap?.raw ?? null,
      marketCapFmt:     sd.marketCap?.fmt ?? null,
      dividendYield:    sd.dividendYield?.raw ? +(sd.dividendYield.raw * 100).toFixed(2) : null,
      beta:             sd.beta?.raw ?? null,
      eps:              ks.trailingEps?.raw ?? null,
      roe:              fd.returnOnEquity?.raw ? +(fd.returnOnEquity.raw * 100).toFixed(2) : null,
      roa:              fd.returnOnAssets?.raw ? +(fd.returnOnAssets.raw * 100).toFixed(2) : null,
      debtToEquity:     fd.debtToEquity?.raw ?? null,
      currentRatio:     fd.currentRatio?.raw ?? null,
      revenueGrowth:    fd.revenueGrowth?.raw ? +(fd.revenueGrowth.raw * 100).toFixed(2) : null,
      earningsGrowth:   fd.earningsGrowth?.raw ? +(fd.earningsGrowth.raw * 100).toFixed(2) : null,
      freeCashflow:     fd.freeCashflow?.raw ?? null,
      freeCashflowFmt:  fd.freeCashflow?.fmt ?? null,
      grossMargin:      fd.grossMargins?.raw ? +(fd.grossMargins.raw * 100).toFixed(2) : null,
      operatingMargin:  fd.operatingMargins?.raw ? +(fd.operatingMargins.raw * 100).toFixed(2) : null,
      profitMargin:     fd.profitMargins?.raw ? +(fd.profitMargins.raw * 100).toFixed(2) : null,
      sector:           ap.sector ?? null,
      industry:         ap.industry ?? null,
      employees:        ap.fullTimeEmployees ?? null,
      website:          ap.website ?? null,
      description:      ap.longBusinessSummary ?? null,
    })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch fundamentals' }, { status: 500 })
  }
}
