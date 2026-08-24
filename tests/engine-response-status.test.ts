import { describe, expect, it } from 'vitest'
import { classifyEngineResponse, deriveExcerpt } from '../lib/geo/coverage'

const answer = 'A'.repeat(220)
const base = { engine: 'claude' as const, ok: true, answer, citations: [], attempts: 1 }
describe('A1 engine response status', () => {
  it('keeps valid no-citation answers successful', () => expect(classifyEngineResponse(base, { engine: 'claude', webSearch: true }).status).toBe('ok_no_citations'))
  it('recognizes Claude tool failures without treating zero citations as failure', () => expect(classifyEngineResponse({ ...base, answer: `${answer} based on my training knowledge`, tool_events: { search_requests: 1, search_results: 0, tool_errors: ['too_many_requests'], protocol: 'claude_web_search' } }, { engine: 'claude', webSearch: true }).status).toBe('tool_failure'))
  it('keeps successful search narration grounded', () => expect(classifyEngineResponse({ ...base, tool_events: { search_requests: 1, search_results: 1, tool_errors: [], protocol: 'claude_web_search' } }, { engine: 'claude', webSearch: true }).status).toBe('ok_grounded'))
  it('keeps Perplexity zero-citation anomaly successful', () => expect(classifyEngineResponse({ ...base, engine: 'perplexity' }, { engine: 'perplexity', webSearch: true })).toMatchObject({ status: 'ok_no_citations', reason: 'protocol_anomaly_no_citations' }))
  it('classifies timeout and empty answers', () => { expect(classifyEngineResponse({ ...base, ok: false, error: 'timed out' }, { engine: 'claude', webSearch: true }).status).toBe('timeout'); expect(classifyEngineResponse({ ...base, answer: 'short' }, { engine: 'claude', webSearch: true }).status).toBe('empty') })
  it('falls back to the beginning for a long narration-only answer', () => { const narration = 'Let me compile the available information before presenting the answer in a useful format.'; const r = deriveExcerpt(narration); expect(r.offset).toBe(0); expect(r.excerpt).toBe(narration) })
  it('falls back to the beginning when every paragraph is short', () => { const answer = 'Brief note.\n\nStill short.\n\nOne more short note.'; const r = deriveExcerpt(answer); expect(r.offset).toBe(0); expect(r.excerpt).toBe(answer) })
  it('derives an excerpt after tool narration', () => { const r = deriveExcerpt(`Let me compile this.\n\n${answer}`); expect(r.offset).toBeGreaterThan(0); expect(r.excerpt).toBe(answer) })
  it('derives a later duplicate paragraph rather than reusing its first offset', () => { const repeated = 'Repeated paragraph that is long enough to qualify as a real answer section.'; const r = deriveExcerpt(`Let me compile this.\n\n${repeated}\n\nLet me compile this.\n\n${repeated}`, repeated.length); expect(r.offset).toBe('Let me compile this.\n\n'.length); expect(r.excerpt).toBe(repeated) })
})
