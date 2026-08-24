import dictionary from './language-dictionary.json'
import stopwords from './language-stopwords.json'

export const SUPPORTED_LANGUAGES = ['en', 'lv', 'ru', 'lt', 'et', 'de', 'es', 'fr', 'it', 'pl'] as const
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number]
export type DetectedLanguage = SupportedLanguage | 'unknown'

const languageEntries = Object.entries(dictionary as Record<string, string[]>)

export function parseMarketsLanguages(text: string | null | undefined): { languages: SupportedLanguage[]; markets: string[]; raw: string; unknown_tokens: string[] } {
  const raw = text?.trim() || ''
  const matches: Array<{ lang: SupportedLanguage; position: number }> = []
  const unknown_tokens: string[] = []
  const normalized = raw.toLowerCase()
  for (const [lang, names] of languageEntries) {
    const positions = names.map((name) => normalized.search(new RegExp(`(?:^|[^a-z\\p{L}])${name.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}(?:$|[^a-z\\p{L}])`, 'iu'))).filter((position) => position >= 0)
    if (positions.length) matches.push({ lang: lang as SupportedLanguage, position: Math.min(...positions) })
  }
  const languages = matches.sort((a, b) => a.position - b.position).map((match) => match.lang)
  // Preserve operator market wording. First remove known language words, then use only
  // separators A4 explicitly supports; "and" is a separator only for known Toronto/GTA.
  let marketText = raw
  for (const [, names] of languageEntries) for (const name of names.sort((a, b) => b.length - a.length)) marketText = marketText.replace(new RegExp(`(?:^|[;,\s-])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[;,\s-])`, 'giu'), ' ')
  const rawParts = marketText.split(/[;\n]|\s[-–—]\s/).flatMap((part) => {
    if (/\bToronto\s+and\s+GTA\b/i.test(part)) return part.split(/\s+and\s+/i)
    return part.split(/,(?![^()]*\))/)
  })
  const markets = rawParts.map((x) => x.replace(/^\s*(?:primary market|market):?\s*/i, '').trim()).filter(Boolean)
    .filter((part) => !languageEntries.some(([, names]) => names.some((name) => part.toLowerCase() === name.toLowerCase())))
    .filter((part) => !part.split(/\s+(?:and|un)\s+/i).every((segment) => languageEntries.some(([, names]) => names.some((name) => segment.trim().toLowerCase() === name.toLowerCase()))))
    .filter((part) => /\p{Lu}/u.test(part) && !/^primary (market|website language|language|customer base)/i.test(part))
  for (const token of raw.split(/[;,\n-]+/).map((x) => x.trim()).filter(Boolean)) {
    if (/language/i.test(token) && !languages.length) unknown_tokens.push(token)
  }
  return { languages, markets: [...new Set(markets)], raw, unknown_tokens }
}

export function detectLanguage(text: string): { lang: DetectedLanguage; confidence: number } {
  const lower = text.toLowerCase()
  if (!lower.trim()) return { lang: 'unknown', confidence: 0 }
  if (/[\u0101\u010d\u0113\u0123\u012b\u0137\u013c\u0146\u0161\u016b\u017e]/i.test(text)) return { lang: 'lv', confidence: 0.9 }
  const cyrillic = (text.match(/[\u0400-\u04ff]/g) || []).length
  if (cyrillic >= 3) return { lang: 'ru', confidence: 0.9 }
  const words = lower.match(/[\p{L}]+/gu) || []
  const scores = SUPPORTED_LANGUAGES.map((lang) => ({ lang, hits: words.filter((word) => (stopwords as Record<string, string[]>)[lang].includes(word)).length }))
  const top = scores.sort((a, b) => b.hits - a.hits)[0]
  if (!top || top.hits === 0) return { lang: 'unknown', confidence: 0 }
  return { lang: top.lang, confidence: Math.min(0.95, 0.4 + top.hits * 0.1) }
}
