// lib/alpha.ts

export interface AlphaData {
  revenueGrowth:    number | null
  profitGrowth:     number | null
  operatingMargins: number | null
  profitMargins:    number | null
  debtToEquity:     number | null
  currentRatio:     number | null
  returnOnEquity:   number | null
  eps:              number | null
}

export async function fetchAlphaData(ticker: string): Promise<AlphaData | null> {
  const key = process.env.ALPHA_VANTAGE_KEY
  if (!key) { console.log('Alpha Vantage key missing'); return null }

  // NSE stocks: INFY.BSE format for Alpha Vantage
  const bseTicker = `${ticker.toUpperCase()}.BSE`

  try {
    console.log(`📊 Alpha Vantage fetch: ${bseTicker}`)

    const url = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${bseTicker}&apikey=${key}`
    const res = await fetch(url, { cache: 'no-store' })

    console.log(`Alpha status: ${res.status}`)
    if (!res.ok) return null

    const d = await res.json()

    // Rate limit check
    if (d?.Note || d?.Information) {
      console.log('Alpha rate limit:', d?.Note ?? d?.Information)
      return null
    }

    // No data check
    if (!d?.Symbol) {
      console.log('Alpha: no data for', bseTicker)
      return null
    }

    const toNum = (v: string | undefined): number | null => {
      if (!v || v === 'None' || v === '-') return null
      const n = parseFloat(v)
      return isNaN(n) ? null : n
    }

    const data: AlphaData = {
      revenueGrowth:    toNum(d?.QuarterlyRevenueGrowthYOY) != null
                          ? parseFloat((toNum(d.QuarterlyRevenueGrowthYOY)! * 100).toFixed(2))
                          : null,
      profitGrowth:     toNum(d?.QuarterlyEarningsGrowthYOY) != null
                          ? parseFloat((toNum(d.QuarterlyEarningsGrowthYOY)! * 100).toFixed(2))
                          : null,
      operatingMargins: toNum(d?.OperatingMarginTTM) != null
                          ? parseFloat((toNum(d.OperatingMarginTTM)! * 100).toFixed(2))
                          : null,
      profitMargins:    toNum(d?.ProfitMargin) != null
                          ? parseFloat((toNum(d.ProfitMargin)! * 100).toFixed(2))
                          : null,
      debtToEquity:     toNum(d?.DebtToEquityRatio),
      currentRatio:     toNum(d?.CurrentRatio),
      returnOnEquity:   toNum(d?.ReturnOnEquityTTM) != null
                          ? parseFloat((toNum(d.ReturnOnEquityTTM)! * 100).toFixed(2))
                          : null,
      eps:              toNum(d?.EPS),
    }

    console.log('📊 Alpha data:', JSON.stringify(data, null, 2))
    return data

  } catch (e: any) {
    console.log('Alpha error:', e?.message)
    return null
  }
}