import { NextRequest, NextResponse } from 'next/server'
import { LANG_PROMPTS, Language } from '@/lib/langConstants'
import { createClient } from '@supabase/supabase-js'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ── Parse JSON safely ───────────────────────────────────────────
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

// ── Step 1: English Analysis Prompt ────────────────────────────
function buildAnalysisPrompt(stockName: string) {
  return `You are an expert Indian stock market analyst with deep knowledge of NSE/BSE listed companies.

Analyze the Indian stock "${stockName}" with SPECIFIC data points, numbers, and facts.
Respond in ENGLISH only.

IMPORTANT RULES:
- Use SPECIFIC numbers (e.g., "ROE 42%", "Promoter holding 72%", "PE 19x")
- Mention actual risks with context
- Reference real competitors by name
- Give actionable insights, not vague statements
- Detail field must be 2-3 sentences with specific facts

Respond with ONLY valid JSON. No markdown, no backticks, no extra text.

{
  "company": "full company name",
  "ticker": "NSE ticker",
  "sector": "sector name",
  "overallScore": 75,
  "verdict": "Buy",
  "summary": "2 sentence summary with specific data points",
  "steps": [
    {"num": 1,  "name": "Industry Check",          "status": "PASS",    "detail": "specific industry data with growth numbers"},
    {"num": 2,  "name": "Business Quality (Moat)",  "status": "PASS",    "detail": "specific moat with competitive advantages"},
    {"num": 3,  "name": "Promoter Check",           "status": "PASS",    "detail": "exact promoter holding %, pledge %, recent changes"},
    {"num": 4,  "name": "Risk Check",               "status": "PASS",    "detail": "specific risks with numbers and context"},
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

status: PASS, FAIL, CAUTION, or WAIT only. JSON only.`
}

// ── Step 2: Translation Prompt ──────────────────────────────────
function buildTranslationPrompt(englishAnalysis: any, language: string) {
  const langInstruction = LANG_PROMPTS[language as Language] || LANG_PROMPTS.telugu

  return `You are a translator. Translate the following stock analysis JSON to ${language}.

Language instruction: ${langInstruction}

RULES:
- Translate ONLY the text fields: summary, detail fields
- Keep ALL numbers, percentages, company names, ticker symbols EXACTLY same
- Keep status values (PASS/FAIL/CAUTION/WAIT) in ENGLISH — do NOT translate
- Keep step names in English
- Keep verdict in English (Buy/Sell/Hold/Wait/Caution)
- Keep overallScore, num fields as numbers
- Return ONLY valid JSON, same structure

Input JSON:
${JSON.stringify(englishAnalysis)}

Return the translated JSON only. No extra text.`
}

// ── Groq API call ───────────────────────────────────────────────
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
            content: 'You are an expert Indian stock market analyst. Always respond with valid JSON only. No markdown, no backticks. Use specific numbers and facts.',
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

// ── Gemini API call ─────────────────────────────────────────────
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

// ── Call AI (Groq first, Gemini fallback) ───────────────────────
async function callAI(prompt: string) {
  // Try Groq first (more quota)
  let result = await callGroq(prompt)
  if (result) { console.log('✅ Groq success'); return result }

  // Gemini fallback
  result = await callGemini(prompt)
  if (result) { console.log('✅ Gemini success'); return result }

  return null
}

export async function POST(req: NextRequest) {
  const { stockName, language = 'english' } = await req.json()
  const tickerGuess = stockName.toUpperCase().trim()

  // ── Step 1: Check DB cache (English analysis) ───────────────
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

  // ── Step 2: If no cache, get English analysis ───────────────
  if (!englishAnalysis) {
    const analysisPrompt = buildAnalysisPrompt(stockName)
    englishAnalysis = await callAI(analysisPrompt)

    if (!englishAnalysis) {
      return NextResponse.json(
        { error: 'Rate limit reached. Please wait 1 minute and try again.' },
        { status: 429 }
      )
    }

    // Save English analysis to DB
    try {
      await supabase.from('stocks').upsert({
        name: englishAnalysis.company,
        ticker: englishAnalysis.ticker || tickerGuess,
        sector: englishAnalysis.sector,
        analysis: englishAnalysis,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'ticker' })
      console.log(`💾 Saved: ${englishAnalysis.ticker}`)
    } catch (e) {
      console.log('DB save failed:', e)
    }
  }

  // ── Step 3: If English requested, return directly ───────────
  if (language === 'english') {
    return NextResponse.json(englishAnalysis)
  }

  // ── Step 4: Translate to user's language ───────────────────
  console.log(`Translating to ${language}...`)
  const translationPrompt = buildTranslationPrompt(englishAnalysis, language)
  const translated = await callAI(translationPrompt)

  if (!translated) {
    // Translation failed — return English as fallback
    console.log('Translation failed — returning English')
    return NextResponse.json(englishAnalysis)
  }

  // Keep score and verdict from English (consistent!)
  translated.overallScore = englishAnalysis.overallScore
  translated.verdict      = englishAnalysis.verdict
  translated.ticker       = englishAnalysis.ticker
  translated.sector       = englishAnalysis.sector

  return NextResponse.json(translated)
}
