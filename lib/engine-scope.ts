export const FREE_SCORE_ENGINES = ['claude'] as const
export const FULL_AUDIT_ENGINES = ['claude', 'perplexity', 'openai'] as const

type EngineId = (typeof FULL_AUDIT_ENGINES)[number]

const PUBLIC_ENGINE_NAMES: Record<EngineId, string> = {
  openai: 'ChatGPT',
  claude: 'Claude',
  perplexity: 'Perplexity',
}

// Answer engines are measurement instruments, never inferred competitors.
// Keep their public product and vendor names beside the engine registry so the
// GEO pipeline does not grow an unrelated hardcoded exclusion list.
const ANSWER_ENGINE_COMPETITOR_NAMES = [
  'OpenAI',
  'ChatGPT',
  'Anthropic',
  'Claude',
  'Perplexity',
  'Google',
  'Gemini',
  'Google AI Overviews',
  'AI Mode',
  'Microsoft',
  'Copilot',
] as const

const ANSWER_ENGINE_COMPETITOR_TOKENS = new Set([
  'google',
  'openai',
  'chatgpt',
  'anthropic',
  'claude',
  'perplexity',
  'gemini',
  'copilot',
  'microsoft',
  'bing',
  'ai',
  'overviews',
  'mode',
  'search',
  'assistant',
])

function answerEngineNameKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

const ANSWER_ENGINE_COMPETITOR_KEYS = new Set(
  ANSWER_ENGINE_COMPETITOR_NAMES.map(answerEngineNameKey)
)

/** Public answer-engine names that must not be inferred as competitors. */
export function answerEngineCompetitorNames(): readonly string[] {
  return ANSWER_ENGINE_COMPETITOR_NAMES
}

/** Whether an inferred competitor name consists only of answer-engine vendor/product tokens. */
export function isAnswerEngineCompetitorName(value: string): boolean {
  if (ANSWER_ENGINE_COMPETITOR_KEYS.has(answerEngineNameKey(value))) return true

  const tokens = value.toLowerCase().match(/[a-z0-9]+/g) ?? []
  return tokens.length > 1 && tokens.every((token) => ANSWER_ENGINE_COMPETITOR_TOKENS.has(token))
}

const PUBLIC_ENGINE_ORDER: EngineId[] = ['openai', 'claude', 'perplexity']

function formatPublicEngineNames(engines: readonly EngineId[]): string {
  const names = PUBLIC_ENGINE_ORDER
    .filter((engine) => engines.includes(engine))
    .map((engine) => PUBLIC_ENGINE_NAMES[engine])

  if (names.length <= 1) return names[0] || ''
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

export const FREE_SCORE_ENGINE_NAMES = formatPublicEngineNames(FREE_SCORE_ENGINES)
export const FULL_AUDIT_ENGINE_NAMES = formatPublicEngineNames(FULL_AUDIT_ENGINES)

export const SCORE_ENGINE_SCOPE_COPY =
  `The free score samples one engine (${FREE_SCORE_ENGINE_NAMES}) on a handful of buyer questions. ` +
  `The full audit tests ${FULL_AUDIT_ENGINE_NAMES} across your buyer question set and has a person review the result.`
