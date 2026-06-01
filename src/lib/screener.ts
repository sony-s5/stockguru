// lib/screener.ts
// ─────────────────────────────────────────────────────────────────────────────
// Strategy:
//   1. Screener.in /api/company/search/ → resolve slug
//   2. Screener.in HTML fetch (consolidated → standalone)
//      → parse static fields (top-ratios, company header, growth tables)
//   3. NSE India API → fills sector, D/E, currentRatio, OPM, netMargin, industryPE
//   4. Merge: Screener primary, NSE fills nulls
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────────────────────────────────────
function toNum(s: string | null | undefined): number | null {
  if (s === null || s === undefined) return null
  const clean = s.replace(/,/g, '').replace(/%/g, '').trim()
  if (clean === '' || clean === '-' || clean === '--' || clean.toLowerCase() === 'na') return null
  const m = clean.match(/-?\d+\.?\d*/)
  return m ? parseFloat(m[0]) : null
}

function escRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const SCREENER_HEADERS = {
  'User-Agent':       'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept':           'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language':  'en-US,en;q=0.9',
  'Accept-Encoding':  'gzip, deflate, br',
  'Referer':          'https://www.screener.in/',
  'Connection':       'keep-alive',
  'Upgrade-Insecure-Requests': '1',
}

const NSE_HEADERS = {
  'User-Agent':   'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept':       'application/json, text/plain, */*',
  'Referer':      'https://www.nseindia.com/',
  'Accept-Language': 'en-US,en;q=0.9',
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Screener slug resolver
// ─────────────────────────────────────────────────────────────────────────────
async function resolveScreenerSlug(query: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://www.screener.in/api/company/search/?q=${encodeURIComponent(query)}&v=3`,
      { headers: SCREENER_HEADERS, cache: 'no-store' }
    )
    if (!res.ok) return null
    const data = await res.json()
    if (Array.isArray(data) && data.length > 0) {
      const match = data[0].url?.match(/\/company\/([^/]+)\//)
      if (match) {
        console.log(`✅ Slug resolved: ${query} → ${match[1]}`)
        return match[1]
      }
    }
    return null
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. NSE India API — fills gaps Screener HTML misses
// ─────────────────────────────────────────────────────────────────────────────
interface NSEData {
  sector:          string | null
  industryPe:      number | null
  opm:             number | null
  netProfitMargin: number | null
  debtToEquity:    number | null
  currentRatio:    number | null
  eps:             number | null
  bookValue:       number | null
  pbRatio:         number | null
  fiiHolding:      number | null
  diiHolding:      number | null
}

async function fetchNSEData(ticker: string): Promise<NSEData | null> {
  try {
    // NSE requires a cookie session first
    const cookieRes = await fetch('https://www.nseindia.com', {
      headers: NSE_HEADERS,
      cache: 'no-store',
    })
    const cookies = cookieRes.headers.get('set-cookie') ?? ''

    const headers = { ...NSE_HEADERS, Cookie: cookies }

    // Quote + fundamentals
    const [quoteRes, fundRes] = await Promise.allSettled([
      fetch(`https://www.nseindia.com/api/quote-equity?symbol=${encodeURIComponent(ticker)}`, {
        headers, cache: 'no-store',
      }),
      fetch(`https://www.nseindia.com/api/fundamentals/securities?symbol=${encodeURIComponent(ticker)}&series=EQ`, {
        headers, cache: 'no-store',
      }),
    ])

    let quote: any = null
    let fund: any = null

    if (quoteRes.status === 'fulfilled' && quoteRes.value.ok) {
      quote = await quoteRes.value.json().catch(() => null)
    }
    if (fundRes.status === 'fulfilled' && fundRes.value.ok) {
      fund = await fundRes.value.json().catch(() => null)
    }

    if (!quote && !fund) return null

    const metadata = quote?.metadata ?? {}
    const securityInfo = quote?.securityInfo ?? {}
    const industryInfo = quote?.industryInfo ?? {}
    const priceInfo = quote?.priceInfo ?? {}

    // Fundamentals endpoint
    const ratios = fund?.data?.[0] ?? {}

    const result: NSEData = {
      sector:          industryInfo.industry ?? industryInfo.macro ?? metadata.industry ?? null,
      industryPe:      toNum(String(ratios.industryPE ?? ratios.industryPe ?? '')),
      opm:             toNum(String(ratios.ebitdaMarginFY ?? ratios.pbndtAnnualised ?? '')),
      netProfitMargin: toNum(String(ratios.profitAfterTaxMargin ?? ratios.patMarginFY ?? '')),
      debtToEquity:    toNum(String(ratios.debtEquityRatio ?? ratios.debtEquity ?? '')),
      currentRatio:    toNum(String(ratios.currentRatio ?? '')),
      eps:             toNum(String(ratios.basicEPS ?? ratios.eps ?? priceInfo.eps ?? '')),
      bookValue:       toNum(String(ratios.bookValuePerShare ?? '')),
      pbRatio:         toNum(String(ratios.pbRatio ?? '')),
      fiiHolding:      toNum(String(ratios.fiiHolding ?? '')),
      diiHolding:      toNum(String(ratios.diiHolding ?? '')),
    }

    console.log('📈 NSE data:', JSON.stringify(result, null, 2))
    return result
  } catch (e: any) {
    console.log('NSE fetch error:', e?.message)
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Screener HTML parser
// ─────────────────────────────────────────────────────────────────────────────
function parseScreenerHTML(html: string, ticker: string): ScreenerData {

  // ── top-ratios: <ul id="top-ratios"> ─────────────────────────────────────
  // Actual Screener HTML structure (verified):
  // <li>
  //   <span class="name">Market Cap</span>
  //   <span class="nowrap value"><span class="number">4,70,821</span> <span class="sub">Cr.</span></span>
  // </li>
  function topRatio(label: string): number | null {
    const esc = escRe(label)
    // Pattern A: exact span.name match → next span.number within 500 chars
    const rA = new RegExp(
      `<span[^>]*class="[^"]*\\bname\\b[^"]*"[^>]*>\\s*${esc}\\s*<\\/span>[\\s\\S]{0,600}?<span[^>]*class="[^"]*\\bnumber\\b[^"]*"[^>]*>([\\d,\\.]+)<\\/span>`,
      'i'
    )
    const mA = html.match(rA)
    if (mA) return toNum(mA[1])

    // Pattern B: label in <li> text node
    const rB = new RegExp(
      `>${esc}<\\/[^>]+>[\\s\\S]{0,400}?<span[^>]*class="[^"]*\\bnumber\\b[^"]*"[^>]*>([\\d,\\.]+)<\\/span>`,
      'i'
    )
    const mB = html.match(rB)
    return mB ? toNum(mB[1]) : null
  }

  // ── Company Name ─────────────────────────────────────────────────────────
  const nameM =
    html.match(/<h1[^>]*class="[^"]*h2[^"]*"[^>]*>\s*([^<]+)/) ??
    html.match(/<h1[^>]*>\s*([^<\n]+)/)
  const name = nameM ? nameM[1].trim() : ticker

  // ── Sector from breadcrumb ────────────────────────────────────────────────
  // Screener: <a href="/screens/.../">IT Services</a>
  function extractSector(): string | null {
    const allLinks = [...html.matchAll(/href="\/screens\/([^"]+)"[^>]*>\s*([^<]+?)\s*<\/a>/gi)]
    const skip = new Set(['All Companies', 'Screener', 'Home', 'NSE', 'BSE', 'Indices'])
    for (const m of allLinks) {
      const text = m[2].trim()
      if (text && !skip.has(text) && text.length > 2) return text
    }
    // Fallback: meta description or og:description sometimes has sector
    const metaM = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i)
    if (metaM) {
      const desc = metaM[1]
      const sectorMatch = desc.match(/(?:sector|industry)[:\s]+([A-Za-z][^,.]+)/i)
      if (sectorMatch) return sectorMatch[1].trim()
    }
    return null
  }

  // ── 52W High / Low ────────────────────────────────────────────────────────
  const hlM = html.match(
    /High\s*\/\s*Low[^>]*>[\s\S]{0,500}?<span[^>]*class="[^"]*number[^"]*"[^>]*>([\d,]+)<\/span>\s*\/\s*<span[^>]*class="[^"]*number[^"]*"[^>]*>([\d,]+)<\/span>/i
  )
  const high52Week = hlM ? toNum(hlM[1]) : null
  const low52Week  = hlM ? toNum(hlM[2]) : null

  // ── Top ratios ─────────────────────────────────────────────────────────────
  const currentPrice  = topRatio('Current Price')
  const stockPE       = topRatio('Stock P/E')
  const dividendYield = topRatio('Dividend Yield')
  const faceValue     = topRatio('Face Value')
  const roce          = topRatio('ROCE')
  const roe           = topRatio('ROE')
  const marketCap     = topRatio('Market Cap')

  // Industry PE — Screener shows as "Ind. P/E"
  const industryPe =
    topRatio('Ind. P/E') ??
    topRatio('Industry P/E') ??
    topRatio('Ind P/E') ??
    topRatio('Ind PE')

  // P/B = CMP ÷ Book Value Per Share (Screener shows Book Value, not P/B directly)
  const bookValuePerShare = topRatio('Book Value')
  const priceToBook = (currentPrice && bookValuePerShare && bookValuePerShare > 0)
    ? parseFloat((currentPrice / bookValuePerShare).toFixed(2))
    : null

  // ── Ratios table parser ───────────────────────────────────────────────────
  // Screener #ratios section: annual columns, leftmost data col = most recent FY
  // Row structure (two variants):
  //   <td class="text"><a href="/define/...">OPM %</a></td><td>28</td><td>30</td>...
  //   <td class="text">Debt to equity</td><td>0.06</td>...
  // We want the LAST non-empty column (TTM / most recent FY)
  function ratioTableLatest(label: string): number | null {
    const esc = escRe(label)

    // Extract the #ratios section first for accuracy
    const ratioSection = (() => {
      const m = html.match(/id="ratios"[\s\S]{0,80000}?(?=id="shareholding"|id="profit-loss"|id="balance-sheet"|<\/section>)/i)
      return m ? m[0] : html
    })()

    // Pattern: label in td (with optional <a> wrapper) → collect all following tds in same row
    const rowR = new RegExp(
      `<td[^>]*>(?:<a[^>]*>)?\\s*${esc}\\s*(?:<\\/a>)?<\\/td>([\\s\\S]{0,3000}?)<\\/tr>`,
      'i'
    )
    const rowM = ratioSection.match(rowR)
    if (!rowM) return null

    const tds = [...rowM[1].matchAll(/<td[^>]*>\s*(-?[\d,\.]+)\s*<\/td>/gi)]
    if (tds.length === 0) return null

    // Last non-null value = most recent
    for (let i = tds.length - 1; i >= 0; i--) {
      const v = toNum(tds[i][1])
      if (v !== null) return v
    }
    return null
  }

  // ── OPM, Net Margin ──────────────────────────────────────────────────────
  const opm =
    ratioTableLatest('OPM %') ??
    ratioTableLatest('OPM') ??
    ratioTableLatest('Operating Profit Margin') ??
    ratioTableLatest('EBITDA Margin')

  const netProfitMargin =
    ratioTableLatest('NPM %') ??
    ratioTableLatest('NPM') ??
    ratioTableLatest('Net profit margin') ??
    ratioTableLatest('Net Profit %') ??
    ratioTableLatest('PAT Margin')

  // ── Debt to Equity ───────────────────────────────────────────────────────
  function debtToEquityVal(): number | null {
    const labels = ['Debt to equity', 'Debt / Equity', 'D/E Ratio', 'Debt to Equity']
    for (const label of labels) {
      const val = ratioTableLatest(label)
      if (val !== null) return val
    }
    if (/debt\s*free|debt-free|zero\s*debt/i.test(html)) return 0
    return null
  }

  // ── Current Ratio ─────────────────────────────────────────────────────────
  const currentRatio =
    ratioTableLatest('Current ratio') ??
    ratioTableLatest('Current Ratio')

  // ── Interest Coverage ─────────────────────────────────────────────────────
  const interestCoverage =
    ratioTableLatest('Interest Coverage Ratio') ??
    ratioTableLatest('Interest Coverage') ??
    ratioTableLatest('Int Coverage')

  // ── EPS from annual P&L table ─────────────────────────────────────────────
  function annualTableVal(label: string): number | null {
    const esc = escRe(label)
    // Scope to profit-loss section
    const sectionM = html.match(/id="profit-loss"[\s\S]{0,60000}?(?=id="balance-sheet"|id="ratios")/i)
    const section = sectionM ? sectionM[0] : html

    const rowR = new RegExp(
      `<td[^>]*>\\s*(?:<[^>]+>)?\\s*${esc}\\s*(?:<\\/[^>]+>)?\\s*<\\/td>([\\s\\S]{0,3000}?)<\\/tr>`,
      'i'
    )
    const rowM = section.match(rowR)
    if (!rowM) return null

    const tds = [...rowM[1].matchAll(/<td[^>]*>\s*(-?[\d,\.]+)\s*<\/td>/gi)]
    if (tds.length === 0) return null
    // Last column = most recent year
    for (let i = tds.length - 1; i >= 0; i--) {
      const v = toNum(tds[i][1])
      if (v !== null) return v
    }
    return null
  }

  const eps =
    annualTableVal('EPS in Rs') ??
    annualTableVal('EPS (in Rs)') ??
    ratioTableLatest('EPS in Rs') ??
    ratioTableLatest('EPS')

  // ── Compounded Growth Tables ──────────────────────────────────────────────
  // <h3>Compounded Sales Growth</h3>
  // <table><tr><td>3 Years:</td><td>8%</td></tr><tr><td>TTM:</td><td>10%</td></tr>
  function growthTableVal(sectionTitle: string, period: string): number | null {
    const titleEsc = escRe(sectionTitle)
    const periodEsc = escRe(period)
    const r = new RegExp(
      `${titleEsc}[\\s\\S]{0,2000}?<td[^>]*>\\s*${periodEsc}[\\s\\S]{0,150}?<\\/td>\\s*<td[^>]*>\\s*(-?[\\d,\\.]+)\\s*%?\\s*<\\/td>`,
      'i'
    )
    const m = html.match(r)
    return m ? toNum(m[1]) : null
  }

  const salesGrowth =
    growthTableVal('Compounded Sales Growth', 'TTM') ??
    growthTableVal('Sales Growth', 'TTM') ??
    ratioTableLatest('Sales growth') ??
    ratioTableLatest('Revenue growth')

  const salesGrowth3yr =
    growthTableVal('Compounded Sales Growth', '3 Years') ??
    growthTableVal('Compounded Sales Growth', '3 Yrs')

  const profitGrowth =
    growthTableVal('Compounded Profit Growth', 'TTM') ??
    growthTableVal('Profit Growth', 'TTM') ??
    ratioTableLatest('Profit growth') ??
    ratioTableLatest('PAT growth')

  const profitGrowth3yr =
    growthTableVal('Compounded Profit Growth', '3 Years') ??
    growthTableVal('Compounded Profit Growth', '3 Yrs')

  // ── Free Cash Flow ────────────────────────────────────────────────────────
  const freeCashFlow = (() => {
    const v = ratioTableLatest('Free Cash Flow') ?? ratioTableLatest('FCF')
    if (v !== null) return v
    // Cash flow section: Cash from Operations row
    const cfM = html.match(
      /Cash from Operations[\s\S]{0,200}?<td[^>]*>\s*([\d,\.\-]+)\s*<\/td>/i
    )
    return cfM ? toNum(cfM[1]) : null
  })()

  // ── Promoter Holding ──────────────────────────────────────────────────────
  // Screener shareholding table:
  // <tr><td class="text"><button ...>Promoters</button></td><td>14.94%</td>...
  // We want the LATEST quarter (last column) or first column if only one
  function promoterHoldingVal(): number | null {
    // Find the promoters row in shareholding section
    const shareSection = html.match(/id="shareholding"[\s\S]{0,20000}?(?=id="|<\/section>)/i)
    const scope = shareSection ? shareSection[0] : html

    const rowR = /Promoters[\s\S]{0,500}?<\/td>([\s\S]{0,2000}?)<\/tr>/i
    const rowM = scope.match(rowR)
    if (!rowM) {
      // Fallback: simple pattern
      const simple = html.match(/Promoters[\s\S]{0,300}?<td[^>]*>\s*([\d\.]+)%/)
      return simple ? toNum(simple[1]) : null
    }
    // Get all % values from the row — use latest (last)
    const vals = [...rowM[1].matchAll(/<td[^>]*>\s*([\d\.]+)%?\s*<\/td>/gi)]
    if (vals.length === 0) return null
    return toNum(vals[vals.length - 1][1])
  }

  // ── Pledge ────────────────────────────────────────────────────────────────
  function pledgeVal(): number {
    const pledgeM =
      html.match(/Pledged\s*percentage[\s\S]{0,300}?<td[^>]*>\s*([\d\.]+)%?/i) ??
      html.match(/Pledge[^<]{0,30}<\/(?:td|button)[^>]*>[\s\S]{0,200}?<td[^>]*>\s*([\d\.]+)%?/i)
    return pledgeM ? (toNum(pledgeM[1]) ?? 0) : 0
  }

  const result: ScreenerData = {
    name,
    ticker:           ticker.toUpperCase(),
    sector:           extractSector(),
    currentPrice,
    stockPE,
    industryPe,
    priceToBook,
    roe,
    roce,
    debtToEquity:     debtToEquityVal(),
    promoterHolding:  promoterHoldingVal(),
    pledge:           pledgeVal(),
    salesGrowth,
    salesGrowth3yr,
    profitGrowth,
    profitGrowth3yr,
    eps,
    marketCap,
    high52Week,
    low52Week,
    dividendYield,
    opm,
    netProfitMargin,
    currentRatio,
    interestCoverage,
    freeCashFlow,
    faceValue,
  }

  const nullFields = Object.entries(result).filter(([, v]) => v === null).map(([k]) => k)
  if (nullFields.length > 0) console.log(`⚠️ NULL after Screener parse [${ticker}]:`, nullFields.join(', '))

  console.log('📊 Parsed:', JSON.stringify(result, null, 2))
  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Merge: Screener primary + NSE fills nulls
// ─────────────────────────────────────────────────────────────────────────────
function mergeWithNSE(screener: ScreenerData, nse: NSEData | null): ScreenerData {
  if (!nse) return screener

  const fill = <T>(a: T | null, b: T | null): T | null => (a !== null ? a : b)

  const merged: ScreenerData = {
    ...screener,
    sector:          fill(screener.sector,          nse.sector),
    industryPe:      fill(screener.industryPe,      nse.industryPe),
    opm:             fill(screener.opm,             nse.opm),
    netProfitMargin: fill(screener.netProfitMargin, nse.netProfitMargin),
    debtToEquity:    fill(screener.debtToEquity,    nse.debtToEquity),
    currentRatio:    fill(screener.currentRatio,    nse.currentRatio),
    eps:             fill(screener.eps,             nse.eps),
    priceToBook:     fill(screener.priceToBook,     nse.pbRatio),
  }

  const stillNull = Object.entries(merged).filter(([, v]) => v === null).map(([k]) => k)
  if (stillNull.length > 0) console.log(`⚠️ Still NULL after NSE merge:`, stillNull.join(', '))
  else console.log('✅ All fields resolved after merge')

  return merged
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Public API
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchScreenerData(ticker: string): Promise<ScreenerData | null> {
  try {
    const slug = await resolveScreenerSlug(ticker) ?? ticker
    console.log(`🔍 Resolved slug: ${ticker} → ${slug}`)

    // Fetch Screener HTML + NSE in parallel
    const [screenerResult, nseResult] = await Promise.allSettled([
      (async () => {
        const urls = [
          `https://www.screener.in/company/${slug}/consolidated/`,
          `https://www.screener.in/company/${slug}/`,
        ]
        for (const url of urls) {
          console.log(`🌐 Fetching: ${url}`)
          const res = await fetch(url, {
            headers: SCREENER_HEADERS,
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
      })(),
      fetchNSEData(ticker),
    ])

    const screenerData = screenerResult.status === 'fulfilled' ? screenerResult.value : null
    const nseData      = nseResult.status === 'fulfilled'      ? nseResult.value      : null

    if (!screenerData && !nseData) {
      console.log('❌ Both Screener and NSE failed')
      return null
    }

    if (!screenerData && nseData) {
      console.log('⚠️ Screener failed, using NSE data only')
      // Build minimal ScreenerData from NSE
      return {
        name:             ticker,
        ticker:           ticker.toUpperCase(),
        sector:           nseData.sector,
        currentPrice:     null,
        stockPE:          null,
        industryPe:       nseData.industryPe,
        priceToBook:      nseData.pbRatio,
        roe:              null,
        roce:             null,
        debtToEquity:     nseData.debtToEquity,
        promoterHolding:  null,
        pledge:           0,
        salesGrowth:      null,
        salesGrowth3yr:   null,
        profitGrowth:     null,
        profitGrowth3yr:  null,
        eps:              nseData.eps,
        marketCap:        null,
        high52Week:       null,
        low52Week:        null,
        dividendYield:    null,
        opm:              nseData.opm,
        netProfitMargin:  nseData.netProfitMargin,
        currentRatio:     nseData.currentRatio,
        interestCoverage: null,
        freeCashFlow:     null,
        faceValue:        null,
      }
    }

    return mergeWithNSE(screenerData!, nseData)
  } catch (e: any) {
    console.log('fetchScreenerData error:', e?.message)
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Format for AI prompt
// ─────────────────────────────────────────────────────────────────────────────
export function formatScreenerDataForPrompt(data: ScreenerData): string {
  const v = (val: number | string | null, suffix = '') =>
    val !== null && val !== undefined ? `${val}${suffix}` : 'N/A'

  const debtDisplay =
    data.debtToEquity === 0   ? '0x (Debt-Free)' :
    data.debtToEquity !== null ? `${data.debtToEquity}x` : 'N/A'

  return `
VERIFIED DATA FROM SCREENER.IN + NSE:
Company:      ${data.name} (${data.ticker})
Sector:       ${v(data.sector)}
CMP:          ₹${v(data.currentPrice)} | Market Cap: ₹${v(data.marketCap)} Cr
52W Range:    ₹${v(data.low52Week)} – ₹${v(data.high52Week)}
VALUATION:    PE ${v(data.stockPE)}x | Industry PE ${v(data.industryPe)}x | P/B ${v(data.priceToBook)}x | EPS ₹${v(data.eps)} | Div Yield ${v(data.dividendYield)}%
PROFITABILITY: ROE ${v(data.roe)}% | ROCE ${v(data.roce)}% | OPM ${v(data.opm)}% | Net Margin ${v(data.netProfitMargin)}%
GROWTH:       Sales TTM ${v(data.salesGrowth)}% | 3yr CAGR ${v(data.salesGrowth3yr)}% | Profit TTM ${v(data.profitGrowth)}% | 3yr CAGR ${v(data.profitGrowth3yr)}%
BALANCE SHEET: D/E ${debtDisplay} | Current Ratio ${v(data.currentRatio)}x | Interest Coverage ${v(data.interestCoverage)}x | FCF ₹${v(data.freeCashFlow)} Cr
OWNERSHIP:    Promoter ${v(data.promoterHolding)}% | Pledge ${v(data.pledge)}%
`.trim()
}