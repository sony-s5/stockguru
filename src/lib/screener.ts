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

async function resolveScreenerSlug(query: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://www.screener.in/api/company/search/?q=${encodeURIComponent(query)}&v=3`,
      {
        headers: {
          'User-Agent':       'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept':           'application/json',
          'Referer':          'https://www.screener.in/',
          'X-Requested-With': 'XMLHttpRequest',
        },
        cache: 'no-store',
      }
    )
    if (!res.ok) return null
    const data = await res.json()
    if (data?.length > 0) {
      const match = data[0].url?.match(/\/company\/([^/]+)\//)
      if (match) { console.log(`✅ Resolved: ${query} → ${match[1]}`); return match[1] }
    }
    return null
  } catch { return null }
}


function parseScreenerHTML(html: string, ticker: string): ScreenerData {

  // ✅ ఇక్కడ add చేయి — మొదటి line గా
  const idx = html.indexOf('Current Price')
  if (idx !== -1) console.log('HTML_SNIPPET:', html.slice(idx - 100, idx + 300))
  const idx2 = html.indexOf('Stock P/E')
  if (idx2 !== -1) console.log('PE_SNIPPET:', html.slice(idx2 - 100, idx2 + 300))
  const idx3 = html.indexOf('ROCE')
  if (idx3 !== -1) console.log('ROCE_SNIPPET:', html.slice(idx3 - 50, idx3 + 200))
  const idx4 = html.indexOf('Promoters')
  if (idx4 !== -1) console.log('PROMOTER_SNIPPET:', html.slice(idx4 - 50, idx4 + 200))
  // ✅ ఇక్కడే ఆపు


  // ── Strip inner HTML tags, extract text only ──
  function stripTags(s: string): string {
    return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  }

  // ── Extract number from messy string ──
  function toNum(s: string | null | undefined): number | null {
    if (!s) return null
    const clean = s.replace(/,/g, '').replace(/%/g, '').trim()
    const m = clean.match(/-?\d+\.?\d*/)
    return m ? parseFloat(m[0]) : null
  }

  // ── Find value in #top-ratios by label ──
  // Actual HTML: <span class="name">Label</span><span class="nowrap value">123 <span>sub</span></span>
  function topRatio(label: string): number | null {
    const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // Match label span → next value span → extract text before any inner span
    const r = new RegExp(
      `<span[^>]*>\\s*${esc}\\s*<\\/span>\\s*<span[^>]*>\\s*([\\d,\\.\\-]+)`,
      'i'
    )
    const m = html.match(r)
    return m ? toNum(m[1]) : null
  }

  // ── Find value in ratios/financials table by label ──
  // Actual HTML: <td class="...">Label</td><td>value</td>
  function tableVal(label: string): number | null {
    const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const r = new RegExp(
      `>\\s*${esc}\\s*<\\/td>[\\s\\S]{0,200}?<td[^>]*>\\s*([\\d,\\.\\-]+)`,
      'i'
    )
    const m = html.match(r)
    return m ? toNum(m[1]) : null
  }

  // ── Company name ──
  const nameM = html.match(/<h1[^>]*class="[^"]*h2[^"]*"[^>]*>\s*([^<]+)/)
    ?? html.match(/<h1[^>]*>\s*([^<\n]+)/)
  const name = nameM ? nameM[1].trim() : ticker

  // ── Sector ──
  const sectorM = html.match(/\/company\/[^/]+\/[^"]*"[^>]*>([^<]+)<\/a>\s*<\/li>\s*<li[^>]*>\s*<a[^>]*>([^<]+)<\/a>/)
    ?? html.match(/class="[^"]*breadcrumb[^"]*"[\s\S]*?<a[^>]*>([^<]+)<\/a>\s*<\/li>\s*$/)
  // simpler: look for sector link pattern
  const sectorM2 = html.match(/\/screens\/[^"]+"\s*>[^<]*<\/a>\s*›?\s*<a[^>]*>([^<]+)<\/a>/)
    ?? html.match(/Sector[^<]*<\/[^>]+>\s*[^<]*<a[^>]*>([^<]+)<\/a>/i)
  const sector = sectorM2 ? sectorM2[1].trim() : null

  // ── Top Ratios (Market Cap, Price, PE, PB etc.) ──
  const marketCap  = topRatio('Market Cap')
  const currentPrice = topRatio('Current Price')
  const stockPE    = topRatio('Stock P/E')
  const industryPe = topRatio('Industry PE') ?? topRatio('Ind PE')
  const priceToBook= topRatio('Price to Book')
  const dividendYield = topRatio('Dividend Yield')
  const faceValue  = topRatio('Face Value')
  const roce       = topRatio('ROCE')
  const roe        = topRatio('ROE')

  // ── 52 Week High / Low ──
  // Format: "1,234 / 987" in value span after "52 Week High"
  const hlM = html.match(/52\s*Week\s*High[\s\S]{0,300}?([\d,]+\.?\d*)\s*\/\s*([\d,]+\.?\d*)/)
  const high52Week = hlM ? toNum(hlM[1]) : null
  const low52Week  = hlM ? toNum(hlM[2]) : null

  // ── Company Ratios table ──
  const debtToEquity    = tableVal('Debt to equity') ?? tableVal('Debt / Equity')
  const currentRatio    = tableVal('Current ratio')
  const interestCoverage= tableVal('Interest Coverage') ?? tableVal('Int Coverage')
  const opm             = tableVal('OPM')
  const netProfitMargin = tableVal('NPM') ?? tableVal('Net profit margin')
  const eps             = tableVal('EPS in Rs') ?? tableVal('EPS')
  const salesGrowth     = tableVal('Sales growth') ?? tableVal('Sales Growth')
  const salesGrowth3yr  = tableVal('3 Year Sales Growth') ?? tableVal('Sales CAGR 3Yrs')
  const profitGrowth    = tableVal('Profit growth') ?? tableVal('Profit Growth')
  const profitGrowth3yr = tableVal('3 Year Profit Growth') ?? tableVal('Profit CAGR 3Yrs')
  const freeCashFlow    = tableVal('Free Cash Flow') ?? tableVal('FCF')

  // ── Shareholding ──
  const promM = html.match(/Promoters\s*<\/td>\s*<td[^>]*>\s*([\d\.]+)/)
  const promoterHolding = promM ? toNum(promM[1]) : null

  const pledgeM = html.match(/Pledged\s*<\/td>\s*<td[^>]*>\s*([\d\.]+)/)
    ?? html.match(/Pledge\s*percentage\s*<\/td>\s*<td[^>]*>\s*([\d\.]+)/i)
  const pledge = pledgeM ? toNum(pledgeM[1]) : 0

  const result: ScreenerData = {
    name, ticker: ticker.toUpperCase(), sector,
    currentPrice, stockPE, industryPe, priceToBook,
    roe, roce, debtToEquity, promoterHolding, pledge,
    salesGrowth, salesGrowth3yr, profitGrowth, profitGrowth3yr,
    eps, marketCap, high52Week, low52Week, dividendYield,
    opm, netProfitMargin, currentRatio, interestCoverage,
    freeCashFlow, faceValue,
  }

  console.log('📊 Parsed:', JSON.stringify(result, null, 2))
  return result
}

export async function fetchScreenerData(ticker: string): Promise<ScreenerData | null> {
  try {
    const slug = await resolveScreenerSlug(ticker) ?? ticker
    console.log(`🔍 Slug: ${ticker} → ${slug}`)

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
      console.log(`Status [${slug}]: ${res.status}`)
      if (res.ok) {
        const html = await res.text()
        console.log(`HTML size: ${html.length} chars`)
        return parseScreenerHTML(html, slug)
      }
    }
    return null
  } catch (e: any) {
    console.log('Screener error:', e?.message)
    return null
  }
}

export function formatScreenerDataForPrompt(data: ScreenerData): string {
  const v = (val: number | string | null, suffix = '') =>
    val !== null ? `${val}${suffix}` : 'N/A'
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