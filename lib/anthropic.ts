import Anthropic from '@anthropic-ai/sdk'

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
}): Promise<T> {
  const { model, system, user, validate, maxTokens = 4096 } = opts

  // First attempt
  let rawText = await callClaude(model, system, user, maxTokens)
  let parsed = tryParseAndValidate(rawText, validate)
  if (parsed.success) return parsed.data

  // Retry with repair prompt
  console.warn('First attempt failed validation, retrying with repair prompt...')
  const repairPrompt = `The previous response was not valid JSON or did not match the required schema.

Error: ${parsed.error}

Original response (first 2000 chars):
${rawText.slice(0, 2000)}

Please return ONLY valid JSON matching the exact schema. No commentary, no markdown fences.`

  rawText = await callClaude(model, system, repairPrompt, maxTokens)
  parsed = tryParseAndValidate(rawText, validate)
  if (parsed.success) return parsed.data

  throw new Error(`Claude output failed validation after retry: ${parsed.error}`)
}

async function callClaude(model: string, system: string, user: string, maxTokens: number): Promise<string> {
  const response = await getAnthropic().messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
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
