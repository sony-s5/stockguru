import { NextResponse } from 'next/server'

export async function GET() {
  const key = process.env.GEMINI_API_KEY

  if (!key) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not found in .env.local' })
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'say hi' }] }],
          generationConfig: { maxOutputTokens: 10 }
        })
      }
    )
    const data = await res.json()
    return NextResponse.json({
      status: res.status,
      keyPrefix: key.slice(0, 8) + '...',
      response: data
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message })
  }
}