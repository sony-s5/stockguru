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
    const bases = ['https://query2.finance.yahoo.com', 'https://query1.finance.yahoo.com']
    let json: any = null
    let res: Response | null = null

    for (const base of bases) {
      const url = `${base}/v10/finance/quoteSummary/${nsTicker}?modules=financialData,defaultKeyStatistics`
      console.log(`📈 Yahoo fetch: ${url}`)
      try {
        res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept':     'application/json, text/plain, */*',
            'Referer':    'https://finance.yahoo.com',
            'Origin':     'https://finance.yahoo.com',
          },
          cache: 'no-store',
        })
      } catch (err) {
        console.log('Yahoo fetch error:', (err as any)?.message)
        res = null
      }

      if (!res) continue
      if (res.status === 401) { console.log(`Yahoo ${nsTicker} @ ${base}: 401`); continue }
      if (!res.ok) { console.log(`Yahoo ${nsTicker} @ ${base}: HTTP ${res.status}`); continue }

      json = await res.json().catch(() => null)
      if (json) break
    }

    if (!json) return null

    const fd   = json?.quoteSummary?.result?.[0]?.financialData
    const ks   = json?.quoteSummary?.result?.[0]?.defaultKeyStatistics

    if (!fd) { console.log('Yahoo: no financialData'); return null }

    const raw = (v: any): number | null => {
      if (v === null || v === undefined) return null
      if (typeof v === 'number') return isFinite(v) ? v : null
      if (typeof v === 'object' && 'raw' in v) {
        const r = v.raw
        return typeof r === 'number' && isFinite(r) ? r : null
      }
      return null
    }

    const data: YahooData = {
      debtToEquity:     raw(fd?.debtToEquity)        ?? null,
      currentRatio:     raw(fd?.currentRatio)        ?? null,
      revenueGrowth:    raw(fd?.revenueGrowth) != null
                          ? parseFloat((raw(fd.revenueGrowth)! * 100).toFixed(2))
                          : null,
      earningsGrowth:   raw(fd?.earningsGrowth) != null
                          ? parseFloat((raw(fd.earningsGrowth)! * 100).toFixed(2))
                          : null,
      grossMargins:     raw(fd?.grossMargins) != null
                          ? parseFloat((raw(fd.grossMargins)! * 100).toFixed(2))
                          : null,
      operatingMargins: raw(fd?.operatingMargins) != null
                          ? parseFloat((raw(fd.operatingMargins)! * 100).toFixed(2))
                          : null,
      profitMargins:    raw(fd?.profitMargins) != null
                          ? parseFloat((raw(fd.profitMargins)! * 100).toFixed(2))
                          : null,
      returnOnEquity:   raw(fd?.returnOnEquity) != null
                          ? parseFloat((raw(fd.returnOnEquity)! * 100).toFixed(2))
                          : null,
      returnOnAssets:   raw(fd?.returnOnAssets) != null
                          ? parseFloat((raw(fd.returnOnAssets)! * 100).toFixed(2))
                          : null,
      freeCashFlow:     raw(fd?.freeCashflow) != null
                          ? parseFloat((raw(fd.freeCashflow)! / 1e7).toFixed(2)) // in Cr
                          : null,
      totalRevenue:     raw(fd?.totalRevenue) != null
                          ? parseFloat((raw(fd.totalRevenue)! / 1e7).toFixed(2)) // in Cr
                          : null,
      revenuePerShare:  raw(fd?.revenuePerShare)     ?? null,
    }

    console.log('📈 Yahoo data:', JSON.stringify(data, null, 2))
    return data

  } catch (e: any) {
    console.log('Yahoo error:', e?.message)
    return null
  }
}