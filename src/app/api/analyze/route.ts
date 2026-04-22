import { NextRequest, NextResponse } from 'next/server'
import { LANG_PROMPTS, Language } from '@/lib/langConstants'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

export async function POST(req: NextRequest) {
  const { stockName, language = 'telugu' } = await req.json()

  const langInstruction = LANG_PROMPTS[language as Language] || LANG_PROMPTS.telugu

  const prompt = `You are a fundamental stock analyst. Analyze the Indian stock "${stockName}".

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

  const urls = [
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`,
  ]

  for (let i = 0; i < urls.length; i++) {
    if (i > 0) await sleep(3000)
    try {
      const res = await fetch(urls[i], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 2500 },
        }),
      })
      if (res.status === 429) { console.log(`429 on attempt ${i + 1}`); continue }
      if (!res.ok) { console.log(`Attempt ${i + 1} failed: ${res.status}`); continue }

      const data = await res.json()
      const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
      if (!raw) continue

      let clean = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
      const s = clean.indexOf('{'), e = clean.lastIndexOf('}')
      if (s !== -1 && e !== -1) clean = clean.slice(s, e + 1)

      const parsed = JSON.parse(clean)
      console.log(`✅ Success on attempt ${i + 1}`)
      return NextResponse.json(parsed)
    } catch (e: any) {
      console.log(`Attempt ${i + 1} error:`, e?.message)
      continue
    }
  }

  return NextResponse.json(
    { error: 'Rate limit reached. 1 minute wait cheyyi and try again.' },
    { status: 429 }
  )
}
