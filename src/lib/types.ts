export type StepStatus = 'PASS' | 'FAIL' | 'CAUTION' | 'WAIT'

export interface StepResult {
  num: number
  name: string
  status: StepStatus
  detail: string
}

export interface StockAnalysis {
  company: string
  ticker: string
  sector: string
  overallScore: number
  verdict: string
  summary: string
  price?: number
  steps: StepResult[]
  updatedAt?: string
}

export const STEP_NAMES = [
  'Industry Check',
  'Business Quality (Moat)',
  'Promoter Check',
  'Risk Check',
  'Management Quality',
  'Financial Strength',
  'Consistency Check',
  'Valuation',
  'Entry Strategy',
  'Position Sizing',
  'Holding Strategy',
  'Exit Rules',
]

export const STATUS_COLOR: Record<StepStatus, string> = {
  PASS:    'bg-green-100 text-green-800',
  FAIL:    'bg-red-100 text-red-800',
  CAUTION: 'bg-yellow-100 text-yellow-800',
  WAIT:    'bg-blue-100 text-blue-800',
}

export function scoreColor(score: number) {
  if (score >= 70) return 'text-green-600'
  if (score >= 50) return 'text-yellow-600'
  return 'text-red-600'
}

export function scoreBg(score: number) {
  if (score >= 70) return 'bg-green-100'
  if (score >= 50) return 'bg-yellow-100'
  return 'bg-red-100'
}
