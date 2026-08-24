import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { classifyEngineResponse } from '../lib/geo/coverage'

const fixture = (name: string) => JSON.parse(readFileSync(join(process.cwd(), 'tests/fixtures/provider-responses', name), 'utf8'))
const answer = 'A'.repeat(220)
describe('sanitized provider response captures', () => {
  it('uses the real Sonar capture shape and treats returned citations as grounded', () => {
    const payload = fixture('perplexity-ok.json')
    expect(payload.object).toBe('chat.completion')
    expect(payload.choices[0].message.role).toBe('assistant')
    expect(payload.search_results[0]).toEqual(expect.objectContaining({ url: expect.any(String), title: expect.any(String) }))
    expect(classifyEngineResponse({ engine: 'perplexity', ok: true, answer, citations: payload.citations, attempts: 1, tool_events: { search_requests: 1, search_results: payload.citations.length, tool_errors: [], protocol: 'perplexity_sonar' } }, { engine: 'perplexity', webSearch: true }).status).toBe('ok_grounded')
  })
  it('keeps the Anthropic tool-error shape explicitly unconfirmed while covering adapter compatibility', () => {
    const payload = fixture('claude-tool-error.json')
    expect(payload._fixture_status).toMatch(/^UNCONFIRMED:/)
    const error = payload.content.find((x: any) => x.type === 'web_search_tool_result').content
    expect(error).toMatchObject({ type: 'web_search_tool_result_error', error_code: 'too_many_requests' })
  })
  it('uses the real Responses web-search capture shape and classifies its citations as grounded', () => {
    const payload = fixture('openai-web-search-call.json')
    const search = payload.output.find((x: any) => x.type === 'web_search_call')
    const output = payload.output.find((x: any) => x.type === 'message').content[0]
    expect(payload).toMatchObject({ object: 'response', model: 'gpt-4o-2024-08-06' })
    expect(search).toMatchObject({ status: 'completed', action: { type: 'search', queries: expect.any(Array) } })
    expect(output).toMatchObject({ type: 'output_text', annotations: [expect.objectContaining({ type: 'url_citation', start_index: expect.any(Number), end_index: expect.any(Number), title: expect.any(String), url: expect.any(String) })] })
    expect(classifyEngineResponse({ engine: 'openai', ok: true, answer, citations: output.annotations.map((a: any) => a.url), attempts: 1, tool_events: { search_requests: 1, search_results: 1, tool_errors: [], protocol: 'openai_web_search_preview' } }, { engine: 'openai', webSearch: true }).status).toBe('ok_grounded')
  })
})
