import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function parseJSON(raw: string) {
  let clean = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
  const s = clean.indexOf('{')
  const e = clean.lastIndexOf('}')
  if (s !== -1 && e !== -1) clean = clean.slice(s, e + 1)
  return JSON.parse(clean)
}

function buildAnalysisPrompt(stockName: string) {
  return `You are an expert Indian stock market analyst with deep knowledge of NSE/BSE listed companies.

Analyze the Indian stock "${stockName}" with REAL, SPECIFIC data points, numbers, and facts.
Respond in ENGLISH only.

CRITICAL RULES:
- Use REAL numbers from actual financial data (ROE, PE, Revenue growth, Debt/Equity)
- DO NOT make up or hallucinate numbers — if unsure, say "data unavailable"
- Mention actual risks with context
- Reference real competitors by name
- Give actionable insights, not vague statements
- detail field must be 2-3 sentences with specific facts
- status must reflect ACTUAL company health, not generic PASS for everything

Respond with ONLY valid JSON. No markdown, no backticks, no extra text.

{
  "company": "full company name",
  "ticker": "NSE ticker symbol only (e.g. TCS, INFY, RELIANCE)",
  "sector": "sector name",
  "overallScore": 75,
  "verdict": "Buy",
  "summary": "2 sentence summary with specific data points",
  "steps": [
    {"num": 1,  "name": "Industry Check",          "status": "PASS",    "detail": "specific industry data with growth numbers"},
    {"num": 2,  "name": "Business Quality (Moat)",  "status": "PASS",    "detail": "specific moat with competitive advantages"},
    {"num": 3,  "name": "Promoter Check",           "status": "PASS",    "detail": "exact promoter holding %, pledge %, recent changes"},
    {"num": 4,  "name": "Risk Check",               "status": "CAUTION", "detail": "specific risks with numbers and context"},
    {"num": 5,  "name": "Management Quality",       "status": "PASS",    "detail": "specific management track record with examples"},
    {"num": 6,  "name": "Financial Strength",       "status": "PASS",    "detail": "specific ROE%, Revenue growth%, Debt/Equity, FCF"},
    {"num": 7,  "name": "Consistency Check",        "status": "PASS",    "detail": "specific years of consistent performance with data"},
    {"num": 8,  "name": "Valuation",                "status": "WAIT",    "detail": "specific PE ratio, historical PE range, PEG ratio"},
    {"num": 9,  "name": "Entry Strategy",           "status": "PASS",    "detail": "specific price levels, support zones, accumulation strategy"},
    {"num": 10, "name": "Position Sizing",          "status": "PASS",    "detail": "specific allocation % recommendation with reasoning"},
    {"num": 11, "name": "Holding Strategy",         "status": "PASS",    "detail": "specific holding period with growth catalysts"},
    {"num": 12, "name": "Exit Rules",               "status": "CAUTION", "detail": "specific exit triggers with measurable criteria"}
  ]
}

status values: PASS, FAIL, CAUTION, or WAIT only. JSON only.`
}

async function callGroq(prompt: string) {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You are an expert Indian stock market analyst. Always respond with valid JSON only. No markdown, no backticks. Use real specific numbers and facts. Never hallucinate data.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0,
        max_tokens: 3000,
      }),
    })
    if (!res.ok) { console.log(`Groq failed: ${res.status}`); return null }
    const data = await res.json()
    const raw = data?.choices?.[0]?.message?.content || ''
    if (!raw) return null
    return parseJSON(raw)
  } catch (e: any) {
    console.log('Groq error:', e?.message)
    return null
  }
}

async function callGemini(prompt: string) {
  const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite']
  for (let i = 0; i < models.length; i++) {
    if (i > 0) await sleep(2000)
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${models[i]}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0, maxOutputTokens: 3000 },
          }),
        }
      )
      if (res.status === 429) continue
      if (!res.ok) continue
      const data = await res.json()
      const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
      if (!raw) continue
      return parseJSON(raw)
    } catch { continue }
  }
  return null
}

async function callAI(prompt: string) {
  let result = await callGroq(prompt)
  if (result) { console.log('✅ Groq success'); return result }
  result = await callGemini(prompt)
  if (result) { console.log('✅ Gemini success'); return result }
  return null
}

export async function POST(req: NextRequest) {
  const { stockName } = await req.json()
  const tickerGuess = stockName.toUpperCase().trim()

  // ✅ Fix 1: Exact ticker match only — no partial/language suffix matches
  let englishAnalysis: any = null

  try {
    const { data: cached } = await supabase
      .from('stocks')
      .select('analysis, updated_at, ticker')
      .eq('ticker', tickerGuess)           // ✅ exact match, not ilike
      .not('ticker', 'ilike', '%\\_%')     // ✅ _telugu, _english suffix ఉన్నవి exclude
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    if (cached?.analysis) {
      // ✅ Fix 2: Cache 7 days — fresh enough, reduces fake data re-generation
      const hoursSince = (Date.now() - new Date(cached.updated_at).getTime()) / 3600000
      if (hoursSince < 168) {
        console.log(`✅ Cache hit: ${tickerGuess}`)
        englishAnalysis = cached.analysis
      } else {
        console.log(`⏰ Cache expired: ${tickerGuess} — re-analyzing`)
      }
    }
  } catch {
    console.log('Cache miss — analyzing fresh...')
  }

  // Fresh AI analysis
  if (!englishAnalysis) {
    const analysisPrompt = buildAnalysisPrompt(stockName)
    englishAnalysis = await callAI(analysisPrompt)

    if (!englishAnalysis) {
      return NextResponse.json(
        { error: 'Rate limit reached. Please wait 1 minute and try again.' },
        { status: 429 }
      )
    }

    // ✅ Fix 3: Always use tickerGuess for DB key — not AI's returned ticker
    // AI sometimes returns wrong/variant ticker symbols
    const dbTicker = tickerGuess

    try {
      await supabase.from('stocks').upsert({
        name: englishAnalysis.company,
        ticker: dbTicker,
        sector: englishAnalysis.sector,
        analysis: englishAnalysis,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'ticker' })
      console.log(`💾 Saved: ${dbTicker}`)
    } catch (e) {
      console.log('DB save failed:', e)
    }
  }

  // English only — return directly
  return NextResponse.json(englishAnalysis)
}
