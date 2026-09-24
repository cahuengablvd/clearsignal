import type { GeoEvidence, GeoResult, QueryProvenance } from '../schemas'

const LANGUAGE_NAMES: Record<string, string> = { en: 'English', lv: 'Latvian', ru: 'Russian', es: 'Spanish', de: 'German', fr: 'French', it: 'Italian', pl: 'Polish', et: 'Estonian', lt: 'Lithuanian', ar: 'Arabic' }

function languageName(value: string): string {
  return LANGUAGE_NAMES[value.trim().toLowerCase()] || value
}

function measuredLanguages(provenance: QueryProvenance[], scope?: 'core' | 'supplemental'): string[] {
  return [...new Set(provenance
    .filter((item) => item.state === 'valid' && (!scope || item.scope === scope))
    .map((item) => languageName(item.language))
    .filter((language) => language !== 'unknown'))]
}

function measuredMarket(provenance: QueryProvenance[], executedPlanMarkets?: string[]): string | null {
  const markets = [...new Set(provenance
    .filter((item) => item.scope === 'core' && item.state === 'valid')
    .map((item) => item.market)
    .filter((item): item is string => Boolean(item)))]
  return markets.length ? markets.join(', ') : executedPlanMarkets?.length ? executedPlanMarkets.join(', ') : null
}

function untestedLanguageDisclosure(requested: string | undefined, tested: string[]): string | undefined {
  if (!requested) return undefined
  const requestedNames = Object.entries(LANGUAGE_NAMES)
    .filter(([code, name]) => new RegExp(`\\b(${code}|${name})\\b`, 'i').test(requested))
    .map(([, name]) => name)
  const missing = requestedNames.filter((name) => !tested.includes(name))
  return missing.length ? `${missing.join(' and ')} buyer questions were not tested in this audit.` : undefined
}

function searchModeDisclosure(protocol: GeoResult['acquisition_protocol']): string | undefined {
  if (!protocol?.engines.length) return undefined
  const modes = protocol.engines.map((item) => `${item.engine}: ${item.web_search_mode === 'disabled' ? 'web search disabled' : 'provider web-search mode'}`)
  return `Tool/search mode: ${modes.join('; ')}. This measures provider API responses, not literal consumer ChatGPT UI observations.`
}

/** Pure methodology construction shared by fresh scans and stored-evidence rebuilds. */
export function buildMeasurementMethodology(input: {
  provenance: QueryProvenance[]
  evidence: GeoEvidence[]
  engines: string[]
  acquisitionProtocol?: GeoResult['acquisition_protocol']
  requestedMarketsLanguages?: string
  executedPlanMarkets?: string[]
}) {
  const core = input.provenance.filter((item) => item.scope === 'core' && item.state === 'valid')
  const supplemental = input.provenance.filter((item) => item.scope === 'supplemental' && item.state === 'valid')
  const languages = measuredLanguages(input.provenance, 'core')
  const supplementalLanguages = measuredLanguages(input.provenance, 'supplemental')
  return {
    market: measuredMarket(input.provenance, input.executedPlanMarkets),
    languages_tested: languages,
    supplemental_languages_tested: supplementalLanguages,
    core_queries: core.length,
    supplemental_queries: supplemental.length,
    providers: input.engines.map((engine) => ({ engine, model: input.evidence.find((item) => item.engine === engine)?.model || null })),
    samples_per_combination: input.acquisitionProtocol?.samples_per_combination || 1,
    user_location: null,
    location_behavior: 'Provider default; no explicit user location was set.',
    untested_languages_disclosure: untestedLanguageDisclosure(input.requestedMarketsLanguages, [...languages, ...supplementalLanguages]),
    search_mode_disclosure: searchModeDisclosure(input.acquisitionProtocol),
  }
}
