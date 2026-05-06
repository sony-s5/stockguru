import { StepResult, STATUS_COLOR } from '@/lib/types'

// Verify checklist for steps that need live data
const VERIFY_HINTS: Record<number, { items: string[]; link: string; linkLabel: string }> = {
  3: {
    items: [
      'Promoter holding > 40%?',
      'Pledge % = 0% (10%+ is red flag)',
      'Promoter stake increasing or decreasing?',
    ],
    link: 'https://www.screener.in',
    linkLabel: 'Screener.in → Shareholding Pattern',
  },
  6: {
    items: [
      'ROE > 15%?',
      'Revenue growing YoY?',
      'Net Profit growing YoY?',
      'Debt to Equity < 0.5?',
      'Free Cash Flow positive?',
    ],
    link: 'https://www.screener.in',
    linkLabel: 'Screener.in → Key Metrics + Quarterly Results',
  },
  8: {
    items: [
      'P/E ratio < industry average?',
      'P/B ratio < 3?',
      'EPS growing YoY?',
    ],
    link: 'https://www.screener.in',
    linkLabel: 'Screener.in → Key Metrics',
  },
}

// Industry average P/E reference
const PE_REFERENCE = [
  { sector: 'IT', pe: '25–30x' },
  { sector: 'Banking', pe: '15–20x' },
  { sector: 'FMCG', pe: '40–50x' },
  { sector: 'Auto', pe: '20–25x' },
  { sector: 'Pharma', pe: '25–35x' },
]

export default function StepCard({ step, ticker }: { step: StepResult; ticker?: string }) {
  const hint = VERIFY_HINTS[step.num]

  return (
    <div className="bg-white border rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <span className="text-xs font-medium bg-gray-100 text-gray-500 px-2 py-1 rounded-full whitespace-nowrap">
          Step {step.num}
        </span>
        <span className="font-medium text-gray-900 flex-1">{step.name}</span>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLOR[step.status]}`}>
          {step.status}
        </span>
      </div>

      {/* AI Analysis */}
      <p className="text-sm text-gray-500 leading-relaxed mb-3">{step.detail}</p>

      {/* Verify Checklist — only for steps 3, 6, 8 */}
      {hint && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
          <p className="text-xs font-semibold text-blue-700 mb-2">
            📋 Verify on Screener.in:
          </p>
          <ul className="space-y-1 mb-2">
            {hint.items.map((item, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="text-blue-400 text-xs mt-0.5">→</span>
                <span className="text-xs text-blue-700">{item}</span>
              </li>
            ))}
          </ul>

          {/* Step 8 extra — Industry PE reference */}
          {step.num === 8 && (
            <div className="mt-2 mb-2">
              <p className="text-xs font-medium text-blue-600 mb-1">Industry Avg P/E:</p>
              <div className="flex flex-wrap gap-1">
                {PE_REFERENCE.map(r => (
                  <span key={r.sector} className="text-xs bg-white border border-blue-200 text-blue-600 px-2 py-0.5 rounded-full">
                    {r.sector}: {r.pe}
                  </span>
                ))}
              </div>
            </div>
          )}

          <a
            href={ticker
              ? `https://www.screener.in/company/${ticker}/`
              : hint.link
            }
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-xs text-blue-600 hover:underline font-medium"
          >
            {hint.linkLabel} ↗
          </a>
        </div>
      )}
    </div>
  )
}
