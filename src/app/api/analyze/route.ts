// app/api/analyze/route.ts
import { fetchAlphaData } from '@/lib/alpha'
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

// ─────────────────────────────────────────────────────────────────────────────
// Improved AI prompt — richer context, better instructions
// ─────────────────────────────────────────────────────────────────────────────
function buildAnalysisPrompt(stockName: string, metrics: any, steps: any, screenerFormatted: string) {
  const nullFields = Object.entries(metrics)
    .filter(([, v]) => v === null)
    .map(([k]) => k)

  return `You are an expert Indian stock market analyst. Analyze this stock using ONLY the provided data.

STRICT RULES — NEVER violate these:
- NEVER invent, estimate, or assume any number not in the data below
- NEVER change any step status (PASS/FAIL/CAUTION/WAIT)
- NEVER modify any metric values
- If a field is null/N/A, explicitly say "data unavailable" for that point
- Do NOT hallucinate management names, market share, or future forecasts

=== VERIFIED STOCK DATA ===
${screenerFormatted}

=== NULL / UNAVAILABLE FIELDS ===
${nullFields.length > 0 ? nullFields.join(', ') : 'None — all data available'}

=== ANALYSIS STEPS (DO NOT MODIFY STATUS) ===
${JSON.stringify(steps, null, 2)}

=== YOUR TASK ===
1. Write a 2-line executive summary using ONLY the available numbers above
2. For each step, improve the "detail" text for readability — keep all numbers EXACTLY the same
3. For steps with null data, explain what the investor should manually check and why it matters
4. Sector context: if sector is available, briefly mention what's typical for that sector

Return ONLY valid JSON in this exact format (no markdown, no backticks):
{
  "summary": "2-line summary using only verified numbers",
  "sector_context": "1-line sector observation or empty string if sector unknown",
  "steps": [
    {
      "num": 1,
      "name": "step name",
      "status": "EXACTLY as provided above",
      "detail": "improved detail text",
      "checklistItems": ["item1"] or null,
      "verifyLinks": [{"label": "...", "url": "..."}] or null
    }
  ]
}`
}

// ─────────────────────────────────────────────────────────────────────────────
// AI callers
// ─────────────────────────────────────────────────────────────────────────────
async function callGroq(prompt: string) {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model:       'llama-3.3-70b-versatile',
        messages: [
          {
            role:    'system',
            content: 'You are an expert Indian stock market analyst. Respond with valid JSON only. No markdown. No backticks. Never hallucinate.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0,
        max_tokens:  4000,
      }),
    })
    if (!res.ok) { console.log(`Groq failed: ${res.status}`); return null }
    const data = await res.json()
    const raw  = data?.choices?.[0]?.message?.content || ''
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
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            contents:       [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0, maxOutputTokens: 4000 },
          }),
        }
      )
      if (res.status === 429) { console.log(`Gemini ${models[i]} rate limited`); continue }
      if (!res.ok)            { console.log(`Gemini ${models[i]} failed: ${res.status}`); continue }
      const data = await res.json()
      const raw  = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
      if (!raw) continue
      return parseJSON(raw)
    } catch { continue }
  }
  return null
}

async function callAI(prompt: string) {
  const result = await callGroq(prompt)
  if (result) { console.log('✅ Groq success'); return result }
  const result2 = await callGemini(prompt)
  if (result2) { console.log('✅ Gemini success'); return result2 }
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Route
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { stockName } = await req.json()
  const tickerGuess = stockName.toUpperCase().trim()

  // ── Fetch data in parallel ─────────────────────────────────────────────
  const [screenerData, yahooData] = await Promise.all([
    fetchScreenerData(tickerGuess),
    fetchAlphaData(tickerGuess),
  ])

  console.log('SCREENER DATA:', JSON.stringify(screenerData, null, 2))
  console.log('📊 Screener context ready:', screenerData ? 'YES' : 'NO')

  const metrics = buildMetrics(screenerData, yahooData)
  const { overallScore, verdict, steps } = buildSteps(metrics)

  // ── Cache check ────────────────────────────────────────────────────────
  let englishAnalysis: any = null

  try {
    const { data: cached } = await supabase
      .from('stocks')
      .select('analysis, updated_at, ticker')
      .eq('ticker', tickerGuess)
      .not('ticker', 'ilike', '%\\_%')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    if (cached?.analysis) {
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

  // ── Fresh AI analysis ──────────────────────────────────────────────────
  if (!englishAnalysis) {
    const screenerFormatted = screenerData
      ? formatScreenerDataForPrompt(screenerData)
      : 'Screener data unavailable — analysis based on partial data only.'

    const analysisPrompt = buildAnalysisPrompt(stockName, metrics, steps, screenerFormatted)
    const aiResult = await callAI(analysisPrompt)

    if (!aiResult) {
      return NextResponse.json(
        { error: 'AI rate limit reached. Please wait 1 minute and try again.' },
        { status: 429 }
      )
    }

    // Merge AI-improved step details back (preserve original statuses)
    const enhancedSteps = steps.map((step: any) => {
      const aiStep = aiResult?.steps?.find((s: any) => s.num === step.num)
      if (!aiStep) return step
      return {
        ...step,
        // AI can only improve detail text — status is LOCKED from buildSteps
        detail:        aiStep.detail        ?? step.detail,
        checklistItems: aiStep.checklistItems ?? step.checklistItems ?? null,
        verifyLinks:   aiStep.verifyLinks   ?? step.verifyLinks   ?? null,
      }
    })

    englishAnalysis = {
      company:        metrics.companyName,
      ticker:         tickerGuess,
      sector:         metrics.sector,
      overallScore,
      verdict,
      summary:        aiResult?.summary        ?? `${metrics.companyName} analysis based on verified data.`,
      sectorContext:  aiResult?.sector_context  ?? '',
      dataQuality: {
        totalFields:   Object.keys(metrics).length,
        nullFields:    Object.values(metrics).filter(v => v === null).length,
        confidence:    screenerData ? 'HIGH' : 'LOW',
      },
      steps: enhancedSteps,
    }

    // ── Save to DB ──────────────────────────────────────────────────────
    try {
      await supabase.from('stocks').upsert({
        name:       englishAnalysis.company,
        ticker:     tickerGuess,
        sector:     englishAnalysis.sector,
        analysis:   englishAnalysis,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'ticker' })
      console.log(`💾 Saved: ${tickerGuess}`)
    } catch (e) {
      console.log('DB save failed:', e)
    }
  }

  return NextResponse.json(englishAnalysis)
}