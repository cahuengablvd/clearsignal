import type { GeoEvidence } from './schemas'

/** Presentation-only citation attachment totals; citation presence is separate. */
export function citationAttachmentCounts(evidence: GeoEvidence[] | undefined, engine: string) {
  const rows = (evidence || []).filter((item) => item.engine === engine && item.scope !== 'supplemental')
  return {
    resolved: rows.filter((item) => item.citation_attachment !== 'unresolved').length,
    unresolved: rows.filter((item) => item.citation_attachment === 'unresolved').length,
  }
}

export function hasSuggestedRewrite(value: string | null | undefined): boolean {
  return Boolean(value?.trim())
}
