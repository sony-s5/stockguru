// lib/screener.ts
// ─────────────────────────────────────────────────────────────────────────────
// Strategy:
//   1. Screener.in /api/company/search/ → resolve slug
//   2. Screener.in HTML fetch (consolidated → standalone)
//      → parse static fields (top-ratios, company header, growth tables)
//   3. Yahoo Finance v10 API → fills sector, D/E, currentRatio, OPM,
//      netMargin, freeCashFlow, EPS, P/B, ROE (no auth, works on Vercel)
//   4. Merge: Screener primary, Yahoo fills nulls
//
// FIXES vs previous version:
//   - NSE API removed (fails on Vercel - no cookie session possible)
//   - Yahoo Finance replaces NSE (free, no auth, reliable from Vercel)
//   - Ratios section scoping fixed: <section id="ratios">...</section>
//     instead of lookahead that was truncating at wrong boundary
//   - Sector: HTML entity decode + multiple fallback selectors
//   - debtToEquity: Yahoo Finance returns value*100, normalize correctly
//   - freeCashFlow: Yahoo Finance in USD units → convert to INR Cr
//   - industryPe: try Screener "Ind. P/E" + Yahoo summaryDetail fallback
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
// Utilities
// ─────────────────────────────────────────────────────────────────────────────
function toNum(s: string | null | undefined): number | null {
  if (s === null || s === undefined) return null
  const clean = s.replace(/,/g, '').replace(/%/g, '').trim()
  if (
    clean === '' ||
    clean === '-' ||
    clean === '--' ||
    clean.toLowerCase() === 'na' ||
    clean.toLowerCase() === 'n/a'
  )
    return null
  const m = clean.match(/-?\d+\.?\d*/)
  return m ? parseFloat(m[0]) : null
}

function escRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Decode common HTML entities */
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim()
}

const SCREENER_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  Referer: 'https://www.screener.in/',
  Connection: 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
}

const YF_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  Origin: 'https://finance.yahoo.com',
  Referer: 'https://finance.yahoo.com/',
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
// 2. Yahoo Finance API — replaces NSE (works on Vercel, no auth required)
// ─────────────────────────────────────────────────────────────────────────────
interface YahooData {
  sector:          string | null
  industryPe:      number | null
  opm:             number | null
  netProfitMargin: number | null
  debtToEquity:    number | null
  currentRatio:    number | null
  eps:             number | null
  priceToBook:     number | null
  roe:             number | null
  freeCashFlow:    number | null  // in Cr INR
}

async function fetchYahooFinanceData(ticker: string): Promise<YahooData | null> {
  // Yahoo Finance uses .NS suffix for NSE stocks, .BO for BSE
  // Try NSE first, then BSE
  const symbols = [`${ticker}.NS`, `${ticker}.BO`]

  const modules = [
    'financialData',
    'defaultKeyStatistics',
    'summaryDetail',
    'assetProfile',
  ].join(',')

  for (const symbol of symbols) {
    try {
      const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}&corsDomain=finance.yahoo.com&formatted=false`

      console.log(`📈 Yahoo Finance fetch: ${symbol}`)

      const res = await fetch(url, {
        headers: YF_HEADERS,
        cache: 'no-store',
      })

      if (!res.ok) {
        console.log(`Yahoo Finance ${symbol}: HTTP ${res.status}`)
        continue
      }

      const json = await res.json().catch(() => null)
      if (!json) continue

      const result = json?.quoteSummary?.result?.[0]
      if (!result) continue

      const fd  = result.financialData        ?? {}
      const ks  = result.defaultKeyStatistics ?? {}
      const sd  = result.summaryDetail        ?? {}
      const ap  = result.assetProfile         ?? {}

      // Helper: extract raw numeric value from Yahoo Finance field
      // Yahoo returns either { raw: number, fmt: "string" } or plain number
      const raw = (v: any): number | null => {
        if (v === null || v === undefined) return null
        if (typeof v === 'number') return isFinite(v) ? v : null
        if (typeof v === 'object' && 'raw' in v) {
          const r = v.raw
          return typeof r === 'number' && isFinite(r) ? r : null
        }
        return null
      }

      // freeCashFlow from Yahoo is in USD (for Indian stocks, actually INR)
      // Yahoo reports Indian company financials in INR already
      // Value is in absolute units (e.g., 123456789000 = ~12345 Cr)
      const fcfRaw = raw(fd.freeCashflow)
      const freeCashFlowCr = fcfRaw !== null
        ? parseFloat((fcfRaw / 1e7).toFixed(2))  // Convert to Crores (1 Cr = 10^7)
        : null

      // debtToEquity: Yahoo Finance reports as percentage × 100 for Indian stocks
      // e.g., Yahoo says 5.5 → actual D/E = 0.055
      // BUT for BSE/NSE stocks, Yahoo sometimes returns the actual ratio already
      // Safe approach: if value > 10, divide by 100; else use as-is
      const deRaw = raw(fd.debtToEquity)
      const debtToEquity = deRaw !== null
        ? (deRaw > 10 ? parseFloat((deRaw / 100).toFixed(2)) : deRaw)
        : null

      // OPM from operatingMargins (decimal → percentage)
      const opmRaw = raw(fd.operatingMargins)
      const opm = opmRaw !== null ? parseFloat((opmRaw * 100).toFixed(2)) : null

      // Net profit margin (decimal → percentage)
      const npmRaw = raw(fd.profitMargins)
      const netProfitMargin = npmRaw !== null ? parseFloat((npmRaw * 100).toFixed(2)) : null

      // ROE (decimal → percentage)
      const roeRaw = raw(fd.returnOnEquity)
      const roe = roeRaw !== null ? parseFloat((roeRaw * 100).toFixed(2)) : null

      const data: YahooData = {
        sector:          ap.sector ?? ap.industry ?? null,
        industryPe:      null, // Yahoo doesn't provide industry PE directly
        opm,
        netProfitMargin,
        debtToEquity,
        currentRatio:    raw(fd.currentRatio),
        eps:             raw(ks.trailingEps),
        priceToBook:     raw(ks.priceToBook),
        roe,
        freeCashFlow:    freeCashFlowCr,
      }

      // Log what we got
      const nullFields = Object.entries(data)
        .filter(([, v]) => v === null)
        .map(([k]) => k)
      console.log(`✅ Yahoo Finance [${symbol}] success. Null fields: ${nullFields.join(', ') || 'none'}`)
      console.log('📊 Yahoo data:', JSON.stringify(data, null, 2))
      return data
    } catch (e: any) {
      console.log(`Yahoo Finance [${ticker}] error:`, e?.message)
    }
  }

  console.log(`❌ Yahoo Finance: all symbols failed for ${ticker}`)
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Screener HTML parser (hardened version)
// ─────────────────────────────────────────────────────────────────────────────
function parseScreenerHTML(html: string, ticker: string): ScreenerData {

  // ── top-ratios: <ul id="top-ratios"> ─────────────────────────────────────
  // Screener HTML: <span class="name">Label</span> ... <span class="number">VALUE</span>
  function topRatio(label: string): number | null {
    const esc = escRe(label)
    // Primary pattern: span.name containing label → nearest span.number within 600 chars
    const rA = new RegExp(
      `<span[^>]*class="[^"]*\\bname\\b[^"]*"[^>]*>\\s*${esc}\\s*<\\/span>[\\s\\S]{0,600}?<span[^>]*class="[^"]*\\bnumber\\b[^"]*"[^>]*>([\\d,\\.]+)<\\/span>`,
      'i'
    )
    const mA = html.match(rA)
    if (mA) return toNum(mA[1])

    // Fallback: label in text node → next number span
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
  const name = nameM ? decodeEntities(nameM[1].trim()) : ticker

  // ── Sector extraction (multiple strategies) ───────────────────────────────
  // FIX: Previous code missed HTML entity decode + checked wrong URL patterns
  function extractSector(): string | null {
    // Strategy 1: /screens/NUMBER/ links (Screener's actual URL pattern)
    const screenLinks = [
      ...html.matchAll(/href="\/screens\/\d+\/"[^>]*>\s*([^<]+?)\s*<\/a>/gi),
    ]
    const skipSector = new Set([
      'All Companies', 'Screener', 'Home', 'NSE', 'BSE', 'Indices',
      'Screens', 'Screen', 'Companies',
    ])
    for (const m of screenLinks) {
      const text = decodeEntities(m[1].trim())
      if (text && !skipSector.has(text) && text.length > 2 && text.length < 80) {
        return text
      }
    }

    // Strategy 2: company-info / sub-heading area with industry/sector label
    const industryM = html.match(
      /(?:Industry|Sector)\s*[:\-]\s*<a[^>]*>([^<]+)<\/a>/i
    )
    if (industryM) return decodeEntities(industryM[1].trim())

    // Strategy 3: <a class="ink" href="/screens/..."> pattern
    const inkM = html.match(
      /class="[^"]*\bink\b[^"]*"[^>]*href="\/screens\/\d+\/"[^>]*>([^<]+)<\/a>/i
    )
    if (inkM) return decodeEntities(inkM[1].trim())

    // Strategy 4: meta description
    const metaM = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i)
    if (metaM) {
      const sectorMatch = metaM[1].match(/(?:sector|industry)[:\s]+([A-Za-z][^,.]{2,40})/i)
      if (sectorMatch) return sectorMatch[1].trim()
    }

    return null
  }

  // ── 52W High / Low ────────────────────────────────────────────────────────
  // Pattern handles "High / Low" and "52 Week High" variants
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

  // Industry PE — Screener shows as "Ind. P/E" in top-ratios (inconsistent)
  const industryPe =
    topRatio('Ind. P/E') ??
    topRatio('Industry P/E') ??
    topRatio('Ind P/E') ??
    topRatio('Ind PE') ??
    topRatio('Industry PE')

  // Book Value → compute P/B
  const bookValuePerShare = topRatio('Book Value')
  const priceToBook =
    currentPrice && bookValuePerShare && bookValuePerShare > 0
      ? parseFloat((currentPrice / bookValuePerShare).toFixed(2))
      : null

  // ── Ratios section extraction (FIX: use <section> tag boundary) ───────────
  // PREVIOUS BUG: Lookahead (?=id="profit-loss") truncated early because
  // profit-loss section appears BEFORE ratios in Screener page order.
  // FIX: Extract <section id="ratios">...</section> properly.
  function extractSection(sectionId: string): string {
    // Try <section id="SECTIONID">...</section>
    const r = new RegExp(
      `<section[^>]*id="${escRe(sectionId)}"[^>]*>([\\s\\S]*?)<\\/section>`,
      'i'
    )
    const m = html.match(r)
    if (m) return m[1]

    // Fallback: id="SECTIONID" to next id= attribute (less reliable)
    const r2 = new RegExp(
      `id="${escRe(sectionId)}"[\\s\\S]{0,100000}?(?=\\s+id="|$)`,
      'i'
    )
    const m2 = html.match(r2)
    return m2 ? m2[0] : html
  }

  const ratiosSection      = extractSection('ratios')
  const profitLossSection  = extractSection('profit-loss')
  const cashFlowSection    = extractSection('cash-flow')
  const shareholdingSection = extractSection('shareholding')

  // ── Ratios table parser ───────────────────────────────────────────────────
  // Row: <td class="text"><a href="...">LABEL</a></td><td>V1</td><td>V2</td>...
  // Returns LAST non-null value (most recent period/TTM)
  function ratioTableLatest(label: string, section = ratiosSection): number | null {
    const esc = escRe(label)
    const rowR = new RegExp(
      `<td[^>]*>(?:<[^>]+>)?\\s*${esc}\\s*(?:<\\/[^>]+>)?<\\/td>([\\s\\S]{0,3000}?)<\\/tr>`,
      'i'
    )
    const rowM = section.match(rowR)
    if (!rowM) return null

    const tds = [...rowM[1].matchAll(/<td[^>]*>\s*(-?[\d,\.]+)\s*<\/td>/gi)]
    if (tds.length === 0) return null

    for (let i = tds.length - 1; i >= 0; i--) {
      const v = toNum(tds[i][1])
      if (v !== null) return v
    }
    return null
  }

  // ── OPM ──────────────────────────────────────────────────────────────────
  // Screener shows "OPM %" in ratios table for most companies
  const opm =
    ratioTableLatest('OPM %')          ??
    ratioTableLatest('OPM')            ??
    ratioTableLatest('Operating Profit Margin') ??
    ratioTableLatest('EBITDA Margin')

  // ── Net Profit Margin ────────────────────────────────────────────────────
  const netProfitMargin =
    ratioTableLatest('NPM %')              ??
    ratioTableLatest('NPM')               ??
    ratioTableLatest('Net profit margin')  ??
    ratioTableLatest('Net Profit %')       ??
    ratioTableLatest('PAT Margin')

  // ── Debt to Equity ───────────────────────────────────────────────────────
  function debtToEquityVal(): number | null {
    // Screener labels (varies by sector)
    const labels = [
      'Debt to equity',
      'Debt / Equity',
      'D/E Ratio',
      'Debt to Equity',
      'Debt/Equity',
    ]
    for (const label of labels) {
      const val = ratioTableLatest(label)
      if (val !== null) return val
    }
    // "Debt free" / "Zero debt" mentioned anywhere in ratios section
    if (/debt\s*free|debt-free|zero\s*debt/i.test(ratiosSection)) return 0
    // Also check full HTML for explicit debt-free mention near company name
    if (/debt\s*free|debt-free|zero\s*debt/i.test(html.substring(0, 5000))) return 0
    return null
  }

  // ── Current Ratio ─────────────────────────────────────────────────────────
  const currentRatio =
    ratioTableLatest('Current ratio') ??
    ratioTableLatest('Current Ratio')

  // ── Interest Coverage ─────────────────────────────────────────────────────
  const interestCoverage =
    ratioTableLatest('Interest Coverage Ratio') ??
    ratioTableLatest('Interest Coverage')       ??
    ratioTableLatest('Int Coverage')            ??
    ratioTableLatest('Interest coverage')

  // ── EPS from P&L table ────────────────────────────────────────────────────
  // Last column = most recent year
  function annualTableVal(label: string, section: string): number | null {
    const esc = escRe(label)
    const rowR = new RegExp(
      `<td[^>]*>\\s*(?:<[^>]+>)?\\s*${esc}\\s*(?:<\\/[^>]+>)?\\s*<\\/td>([\\s\\S]{0,3000}?)<\\/tr>`,
      'i'
    )
    const rowM = section.match(rowR)
    if (!rowM) return null

    const tds = [...rowM[1].matchAll(/<td[^>]*>\s*(-?[\d,\.]+)\s*<\/td>/gi)]
    if (tds.length === 0) return null
    for (let i = tds.length - 1; i >= 0; i--) {
      const v = toNum(tds[i][1])
      if (v !== null) return v
    }
    return null
  }

  const eps =
    annualTableVal('EPS in Rs', profitLossSection)    ??
    annualTableVal('EPS (in Rs)', profitLossSection)   ??
    ratioTableLatest('EPS in Rs')                      ??
    ratioTableLatest('EPS')

  // ── Compounded Growth Tables ──────────────────────────────────────────────
  // Screener structure:
  // <h3>Compounded Sales Growth</h3>
  // <table><tr><td>3 Years:</td><td>8%</td></tr><tr><td>TTM:</td><td>10%</td></tr></table>
  function growthTableVal(sectionTitle: string, period: string): number | null {
    const titleEsc  = escRe(sectionTitle)
    const periodEsc = escRe(period)
    const r = new RegExp(
      `${titleEsc}[\\s\\S]{0,2000}?<td[^>]*>\\s*${periodEsc}[:\\s]*<\\/td>\\s*<td[^>]*>\\s*(-?[\\d,\\.]+)\\s*%?\\s*<\\/td>`,
      'i'
    )
    const m = html.match(r)
    return m ? toNum(m[1]) : null
  }

  const salesGrowth =
    growthTableVal('Compounded Sales Growth', 'TTM')  ??
    growthTableVal('Sales Growth', 'TTM')              ??
    ratioTableLatest('Sales growth')                   ??
    ratioTableLatest('Revenue growth')

  const salesGrowth3yr =
    growthTableVal('Compounded Sales Growth', '3 Years') ??
    growthTableVal('Compounded Sales Growth', '3 Yrs')

  const profitGrowth =
    growthTableVal('Compounded Profit Growth', 'TTM') ??
    growthTableVal('Profit Growth', 'TTM')             ??
    ratioTableLatest('Profit growth')                  ??
    ratioTableLatest('PAT growth')

  const profitGrowth3yr =
    growthTableVal('Compounded Profit Growth', '3 Years') ??
    growthTableVal('Compounded Profit Growth', '3 Yrs')

  // ── Free Cash Flow ────────────────────────────────────────────────────────
  // FIX: scope to cash-flow section first; Screener shows OCF - Capex = FCF
  const freeCashFlow = (() => {
    // Direct FCF row in cash flow section
    const fromCfSection =
      ratioTableLatest('Free Cash Flow', cashFlowSection) ??
      ratioTableLatest('FCF', cashFlowSection)

    if (fromCfSection !== null) return fromCfSection

    // Fallback: ratios section
    const fromRatios =
      ratioTableLatest('Free Cash Flow') ??
      ratioTableLatest('FCF')

    if (fromRatios !== null) return fromRatios

    // Fallback: Cash from Operations in cash flow section
    const cfOpM = cashFlowSection.match(
      /Cash from Operations[\s\S]{0,300}?<td[^>]*>\s*([\d,\.\-]+)\s*<\/td>/i
    )
    return cfOpM ? toNum(cfOpM[1]) : null
  })()

  // ── Promoter Holding ──────────────────────────────────────────────────────
  // Screener shareholding: Promoters row → last quarter value
  function promoterHoldingVal(): number | null {
    // Use scoped shareholding section
    const rowR = /Promoters[\s\S]{0,600}?<\/td>([\s\S]{0,2000}?)<\/tr>/i
    const rowM = shareholdingSection.match(rowR)

    if (rowM) {
      const vals = [...rowM[1].matchAll(/<td[^>]*>\s*([\d\.]+)%?\s*<\/td>/gi)]
      if (vals.length > 0) {
        // Use latest (last) quarter
        return toNum(vals[vals.length - 1][1])
      }
    }

    // Fallback: simple pattern anywhere in HTML
    const simple = html.match(/Promoters[\s\S]{0,300}?<td[^>]*>\s*([\d\.]+)%/)
    return simple ? toNum(simple[1]) : null
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

  const nullFields = Object.entries(result)
    .filter(([, v]) => v === null)
    .map(([k]) => k)

  if (nullFields.length > 0) {
    console.log(`⚠️  NULL after Screener parse [${ticker}]:`, nullFields.join(', '))
  } else {
    console.log(`✅ All fields resolved from Screener HTML [${ticker}]`)
  }

  console.log('📊 Parsed:', JSON.stringify(result, null, 2))
  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Merge: Screener primary + Yahoo fills nulls
// ─────────────────────────────────────────────────────────────────────────────
function mergeWithYahoo(screener: ScreenerData, yahoo: YahooData | null): ScreenerData {
  if (!yahoo) return screener

  const fill = <T>(a: T | null, b: T | null): T | null => (a !== null ? a : b)

  const merged: ScreenerData = {
    ...screener,
    sector:          fill(screener.sector,          yahoo.sector),
    industryPe:      fill(screener.industryPe,      yahoo.industryPe),
    opm:             fill(screener.opm,             yahoo.opm),
    netProfitMargin: fill(screener.netProfitMargin, yahoo.netProfitMargin),
    debtToEquity:    fill(screener.debtToEquity,    yahoo.debtToEquity),
    currentRatio:    fill(screener.currentRatio,    yahoo.currentRatio),
    eps:             fill(screener.eps,             yahoo.eps),
    priceToBook:     fill(screener.priceToBook,     yahoo.priceToBook),
    roe:             fill(screener.roe,             yahoo.roe),
    freeCashFlow:    fill(screener.freeCashFlow,    yahoo.freeCashFlow),
  }

  const stillNull = Object.entries(merged)
    .filter(([, v]) => v === null)
    .map(([k]) => k)

  if (stillNull.length > 0) {
    console.log(`⚠️  Still NULL after Yahoo merge [${screener.ticker}]:`, stillNull.join(', '))
  } else {
    console.log(`✅ All fields resolved after Yahoo merge [${screener.ticker}]`)
  }

  console.log('📊 FINAL MERGED DATA:', JSON.stringify(merged, null, 2))
  return merged
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Public API
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchScreenerData(ticker: string): Promise<ScreenerData | null> {
  try {
    const slug = (await resolveScreenerSlug(ticker)) ?? ticker
    console.log(`🔍 Resolved slug: ${ticker} → ${slug}`)

    // Fetch Screener HTML + Yahoo Finance in parallel
    const [screenerResult, yahooResult] = await Promise.allSettled([
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
      fetchYahooFinanceData(ticker.toUpperCase()),
    ])

    const screenerData =
      screenerResult.status === 'fulfilled' ? screenerResult.value : null
    const yahooData =
      yahooResult.status === 'fulfilled' ? yahooResult.value : null

    if (!screenerData && !yahooData) {
      console.log('❌ Both Screener and Yahoo Finance failed')
      return null
    }

    if (!screenerData && yahooData) {
      console.log('⚠️  Screener failed, building from Yahoo Finance data only')
      return {
        name:             ticker,
        ticker:           ticker.toUpperCase(),
        sector:           yahooData.sector,
        currentPrice:     null,
        stockPE:          null,
        industryPe:       yahooData.industryPe,
        priceToBook:      yahooData.priceToBook,
        roe:              yahooData.roe,
        roce:             null,
        debtToEquity:     yahooData.debtToEquity,
        promoterHolding:  null,
        pledge:           0,
        salesGrowth:      null,
        salesGrowth3yr:   null,
        profitGrowth:     null,
        profitGrowth3yr:  null,
        eps:              yahooData.eps,
        marketCap:        null,
        high52Week:       null,
        low52Week:        null,
        dividendYield:    null,
        opm:              yahooData.opm,
        netProfitMargin:  yahooData.netProfitMargin,
        currentRatio:     yahooData.currentRatio,
        interestCoverage: null,
        freeCashFlow:     yahooData.freeCashFlow,
        faceValue:        null,
      }
    }

    return mergeWithYahoo(screenerData!, yahooData)
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
    data.debtToEquity === 0
      ? '0x (Debt-Free)'
      : data.debtToEquity !== null
      ? `${data.debtToEquity}x`
      : 'N/A'

  return `
VERIFIED DATA FROM SCREENER.IN + YAHOO FINANCE:
Company:       ${data.name} (${data.ticker})
Sector:        ${v(data.sector)}
CMP:           ₹${v(data.currentPrice)} | Market Cap: ₹${v(data.marketCap)} Cr
52W Range:     ₹${v(data.low52Week)} – ₹${v(data.high52Week)}
VALUATION:     PE ${v(data.stockPE)}x | Industry PE ${v(data.industryPe)}x | P/B ${v(data.priceToBook)}x | EPS ₹${v(data.eps)} | Div Yield ${v(data.dividendYield)}%
PROFITABILITY: ROE ${v(data.roe)}% | ROCE ${v(data.roce)}% | OPM ${v(data.opm)}% | Net Margin ${v(data.netProfitMargin)}%
GROWTH:        Sales TTM ${v(data.salesGrowth)}% | 3yr CAGR ${v(data.salesGrowth3yr)}% | Profit TTM ${v(data.profitGrowth)}% | 3yr CAGR ${v(data.profitGrowth3yr)}%
BALANCE SHEET: D/E ${debtDisplay} | Current Ratio ${v(data.currentRatio)}x | Interest Coverage ${v(data.interestCoverage)}x | FCF ₹${v(data.freeCashFlow)} Cr
OWNERSHIP:     Promoter ${v(data.promoterHolding)}% | Pledge ${v(data.pledge)}%
`.trim()
}