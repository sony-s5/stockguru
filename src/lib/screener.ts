// lib/screener.ts

export interface ScreenerData {
  name:             string
  ticker:           string
  sector:           string | null
  currentPrice:     number | null
  stockPE:          number | null
  industryPe:       number | null
  priceToBook:      number | null
  roe:              number | null
  roce:             number | null
  debtToEquity:     number | null
  promoterHolding:  number | null
  pledge:           number | null
  salesGrowth:      number | null
  salesGrowth3yr:   number | null
  profitGrowth:     number | null
  profitGrowth3yr:  number | null
  eps:              number | null
  marketCap:        number | null
  high52Week:       number | null
  low52Week:        number | null
  dividendYield:    number | null
  opm:              number | null
  netProfitMargin:  number | null
  currentRatio:     number | null
  interestCoverage: number | null
  freeCashFlow:     number | null
  faceValue:        number | null
}

// ── Step 1: Search API — correct slug resolve ──────────────
async function resolveScreenerSlug(query: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://www.screener.in/api/company/search/?q=${encodeURIComponent(query)}&v=3`,
      {
        headers: {
          'User-Agent':        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept':            'application/json',
          'Referer':           'https://www.screener.in/',
          'X-Requested-With':  'XMLHttpRequest',
        },
        cache: 'no-store',
      }
    )
    if (!res.ok) { console.log(`Search API failed: ${res.status}`); return null }

    const data = await res.json()
    if (data && data.length > 0) {
      const url = data[0].url  // "/company/INFY/consolidated/"
      const match = url.match(/\/company\/([^/]+)\//)
      if (match) {
        console.log(`✅ Resolved: ${query} → ${match[1]}`)
        return match[1]
      }
    }
    return null
  } catch (e: any) {
    console.log('Search API error:', e?.message)
    return null
  }
}

// ── Step 2: Parse HTML ─────────────────────────────────────
function parseScreenerHTML(html: string, ticker: string): ScreenerData {

  function extractNumber(text: string): number | null {
    if (!text) return null
    const clean = text.replace(/,/g, '').replace(/%/g, '').trim()
    const match = clean.match(/-?\d+\.?\d*/)
    return match ? parseFloat(match[0]) : null
  }

  function findTopRatio(label: string): number | null {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(
      `<span[^>]*class="[^"]*name[^"]*"[^>]*>\\s*${escaped}\\s*<\\/span>\\s*<span[^>]*class="[^"]*value[^"]*"[^>]*>([^<]+)<`,
      'i'
    )
    const match = html.match(regex)
    return match ? extractNumber(match[1]) : null
  }

  function findRatiosTable(label: string): number | null {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(
      `${escaped}[^<]*<\\/td>[\\s\\S]*?<td[^>]*>([\\d,\\.\\-]+)`,
      'i'
    )
    const match = html.match(regex)
    return match ? extractNumber(match[1]) : null
  }

  // Company name
  const nameMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/)
  const name = nameMatch ? nameMatch[1].trim() : ticker

  // Sector
  const sectorMatch = html.match(/sector[^"]*"[^>]*>([^<]+)<\/a>/i)
  const sector = sectorMatch ? sectorMatch[1].trim() : null

  // Top ratios
  const currentPrice  = findTopRatio('Current Price')
  const stockPE       = findTopRatio('Stock P/E')
  const industryPe    = findTopRatio('Industry PE') ?? findTopRatio('Ind PE')
  const priceToBook   = findTopRatio('Price to Book')
  const dividendYield = findTopRatio('Dividend Yield')
  const faceValue     = findTopRatio('Face Value')
  const roce          = findTopRatio('ROCE')
  const roe           = findTopRatio('ROE')

  // 52 Week High/Low
  const highLowMatch = html.match(/52 Week High\s*<\/span>\s*<span[^>]*>\s*([\d,\.]+)\s*\/\s*([\d,\.]+)/)
  const high52Week = highLowMatch ? extractNumber(highLowMatch[1]) : null
  const low52Week  = highLowMatch ? extractNumber(highLowMatch[2]) : null

  // Market Cap
  const mcMatch   = html.match(/Market Cap[^<]*<\/span>\s*<span[^>]*class="[^"]*value[^"]*"[^>]*>([\d,\.]+)/)
  const marketCap = mcMatch ? extractNumber(mcMatch[1]) : null

  // Ratios table
  const debtToEquity     = findRatiosTable('Debt to equity') ?? findRatiosTable('Debt / Equity')
  const currentRatio     = findRatiosTable('Current ratio')
  const interestCoverage = findRatiosTable('Interest Coverage')
  const opm              = findRatiosTable('OPM')
  const netProfitMargin  = findRatiosTable('Net profit')
  const eps              = findRatiosTable('EPS')
  const salesGrowth      = findRatiosTable('Sales growth')
  const salesGrowth3yr   = findRatiosTable('Sales CAGR') ?? findRatiosTable('3 Year Sales')
  const profitGrowth     = findRatiosTable('Profit growth')
  const profitGrowth3yr  = findRatiosTable('Profit CAGR') ?? findRatiosTable('3 Year Profit')
  const freeCashFlow     = findRatiosTable('Free cash flow') ?? findRatiosTable('FCF')

  // Shareholding
  const promoterMatch   = html.match(/Promoters\s*<\/td>\s*<td[^>]*>([\d\.]+)/)
  const promoterHolding = promoterMatch ? extractNumber(promoterMatch[1]) : null

  const pledgeMatch = html.match(/Pledged percentage\s*<\/td>\s*<td[^>]*>([\d\.]+)/)
    ?? html.match(/Pledge\s*<\/td>\s*<td[^>]*>([\d\.]+)/)
  const pledge = pledgeMatch ? extractNumber(pledgeMatch[1]) : 0

  const data: ScreenerData = {
    name, ticker: ticker.toUpperCase(), sector,
    currentPrice, stockPE, industryPe, priceToBook,
    roe, roce, debtToEquity, promoterHolding, pledge,
    salesGrowth, salesGrowth3yr, profitGrowth, profitGrowth3yr,
    eps, marketCap, high52Week, low52Week, dividendYield,
    opm, netProfitMargin, currentRatio, interestCoverage,
    freeCashFlow, faceValue,
  }

  console.log('📊 Parsed Screener data:', JSON.stringify(data, null, 2))
  return data
}

// ── Main export ────────────────────────────────────────────
export async function fetchScreenerData(ticker: string): Promise<ScreenerData | null> {
  try {
    // Correct slug resolve చేయి (INFOSYS → INFY)
    const slug = await resolveScreenerSlug(ticker) ?? ticker
    console.log(`🔍 Slug: ${ticker} → ${slug}`)

    // Consolidated first, then standalone
    const urls = [
      `https://www.screener.in/company/${slug}/consolidated/`,
      `https://www.screener.in/company/${slug}/`,
    ]

    for (const url of urls) {
      console.log(`🌐 Fetching: ${url}`)
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept':     'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Referer':    'https://www.screener.in/',
        },
        cache: 'no-store',
      })
      console.log(`Screener status [${url}]: ${res.status}`)
      if (res.ok) {
        const html = await res.text()
        return parseScreenerHTML(html, slug)
      }
    }

    console.log('Screener fetch failed for:', slug)
    return null

  } catch (e: any) {
    console.log('Screener fetch error:', e?.message)
    return null
  }
}

// ── Format for AI prompt ───────────────────────────────────
export function formatScreenerDataForPrompt(data: ScreenerData): string {
  const v = (val: number | string | null, suffix = '') =>
    val !== null && val !== undefined ? `${val}${suffix}` : 'N/A'

  return `
VERIFIED DATA FROM SCREENER.IN:
Company: ${data.name} (${data.ticker}) | Sector: ${v(data.sector)}
CMP: ₹${v(data.currentPrice)} | Market Cap: ₹${v(data.marketCap)}Cr
52W: ₹${v(data.low52Week)} – ₹${v(data.high52Week)}
VALUATION: PE ${v(data.stockPE)}x | Industry PE ${v(data.industryPe)}x | PB ${v(data.priceToBook)}x | EPS ₹${v(data.eps)} | Div Yield ${v(data.dividendYield)}%
PROFITABILITY: ROE ${v(data.roe)}% | ROCE ${v(data.roce)}% | OPM ${v(data.opm)}% | Net Margin ${v(data.netProfitMargin)}%
GROWTH: Sales ${v(data.salesGrowth)}% YoY | 3yr CAGR ${v(data.salesGrowth3yr)}% | Profit ${v(data.profitGrowth)}% YoY | 3yr CAGR ${v(data.profitGrowth3yr)}%
BALANCE SHEET: D/E ${v(data.debtToEquity)}x | Current Ratio ${v(data.currentRatio)}x | Interest Coverage ${v(data.interestCoverage)}x | FCF ₹${v(data.freeCashFlow)}Cr
OWNERSHIP: Promoter ${v(data.promoterHolding)}% | Pledge ${v(data.pledge)}%
`.trim()
}