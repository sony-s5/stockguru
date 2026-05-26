export interface ScreenerData {
  name: string
  ticker: string
  currentPrice: number | null
  pe: number | null
  industryPe: number | null
  pb: number | null
  roe: number | null
  roce: number | null
  debtToEquity: number | null
  promoterHolding: number | null
  salesGrowth: number | null
  profitGrowth: number | null
  eps: number | null
  marketCap: string | null
  high52: number | null
  low52: number | null
  dividendYield: number | null
  faceValue: number | null
}

export async function fetchScreenerData(ticker: string): Promise<ScreenerData | null> {
  try {
    const url = `https://www.screener.in/company/${ticker.toUpperCase()}/`
    console.log(`🌐 Fetching: ${url}`)

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      next: { revalidate: 3600 }, // 1 hour cache
    })

    if (!res.ok) {
      console.log(`Screener fetch failed: ${res.status}`)
      return null
    }

    const html = await res.text()

    // ── Helper: extract number from text ──
    function extractNumber(text: string): number | null {
      const clean = text.replace(/,/g, '').trim()
      const match = clean.match(/-?\d+\.?\d*/)
      return match ? parseFloat(match[0]) : null
    }

    // ── Helper: find value by label in #top-ratios ──
    function findRatio(label: string): number | null {
      const regex = new RegExp(
        `${label}[^<]*</span>[^<]*<span[^>]*>([^<]+)<`,
        'i'
      )
      const match = html.match(regex)
      return match ? extractNumber(match[1]) : null
    }

    // ── Company name ──
    const nameMatch = html.match(/<h1[^>]*class="[^"]*company-name[^"]*"[^>]*>([^<]+)</)
      || html.match(/<title>([^|<]+)/)
    const name = nameMatch ? nameMatch[1].trim() : ticker

    // ── Market Cap ──
    const marketCapMatch = html.match(/Market Cap[^<]*<\/span>[^<]*<span[^>]*>([^<]+)</i)
    const marketCap = marketCapMatch ? marketCapMatch[1].trim() : null

    // ── Current Price ──
    const priceMatch = html.match(/id="top-ratios"[\s\S]*?Current Price[\s\S]*?<span[^>]*>([\d,\.]+)</)
      || html.match(/class="[^"]*current-price[^"]*"[^>]*>([\d,\.]+)</)
      || html.match(/"currentPrice":\s*([\d.]+)/)
    const currentPrice = priceMatch ? extractNumber(priceMatch[1]) : null

    // ── 52 Week High/Low ──
    const highLowMatch = html.match(/52 Week High[^<]*<\/span>[^<]*<span[^>]*>([\d,\.]+)\s*\/\s*([\d,\.]+)</)
    const high52 = highLowMatch ? extractNumber(highLowMatch[1]) : null
    const low52  = highLowMatch ? extractNumber(highLowMatch[2]) : null

    // ── P/E Ratio ──
    const pe = findRatio('Stock P/E') ?? findRatio('P/E')

    // ── Industry P/E ──
    const industryPe = findRatio('Industry PE') ?? findRatio('Ind PE')

    // ── P/B Ratio ──
    const pb = findRatio('Price to Book') ?? findRatio('P/B')

    // ── Dividend Yield ──
    const dividendYield = findRatio('Dividend Yield')

    // ── Face Value ──
    const faceValue = findRatio('Face Value')

    // ── ROE ──
    const roeMatch = html.match(/ROE[^<]*<\/td>[^<]*<td[^>]*>([\d,\.]+)</)
      || html.match(/Return on Equity[^<]*<\/td>[^<]*<td[^>]*>([\d,\.]+)</)
    const roe = roeMatch ? extractNumber(roeMatch[1]) : null

    // ── ROCE ──
    const roceMatch = html.match(/ROCE[^<]*<\/td>[^<]*<td[^>]*>([\d,\.]+)</)
    const roce = roceMatch ? extractNumber(roceMatch[1]) : null

    // ── Debt to Equity ──
    const deMatch = html.match(/Debt to equity[^<]*<\/td>[^<]*<td[^>]*>([\d,\.]+)</)
      || html.match(/Debt\/Equity[^<]*<\/td>[^<]*<td[^>]*>([\d,\.]+)</)
    const debtToEquity = deMatch ? extractNumber(deMatch[1]) : null

    // ── Promoter Holding ──
    const promoterMatch = html.match(/Promoters[^<]*<\/td>[^<]*<td[^>]*>([\d,\.]+)</)
      || html.match(/Promoter Holding[^<]*>([\d,\.]+)%/)
    const promoterHolding = promoterMatch ? extractNumber(promoterMatch[1]) : null

    // ── Sales Growth (TTM) ──
    const salesMatch = html.match(/Sales Growth[^<]*<\/td>[^<]*<td[^>]*>([\d,\.\-]+)</)
    const salesGrowth = salesMatch ? extractNumber(salesMatch[1]) : null

    // ── Profit Growth ──
    const profitMatch = html.match(/Profit Growth[^<]*<\/td>[^<]*<td[^>]*>([\d,\.\-]+)</)
    const profitGrowth = profitMatch ? extractNumber(profitMatch[1]) : null

    // ── EPS ──
    const epsMatch = html.match(/EPS[^<]*<\/td>[^<]*<td[^>]*>([\d,\.\-]+)</)
    const eps = epsMatch ? extractNumber(epsMatch[1]) : null

    const data: ScreenerData = {
      name,
      ticker: ticker.toUpperCase(),
      currentPrice,
      pe,
      industryPe,
      pb,
      roe,
      roce,
      debtToEquity,
      promoterHolding,
      salesGrowth,
      profitGrowth,
      eps,
      marketCap,
      high52,
      low52,
      dividendYield,
      faceValue,
    }

    console.log('📊 Screener data:', JSON.stringify(data, null, 2))
    return data

  } catch (e: any) {
    console.log('Screener fetch error:', e?.message)
    return null
  }
}

// ── Format for AI prompt ──
export function formatScreenerDataForPrompt(data: ScreenerData): string {
  const val = (v: number | string | null, suffix = '') =>
    v !== null && v !== undefined ? `${v}${suffix}` : 'N/A'

  return `
REAL FINANCIAL DATA FROM SCREENER.IN (use these exact numbers in analysis):
Company: ${data.name} (${data.ticker})
Current Price: ₹${val(data.currentPrice)}
Market Cap: ${val(data.marketCap)} Cr
52W High: ₹${val(data.high52)} | 52W Low: ₹${val(data.low52)}

VALUATION:
- Stock P/E: ${val(data.pe)}x
- Industry P/E: ${val(data.industryPe)}x
- Price to Book: ${val(data.pb)}x
- EPS: ₹${val(data.eps)}
- Dividend Yield: ${val(data.dividendYield, '%')}

PROFITABILITY:
- ROE: ${val(data.roe, '%')}
- ROCE: ${val(data.roce, '%')}
- Sales Growth: ${val(data.salesGrowth, '%')}
- Profit Growth: ${val(data.profitGrowth, '%')}

FINANCIAL HEALTH:
- Debt to Equity: ${val(data.debtToEquity)}x
- Face Value: ₹${val(data.faceValue)}

OWNERSHIP:
- Promoter Holding: ${val(data.promoterHolding, '%')}
`.trim()
}