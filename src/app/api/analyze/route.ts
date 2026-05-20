import { NextRequest, NextResponse } from 'next/server'
import { LANG_PROMPTS, Language } from '@/lib/langConstants'
import { createClient } from '@supabase/supabase-js'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Step 1: English analysis prompt — consistent data, no language variation
function buildAnalysisPrompt(stockName: string) {
  return `You are an expert Indian stock market analyst with deep knowledge of NSE/BSE listed companies.

Analyze the Indian stock "${stockName}" with SPECIFIC data points, numbers, and facts.

IMPORTANT RULES:
- Use SPECIFIC numbers (e.g., "ROE 42%", "Promoter holding 72%", "PE 19x")
- Mention actual risks, not generic statements
- Reference real competitors by name
- Give actionable insights, not vague statements
- Detail field must be 2-3 sentences with specific facts
- Always respond in ENGLISH for the analysis fields
- Be consistent — same company always gets same score range

Respond with ONLY valid JSON. No markdown, no backticks, no extra text.

{
  "company": "full company name",
  "ticker": "NSE ticker",
  "sector": "sector name",
  "overallScore": 75,
  "verdict": "Buy",
  "summary": "2 sentence summary with specific data points in English",
  "steps": [
    {"num": 1,  "name": "Industry Check",          "status": "PASS",    "detail": "specific industry data with numbers in English"},
    {"num": 2,  "name": "Business Quality (Moat)",  "status": "PASS",    "detail": "specific moat with competitive advantages in English"},
    {"num": 3,  "name": "Promoter Check",           "status": "PASS",    "detail": "exact promoter holding %, pledge %, recent changes in English"},
    {"num": 4,  "name": "Risk Check",               "status": "PASS",    "detail": "specific risks with numbers in English"},
    {"num": 5,  "name": "Management Quality",       "status": "PASS",    "detail": "specific management track record in English"},
    {"num": 6,  "name": "Financial Strength",       "status": "PASS",    "detail": "specific ROE%, Revenue growth%, Debt/Equity, FCF in English"},
    {"num": 7,  "name": "Consistency Check",        "status": "PASS",    "detail": "specific years of consistent performance in English"},
    {"num": 8,  "name": "Valuation",                "status": "WAIT",    "detail": "specific PE ratio, historical PE range in English"},
    {"num": 9,  "name": "Entry Strategy",           "status": "PASS",    "detail": "specific price levels and accumulation strategy in English"},
    {"num": 10, "name": "Position Sizing",          "status": "PASS",    "detail": "specific allocation % with reasoning in English"},
    {"num": 11, "name": "Holding Strategy",         "status": "PASS",    "detail": "specific holding period with growth catalysts in English"},
    {"num": 12, "name": "Exit Rules",               "status": "CAUTION", "detail": "specific exit triggers with measurable criteria in English"}
  ]
}

status: PASS, FAIL, CAUTION, or WAIT only. JSON only.`
}

// Step 2: Translation prompt — only translate, never change scores/verdict
function buildTranslationPrompt(analysis: any, langInstruction: string) {
  return `Translate ONLY the text fields in this JSON to the specified language. 
DO NOT change any numbers, scores, status values, ticker, or verdict.
ONLY translate: summary, and all detail fields.

Language instruction: ${langInstruction}

Input JSON:
${JSON.stringify(analysis, null, 2)}

Return the complete JSON with translated text fields only. 
Keep all numbers, status (PASS/FAIL/CAUTION/WAIT), overallScore, verdict, ticker, sector exactly the same.
JSON only, no markdown.`
}

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

// ── Groq API ────────────────────────────────────────────────────
async function callGroq(prompt: string, isTranslation = false) {
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
            content: isTranslation
              ? 'You are a translator. Translate only text fields in JSON. Never change numbers, scores, status values, or verdict. Return valid JSON only.'
              : 'You are an expert Indian stock market analyst. Use specific numbers and facts. Return valid JSON only. No markdown.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0, // Zero temperature = consistent results!
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

// ── Gemini API ──────────────────────────────────────────────────
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
            generationConfig: { temperature: 0, maxOutputTokens: 2500 },
          }),
        }
      )
      if (res.status === 429) continue
      if (!res.ok) continue

      const data = await res.json()
      const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
      if (!raw) continue

      const parsed = parseJSON(raw)
      console.log(`✅ Gemini: ${models[i]}`)
      return parsed
    } catch { continue }
  }
  return null
}

export async function POST(req: NextRequest) {
  const { stockName, language = 'english' } = await req.json()
  const tickerGuess = stockName.toUpperCase().trim()

  // ── Step 1: Check English cache first ──────────────────────
  // Cache key = ticker only (no language) — one analysis for all languages!
  let englishAnalysis: any = null

  try {
    const { data: cached } = await supabase
      .from('stocks')
      .select('analysis, updated_at')
      .ilike('ticker', tickerGuess)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    if (cached?.analysis) {
      const hoursSince = (Date.now() - new Date(cached.updated_at).getTime()) / 3600000
      if (hoursSince < 24) {
        console.log(`✅ Cache hit: ${tickerGuess}`)
        englishAnalysis = cached.analysis
      }
    }
  } catch {
    console.log('Cache miss — analyzing...')
  }

  // ── Step 2: Analyze in English if no cache ─────────────────
  if (!englishAnalysis) {
    const analysisPrompt = buildAnalysisPrompt(stockName)

    // Try Gemini first, then Groq
    englishAnalysis = await callGemini(analysisPrompt)
    if (!englishAnalysis) {
      console.log('Gemini failed — trying Groq...')
      englishAnalysis = await callGroq(analysisPrompt, false)
    }

    if (!englishAnalysis) {
      return NextResponse.json(
        { error: 'Rate limit reached. Please wait 1 minute and try again.' },
        { status: 429 }
      )
    }

    // Auto-save English analysis to DB
    try {
      await supabase.from('stocks').upsert({
        name: englishAnalysis.company,
        ticker: englishAnalysis.ticker,
        sector: englishAnalysis.sector,
        analysis: englishAnalysis,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'ticker' })
      console.log(`💾 Saved: ${englishAnalysis.ticker}`)
    } catch (e) {
      console.log('DB save failed:', e)
    }
  }

  // ── Step 3: Translate if not English ──────────────────────
  // Same scores, same verdict — only text translated!
  if (language === 'english') {
    return NextResponse.json(englishAnalysis)
  }

  const langInstruction = LANG_PROMPTS[language as Language] || LANG_PROMPTS.english
  const translationPrompt = buildTranslationPrompt(englishAnalysis, langInstruction)

  // Translate using Groq (fast + free)
  let translated = await callGroq(translationPrompt, true)

  // If translation fails, return English
  if (!translated) {
    console.log('Translation failed — returning English')
    translated = englishAnalysis
  }

  // Ensure scores never change during translation!
  translated.overallScore = englishAnalysis.overallScore
  translated.verdict = englishAnalysis.verdict
  translated.ticker = englishAnalysis.ticker
  translated.sector = englishAnalysis.sector
  translated.steps = translated.steps?.map((step: any, i: number) => ({
    ...step,
    status: englishAnalysis.steps[i]?.status || step.status,
    num: englishAnalysis.steps[i]?.num || step.num,
  }))

  return NextResponse.json(translated)
}
