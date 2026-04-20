'use client'
import { useEffect, useState } from 'react'

interface NewsItem {
  title: string
  link: string
  source: string
  timeAgo: string
}

export default function NewsCard({ stockName }: { stockName: string }) {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/news?stock=${encodeURIComponent(stockName)}`)
      .then(r => r.json())
      .then(d => { setNews(d.items || []); setLoading(false) })
  }, [stockName])

  if (loading) return (
    <div className="bg-white border rounded-xl p-4 space-y-3 animate-pulse">
      {[...Array(4)].map((_, i) => <div key={i} className="h-4 bg-gray-100 rounded" />)}
    </div>
  )

  return (
    <div className="bg-white border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b">
        <h3 className="font-semibold text-gray-900 text-sm">Latest News</h3>
      </div>
      {news.length === 0 ? (
        <p className="text-sm text-gray-400 p-4">No recent news found.</p>
      ) : (
        <div className="divide-y">
          {news.map((item, i) => (
            <a
              key={i}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              <p className="text-sm text-gray-800 leading-snug mb-1">{item.title}</p>
              <div className="flex items-center gap-2">
                {item.source && <span className="text-xs text-gray-400">{item.source}</span>}
                {item.timeAgo && <span className="text-xs text-gray-300">· {item.timeAgo}</span>}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
