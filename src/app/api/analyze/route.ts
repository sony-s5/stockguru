import { NextRequest, NextResponse } from 'next/server'
import { LANG_PROMPTS, Language } from '@/lib/langConstants'
import { createClient } from '@supabase/supabase-js'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function buildPrompt(stockName: string, langInstruction: string) {
  return `You are a fundamental stock analyst. Analyze the Indian stock "${stockName}".

Language instruction: ${langInstruction}

Respond with ONLY valid JSON. No markdown, no backticks, no extra text.

{
  "company": "full company name",
  "ticker": "NSE ticker",
  "sector": "sector name",
  "overallScore": 75,
  "verdict": "Buy",
  "summary": "2 sentence summary in the specified language",
  "steps": [
    {"num": 1,  "name": "Industry Check",          "status": "PASS",    "detail": "detail in specified language"},
    {"num": 2,  "name": "Business Quality (Moat)",  "status": "PASS",    "detail": "detail in specified language"},
    {"num": 3,  "name": "Promoter Check",           "status": "PASS",    "detail": "detail in specified language"},
    {"num": 4,  "name": "Risk Check",               "status": "PASS",    "detail": "detail in specified language"},
    {"num": 5,  "name": "Management Quality",       "status": "PASS",    "detail": "detail in specified language"},
    {"num": 6,  "name": "Financial Strength",       "status": "PASS",    "detail": "detail in specified language"},
    {"num": 7,  "name": "Consistency Check",        "status": "PASS",    "detail": "detail in specified language"},
    {"num": 8,  "name": "Valuation",                "status": "WAIT",    "detail": "detail in specified language"},
    {"num": 9,  "name": "Entry Strategy",           "status": "PASS",    "detail": "detail in specified language"},
    {"num": 10, "name": "Position Sizing",          "status": "PASS",    "detail": "detail in specified language"},
    {"num": 11, "name": "Holding Strategy",         "status": "PASS",    "detail": "detail in specified language"},
    {"num": 12, "name": "Exit Rules",               "status": "CAUTION", "detail": "detail in specified language"}
  ]
}

status: PASS, FAIL, CAUTION, or WAIT only. JSON only.`
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

// ── Gemini API ──────────────────────────────────────────────────
async function callGemini(prompt: string) {
  const models = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
  ]

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
            generationConfig: { temperature: 0.2, maxOutputTokens: 2500 },
          }),
        }
      )
      if (res.status === 429) { console.log(`Gemini ${models[i]} rate limited`); continue }
      if (!res.ok) { console.log(`Gemini ${models[i]} failed: ${res.status}`); continue }

      const data = await res.json()
      const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
      if (!raw) continue

      const parsed = parseJSON(raw)
      console.log(`✅ Gemini success: ${models[i]}`)
      return parsed
    } catch (e: any) {
      console.log(`Gemini ${models[i]} error:`, e?.message)
      continue
    }
  }
  return null
}

// ── Groq API (Fallback) ─────────────────────────────────────────
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
            content: content: 'You are an expert Indian stock market analyst with deep knowledge of NSE/BSE listed companies. Always respond with valid JSON only. No markdown, no backticks. Use SPECIFIC numbers, exact percentages, real competitor names, and actionable insights. Never give vague generic statements.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 2500,
      }),
    })

    if (!res.ok) {
      console.log(`Groq failed: ${res.status}`)
      return null
    }

    const data = await res.json()
    const raw = data?.choices?.[0]?.message?.content || ''
    if (!raw) return null

    const parsed = parseJSON(raw)
    console.log('✅ Groq success!')
    return parsed
  } catch (e: any) {
    console.log('Groq error:', e?.message)
    return null
  }
}

export async function POST(req: NextRequest) {
  const { stockName, language = 'telugu' } = await req.json()
  const tickerGuess = stockName.toUpperCase().trim()

  // ── Step 1: DB Cache check ──────────────────────────────────
  try {
    const cacheKey = `${tickerGuess}_${language}`
    const { data: cached } = await supabase
      .from('stocks')
      .select('analysis, updated_at')
      .or(`ticker.ilike.${cacheKey},name.ilike.%${stockName}%_${language}`)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    if (cached?.analysis) {
      const hoursSince = (Date.now() - new Date(cached.updated_at).getTime()) / 3600000
      if (hoursSince < 24) {
        console.log(`✅ Cache hit: ${cacheKey}`)
        return NextResponse.json({ ...cached.analysis, fromCache: true })
      }
    }
  } catch {
    console.log('Cache miss — calling AI...')
  }

  // ── Step 2: Build prompt ────────────────────────────────────
  const langInstruction = LANG_PROMPTS[language as Language] || LANG_PROMPTS.telugu
  const prompt = buildPrompt(stockName, langInstruction)

  // ── Step 3: Try Gemini first, then Groq fallback ───────────
  let parsed = await callGemini(prompt)

  if (!parsed) {
    console.log('Gemini failed — trying Groq fallback...')
    parsed = await callGroq(prompt)
  }

  if (!parsed) {
    return NextResponse.json(
      { error: 'Rate limit reached. Please wait 1 minute and try again.' },
      { status: 429 }
    )
  }

  // ── Step 4: Auto-save to DB cache ──────────────────────────
  try {
    const cacheKey = `${parsed.ticker}_${language}`
    await supabase.from('stocks').upsert({
      name: `${parsed.company} (${language})`,
      ticker: cacheKey,
      sector: parsed.sector,
      analysis: parsed,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'ticker' })
    console.log(`💾 Auto-saved: ${cacheKey}`)
  } catch (e) {
    console.log('DB save failed (non-critical):', e)
  }

  return NextResponse.json(parsed)
}
