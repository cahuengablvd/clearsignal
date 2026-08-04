import Anthropic from '@anthropic-ai/sdk'
import { anthropicUsageEvent, type CostEvent } from './cost-tracker'
import { logAnthropicCall, type AnthropicRequestMeta } from './ai-observability'

let _anthropic: Anthropic | null = null

function getAnthropic() {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  }
  return _anthropic
}

/**
 * Call Claude and parse JSON from the response.
 * Retries once with a repair prompt on parse/validation failure.
 */
export async function callClaudeJSON<T>(opts: {
  model: string
  system: string
  user: string
  validate: (data: unknown) => T
  maxTokens?: number
  purpose?: string
  onUsage?: (event: CostEvent) => void
  meta?: AnthropicRequestMeta
  signal?: AbortSignal
}): Promise<T> {
  const { model, system, user, validate, maxTokens = 4096, purpose = 'anthropic_json', onUsage, meta, signal } = opts

  // First attempt
  let rawText = await callClaude(model, system, user, maxTokens, purpose, onUsage, meta, signal)
  let parsed = tryParseAndValidate(rawText, validate)
  if (parsed.success) return parsed.data

  // Retry with repair prompt
  console.warn('First attempt failed validation, retrying with repair prompt...')
  rawText = await callClaude(
    model,
    system,
    buildRepairPrompt(user, parsed.error, rawText),
    maxTokens,
    `${purpose}:repair`,
    onUsage,
    meta ? { ...meta, stage: `${meta.stage}:repair` } : undefined,
    signal
  )
  parsed = tryParseAndValidate(rawText, validate)
  if (parsed.success) return parsed.data

  throw new Error(`Claude output failed validation after retry: ${parsed.error}`)
}

/**
 * The repair prompt MUST restate the original request: without it the model
 * reconstructs the JSON from the 2000-char excerpt alone and loses every
 * schema constraint (invented enum values, dropped required fields) - which
 * turned any transient first-attempt failure into a guaranteed audit failure.
 */
export function buildRepairPrompt(user: string, error: string, rawText: string): string {
  return `Your previous response was not valid JSON or did not match the required schema.

Validation error:
${error}

Your previous response (first 2000 chars):
${rawText.slice(0, 2000)}

The ORIGINAL REQUEST is repeated below. Follow its schema and instructions exactly.
Return ONLY valid JSON. No commentary, no markdown fences.

--- ORIGINAL REQUEST ---
${user}`
}

async function callClaude(
  model: string,
  system: string,
  user: string,
  maxTokens: number,
  purpose: string,
  onUsage?: (event: CostEvent) => void,
  meta?: AnthropicRequestMeta,
  signal?: AbortSignal
): Promise<string> {
  const startedAt = new Date().toISOString()
  let response: Anthropic.Messages.Message
  try {
    response = await getAnthropic().messages.create(
      {
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: user }],
      },
      signal ? { signal } : undefined
    )
  } catch (err) {
    await logAnthropicCall({
      meta,
      model,
      purpose,
      startedAt,
      finishedAt: new Date().toISOString(),
      responseOrError: err,
      status: 'failed',
      error: err instanceof Error ? err.message : String(err),
    })
    throw err
  }

  const usage = anthropicUsageEvent({ model, purpose, usage: (response as any).usage })
  onUsage?.(usage)
  await logAnthropicCall({
    meta,
    model,
    purpose,
    startedAt,
    finishedAt: new Date().toISOString(),
    usage,
    responseOrError: response,
    status: 'succeeded',
  })

  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text block in Claude response')
  }
  return textBlock.text
}

function tryParseAndValidate<T>(
  raw: string,
  validate: (data: unknown) => T
): { success: true; data: T } | { success: false; error: string } {
  try {
    // Strip markdown fences if present
    let cleaned = raw.trim()
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }
    const parsed = JSON.parse(cleaned)
    const validated = validate(parsed)
    return { success: true, data: validated }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}
