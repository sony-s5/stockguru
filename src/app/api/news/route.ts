import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const stock = req.nextUrl.searchParams.get('stock') // e.g. "TCS" or "Tata Consultancy"
  if (!stock) return NextResponse.json({ error: 'stock required' }, { status: 400 })

  try {
    const query = encodeURIComponent(`${stock} stock NSE India`)
    const rssUrl = `https://news.google.com/rss/search?q=${query}&hl=en-IN&gl=IN&ceid=IN:en`

    const res = await fetch(rssUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 900 }, // cache 15 mins
    })
    const xml = await res.text()

    // Parse RSS items
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 8).map(m => {
      const item = m[1]
      const title   = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] || item.match(/<title>(.*?)<\/title>/)?.[1] || ''
      const link    = item.match(/<link>(.*?)<\/link>/)?.[1] || ''
      const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || ''
      const source  = item.match(/<source[^>]*>(.*?)<\/source>/)?.[1] || ''
      return {
        title: title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'),
        link,
        pubDate,
        source,
        timeAgo: getTimeAgo(pubDate),
      }
    })

    return NextResponse.json({ items })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch news' }, { status: 500 })
  }
}

function getTimeAgo(dateStr: string): string {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}
