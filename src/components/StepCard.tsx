import { StepResult, STATUS_COLOR } from '@/lib/types'

export default function StepCard({ step }: { step: StepResult }) {
  return (
    <div className="bg-white border rounded-xl p-4">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-xs font-medium bg-gray-100 text-gray-500 px-2 py-1 rounded-full">
          Step {step.num}
        </span>
        <span className="font-medium text-gray-900 flex-1">{step.name}</span>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLOR[step.status]}`}>
          {step.status}
        </span>
      </div>
      <p className="text-sm text-gray-500 leading-relaxed">{step.detail}</p>
    </div>
  )
}
