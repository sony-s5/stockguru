// app/api/debug-screener/route.ts
// TEMPORARY DEBUG ROUTE — delete after fixing
// Usage: POST https://your-site.vercel.app/api/debug-screener
// Body: { "ticker": "INFY" }

import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { ticker = 'INFY' } = await req.json()

  const HEADERS = {
    'User-Agent':       'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept':           'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language':  'en-US,en;q=0.9',
    'Referer':          'https://www.screener.in/',
  }

  // Step 1: Resolve slug
  let slug = ticker
  try {
    const searchRes = await fetch(
      `https://www.screener.in/api/company/search/?q=${encodeURIComponent(ticker)}&v=3`,
      { headers: HEADERS, cache: 'no-store' }
    )
    const searchData = await searchRes.json()
    const match = searchData?.[0]?.url?.match(/\/company\/([^/]+)\//)
    if (match) slug = match[1]
  } catch (e: any) {
    return NextResponse.json({ error: 'Slug resolve failed', msg: e?.message })
  }

  // Step 2: Fetch HTML
  const url = `https://www.screener.in/company/${slug}/consolidated/`
  let html = ''
  try {
    const res = await fetch(url, { headers: HEADERS, cache: 'no-store' })
    html = await res.text()
  } catch (e: any) {
    return NextResponse.json({ error: 'HTML fetch failed', msg: e?.message })
  }

  // Step 3: Extract key sections for debugging
  const debug: Record<string, any> = {
    slug,
    htmlLength: html.length,
    hasTopRatios:    html.includes('id="top-ratios"'),
    hasRatiosSection: html.includes('id="ratios"'),
    hasProfitLoss:   html.includes('id="profit-loss"'),
    hasShareholding: html.includes('id="shareholding"'),
    hasOPM:          html.includes('OPM'),
    hasNPM:          html.includes('NPM'),
    hasDebtEquity:   html.includes('Debt to equity') || html.includes('Debt / Equity'),
    hasCurrentRatio: html.includes('Current ratio') || html.includes('Current Ratio'),
    hasIndustryPE:   html.includes('Ind. P/E') || html.includes('Industry P/E'),
    hasScreensLinks: html.includes('/screens/'),
  }

  // Extract top-ratios section
  const topRatiosM = html.match(/id="top-ratios"[\s\S]{0,4000}?<\/ul>/i)
  debug.topRatiosHTML = topRatiosM ? topRatiosM[0].slice(0, 3000) : 'NOT FOUND'

  // Extract ratios section (first 3000 chars)
  const ratiosSectionM = html.match(/id="ratios"[\s\S]{0,6000}?<\/section>/i)
    ?? html.match(/id="ratios"[\s\S]{0,4000}?<\/table>/i)
  debug.ratiosSectionHTML = ratiosSectionM ? ratiosSectionM[0].slice(0, 3000) : 'NOT FOUND'

  // Extract OPM row context
  const opmIdx = html.indexOf('OPM')
  if (opmIdx !== -1) {
    const tableStart = html.lastIndexOf('<tr', opmIdx)
    debug.opmRowHTML = html.slice(tableStart, opmIdx + 500)
  }

  // Extract sector/screens links
  const screenLinks = [...html.matchAll(/href="\/screens\/([^"]+)"[^>]*>\s*([^<]+?)\s*<\/a>/gi)]
  debug.screenLinks = screenLinks.map(m => ({ path: m[1], text: m[2].trim() })).slice(0, 10)

  // Extract shareholding section
  const shareM = html.match(/id="shareholding"[\s\S]{0,3000}?<\/section>/i)
  debug.shareholdingHTML = shareM ? shareM[0].slice(0, 2000) : 'NOT FOUND'

  // NSE test
  try {
    const nseRes = await fetch(
      `https://www.nseindia.com/api/quote-equity?symbol=${ticker}`,
      {
        headers: {
          'User-Agent':    'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Accept':        'application/json',
          'Referer':       'https://www.nseindia.com/',
        },
        cache: 'no-store',
      }
    )
    debug.nseStatus     = nseRes.status
    debug.nseOk         = nseRes.ok
    if (nseRes.ok) {
      const nseData = await nseRes.json()
      debug.nseIndustry   = nseData?.industryInfo?.industry ?? null
      debug.nseMetadata   = nseData?.metadata ?? null
    }
  } catch (e: any) {
    debug.nseError = e?.message
  }

  return NextResponse.json(debug, { status: 200 })
}