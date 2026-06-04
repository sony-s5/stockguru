from pathlib import Path
import re

path = Path('src/lib/screener.ts')
text = path.read_text(encoding='utf-8')
lines = text.splitlines()

normalize_code = """function normalizeLabel(label: string): string {
  return label
    .replace(/&nbsp;/g, ' ')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u0000-\u001F\u007F]+/g, ' ')
    .replace(/[.:,;%\/()\[\]{}<>\"'’‘“”–—]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}
"""

parse_code = """function parseScreenerHTML(html: string, ticker: string): ScreenerData {
  const $ = load(html)

  const name = $('h1.h2, h1').first().text().trim() || ticker

  function extractSector(): string | null {
    const skipSector = new Set([
      'All Companies',
      'Screener',
      'Home',
      'NSE',
      'BSE',
      'Indices',
      'Screens',
      'Screen',
      'Companies',
    ])

    const screenLink = $('a[href^="/screens/"]')
      .filter((_, el) => {
        const text = $(el).text().trim()
        return text && !skipSector.has(text) && text.length > 2 && text.length < 80
      })
      .first()

    if (screenLink.length) return decodeEntities(screenLink.text().trim())

    const industryLink = $('a')
      .filter((_, el) => {
        const text = $(el).text().trim()
        return /Industry|Sector/i.test($(el).parent().text()) && text.length > 2
      })
      .first()

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

  const { ratios: topRatios, high52Week, low52Week } = parseTopRatios($)
  const ratiosSection = selectSection($, 'ratios')
  const profitLossSection = selectSection($, 'profit-loss')
  const cashFlowSection = selectSection($, 'cash-flow')
  const shareholdingSection = selectSection($, 'shareholding')

  const ratioRowMap = buildSectionRowMap($, ratiosSection)
  const profitLossRowMap = buildSectionRowMap($, profitLossSection)
  const cashFlowRowMap = buildSectionRowMap($, cashFlowSection)
  const shareholdingRowMap = buildSectionRowMap($, shareholdingSection)

  const topRatioValue = (labels: string[]): number | null =>
    findTopRatioValue(topRatios, labels).value

  const sectionValue = (rowMap: Map<string, number[]>, labels: string[]): number | null =>
    findRowValue(rowMap, labels).value

  const sectionFallbackValue = (section: CheerioAPI, labels: string[]): number | null => {
    const localRowMap = buildSectionRowMap($, section)
    const value = findRowValue(localRowMap, labels).value
    if (value !== null) return value
    return findTableRowValue(section.html() ?? '', labels)
  }

  const currentPrice =
    topRatioValue(['Current Price', 'Current price']) ??
    topRatioValue(['Price'])

  const stockPE =
    topRatioValue(['Stock P/E', 'Stock PE', 'P/E', 'P/E Ratio', 'Price to Earnings'])

  const dividendYield =
    topRatioValue(['Dividend Yield', 'Dividend yield', 'Yield'])

  const faceValue =
    topRatioValue(['Face Value', 'Face value'])

  const roce =
    topRatioValue(['ROCE', 'Return on Capital Employed'])

  const roe =
    topRatioValue(['ROE', 'Return on Equity'])

  const marketCap =
    topRatioValue(['Market Cap', 'Market Capitalisation', 'Market Capitalization'])

  const bookValuePerShare =
    topRatioValue(['Book Value', 'Book Value per share', 'Book value per share'])

  const priceToBook =
    topRatioValue(['P/B', 'Price to Book', 'Price to Book Value']) ??
    (currentPrice !== null && bookValuePerShare !== null && bookValuePerShare > 0
      ? parseFloat((currentPrice / bookValuePerShare).toFixed(2))
      : null)

  const industryPe =
    topRatioValue([
      'Ind. P/E',
      'Industry P/E',
      'Ind P/E',
      'Ind PE',
      'Industry PE',
      'Price to Earnings',
    ]) ??
    sectionValue(ratioRowMap, [
      'Ind. P/E',
      'Industry P/E',
      'Ind P/E',
      'Ind PE',
      'Industry PE',
      'Price to Earnings',
    ]) ??
    findLabelNumber(html, [
      'Ind. P/E',
      'Industry P/E',
      'Ind P/E',
      'Ind PE',
      'Industry PE',
      'Price to Earnings',
    ]) ??
    findTableRowValue(html, [
      'Ind. P/E',
      'Industry P/E',
      'Ind P/E',
      'Ind PE',
      'Industry PE',
      'Price to Earnings',
    ])

  const opm =
    sectionValue(ratioRowMap, ['OPM %', 'OPM', 'Operating Profit Margin', 'EBITDA Margin']) ??
    findLabelNumber(html, ['OPM %', 'OPM', 'Operating Profit Margin', 'EBITDA Margin']) ??
    findTableRowValue(html, ['OPM %', 'OPM', 'Operating Profit Margin', 'EBITDA Margin'])

  const netProfitMargin =
    sectionValue(ratioRowMap, ['NPM %', 'NPM', 'Net profit margin', 'Net Profit %', 'PAT Margin', 'Profit Margin']) ??
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
      const value = sectionValue(ratioRowMap, [label])
      if (value !== null) return value
    }

    if (/debt\s*free|debt-free|zero\s*debt/i.test(html)) return 0

    const row = findTableRowValue(html, labels)
    if (row !== null) return row

    return findLabelNumber(html, labels)
  }

  const debtToEquity = debtToEquityVal()

  const currentRatio =
    sectionValue(ratioRowMap, ['Current ratio', 'Current Ratio']) ??
    findLabelNumber(html, ['Current Ratio', 'Current ratio']) ??
    findTableRowValue(html, ['Current Ratio', 'Current ratio', 'Current Ratio (%)'])

  const interestCoverage =
    sectionValue(ratioRowMap, ['Interest Coverage Ratio', 'Interest Coverage', 'Interest coverage', 'Int Coverage', 'Interest Cover']) ??
    findLabelNumber(html, ['Interest Coverage Ratio', 'Interest Coverage', 'Interest coverage', 'Int Coverage', 'Interest Cover']) ??
    findTableRowValue(html, ['Interest Coverage Ratio', 'Interest Coverage', 'Interest coverage', 'Int Coverage', 'Interest Cover'])

  const eps =
    sectionValue(profitLossRowMap, ['EPS in Rs', 'EPS (in Rs)', 'EPS']) ??
    sectionValue(ratioRowMap, ['EPS in Rs', 'EPS (in Rs)', 'EPS']) ??
    findLabelNumber(html, ['EPS in Rs', 'EPS (in Rs)', 'EPS']) ??
    findTableRowValue(html, ['EPS in Rs', 'EPS (in Rs)', 'EPS'])

  function extractGrowthValue(title: string, period: string): number | null {
    const normalizedTitle = normalizeLabel(title)
    const heading = $('h3, h2, strong')
      .filter((_, el) => normalizeLabel($(el).text()).includes(normalizedTitle))
      .first()

    if (!heading.length) return null

    const table = heading.nextAll('table').first()
    if (!table.length) return null

    const row = table
      .find('tr')
      .filter((_, tr) => normalizeLabel($(tr).text()).includes(normalizeLabel(period)))
      .first()

    if (!row.length) return null
    return parseNumber(row.find('td').last().text())
  }

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

  const freeCashFlow =
    sectionValue(cashFlowRowMap, ['Free Cash Flow', 'FCF']) ??
    sectionValue(ratioRowMap, ['Free Cash Flow', 'FCF']) ??
    findLabelNumber(html, ['Free Cash Flow', 'FCF'])

  function promoterHoldingVal(): number | null {
    const value = sectionValue(shareholdingRowMap, ['Promoters', 'Promoter holding', 'Promoter Holding'])
    if (value !== null) return value

    const row = shareholdingSection
      .find('tr')
      .filter((_, tr) => normalizeLabel($(tr).text()).includes('promoters'))
      .first()

    if (row.length) return parseNumber(row.find('td').last().text())

    return findLabelNumber(html, ['Promoters'])
  }

  function pledgeVal(): number {
    const value = sectionValue(shareholdingRowMap, ['Pledged', 'Pledge'])
    if (value !== null) return value

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
  if (nullFields.length > 0) {
    console.log(`⚠️  NULL after Screener parse [${ticker}]: ${nullFields.join(', ')}`)
  } else {
    console.log(`✅ All fields resolved from Screener HTML [${ticker}]`)
  }

  console.log('📊 Parsed:', JSON.stringify(result, null, 2))
  return result
}
"""

lines[89:182] = normalize_code.splitlines()
lines[547:933] = parse_code.splitlines()

path.write_text("\n".join(lines), encoding='utf-8')
