// lib/yahoo.ts

export interface YahooData {
  debtToEquity:    number | null
  currentRatio:    number | null
  revenueGrowth:   number | null
  earningsGrowth:  number | null
  grossMargins:    number | null
  operatingMargins:number | null
  profitMargins:   number | null
  returnOnEquity:  number | null
  returnOnAssets:  number | null
  freeCashFlow:    number | null
  totalRevenue:    number | null
  revenuePerShare: number | null
}

export async function fetchYahooData(ticker: string): Promise<YahooData | null> {
  // NSE ticker format: INFY.NS, TCS.NS
  const nsTicker = ticker.toUpperCase().endsWith('.NS')
    ? ticker.toUpperCase()
    : `${ticker.toUpperCase()}.NS`

  try {
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${nsTicker}?modules=financialData,defaultKeyStatistics`

    console.log(`📈 Yahoo fetch: ${url}`)

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept':     'application/json',
        'Referer':    'https://finance.yahoo.com',
      },
      cache: 'no-store',
    })

    console.log(`Yahoo status: ${res.status}`)
    if (!res.ok) return null

    const json = await res.json()
    const fd   = json?.quoteSummary?.result?.[0]?.financialData
    const ks   = json?.quoteSummary?.result?.[0]?.defaultKeyStatistics

    if (!fd) { console.log('Yahoo: no financialData'); return null }

    const data: YahooData = {
      debtToEquity:     fd?.debtToEquity?.raw        ?? null,
      currentRatio:     fd?.currentRatio?.raw        ?? null,
      revenueGrowth:    fd?.revenueGrowth?.raw != null
                          ? parseFloat((fd.revenueGrowth.raw * 100).toFixed(2))
                          : null,
      earningsGrowth:   fd?.earningsGrowth?.raw != null
                          ? parseFloat((fd.earningsGrowth.raw * 100).toFixed(2))
                          : null,
      grossMargins:     fd?.grossMargins?.raw != null
                          ? parseFloat((fd.grossMargins.raw * 100).toFixed(2))
                          : null,
      operatingMargins: fd?.operatingMargins?.raw != null
                          ? parseFloat((fd.operatingMargins.raw * 100).toFixed(2))
                          : null,
      profitMargins:    fd?.profitMargins?.raw != null
                          ? parseFloat((fd.profitMargins.raw * 100).toFixed(2))
                          : null,
      returnOnEquity:   fd?.returnOnEquity?.raw != null
                          ? parseFloat((fd.returnOnEquity.raw * 100).toFixed(2))
                          : null,
      returnOnAssets:   fd?.returnOnAssets?.raw != null
                          ? parseFloat((fd.returnOnAssets.raw * 100).toFixed(2))
                          : null,
      freeCashFlow:     fd?.freeCashflow?.raw != null
                          ? Math.round(fd.freeCashflow.raw / 10000000) // Cr లో
                          : null,
      totalRevenue:     fd?.totalRevenue?.raw != null
                          ? Math.round(fd.totalRevenue.raw / 10000000) // Cr లో
                          : null,
      revenuePerShare:  fd?.revenuePerShare?.raw     ?? null,
    }

    console.log('📈 Yahoo data:', JSON.stringify(data, null, 2))
    return data

  } catch (e: any) {
    console.log('Yahoo error:', e?.message)
    return null
  }
}