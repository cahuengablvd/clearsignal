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

/** Public answer-engine names that must not be inferred as competitors. */
export function answerEngineCompetitorNames(): readonly string[] {
  return ANSWER_ENGINE_COMPETITOR_NAMES
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
