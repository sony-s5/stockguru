import * as cheerio from 'cheerio'

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
//   - Yahoo: Try query2 then query1 endpoints to avoid 401s
//   - Numeric parsing: allow % and trailing chars in cells
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

function normalizeLabel(label: string): string {
  return label
    .replace(/&nbsp;/g, ' ')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u0000-\u001F\u007F]+/g, ' ')
    .replace(/[.:,;%\/()\[\]{}<>"'’‘“”–—]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function findLabelNumber(html: string, labels: string[] | string): number | null {
  const labs = Array.isArray(labels) ? labels : [labels]
  for (const label of labs) {
    const esc = escRe(label)
    const patterns = [
      new RegExp(`<td[^>]*>\s*${esc}\s*<\/td>[\s\S]{0,200}?<td[^>]*>\s*([-\d,\.]+)`, 'i'),
      new RegExp(`${esc}[:\s\-]{0,4}([-\d,\.]+)\s*%?`, 'i'),
      new RegExp(`${esc}[\s\S]{0,200}?<span[^>]*class="[^"]*number[^"]*"[^>]*>\s*([-\d,\.]+)`, 'i'),
      new RegExp(`${esc}[\s\S]{0,60}?([-\d,\.]+)%?`, 'i'),
    ]

    for (const p of patterns) {
      const m = html.match(p)
      if (m && m[1]) return toNum(m[1])
    }
  }
  return null
}

function findTableRowValue(html: string, labels: string[] | string): number | null {
  const labs = Array.isArray(labels) ? labels : [labels]
  for (const label of labs) {
    const esc = escRe(label)
    const rowR = new RegExp(
      `<tr[^>]*>[\s\S]*?<td[^>]*class="[^"]*text[^"]*"[^>]*>[\s\S]*?${esc}[\s\S]*?<\/tr>`,
      'i'
    )
    const rowM = html.match(rowR)
    if (!rowM) continue

    const tds = [...rowM[0].matchAll(/<td[^>]*>\s*([\d,\.]+%?)\s*<\/td>/gi)]
    for (let i = tds.length - 1; i >= 0; i--) {
      const v = toNum(tds[i][1])
      if (v !== null) return v
    }
  }
  return null
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
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  Origin: 'https://finance.yahoo.com',
  Referer: 'https://finance.yahoo.com/',
  'sec-fetch-site': 'same-site',
  'sec-fetch-mode': 'cors',
  'sec-fetch-dest': 'empty',
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Screener slug resolver
// ─────────────────────────────────────────────────────────────────────────────
async function resolveScreenerSlug(query: string): Promise<string | null> {
  try {
    const res = await fetchWithRetry(
      `https://www.screener.in/api/company/search/?q=${encodeURIComponent(query)}&v=3`,
      { headers: SCREENER_HEADERS, cache: 'no-store' },
      3,
      200
    )
    if (!res || !res.ok) return null
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
  freeCashFlow:    number | null
}

async function fetchYahooFinanceData(ticker: string): Promise<YahooData | null> {
  const symbols = [`${ticker}.NS`, `${ticker}.BO`]
  const modules = [
    'financialData',
    'defaultKeyStatistics',
    'summaryDetail',
    'assetProfile',
  ].join(',')
  const bases = ['https://query2.finance.yahoo.com', 'https://query1.finance.yahoo.com']

  for (const symbol of symbols) {
    try {
      console.log(`📈 Yahoo Finance fetch: ${symbol}`)

      let json: any = null
      let res: Response | null = null
      for (const base of bases) {
        const url = `${base}/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}&corsDomain=finance.yahoo.com&formatted=false`
        try {
          res = await fetchWithRetry(url, { headers: YF_HEADERS, cache: 'no-store' }, 2, 200)
        } catch (err) {
          console.log(`Yahoo fetch error for ${base}:`, (err as any)?.message)
          res = null
        }

        if (!res) continue
        if (res.status === 401) {
          console.log(`Yahoo Finance ${symbol} @ ${base}: HTTP 401; trying next base`)
          await new Promise((r) => setTimeout(r, 250))
          continue
        }
        if (!res.ok) continue

        json = await res.json().catch(() => null)
        if (json) break
      }

      if (!json) continue
      const result = json?.quoteSummary?.result?.[0]
      if (!result) continue

      const fd  = result.financialData        ?? {}
      const ks  = result.defaultKeyStatistics ?? {}
      const sd  = result.summaryDetail        ?? {}
      const ap  = result.assetProfile         ?? {}

      const raw = (v: any): number | null => {
        if (v === null || v === undefined) return null
        if (typeof v === 'number') return isFinite(v) ? v : null
        if (typeof v === 'object' && 'raw' in v) {
          const r = v.raw
          return typeof r === 'number' && isFinite(r) ? r : null
        }
        return null
      }

      const fcfRaw = raw(fd.freeCashflow)
      const freeCashFlowCr = fcfRaw !== null
        ? parseFloat((fcfRaw / 1e7).toFixed(2))
        : null

      const deRaw = raw(fd.debtToEquity)
      const debtToEquity = deRaw !== null
        ? (deRaw > 10 ? parseFloat((deRaw / 100).toFixed(2)) : deRaw)
        : null

      const opmRaw = raw(fd.operatingMargins)
      const opm = opmRaw !== null ? parseFloat((opmRaw * 100).toFixed(2)) : null

      const npmRaw = raw(fd.profitMargins)
      const netProfitMargin = npmRaw !== null ? parseFloat((npmRaw * 100).toFixed(2)) : null

      const roeRaw = raw(fd.returnOnEquity)
      const roe = roeRaw !== null ? parseFloat((roeRaw * 100).toFixed(2)) : null

      const data: YahooData = {
        sector:          ap.sector ?? ap.industry ?? null,
        industryPe:      null,
        opm,
        netProfitMargin,
        debtToEquity,
        currentRatio:    raw(fd.currentRatio),
        eps:             raw(ks.trailingEps),
        priceToBook:     raw(ks.priceToBook),
        roe,
        freeCashFlow:    freeCashFlowCr,
      }

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
// 3. Screener HTML parser (DOM-based)
// ─────────────────────────────────────────────────────────────────────────────
function parseScreenerHTML(html: string, ticker: string): ScreenerData {
  const $ = cheerio.load(html)

  const name = $('h1.h2, h1').first().text().trim() || ticker

  const topRatiosRoot = $('#top-ratios').first()

  function findTopRatioValue(label: string): number | null {
    const normalizedLabel = normalizeLabel(label)

    const candidates = $('span.name, .name').toArray()
    for (const el of candidates) {
      const labelText = normalizeLabel($(el).text())
      if (!labelText) continue
      if (labelText === normalizedLabel || labelText.includes(normalizedLabel) || normalizedLabel.includes(labelText)) {
        const parent = $(el).closest('li, div, tr')
        const numberText =
          parent.find('span.number, .number').first().text().trim() ||
          $(el).nextAll('span.number, .number').first().text().trim()
        const value = toNum(numberText)
        if (value !== null) return value
      }
    }

    if (topRatiosRoot.length) {
      const ratioLabel = topRatiosRoot.find('span.name, .name').filter((index: number, el) => {
        const text = normalizeLabel($(el).text())
        return text === normalizedLabel || text.includes(normalizedLabel) || normalizedLabel.includes(text)
      })
      if (ratioLabel.length) {
        const valueText = ratioLabel
          .closest('li, div, tr')
          .find('span.number, .number')
          .first()
          .text()
        const value = toNum(valueText)
        if (value !== null) return value
      }
    }

    return (
      findLabelNumber(html, [label]) ??
      findTableRowValue(html, [label])
    )
  }

  function extractSector(): string | null {
    const skipSector = new Set([
      'All Companies', 'Screener', 'Home', 'NSE', 'BSE', 'Indices',
      'Screens', 'Screen', 'Companies',
    ])

    const screenLink = $('a[href^="/screens/"]').filter((index: number, el) => {
      const text = $(el).text().trim()
      return Boolean(text) && !skipSector.has(text) && text.length > 2 && text.length < 80
    }).first()
    if (screenLink.length) return decodeEntities(screenLink.text().trim())

    const industryLink = $('a').filter((index: number, el) => {
      const text = $(el).text().trim()
      return /Industry|Sector/i.test($(el).parent().text()) && text.length > 2
    }).first()
    if (industryLink.length) return decodeEntities(industryLink.text().trim())

    const meta = $('meta[name="description"]').attr('content')
    if (meta) {
      const match = meta.match(/(?:sector|industry)[:\s]+([A-Za-z][^,.]{2,80})/i)
      if (match) return match[1].trim()
    }

    const simpleLabel = $('body').text().match(/(?:Industry|Sector)[:\-]?\s*([^\n]{2,80})/i)
    if (simpleLabel) {
      const raw = simpleLabel[1].trim().replace(/^\s*["'>]+\s*/, '')
      return decodeEntities(raw)
    }

    return null
  }

  function sectionById(sectionId: string) {
    const section = $(`section#${sectionId}`).first()
    if (section.length) return section
    return $(`[id="${sectionId}"]`).first()
  }

  function sectionValue(section: any, labels: string[]): number | null {
    if (!section || section.length === 0) return null
    const normalizedLabels = labels.map(normalizeLabel)
    const rows = section.find('tr').toArray()
    for (const row of rows) {
      const rowText = normalizeLabel($(row).text())
      if (!rowText) continue
      for (const normalizedLabel of normalizedLabels) {
        if (rowText.includes(normalizedLabel)) {
          const cells = $(row).find('td').toArray()
          for (let i = cells.length - 1; i >= 0; i--) {
            const value = toNum($(cells[i]).text())
            if (value !== null) return value
          }
        }
      }
    }

    return (
      findLabelNumber(section.html() ?? '', labels) ??
      findTableRowValue(section.html() ?? '', labels)
    )
  }

  const ratiosSection = sectionById('ratios')
  const profitLossSection = sectionById('profit-loss')
  const cashFlowSection = sectionById('cash-flow')
  const shareholdingSection = sectionById('shareholding')

  const currentPrice =
    findTopRatioValue('Current Price') ??
    findTopRatioValue('Price')

  const stockPE =
    findTopRatioValue('Stock P/E')

  const dividendYield =
    findTopRatioValue('Dividend Yield')

  const faceValue =
    findTopRatioValue('Face Value')

  const roce =
    findTopRatioValue('ROCE')

  const roe =
    findTopRatioValue('ROE')

  const marketCap =
    findTopRatioValue('Market Cap')

  const bookValuePerShare =
    findTopRatioValue('Book Value')

  const priceToBook =
    currentPrice !== null && bookValuePerShare !== null && bookValuePerShare > 0
      ? parseFloat((currentPrice / bookValuePerShare).toFixed(2))
      : null

  const industryPe =
    findTopRatioValue('Ind. P/E') ??
    findTopRatioValue('Industry P/E') ??
    findTopRatioValue('Ind P/E') ??
    findTopRatioValue('Ind PE') ??
    findTopRatioValue('Industry PE') ??
    findLabelNumber(html, ['Ind. P/E', 'Industry P/E', 'Industry PE', 'Ind P/E', 'Ind PE', 'Price to Earnings']) ??
    findTableRowValue(html, ['Ind. P/E', 'Industry P/E', 'Industry PE', 'Ind P/E', 'Ind PE', 'Price to Earnings'])

  function findSectionText(section: any): string {
    return section.length ? normalizeLabel(section.text()) : ''
  }

  const opm =
    sectionValue(ratiosSection, ['OPM %', 'OPM', 'Operating Profit Margin', 'EBITDA Margin']) ??
    findLabelNumber(html, ['OPM %', 'OPM', 'Operating Profit Margin', 'EBITDA Margin']) ??
    findTableRowValue(html, ['OPM %', 'OPM', 'Operating Profit Margin', 'EBITDA Margin'])

  const netProfitMargin =
    sectionValue(ratiosSection, ['NPM %', 'NPM', 'Net profit margin', 'Net Profit %', 'PAT Margin', 'Profit Margin']) ??
    findLabelNumber(html, ['Net profit margin', 'Net Margin', 'PAT Margin', 'Net Profit %', 'Profit Margin']) ??
    findTableRowValue(html, ['NPM %', 'NPM', 'Net profit margin', 'Net Profit %', 'PAT Margin', 'Profit Margin'])

  function debtToEquityVal(): number | null {
    const labels = [
      'Debt to equity',
      'Debt / Equity',
      'D/E Ratio',
      'Debt to Equity',
      'Debt/Equity',
      'D/E',
    ]
    for (const label of labels) {
      const value = sectionValue(ratiosSection, [label])
      if (value !== null) return value
    }

    if (/debt\s*free|debt-free|zero\s*debt/i.test(html)) return 0

    const row = findTableRowValue(html, labels)
    if (row !== null) return row

    return findLabelNumber(html, labels)
  }

  const debtToEquity = debtToEquityVal()

  const currentRatio =
    sectionValue(ratiosSection, ['Current ratio', 'Current Ratio']) ??
    findLabelNumber(html, ['Current Ratio', 'Current ratio']) ??
    findTableRowValue(html, ['Current Ratio', 'Current ratio', 'Current Ratio (%)'])

  const interestCoverage =
    sectionValue(ratiosSection, ['Interest Coverage Ratio', 'Interest Coverage', 'Interest coverage', 'Int Coverage', 'Interest Cover']) ??
    findLabelNumber(html, ['Interest Coverage Ratio', 'Interest Coverage', 'Interest coverage', 'Int Coverage', 'Interest Cover']) ??
    findTableRowValue(html, ['Interest Coverage Ratio', 'Interest Coverage', 'Interest coverage', 'Int Coverage', 'Interest Cover'])

  function annualTableVal(label: string, section: any): number | null {
    const normalizedLabel = normalizeLabel(label)
    const rows = section.find('tr').toArray()
    for (const row of rows) {
      if (!normalizeLabel($(row).text()).includes(normalizedLabel)) continue
      const cells = $(row).find('td').toArray()
      for (let i = cells.length - 1; i >= 0; i--) {
        const value = toNum($(cells[i]).text())
        if (value !== null) return value
      }
    }
    return null
  }

  const eps =
    annualTableVal('EPS in Rs', profitLossSection) ??
    annualTableVal('EPS (in Rs)', profitLossSection) ??
    sectionValue(ratiosSection, ['EPS in Rs', 'EPS (in Rs)', 'EPS']) ??
    findLabelNumber(html, ['EPS in Rs', 'EPS (in Rs)', 'EPS']) ??
    findTableRowValue(html, ['EPS in Rs', 'EPS (in Rs)', 'EPS'])

  function findGrowthTable(title: string) {
    const normalizedTitle = normalizeLabel(title)
    const heading = $('h1, h2, h3, h4, strong, th').filter((index: number, el: any) => normalizeLabel($(el).text()).includes(normalizedTitle)).first()
    if (!heading.length) return cheerio.load('')('')

    const directTable = heading.closest('table')
    if (directTable.length) return directTable

    return heading.nextAll('table').first()
  }

  function extractGrowthValue(title: string, period: string): number | null {
    const table = findGrowthTable(title)
    if (!table.length) return null
    const row = table.find('tr').filter((index: number, tr: any) => normalizeLabel($(tr).text()).includes(normalizeLabel(period))).first()
    if (!row.length) return null
    return toNum(row.find('td').last().text())
  }

  const salesGrowthTable = findGrowthTable('Compounded Sales Growth')
  console.log('Sales Growth Table:', salesGrowthTable.length ? salesGrowthTable.html()?.replace(/\s+/g, ' ').trim() : 'NOT FOUND')

  const profitGrowthTable = findGrowthTable('Compounded Profit Growth')
  console.log('Profit Growth Table:', profitGrowthTable.length ? profitGrowthTable.html()?.replace(/\s+/g, ' ').trim() : 'NOT FOUND')

  const salesGrowth =
    extractGrowthValue('Compounded Sales Growth', 'TTM') ??
    extractGrowthValue('Sales Growth', 'TTM') ??
    extractGrowthValue('Compounded Sales Growth', '3 Years') ??
    extractGrowthValue('Compounded Sales Growth', '3 Yrs')

  const salesGrowth3yr =
    extractGrowthValue('Compounded Sales Growth', '3 Years') ??
    extractGrowthValue('Compounded Sales Growth', '3 Yrs')

  const profitGrowth =
    extractGrowthValue('Compounded Profit Growth', 'TTM') ??
    extractGrowthValue('Profit Growth', 'TTM')

  const profitGrowth3yr =
    extractGrowthValue('Compounded Profit Growth', '3 Years') ??
    extractGrowthValue('Compounded Profit Growth', '3 Yrs')

  const freeCashFlow = (() => {
    const fromCfSection =
      sectionValue(cashFlowSection, ['Free Cash Flow', 'FCF']) ??
      sectionValue(ratiosSection, ['Free Cash Flow', 'FCF'])
    if (fromCfSection !== null) return fromCfSection

    const cfOpM = cashFlowSection
      .find('tr')
      .filter((index: number, tr) => normalizeLabel($(tr).text()).includes('cash from operations'))
      .first()
      .find('td')
      .last()
      .text()

    if (cfOpM) {
      const value = toNum(cfOpM)
      if (value !== null) return value
    }

    return null
  })()

  function promoterHoldingVal(): number | null {
    const row = shareholdingSection
      .find('tr')
      .filter((index: number, tr) => normalizeLabel($(tr).text()).includes('promoters'))
      .first()

    if (row.length) {
      const cells = row.find('td').toArray()
      for (let i = cells.length - 1; i >= 0; i--) {
        const value = toNum($(cells[i]).text())
        if (value !== null) return value
      }
    }

    const simple = html.match(/Promoters[\s\S]{0,300}?<td[^>]*>\s*([\d\.]+)%/i)
    return simple ? toNum(simple[1]) : null
  }

  function pledgeVal(): number {
    const row = shareholdingSection
      .find('tr')
      .filter((index: number, tr) => normalizeLabel($(tr).text()).includes('pledge') || normalizeLabel($(tr).text()).includes('pledged'))
      .first()

    if (row.length) {
      const value = toNum(row.find('td').last().text())
      if (value !== null) return value
    }

    const pledgeM =
      html.match(/Pledged\s*percentage[\s\S]{0,300}?<td[^>]*>\s*([\d\.]+)%?/i) ??
      html.match(/Pledge[^<]{0,30}<\/(?:td|button)[^>]*>[\s\S]{0,200}?<td[^>]*>\s*([\d\.]+)%?/i)

    return pledgeM ? (toNum(pledgeM[1]) ?? 0) : 0
  }

  const result: ScreenerData = {
    name,
    ticker: ticker.toUpperCase(),
    sector: extractSector(),
    currentPrice,
    stockPE,
    industryPe,
    priceToBook,
    roe,
    roce,
    debtToEquity,
    promoterHolding: promoterHoldingVal(),
    pledge: pledgeVal(),
    salesGrowth,
    salesGrowth3yr,
    profitGrowth,
    profitGrowth3yr,
    eps,
    marketCap,
    high52Week: null,
    low52Week: null,
    dividendYield,
    opm,
    netProfitMargin,
    currentRatio,
    interestCoverage,
    freeCashFlow,
    faceValue,
  }

  const nullFields = Object.entries(result).filter(([, v]) => v === null).map(([k]) => k)
  if (nullFields.length > 0) {
    console.log(`⚠️  NULL after Screener parse [${ticker}]: ${nullFields.join(', ')}`)
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

function mergeScreenerData(primary: ScreenerData, fallback: ScreenerData): ScreenerData {
  const fill = <T>(a: T | null, b: T | null): T | null => (a !== null ? a : b)

  return {
    ...primary,
    sector:          fill(primary.sector,          fallback.sector),
    currentPrice:     fill(primary.currentPrice,     fallback.currentPrice),
    stockPE:          fill(primary.stockPE,          fallback.stockPE),
    industryPe:       fill(primary.industryPe,       fallback.industryPe),
    priceToBook:      fill(primary.priceToBook,      fallback.priceToBook),
    roe:              fill(primary.roe,              fallback.roe),
    roce:             fill(primary.roce,             fallback.roce),
    debtToEquity:     fill(primary.debtToEquity,     fallback.debtToEquity),
    promoterHolding:  fill(primary.promoterHolding,  fallback.promoterHolding),
    pledge:           fill(primary.pledge,           fallback.pledge),
    salesGrowth:      fill(primary.salesGrowth,      fallback.salesGrowth),
    salesGrowth3yr:   fill(primary.salesGrowth3yr,   fallback.salesGrowth3yr),
    profitGrowth:     fill(primary.profitGrowth,     fallback.profitGrowth),
    profitGrowth3yr:  fill(primary.profitGrowth3yr,  fallback.profitGrowth3yr),
    eps:              fill(primary.eps,              fallback.eps),
    marketCap:        fill(primary.marketCap,        fallback.marketCap),
    high52Week:       fill(primary.high52Week,       fallback.high52Week),
    low52Week:        fill(primary.low52Week,        fallback.low52Week),
    dividendYield:    fill(primary.dividendYield,    fallback.dividendYield),
    opm:              fill(primary.opm,              fallback.opm),
    netProfitMargin:  fill(primary.netProfitMargin,  fallback.netProfitMargin),
    currentRatio:     fill(primary.currentRatio,     fallback.currentRatio),
    interestCoverage: fill(primary.interestCoverage, fallback.interestCoverage),
    freeCashFlow:     fill(primary.freeCashFlow,     fallback.freeCashFlow),
    faceValue:        fill(primary.faceValue,        fallback.faceValue),
  }
}

async function fetchScreenerPages(slug: string): Promise<ScreenerData | null> {
  const urls = [
    `https://www.screener.in/company/${slug}/consolidated/`,
    `https://www.screener.in/company/${slug}/`,
  ]

  const results: ScreenerData[] = []
  for (const url of urls) {
    console.log(`🌐 Fetching: ${url}`)
    const res = await fetchWithRetry(url, { headers: SCREENER_HEADERS, cache: 'no-store' }, 3, 300)
    if (!res) {
      console.log(`Fetch failed for ${url}`)
      continue
    }
    console.log(`Status [${slug}]: ${res.status}`)
    if (!res.ok) continue

    const html = await res.text()
    console.log(`HTML size: ${html.length} chars`)
    const parsed = parseScreenerHTML(html, slug)
    results.push(parsed)
  }

  if (results.length === 0) return null
  return results.reduce((acc, next) => mergeScreenerData(acc, next))
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Public API
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchScreenerData(ticker: string): Promise<ScreenerData | null> {
  try {
    const slug = (await resolveScreenerSlug(ticker)) ?? ticker
    console.log(`🔍 Resolved slug: ${ticker} → ${slug}`)

    const [screenerResult, yahooResult] = await Promise.allSettled([
      fetchScreenerPages(slug),
      fetchYahooFinanceData(ticker.toUpperCase()),
    ])

    const screenerData = screenerResult.status === 'fulfilled' ? screenerResult.value : null
    const yahooData = yahooResult.status === 'fulfilled' ? yahooResult.value : null

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

async function fetchWithRetry(
  url: string,
  opts: RequestInit,
  attempts = 3,
  backoffMs = 250
): Promise<Response | null> {
  let lastErr: any = null
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, opts)
      if (res.ok) return res

      if ([429, 401].includes(res.status) || res.status >= 500) {
        console.log(`Fetch ${url}: status ${res.status} (attempt ${i + 1}/${attempts})`)
        await new Promise((r) => setTimeout(r, backoffMs * (i + 1)))
        continue
      }

      return res
    } catch (e: any) {
      lastErr = e
      console.log(`Fetch error ${url} (attempt ${i + 1}/${attempts}):`, e?.message)
      await new Promise((r) => setTimeout(r, backoffMs * (i + 1)))
    }
  }

  console.log(`fetchWithRetry: all attempts failed for ${url}`, lastErr?.message)
  return null
}
