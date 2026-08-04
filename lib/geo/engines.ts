/**
 * Multi-engine AEO (Answer Engine Optimization) adapters.
 *
 * Each adapter asks a real "answer engine" a buyer-intent question and returns
 * the grounded answer plus the source URLs it cited. This is what lets us
 * MEASURE whether a brand actually surfaces in AI answers - as opposed to the
 * old heuristic that just guessed "citation-worthiness" from page text.
 *
 * Engines degrade gracefully: if an API key is missing or a call fails, the
 * engine reports `ok: false` and is skipped. Claude (web search) uses the
 * existing ANTHROPIC_API_KEY and is the always-on baseline.
 */
import Anthropic from '@anthropic-ai/sdk'
import { anthropicUsageEvent, type CostEvent } from '../cost-tracker'
import { logAnthropicCall, type AnthropicRequestMeta } from '../ai-observability'
import { FULL_AUDIT_ENGINES } from '../engine-scope'

export type EngineId = (typeof FULL_AUDIT_ENGINES)[number]

export interface EngineResponse {
  engine: EngineId
  ok: boolean
  /** The grounded natural-language answer the engine produced. */
  answer: string
  /** Source URLs the engine cited / grounded its answer on. */
  citations: string[]
  error?: string
}

const ENGINE_TIMEOUT_MS = 45_000
// A production-key Sonnet 4.6 call with web_search max_uses: 2 took 59.928s
// on 2026-08-04. Keep 1.5x headroom without threatening the 7-minute audit gate.
const CLAUDE_WEB_SEARCH_TIMEOUT_MS = 90_000
const FAST_ENGINE_TIMEOUT_MS = 20_000

async function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>, ms: number, label: string): Promise<T> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(`${label} timed out after ${ms}ms`)
      reject(error)
      controller.abort(error)
    }, ms)
  })

  try {
    return await Promise.race([run(controller.signal), timeout])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

function uniqueUrls(urls: (string | undefined | null)[]): string[] {
  const seen = new Set<string>()
  for (const u of urls) {
    if (!u) continue
    try {
      // Normalise to hostname + path so the same source isn't double-counted.
      const parsed = new URL(u)
      seen.add(`${parsed.protocol}//${parsed.host}${parsed.pathname}`)
    } catch {
      seen.add(u)
    }
  }
  return [...seen]
}

// --- Claude (web search) -----------------------------------------------------

let _anthropic: Anthropic | null = null
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  return _anthropic
}

async function queryClaude(
  question: string,
  opts: { webSearch?: boolean; signal?: AbortSignal; onUsage?: (event: CostEvent) => void; purpose?: string; meta?: AnthropicRequestMeta } = {}
): Promise<EngineResponse> {
  const callStartedAt = new Date().toISOString()
  try {
    if (opts.webSearch === false) {
      const model = 'claude-haiku-4-5-20251001'
      const purpose = opts.purpose ?? 'geo:claude'
      const res: any = await getAnthropic().messages.create(
        {
          model,
          max_tokens: 700,
          system:
            'Answer as a buyer research assistant. Recommend relevant products/vendors when appropriate. Be concise.',
          messages: [{ role: 'user', content: question }],
        } as any,
        opts.signal ? { signal: opts.signal } : undefined
      )
      const usage = anthropicUsageEvent({ model, purpose, usage: res.usage })
      opts.onUsage?.(usage)
      await logAnthropicCall({
        meta: opts.meta,
        model,
        purpose,
        startedAt: callStartedAt,
        finishedAt: new Date().toISOString(),
        usage,
        responseOrError: res,
        status: 'succeeded',
      })

      const answer = (res.content ?? [])
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('')
        .trim()

      return { engine: 'claude', ok: true, answer, citations: [] }
    }

    // web_search_20260209 supports dynamic filtering on Sonnet 4.6. The server
    // tool runs on Anthropic's infra and returns citations inline.
    const model = 'claude-sonnet-4-6'
    const purpose = opts.purpose ?? 'geo:claude_web'
    const res: any = await getAnthropic().messages.create(
      {
        model,
        max_tokens: 1500,
        messages: [{ role: 'user', content: question }],
        tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 2 } as any],
      } as any,
      opts.signal ? { signal: opts.signal } : undefined
    )
    const usage = anthropicUsageEvent({ model, purpose, usage: res.usage })
    opts.onUsage?.(usage)
    await logAnthropicCall({
      meta: opts.meta,
      model,
      purpose,
      startedAt: callStartedAt,
      finishedAt: new Date().toISOString(),
      usage,
      responseOrError: res,
      status: 'succeeded',
    })

    let answer = ''
    const citations: string[] = []

    for (const block of res.content ?? []) {
      if (block.type === 'text') {
        answer += block.text
        for (const c of block.citations ?? []) {
          if (c?.url) citations.push(c.url)
        }
      } else if (block.type === 'web_search_tool_result') {
        const inner = block.content
        if (Array.isArray(inner)) {
          for (const r of inner) if (r?.url) citations.push(r.url)
        }
      }
    }

    return { engine: 'claude', ok: true, answer: answer.trim(), citations: uniqueUrls(citations) }
  } catch (err) {
    const model = opts.webSearch === false ? 'claude-haiku-4-5-20251001' : 'claude-sonnet-4-6'
    await logAnthropicCall({
      meta: opts.meta,
      model,
      purpose: opts.purpose ?? (opts.webSearch === false ? 'geo:claude' : 'geo:claude_web'),
      startedAt: callStartedAt,
      finishedAt: new Date().toISOString(),
      responseOrError: err,
      status: 'failed',
      error: err instanceof Error ? err.message : String(err),
    })
    return {
      engine: 'claude',
      ok: false,
      answer: '',
      citations: [],
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

// --- Perplexity --------------------------------------------------------------
// OpenAI-compatible Chat Completions endpoint. The `sonar` model always grounds
// its answer in live web sources and returns them in `citations`.

async function queryPerplexity(
  question: string,
  opts: { signal?: AbortSignal; onUsage?: (event: CostEvent) => void; purpose?: string } = {}
): Promise<EngineResponse> {
  const key = process.env.PERPLEXITY_API_KEY
  if (!key) {
    return { engine: 'perplexity', ok: false, answer: '', citations: [], error: 'PERPLEXITY_API_KEY not set' }
  }
  try {
    const resp = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      signal: opts.signal,
      body: JSON.stringify({
        model: 'sonar',
        messages: [{ role: 'user', content: question }],
      }),
    })
    if (!resp.ok) throw new Error(`Perplexity HTTP ${resp.status}: ${await resp.text()}`)
    const data: any = await resp.json()
    opts.onUsage?.({
      provider: 'perplexity',
      model: data?.model ?? 'sonar',
      purpose: opts.purpose ?? 'geo:perplexity',
      input_tokens: Number(data?.usage?.prompt_tokens ?? 0),
      output_tokens: Number(data?.usage?.completion_tokens ?? 0),
    })
    const answer: string = data?.choices?.[0]?.message?.content ?? ''
    const citations: string[] = data?.citations ?? data?.search_results?.map((s: any) => s?.url) ?? []
    return { engine: 'perplexity', ok: true, answer: answer.trim(), citations: uniqueUrls(citations) }
  } catch (err) {
    return {
      engine: 'perplexity',
      ok: false,
      answer: '',
      citations: [],
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

// --- OpenAI (ChatGPT with web search) ---------------------------------------
// Responses API with the hosted web_search tool. URL citations come back as
// annotations on the output_text content.

async function queryOpenAI(
  question: string,
  opts: { signal?: AbortSignal; onUsage?: (event: CostEvent) => void; purpose?: string } = {}
): Promise<EngineResponse> {
  const key = process.env.OPENAI_API_KEY
  if (!key) {
    return { engine: 'openai', ok: false, answer: '', citations: [], error: 'OPENAI_API_KEY not set' }
  }
  try {
    const resp = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      signal: opts.signal,
      body: JSON.stringify({
        model: 'gpt-4o',
        tools: [{ type: 'web_search_preview' }],
        input: question,
      }),
    })
    if (!resp.ok) throw new Error(`OpenAI HTTP ${resp.status}: ${await resp.text()}`)
    const data: any = await resp.json()
    opts.onUsage?.({
      provider: 'openai',
      model: data?.model ?? 'gpt-4o',
      purpose: opts.purpose ?? 'geo:openai',
      input_tokens: Number(data?.usage?.input_tokens ?? data?.usage?.prompt_tokens ?? 0),
      output_tokens: Number(data?.usage?.output_tokens ?? data?.usage?.completion_tokens ?? 0),
    })

    let answer = ''
    const citations: string[] = []
    for (const item of data?.output ?? []) {
      if (item?.type === 'message') {
        for (const c of item.content ?? []) {
          if (c?.type === 'output_text') {
            answer += c.text ?? ''
            for (const a of c.annotations ?? []) {
              if (a?.type === 'url_citation' && a.url) citations.push(a.url)
            }
          }
        }
      }
    }
    // Fallback for SDK-style convenience field.
    if (!answer && typeof data?.output_text === 'string') answer = data.output_text

    return { engine: 'openai', ok: true, answer: answer.trim(), citations: uniqueUrls(citations) }
  } catch (err) {
    return {
      engine: 'openai',
      ok: false,
      answer: '',
      citations: [],
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

const ADAPTERS: Record<
  EngineId,
  (q: string, opts?: { signal?: AbortSignal; onUsage?: (event: CostEvent) => void; purpose?: string }) => Promise<EngineResponse>
> = {
  claude: queryClaude,
  perplexity: queryPerplexity,
  openai: queryOpenAI,
}

/** Which engines have credentials configured right now. Claude is always on. */
export function availableEngines(): EngineId[] {
  return FULL_AUDIT_ENGINES.filter((engine) => {
    if (engine === 'claude') return true
    if (engine === 'perplexity') return Boolean(process.env.PERPLEXITY_API_KEY)
    return Boolean(process.env.OPENAI_API_KEY)
  })
}

/** Run one question against one engine (with a hard timeout). */
export async function queryEngine(
  engine: EngineId,
  question: string,
  opts: { webSearch?: boolean; onUsage?: (event: CostEvent) => void; purpose?: string; meta?: AnthropicRequestMeta } = {}
): Promise<EngineResponse> {
  try {
    const timeout = opts.webSearch === false
      ? FAST_ENGINE_TIMEOUT_MS
      : engine === 'claude'
        ? CLAUDE_WEB_SEARCH_TIMEOUT_MS
        : ENGINE_TIMEOUT_MS
    return await withTimeout(
      (signal) => engine === 'claude'
        ? queryClaude(question, {
            webSearch: opts.webSearch,
            signal,
            onUsage: opts.onUsage,
            purpose: opts.purpose,
            meta: opts.meta,
          })
        : ADAPTERS[engine](question, { signal, onUsage: opts.onUsage, purpose: opts.purpose }),
      timeout,
      `${engine} query`
    )
  } catch (err) {
    return {
      engine,
      ok: false,
      answer: '',
      citations: [],
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
