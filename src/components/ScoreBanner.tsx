import { StockAnalysis, scoreColor, scoreBg } from '@/lib/types'

export default function ScoreBanner({ data }: { data: StockAnalysis }) {
  return (
    <div className="bg-white border rounded-xl p-5 flex items-center gap-5 mb-4">
      <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold flex-shrink-0 ${scoreBg(data.overallScore)} ${scoreColor(data.overallScore)}`}>
        {data.overallScore}
      </div>
      <div>
        <p className="text-xs text-gray-400 mb-0.5">{data.ticker} · {data.sector}</p>
        <h2 className="text-lg font-semibold text-gray-900">{data.verdict}</h2>
        <p className="text-sm text-gray-500 mt-0.5">{data.summary}</p>
      </div>
    </div>
  )
}
