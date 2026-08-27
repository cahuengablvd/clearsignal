import { registrableDomain } from './detect'
import { isAnswerEngineCompetitorName } from '../engine-scope'

export type EntityRole = 'competitor' | 'channel_or_directory' | 'source_or_publisher' | 'engine' | 'generic' | 'unknown'
export type EntityState = 'accepted' | 'channel' | 'unconfirmed' | 'rejected'
export type RoleSource = 'operator' | 'dictionary' | 'extractor' | 'reviewer'
export type EntityCandidate = { name: string; role_guess: EntityRole; quote: string; answer_index: number }
export type ResolvedEntity = { entity_id: string; display_name: string; aliases: string[]; role: EntityRole; role_source: RoleSource; state: EntityState; state_reason?: string; occurrences: number; distinct_queries: number; distinct_engines: number; domain_corroborated: boolean; operator_provided: boolean; possible_competitor_flag?: boolean; composite?: boolean }
export type EntityObservation = { entity_id: string; name_as_written: string; role: EntityRole; span_start: number; span_end: number; matched_alias: string; text_source: 'answer_text' | 'answer_excerpt' }

type Channel = { canonical: string; aliases: string[]; domains: string[]; kind: string }
export const KNOWN_CHANNELS: Channel[] = [
  ['Facebook', ['facebook'], ['facebook.com'], 'social'], ['Instagram', ['instagram'], ['instagram.com'], 'social'], ['Reddit', ['reddit'], ['reddit.com'], 'social'], ['Nextdoor', ['nextdoor'], ['nextdoor.com'], 'social'], ['LinkedIn', ['linkedin'], ['linkedin.com'], 'social'], ['YouTube', ['youtube'], ['youtube.com'], 'social'], ['TikTok', ['tiktok'], ['tiktok.com'], 'social'], ['Google Maps', ['google maps', 'google business profile'], ['google.com'], 'directory'], ['Yelp', ['yelp'], ['yelp.com'], 'directory'], ['TripAdvisor', ['tripadvisor'], ['tripadvisor.com'], 'directory'], ['Trustpilot', ['trustpilot'], ['trustpilot.com'], 'directory'], ['G2', ['g2'], ['g2.com'], 'directory'], ['Capterra', ['capterra'], ['capterra.com'], 'directory'], ['Clutch', ['clutch'], ['clutch.co'], 'directory'], ['Crunchbase', ['crunchbase'], ['crunchbase.com'], 'directory'], ['Yellow Pages', ['yellow pages', 'yellowpages', 'yellow.com.mt'], ['yellowpages.com', 'yellow.com.mt'], 'directory'], ['HomeStars', ['homestars'], ['homestars.com'], 'directory'], ['Thumbtack', ['thumbtack'], ['thumbtack.com'], 'marketplace'], ['Angi', ['angi'], ['angi.com'], 'directory'], ['Care.com', ['care.com', 'care'], ['care.com'], 'marketplace'], ['TaskRabbit', ['taskrabbit'], ['taskrabbit.com'], 'marketplace'], ['Bark', ['bark'], ['bark.com'], 'marketplace'], ['Houzz', ['houzz'], ['houzz.com'], 'directory'], ['Booking.com', ['booking.com', 'booking'], ['booking.com'], 'marketplace'], ['Airbnb', ['airbnb'], ['airbnb.com'], 'marketplace'], ['Amazon', ['amazon'], ['amazon.com'], 'marketplace'], ['Wikipedia', ['wikipedia'], ['wikipedia.org'], 'publisher'],
].map(([canonical, aliases, domains, kind]) => ({ canonical: canonical as string, aliases: aliases as string[], domains: domains as string[], kind: kind as string }))

const GENERIC = new Set(['company','co','inc','ltd','llc','group','studio','agency','agencies','service','services','solutions','movers','moving company','cleaners','cleaning company','platform','app','apps','tool','tools','directory','website','site','com','net','org','local','best','top','professional','professionals','provider','providers','vendor','vendors','team','shop','store','market','marketplace'])
const LEGAL = /\b(?:ltd|inc|co|llc)\.?\b/gi

export function normalizeEntityName(value: string): string {
  const domain = registrableDomain(value)
  const base = domain || value
  return base.toLowerCase().replace(LEGAL, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim()
}
/** Equivalence key for the deliberately narrow space/hyphen/concatenation rule. */
function aliasEquivalenceKey(value: string): string {
  return normalizeEntityName(value).replace(/[\s-]+/g, '')
}
export function isGenericEntityName(value: string): boolean {
  const raw = value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim()
  if (GENERIC.has(raw) || raw === 'moving co' || raw === 'cleaning co') return true
  const normalized = normalizeEntityName(value)
  if (!normalized || normalized.length < 3 || normalized === 'international') return true
  if (GENERIC.has(normalized) || /^(?:com|net|org)(?: \w+)?$/.test(normalized)) return true
  return normalized.split(' ').every((word) => GENERIC.has(word))
}
export function knownChannel(value: string): Channel | undefined {
  const normalized = normalizeEntityName(value)
  return KNOWN_CHANNELS.find((channel) => [channel.canonical, ...channel.aliases, ...channel.domains].some((alias) => normalizeEntityName(alias) === normalized))
}
export function domainCorroboratesEntity(domainOrUrl: string, aliases: string[]): boolean {
  const domain = registrableDomain(domainOrUrl)
  if (!domain || knownChannel(domain)) return false
  const label = domain.split('.')[0] || ''
  const normalizedLabel = normalizeEntityName(label)
  return aliases.some((alias) => normalizeEntityName(alias) === normalizedLabel)
}
export function findEntitySpans(text: string, aliases: string[], source: 'answer_text' | 'answer_excerpt'): EntityObservation[] {
  const found: EntityObservation[] = []
  for (const alias of aliases) {
    if (!alias) continue
    // Literal entity names may contain dots, spaces, and hyphens.  Bound only
    // letters/numbers so punctuation remains a valid separator, including Unicode.
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(alias)}(?![\\p{L}\\p{N}])`, 'giu')
    for (const match of text.matchAll(re)) {
      const start = match.index!
      found.push({ entity_id: '', name_as_written: text.slice(start, start + alias.length), role: 'unknown', span_start: start, span_end: start + alias.length, matched_alias: alias, text_source: source })
    }
  }
  return found
}
function escapeRegex(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }
function candidateDomainKey(value: string): string {
  const domain = registrableDomain(value)
  return domain ? domain.split('.')[0] : normalizeEntityName(value)
}
function isCompositeName(value: string): boolean { return /(?:&|\/|\band\b)/i.test(value) }

export function resolveEntities(input: { brandVariants: string[]; operatorCompetitors?: string[]; candidates: EntityCandidate[]; answers: Array<{ answer_text?: string; answer_excerpt: string; query_id?: string; engine: string; citedDomains?: string[] }>; businessModel?: string }): { entities: ResolvedEntity[]; observationsByAnswer: EntityObservation[][] } {
  type Group = { name: string; candidates: EntityCandidate[]; operator: boolean; aliases: string[] }
  const grouped = new Map<string, Group>()
  const add = (key: string, name: string, candidate?: EntityCandidate, operator = false) => {
    const group = grouped.get(key) || { name, candidates: [], operator: false, aliases: [] }
    group.operator ||= operator
    if (candidate) group.candidates.push(candidate)
    if (!group.aliases.includes(name)) group.aliases.push(name)
    grouped.set(key, group)
  }
  for (const name of input.operatorCompetitors || []) add(aliasEquivalenceKey(name), name, undefined, true)
  for (const candidate of input.candidates) {
    const key = aliasEquivalenceKey(candidate.name)
    if (!key || input.brandVariants.some((brand) => aliasEquivalenceKey(brand) === key)) continue
    add(key, candidate.name, candidate)
  }
  // A cited first-party registrable domain may only join candidates whose own
  // deterministic domain label matches it.  Channel/publisher domains cannot join entities.
  // Union first, then merge: this keeps transitive, independently-corrobated aliases stable.
  const initialGroups = [...grouped.entries()]
  const parent = new Map(initialGroups.map(([key]) => [key, key]))
  const root = (key: string): string => {
    const next = parent.get(key)!
    if (next === key) return key
    const resolved = root(next); parent.set(key, resolved); return resolved
  }
  for (let index = 0; index < initialGroups.length; index++) {
    for (let otherIndex = index + 1; otherIndex < initialGroups.length; otherIndex++) {
      const [key, group] = initialGroups[index]; const [otherKey, other] = initialGroups[otherIndex]
      const shared = input.answers.some((answer) => (answer.citedDomains || []).some((domain) => {
        if (knownChannel(domain)) return false
        const label = registrableDomain(domain).split('.')[0]
        return label === candidateDomainKey(group.name) && label === candidateDomainKey(other.name)
      }))
      if (shared) parent.set(root(otherKey), root(key))
    }
  }
  for (const [key, group] of initialGroups) {
    const target = root(key)
    if (target === key) continue
    const into = grouped.get(target)!
    into.operator ||= group.operator
    into.candidates.push(...group.candidates)
    for (const alias of group.aliases) if (!into.aliases.includes(alias)) into.aliases.push(alias)
    grouped.delete(key)
  }
  const entities: ResolvedEntity[] = []; const observationsByAnswer: EntityObservation[][] = input.answers.map(() => [])
  for (const [key, group] of grouped) {
    const channel = knownChannel(group.name); const engine = isAnswerEngineCompetitorName(group.name); const generic = isGenericEntityName(group.name); let role: EntityRole = 'competitor'; let state: EntityState = 'unconfirmed'; let reason: string | undefined; let source: RoleSource = group.operator ? 'operator' : 'extractor'
    const extractorNonCompetitor = group.candidates.find((candidate) => candidate.role_guess === 'channel_or_directory' || candidate.role_guess === 'source_or_publisher')
    const extractorUnknown = group.candidates.some((candidate) => candidate.role_guess === 'unknown')
    // Engine aliases are not businesses. This established A1/A4 safeguard is
    // deliberately narrower than the operator override for channels/generics.
    if (engine) { role = 'engine'; state = 'rejected'; reason = 'engine'; source = 'dictionary' }
    else if (group.operator) { role = 'competitor'; state = 'accepted'; source = 'operator' }
    else if (channel) { role = 'channel_or_directory'; state = 'channel'; source = 'dictionary' }
    else if (generic) { role = 'generic'; state = 'rejected'; reason = 'generic' }
    const entity_id = `entity-${key.replace(/\s+/g, '-')}`
    const queries = new Set<string>(); const engines = new Set<string>(); let occurrences = 0; let corroborated = false; let legacyMissing = false
    for (let index = 0; index < input.answers.length; index++) {
      const answer = input.answers[index]; const sourceText = answer.answer_text || answer.answer_excerpt; const textSource = answer.answer_text ? 'answer_text' : 'answer_excerpt'; const spans = findEntitySpans(sourceText, group.aliases, textSource)
      if (spans.length) { occurrences++; queries.add(answer.query_id || String(index)); engines.add(answer.engine); observationsByAnswer[index].push({ ...spans[0], entity_id, role }) }
      else if (!answer.answer_text && group.candidates.some((candidate) => candidate.answer_index === index)) legacyMissing = true
      if ((answer.citedDomains || []).some((domain) => domainCorroboratesEntity(domain, group.aliases))) corroborated = true
    }
    // The extractor's non-competitor signal is usable only when the literal
    // candidate is evidenced in the answer (or by its matching cited domain).
    const extractorContextCompatible = occurrences > 0 || corroborated
    if (group.operator && !engine) {
      state = 'accepted'; reason = undefined
    } else if (!engine && !channel && !generic && extractorNonCompetitor && extractorContextCompatible) {
      role = extractorNonCompetitor.role_guess
      state = 'channel'
      source = 'extractor'
      reason = extractorNonCompetitor.role_guess === 'source_or_publisher' ? 'extractor_source_or_publisher' : undefined
    } else if (!engine && !channel && !generic && extractorUnknown) {
      role = 'unknown'; state = 'unconfirmed'; source = 'extractor'; reason = 'role_unknown'
    } else if (role === 'competitor') {
      if (occurrences === 0) { state = legacyMissing ? 'unconfirmed' : 'rejected'; reason = legacyMissing ? 'legacy_excerpt_only' : 'quote_not_found' }
      else if (queries.size >= 2 || engines.size >= 2 || corroborated) state = 'accepted'
      else { state = 'unconfirmed'; reason = 'insufficient_confirmation' }
    }
    const possible_competitor_flag = !group.operator && channel?.kind === 'marketplace' && input.businessModel === 'marketplace'
    entities.push({ entity_id, display_name: group.name, aliases: group.aliases, role, role_source: source, state, ...(reason ? { state_reason: reason } : {}), occurrences, distinct_queries: queries.size, distinct_engines: engines.size, domain_corroborated: corroborated, operator_provided: group.operator, ...(possible_competitor_flag ? { possible_competitor_flag } : {}), composite: isCompositeName(group.name) })
  }
  return { entities, observationsByAnswer }
}
