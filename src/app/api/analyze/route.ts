import { buildMetrics } from '@/lib/buildMetrics'
import { buildSteps } from '@/lib/buildSteps'
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

function buildAnalysisPrompt(
  stockName: string,
  metrics: any,
  steps: any
) {

return `
You are a stock analysis formatter.

STRICT RULES:
- Never invent numbers
- Never estimate values
- Never modify metrics
- Never create fake CAGR
- Never create fake market share
- Never generate management experience
- Never change step status

Stock: ${stockName}

Metrics:
${JSON.stringify(metrics, null, 2)}

Steps:
${JSON.stringify(steps, null, 2)}

Your task:
- Improve readability only
- Keep numbers EXACTLY SAME
- Keep statuses EXACTLY SAME

Return JSON only:

{
  "summary": "2 line summary",
  "steps": []
}
`
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
  : `No verified data available.`

const metrics = buildMetrics(screenerData)
const steps = buildSteps(metrics)

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
      if (hoursSince < 12) {
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
    const analysisPrompt = buildAnalysisPrompt(
      stockName,
      metrics,
      steps
    )
    englishAnalysis = await callAI(analysisPrompt)
englishAnalysis = {
  ...englishAnalysis,
  company: metrics.companyName,
  ticker: metrics.ticker,
  sector: 'N/A',
  overallScore: 80,
  verdict: 'Buy',
  steps
}
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
