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

  function toNum(s: string | null | undefined): number | null {
    if (!s) return null
    const clean = s.replace(/,/g, '').replace(/%/g, '').trim()
    const m = clean.match(/-?\d+\.?\d*/)
    return m ? parseFloat(m[0]) : null
  }

  // ✅ Actual HTML:
  // <span class="name">Current Price</span>
  // <span class="nowrap value">
  //   <span class="number">1,160</span>
  // </span>
  function topRatio(label: string): number | null {
    const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const r = new RegExp(
      `<span[^>]*class="[^"]*name[^"]*"[^>]*>[\\s\\S]{0,50}?${esc}[\\s\\S]{0,50}?<\\/span>[\\s\\S]{0,300}?<span[^>]*class="[^"]*number[^"]*"[^>]*>([\\d,\\.]+)<\\/span>`,
      'i'
    )
    const m = html.match(r)
    return m ? toNum(m[1]) : null
  }

  function tableVal(label: string): number | null {
    const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const r = new RegExp(
      `>\\s*${esc}\\s*<\\/td>[\\s\\S]{0,300}?<td[^>]*>\\s*([\\d,\\.\\-]+)`,
      'i'
    )
    const m = html.match(r)
    return m ? toNum(m[1]) : null
  }

  // ── Company name ──
  const nameM = html.match(/<h1[^>]*class="[^"]*h2[^"]*"[^>]*>\s*([^<]+)/)
    ?? html.match(/<h1[^>]*>\s*([^<\n]+)/)
  const name = nameM ? nameM[1].trim() : ticker

  // ── Sector — from breadcrumb ──
  const sectorM = html.match(/\/screens\/[^"]*"[^>]*>([^<]+)<\/a>/i)
  const sector = sectorM ? sectorM[1].trim() : null

  // ── Top Ratios ──
  const currentPrice   = topRatio('Current Price')
  const stockPE        = topRatio('Stock P/E')
  const industryPe     = topRatio('Industry PE') ?? topRatio('Ind PE')
  const priceToBook    = topRatio('Book Value')
  const dividendYield  = topRatio('Dividend Yield')
  const faceValue      = topRatio('Face Value')
  const roce           = topRatio('ROCE')
  const roe            = topRatio('ROE')
  const marketCap      = topRatio('Market Cap')

  // ── 52 Week High / Low ──
  // Actual: <span class="name">High / Low</span>
  //         <span class="number">1,930</span> / <span class="number">1,075</span>
  const hlSection = html.match(/High \/ Low[\s\S]{0,500}?<span[^>]*class="[^"]*number[^"]*"[^>]*>([\d,]+)<\/span>\s*\/\s*<span[^>]*class="[^"]*number[^"]*"[^>]*>([\d,]+)<\/span>/)
  const high52Week = hlSection ? toNum(hlSection[1]) : null
  const low52Week  = hlSection ? toNum(hlSection[2]) : null

  // ── Ratios table ──
  const debtToEquity     = tableVal('Debt to equity') ?? tableVal('Debt / Equity')
  const currentRatio     = tableVal('Current ratio')
  const interestCoverage = tableVal('Interest Coverage') ?? tableVal('Int Coverage')
  const opm              = tableVal('OPM')
  const netProfitMargin  = tableVal('NPM') ?? tableVal('Net profit margin')
  const eps              = tableVal('EPS in Rs') ?? tableVal('EPS')
  const salesGrowth      = tableVal('Sales growth') ?? tableVal('Sales Growth')
  const salesGrowth3yr   = tableVal('3 Year Sales Growth') ?? tableVal('Sales CAGR 3Yrs')
  const profitGrowth     = tableVal('Profit growth') ?? tableVal('Profit Growth')
  const profitGrowth3yr  = tableVal('3 Year Profit Growth') ?? tableVal('Profit CAGR 3Yrs')
  const freeCashFlow     = tableVal('Free Cash Flow') ?? tableVal('FCF')

  // ── Shareholding ──
  // Actual: Promoters&nbsp;<span>+</span></button></td><td>14.94%</td>
  const promM = html.match(/Promoters[^<]*<span[^>]*>[^<]*<\/span>\s*<\/button>\s*<\/td>[\s\S]{0,200}?<td>([\d\.]+)%<\/td>/)
  const promoterHolding = promM ? toNum(promM[1]) : null

  const pledgeM = html.match(/Pledged\s*percentage[\s\S]{0,200}?<td>([\d\.]+)%?<\/td>/i)
    ?? html.match(/Pledge[\s\S]{0,100}?<td>([\d\.]+)%?<\/td>/i)
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

const i1 = html.indexOf('Debt to equity')
if (i1 !== -1) console.log('DEBT_SNIPPET:', html.slice(i1 - 50, i1 + 200))

const i2 = html.indexOf('OPM')
if (i2 !== -1) console.log('OPM_SNIPPET:', html.slice(i2 - 50, i2 + 200))

const i3 = html.indexOf('Sales growth')
if (i3 !== -1) console.log('SALES_SNIPPET:', html.slice(i3 - 50, i3 + 200))

const i4 = html.indexOf('Industry PE')
if (i4 !== -1) console.log('INDPE_SNIPPET:', html.slice(i4 - 50, i4 + 200))

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