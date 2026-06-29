export type FixPriorityInput = {
  impact: string
  effort: string
  confidence?: number | null
}

const IMPACT_SCORE: Record<string, number> = {
  high: 3,
  medium: 2,
  low: 1,
}

const EFFORT_SCORE: Record<string, number> = {
  easy: 1,
  medium: 2,
  hard: 3,
}

export function priorityScore(fix: FixPriorityInput): number {
  const impact = IMPACT_SCORE[fix.impact] ?? 1
  const effort = EFFORT_SCORE[fix.effort] ?? 2
  const confidence = typeof fix.confidence === 'number' ? fix.confidence : 75
  return Math.round(((impact * confidence) / effort) * 10) / 10
}

export function priorityBucket(score: number): 'Do now' | 'This month' | 'Later' | 'Optional' {
  if (score >= 180) return 'Do now'
  if (score >= 90) return 'This month'
  if (score >= 45) return 'Later'
  return 'Optional'
}

export function priorityForFix(fix: FixPriorityInput): {
  score: number
  bucket: 'Do now' | 'This month' | 'Later' | 'Optional'
  formula: string
} {
  const score = priorityScore(fix)
  return {
    score,
    bucket: priorityBucket(score),
    formula: 'Impact x Confidence / Effort',
  }
}
