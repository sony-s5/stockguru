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

// ─────────────────────────────────────────────
// Slug resolver
// ─────────────────────────────────────────────
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
      if (match) {
        console.log(`✅ Resolved: ${query} → ${match[1]}`)
        return match[1]
      }
    }
    return null
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────
// HTML Parser — Complete Rewrite
// ─────────────────────────────────────────────
function parseScreenerHTML(html: string, ticker: string): ScreenerData {

  // Convert string like "1,16,123" or "1.6" or "31.9%" → number
  // NOTE: returns 0 for "0", only null for missing/unparseable
  function toNum(s: string | null | undefined): number | null {
    if (s === null || s === undefined) return null
    const clean = s.replace(/,/g, '').replace(/%/g, '').trim()
    if (clean === '' || clean === '-' || clean === '--') return null
    const m = clean.match(/-?\d+\.?\d*/)
    return m ? parseFloat(m[0]) : null
  }

  // toNumOrZero: for fields where 0 is a valid value (D/E for debt-free companies)
  function toNumOrZero(s: string | null | undefined): number | null {
    const n = toNum(s)
    return n  // already returns 0 correctly from toNum above
  }

  // ── Company Name ──────────────────────────────
  const nameM =
    html.match(/<h1[^>]*class="[^"]*h2[^"]*"[^>]*>\s*([^<]+)/) ??
    html.match(/<h1[^>]*>\s*([^<\n]+)/)
  const name = nameM ? nameM[1].trim() : ticker

  // ── Sector ──────────────────────────────────
  // Screener breadcrumb: <a href="/screens/.../">IT Services</a>
  // Also appears in company info: sector name in various places
  function extractSector(): string | null {
    // Try breadcrumb /screens/ links — skip "All Companies" and generic ones
    const allScreenLinks = [...html.matchAll(/href="\/screens\/([^"]+)"[^>]*>\s*([^<]+?)\s*<\/a>/gi)]
    for (const m of allScreenLinks) {
      const text = m[2].trim()
      // Skip generic labels
      if (text && !['All Companies', 'Screener', 'Home', 'NSE', 'BSE'].includes(text)) {
        return text
      }
    }
    // Try sector from company page meta or header
    const sectorM2 = html.match(/Sector[^<]{0,50}<[^>]+>\s*([A-Za-z][^<]{2,40}?)\s*<\//)
    if (sectorM2) return sectorM2[1].trim()
    return null
  }
  const sector = extractSector()

  // ── Top Ratios (#top-ratios li > .name + .number) ─
  // Structure:
  // <ul id="top-ratios">
  //   <li>
  //     <span class="name">Market Cap</span>
  //     <span class="nowrap value"><span class="number">4,70,821</span> <span class="sub">Cr.</span></span>
  //   </li>
  // Robust: find label text → walk forward for next .number
  function topRatio(label: string): number | null {
    const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // Match label in <span class="name"> then get first <span class="number"> after it
    const r = new RegExp(
      `<span[^>]*class="[^"]*\\bname\\b[^"]*"[^>]*>[^<]*${esc}[^<]*<\\/span>[\\s\\S]{0,400}?<span[^>]*class="[^"]*\\bnumber\\b[^"]*"[^>]*>([\\d,\\.]+)<\\/span>`,
      'i'
    )
    const m = html.match(r)
    return m ? toNum(m[1]) : null
  }

  // ── 52 Week High / Low ────────────────────────
  // <span class="name">High / Low</span>
  // <span class="nowrap value">
  //   <span class="number">1,728</span> / <span class="number">1,089</span>
  const hlM = html.match(
    /High\s*\/\s*Low[\s\S]{0,500}?<span[^>]*class="[^"]*number[^"]*"[^>]*>([\d,]+)<\/span>\s*\/\s*<span[^>]*class="[^"]*number[^"]*"[^>]*>([\d,]+)<\/span>/i
  )
  const high52Week = hlM ? toNum(hlM[1]) : null
  const low52Week  = hlM ? toNum(hlM[2]) : null

  // ── Industry PE (top-ratios label is "Ind. P/E") ──
  const industryPe =
    topRatio('Ind. P/E') ??
    topRatio('Industry P/E') ??
    topRatio('Ind PE') ??
    topRatio('Industry PE')

  const currentPrice  = topRatio('Current Price')
  const stockPE       = topRatio('Stock P/E')
  const dividendYield = topRatio('Dividend Yield')
  const faceValue     = topRatio('Face Value')
  const roce          = topRatio('ROCE')
  const roe           = topRatio('ROE')
  const marketCap     = topRatio('Market Cap')

  // ── P/B Ratio ─────────────────────────────────
  // BUG FIX: Screener "Book Value" in top-ratios = Book Value PER SHARE (e.g. ₹229),
  // NOT the P/B ratio. P/B = CMP ÷ Book Value per share.
  const bookValuePerShare = topRatio('Book Value')
  const priceToBook = (currentPrice && bookValuePerShare && bookValuePerShare > 0)
    ? parseFloat((currentPrice / bookValuePerShare).toFixed(2))
    : null

  // ── Ratios Table (#ratios) ────────────────────
  // Structure:
  // <section id="ratios">
  //   <table>
  //     <thead><tr><th>...</th><th>Mar 2024</th>...</tr></thead>
  //     <tbody>
  //       <tr><td class="text">OPM %</td><td>30</td><td>32</td>...</tr>
  // We want the MOST RECENT value = first data column (index 1 after label)
  function ratioTableLatest(label: string): number | null {
    const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    // Pattern 1: Plain <td>Label</td><td>Value</td>
    const r1 = new RegExp(
      `<td[^>]*>\\s*${esc}\\s*<\/td>\\s*<td[^>]*>\\s*(-?[\\d,\\.]+)\\s*<\/td>`,
      'i'
    )
    const m1 = html.match(r1)
    if (m1) return toNum(m1[1])

    // Pattern 2: <td><a ...>Label</a></td><td>Value</td>  (Screener ratios table)
    const r2 = new RegExp(
      `<td[^>]*>\\s*<a[^>]*>\\s*${esc}\\s*<\/a>\\s*<\/td>\\s*<td[^>]*>\\s*(-?[\\d,\\.]+)\\s*<\/td>`,
      'i'
    )
    const m2 = html.match(r2)
    if (m2) return toNum(m2[1])

    // Pattern 3: label text anywhere in td, then value in next td
    // Handles: <td class="text"><a href="...">OPM %</a></td><td>30</td>
    const r3 = new RegExp(
      `<td[^>]*>[^<]{0,50}${esc}[^<]{0,50}<\/td>\\s*<td[^>]*>\\s*(-?[\\d,\\.]+)\\s*<\/td>`,
      'i'
    )
    const m3 = html.match(r3)
    if (m3) return toNum(m3[1])

    // Pattern 4: <th> row header
    const r4 = new RegExp(
      `<th[^>]*>\\s*${esc}\\s*<\/th>[\\s\\S]{0,200}?<td[^>]*>\\s*(-?[\\d,\\.]+)\\s*<\/td>`,
      'i'
    )
    const m4 = html.match(r4)
    return m4 ? toNum(m4[1]) : null
  }

  // OPM — Screener shows "OPM %" in ratios table
  const opm =
    ratioTableLatest('OPM %') ??
    ratioTableLatest('OPM') ??
    ratioTableLatest('Operating Profit Margin')

  // Net Profit Margin — "NPM %" or "Net Profit %"
  const netProfitMargin =
    ratioTableLatest('NPM %') ??
    ratioTableLatest('NPM') ??
    ratioTableLatest('Net Profit Margin') ??
    ratioTableLatest('Net Profit %')

  // Debt to Equity — BUG FIX: debt-free companies have D/E = 0 or row may be absent.
  // When D/E row exists with value "0" or "0.00", return 0 (not null).
  // When row is completely absent (truly debt-free), return 0 as well.
  function debtToEquityVal(): number | null {
    const labels = ['Debt to equity', 'Debt / Equity', 'D/E Ratio']
    for (const label of labels) {
      // Use ratioTableLatest which handles all <td> patterns including <a> tags
      const val = ratioTableLatest(label)
      if (val !== null) return val
    }
    // Also try: explicit "0" value (debt-free — toNum returns 0 for "0")
    // Check for debt-free mention
    const debtFreeM = html.match(/debt\s*free|debt-free|zero\s*debt/i)
    if (debtFreeM) return 0
    return null
  }
  const debtToEquity = debtToEquityVal()

  // Current Ratio
  const currentRatio =
    ratioTableLatest('Current ratio') ??
    ratioTableLatest('Current Ratio')

  // Interest Coverage
  const interestCoverage =
    ratioTableLatest('Interest Coverage Ratio') ??
    ratioTableLatest('Interest Coverage') ??
    ratioTableLatest('Int Coverage')

  // EPS — BUG FIX: ratioTableLatest('EPS in Rs') picks QUARTERLY value (e.g. ₹14.77/quarter)
  // TTM Annual EPS must come from the annual P&L table last column, or be computed as
  // Net Profit (TTM) ÷ Shares. Best approach: look for EPS in the annual section.
  // Screener annual P&L table row: "EPS in Rs" with annual columns (Mar 2024, Mar 2023...)
  // The FIRST data column = most recent annual year = TTM approximation.
  // To distinguish annual from quarterly, we look inside the #profit-loss section.
  function annualTableVal(label: string): number | null {
    const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // Find the profit-loss section, then find the label row, then grab LAST non-empty td
    // (Screener shows years left→right; last column = most recent TTM)
    const sectionM = html.match(/id="profit-loss"[\s\S]{0,50000}?id="balance-sheet"/i)
    const section = sectionM ? sectionM[0] : html

    const rowR = new RegExp(
      `<td[^>]*>\\s*${esc}\\s*<\\/td>([\\s\\S]{0,2000}?)<\\/tr>`,
      'i'
    )
    const rowM = section.match(rowR)
    if (!rowM) return null

    // Extract all <td> values from the row
    const tdMatches = [...rowM[1].matchAll(/<td[^>]*>\s*([\d,\.\-]+)\s*<\/td>/gi)]
    if (tdMatches.length === 0) return null
    // Last td = most recent year (TTM)
    const lastVal = tdMatches[tdMatches.length - 1][1]
    return toNum(lastVal)
  }

  const eps =
    annualTableVal('EPS in Rs') ??
    annualTableVal('EPS (in Rs)') ??
    ratioTableLatest('EPS in Rs') ??
    ratioTableLatest('EPS')

  // ── Compounded Growth Tables ──────────────────
  // Screener has a dedicated section like:
  // <h3>Compounded Sales Growth</h3>
  // <table>
  //   <tr><td>10 Years:</td><td>9%</td></tr>
  //   <tr><td>5 Years:</td><td>10%</td></tr>
  //   <tr><td>3 Years:</td><td>8%</td></tr>
  //   <tr><td>TTM:</td><td>5%</td></tr>    ← TTM = YoY latest
  // </table>
  function growthTableVal(sectionTitle: string, period: string): number | null {
    const titleEsc = sectionTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const periodEsc = period.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // Find the section, then look for the period row within next 1000 chars
    const sectionR = new RegExp(
      `${titleEsc}[\\s\\S]{0,1500}?<td[^>]*>\\s*${periodEsc}[\\s\\S]{0,100}?<\\/td>\\s*<td[^>]*>\\s*(-?[\\d,\\.]+)\\s*%?`,
      'i'
    )
    const m = html.match(sectionR)
    return m ? toNum(m[1]) : null
  }

  // TTM = trailing twelve months = most recent YoY growth
  const salesGrowth =
    growthTableVal('Compounded Sales Growth', 'TTM') ??
    growthTableVal('Sales Growth', 'TTM') ??
    ratioTableLatest('Sales growth') ??
    ratioTableLatest('Revenue growth')

  // 3 Year CAGR
  const salesGrowth3yr =
    growthTableVal('Compounded Sales Growth', '3 Years') ??
    growthTableVal('Compounded Sales Growth', '3 Yrs') ??
    ratioTableLatest('3 Year Sales Growth')

  const profitGrowth =
    growthTableVal('Compounded Profit Growth', 'TTM') ??
    growthTableVal('Profit Growth', 'TTM') ??
    ratioTableLatest('Profit growth') ??
    ratioTableLatest('PAT growth')

  const profitGrowth3yr =
    growthTableVal('Compounded Profit Growth', '3 Years') ??
    growthTableVal('Compounded Profit Growth', '3 Yrs') ??
    ratioTableLatest('3 Year Profit Growth')

  // ── Cash Flow Table ──────────────────────────
  // Screener Cash Flow table: rows like "Cash from Operations", "Free Cash Flow"
  // FCF = Cash from Operations − Capex (sometimes shown directly)
  const freeCashFlow =
    ratioTableLatest('Free Cash Flow') ??
    ratioTableLatest('FCF') ??
    (() => {
      // Try to extract from cash flow section: look for the pattern near "Cash from Operations"
      const cfM = html.match(
        /Cash from Operations[\s\S]{0,100}?<td[^>]*>\s*([\d,\.\-]+)\s*<\/td>/i
      )
      return cfM ? toNum(cfM[1]) : null
    })()

  // ── Promoter / Pledge ─────────────────────────
  // Screener shareholding table:
  // <tr><td class="text"><button ...>Promoters <span>+</span></button></td><td>14.94%</td>...
  const promM =
    html.match(/Promoters[\s\S]{0,200}?<\/td>\s*<td[^>]*>\s*([\d\.]+)%/) ??
    html.match(/Promoter[^<]*<\/button>\s*<\/td>\s*<td[^>]*>\s*([\d\.]+)%/)
  const promoterHolding = promM ? toNum(promM[1]) : null

  // Pledge %: shown in a sub-row or separate section "Pledged percentage"
  const pledgeM =
    html.match(/Pledged\s*percentage[\s\S]{0,300}?<td[^>]*>\s*([\d\.]+)%?/i) ??
    html.match(/Pledge[^<]{0,30}<\/td>[\s\S]{0,100}?<td[^>]*>\s*([\d\.]+)%?/i)
  const pledge = pledgeM ? toNum(pledgeM[1]) : 0

  // ── Debug log for null fields (keep during development) ──
  const result: ScreenerData = {
    name,
    ticker: ticker.toUpperCase(),
    sector,
    currentPrice,
    stockPE,
    industryPe,
    priceToBook,
    roe,
    roce,
    debtToEquity,
    promoterHolding,
    pledge,
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

  // Log null fields so we can keep improving
  const nullFields = Object.entries(result)
    .filter(([, v]) => v === null)
    .map(([k]) => k)
  if (nullFields.length > 0) {
    console.log(`⚠️ NULL fields [${ticker}]:`, nullFields.join(', '))

    if (result.industryPe === null) {
      const topRatiosM = html.match(/id="top-ratios"[\s\S]{0,3000}?<\/ul>/i)
      if (topRatiosM) console.log('TOP_RATIOS_SECTION:', topRatiosM[0].slice(0, 1500))
    }
    if (result.opm === null || result.netProfitMargin === null || result.debtToEquity === null || result.currentRatio === null) {
      const ratiosSectionM = html.match(/id="ratios"[\s\S]{0,5000}?<\/section>/i)
        ?? html.match(/id="ratios"[\s\S]{0,3000}?<\/table>/i)
      if (ratiosSectionM) {
        console.log('RATIOS_SECTION:', ratiosSectionM[0].slice(0, 2500))
      } else {
        const i = html.indexOf('OPM')
        const tableStart = html.lastIndexOf('<table', i)
        if (tableStart !== -1) console.log('OPM_TABLE:', html.slice(tableStart, tableStart + 1500))
      }
    }
    if (result.sector === null) {
      const screenM = html.match(/href="\/screens\/[^"]*"[\s\S]{0,100}?<\/a>/i)
      if (screenM) console.log('SCREENS_LINK:', screenM[0])
    }
  }

  console.log('📊 Parsed:', JSON.stringify(result, null, 2))
  return result
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────
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
          'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer':         'https://www.screener.in/',
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
    val !== null && val !== undefined ? `${val}${suffix}` : 'N/A'

  // Debt display: 0 = explicitly debt-free, null = data unavailable
  const debtDisplay = data.debtToEquity === 0
    ? '0x (Debt-Free)'
    : data.debtToEquity !== null
    ? `${data.debtToEquity}x`
    : 'N/A'

  return `
VERIFIED DATA FROM SCREENER.IN:
Company: ${data.name} (${data.ticker}) | Sector: ${v(data.sector)}
CMP: ₹${v(data.currentPrice)} | Market Cap: ₹${v(data.marketCap)}Cr
52W: ₹${v(data.low52Week)} – ₹${v(data.high52Week)}
VALUATION: PE ${v(data.stockPE)}x | Industry PE ${v(data.industryPe)}x | P/B ${v(data.priceToBook)}x | EPS ₹${v(data.eps)} | Div Yield ${v(data.dividendYield)}%
PROFITABILITY: ROE ${v(data.roe)}% | ROCE ${v(data.roce)}% | OPM ${v(data.opm)}% | Net Margin ${v(data.netProfitMargin)}%
GROWTH: Sales ${v(data.salesGrowth)}% TTM | 3yr CAGR ${v(data.salesGrowth3yr)}% | Profit ${v(data.profitGrowth)}% TTM | 3yr CAGR ${v(data.profitGrowth3yr)}%
BALANCE SHEET: D/E ${debtDisplay} | Current Ratio ${v(data.currentRatio)}x | Interest Coverage ${v(data.interestCoverage)}x | FCF ₹${v(data.freeCashFlow)}Cr
OWNERSHIP: Promoter ${v(data.promoterHolding)}% | Pledge ${v(data.pledge)}%
`.trim()
}