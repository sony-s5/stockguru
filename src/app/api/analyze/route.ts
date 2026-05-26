import { fetchScreenerData, formatScreenerDataForPrompt } from '@/lib/screener'
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

function buildAnalysisPrompt(stockName: string, screenerContext: string) {
  return `You are an expert Indian stock market analyst.

${screenerContext}

Using the REAL DATA above, analyze "${stockName}" and fill all 12 steps with SPECIFIC numbers from the data provided.

STRICT RULES:
- Use the exact numbers from REAL FINANCIAL DATA above
- If a value shows N/A, mention it honestly and use your knowledge
- NEVER write "please verify on screener" — data is already provided above
- Every step must reference at least one specific number

Respond with ONLY valid JSON:

{
  "company": "full company name",
  "ticker": "NSE ticker",
  "sector": "sector name",
  "overallScore": 75,
  "verdict": "Buy",
  "summary": "2 sentences using real numbers from above data",
  "steps": [
    {"num": 1,  "name": "Industry Check",          "status": "PASS",    "detail": "industry analysis with growth numbers"},
    {"num": 2,  "name": "Business Quality (Moat)",  "status": "PASS",    "detail": "moat analysis with market share data"},
    {"num": 3,  "name": "Promoter Check",           "status": "PASS",    "detail": "Promoter holding X%, pledge info, FII/DII"},
    {"num": 4,  "name": "Risk Check",               "status": "CAUTION", "detail": "specific risks with numbers"},
    {"num": 5,  "name": "Management Quality",       "status": "PASS",    "detail": "management track record with specifics"},
    {"num": 6,  "name": "Financial Strength",       "status": "PASS",    "detail": "ROE X%, Revenue growth X%, D/E X"},
    {"num": 7,  "name": "Consistency Check",        "status": "PASS",    "detail": "years of consistent growth with data"},
    {"num": 8,  "name": "Valuation",                "status": "WAIT",    "detail": "PE Xx vs Industry PE Xx, PB Xx"},
    {"num": 9,  "name": "Entry Strategy",           "status": "PASS",    "detail": "current price ₹X, support ₹X, accumulate range"},
    {"num": 10, "name": "Position Sizing",          "status": "PASS",    "detail": "X% allocation, SL at ₹X, target ₹X"},
    {"num": 11, "name": "Holding Strategy",         "status": "PASS",    "detail": "hold X years, key catalysts with timeline"},
    {"num": 12, "name": "Exit Rules",               "status": "CAUTION", "detail": "exit if PE > Xx or revenue drops below X%"}
  ]
}

JSON only. No markdown. No backticks.`
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

// ✅ ఇక్కడ add చేయి ↓
  const screenerData = await fetchScreenerData(tickerGuess)
  const screenerContext = screenerData
    ? formatScreenerDataForPrompt(screenerData)
    : `No real-time data available for ${stockName}. Use your training knowledge with best estimates.`
  console.log('📊 Screener context ready:', screenerData ? 'YES' : 'NO')

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
    const analysisPrompt = buildAnalysisPrompt(stockName, screenerContext)
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
