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
  return `
You are an expert Indian stock market analyst with deep knowledge of NSE/BSE listed companies.
Analyze the Indian stock "${stockName}" for the current year 2026. 
Respond in ENGLISH only.

CRITICAL INSTRUCTIONS FOR 12 STEPS:
- For Steps 3, 6, and 8: Provide a generic guidance or a checklist on what the user should verify on Screener.in. Do not invent exact live numbers for these three steps.
- For ALL OTHER STEPS (1, 2, 4, 5, 7, 9, 10, 11, 12): You must provide REAL, ACCURATE, and CONTEXTUAL facts, risks, and strategies based on the company's actual business profile as of 2026.
- DO NOT hallucinate or make up fake historical numbers (like fake FY22/FY23 numbers). If you don't know an exact percentage, talk about the qualitative trend, real competitors, and actual business risks.
- The "detail" field in each step must be 2-3 detailed sentences.
- The "status" must reflect ACTUAL company situations (PASS, FAIL, CAUTION, or WAIT), do not mark PASS for everything.

Respond with ONLY valid JSON. No markdown, no backticks, no extra text.

{
  "company": "Full actual company name",
  "ticker": "NSE ticker symbol only",
  "sector": "Sector name",
  "overallScore": 70,
  "verdict": "Buy / Sell / Hold / Wait",
  "summary": "A concise 2-sentence summary of the company's current position in 2026.",
  "steps": [
    {"num": 1,  "name": "Industry Check",          "status": "PASS",    "detail": "Analyze the real industry growth trends, market drivers, and current sector demand for this company in 2026."},
    {"num": 2,  "name": "Business Quality (Moat)",  "status": "PASS",    "detail": "Discuss the company's actual competitive advantage, brand strength, or market share limitations with real competitor names."},
    {"num": 3,  "name": "Promoter Check",           "status": "PASS",    "detail": "Please click the Screener.in link below to verify the latest Promoter Holding %, Pledge %, and FII/DII trends directly."},
    {"num": 4,  "name": "Risk Check",               "status": "CAUTION", "detail": "Identify 2 real, specific operational, regulatory, or raw material risks that this specific company is currently facing."},
    {"num": 5,  "name": "Management Quality",       "status": "PASS",    "detail": "Comment on the management reputation, execution capability, or key leadership stability based on actual corporate track record."},
    {"num": 6,  "name": "Financial Strength",       "status": "PASS",    "detail": "Please check the Screener.in link below to analyze real-time Revenue growth, Net Profit margins, and Debt-to-Equity ratios."},
    {"num": 7,  "name": "Consistency Check",        "status": "PASS",    "detail": "Evaluate the company's long-term business consistency, stability over the cycles, and historical reliability."},
    {"num": 8,  "name": "Valuation",                "status": "WAIT",    "detail": "Please check the current P/E, P/B, and Industry P/E on Screener to determine if the stock is undervalued or overvalued."},
    {"num": 9,  "name": "Entry Strategy",           "status": "PASS",    "detail": "Suggest a realistic technical or fundamental entry strategy (e.g., SIP, accumulation on dips near major support zones)."},
    {"num": 10, "name": "Position Sizing",          "status": "PASS",    "detail": "Provide a standard risk-managed allocation percentage (e.g., 2-5% for high risk, 5-8% for blue-chip) with proper rationale."},
    {"num": 11, "name": "Holding Strategy",         "status": "PASS",    "detail": "Define a recommended holding horizon (Short/Medium/Long term) aligned with the company's visible business catalysts."},
    {"num": 12, "name": "Exit Rules",               "status": "CAUTION", "detail": "Specify 2 concrete fundamental triggers for exiting this stock (e.g., market share loss, margin deterioration, structural sector shift)."}
  ]
}
`;
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
