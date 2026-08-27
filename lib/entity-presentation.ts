import type { GeoResult } from './schemas'

export const ENTITY_DISCLOSURE = 'Named in the tested answers; being named is not a recommendation.'

export type ClientEntityPresentation = {
  competitors: Array<{ name: string; mention_rate: number; quote: string }>
  channels: Array<{ name: string; mention_rate: number }>
}

/** Projects only validated A3 entity evidence into the client report surface. */
export function buildClientEntityPresentation(geo: GeoResult): ClientEntityPresentation {
  const accepted = new Map(
    (geo.entity_resolution?.entities || [])
      .filter((entity) => entity.role === 'competitor' && entity.state === 'accepted')
      .map((entity) => [entity.display_name, entity])
  )
  const competitors = geo.competitor_visibility.flatMap((item) => {
    const entity = accepted.get(item.name)
    if (!entity) return []
    for (const evidence of geo.evidence) {
      const observation = (evidence.entity_observations || []).find((item) => item.entity_id === entity.entity_id)
      const source = observation?.text_source === 'answer_text' ? evidence.answer_text : evidence.answer_excerpt
      if (!observation || !source) continue
      const literal = source.slice(observation.span_start, observation.span_end)
      if (literal !== observation.name_as_written || !literal) continue
      const quote = source.slice(Math.max(0, observation.span_start - 60), Math.min(source.length, observation.span_end + 100))
      if (quote) return [{ ...item, quote }]
    }
    return []
  })
  return { competitors, channels: geo.channels_observed?.map(({ name, mention_rate }) => ({ name, mention_rate })) || [] }
}

export type AdminEntityDiagnostic = {
  entity_id: string; display_name: string; role: string; state: string; state_reason?: string; role_source: string
  occurrences: number; distinct_queries: number; distinct_engines: number; domain_corroborated: boolean; operator_provided: boolean
  possible_competitor_flag?: boolean; composite?: boolean; kind: 'competitor' | 'channel_or_directory'
}

/** Keeps the admin diagnostics contract explicit without exposing it to clients. */
export function buildAdminEntityDiagnostics(entities: Omit<AdminEntityDiagnostic, 'kind'>[] = []): AdminEntityDiagnostic[] {
  return entities.map((entity) => ({ ...entity, kind: entity.role === 'channel_or_directory' ? 'channel_or_directory' : 'competitor' }))
}
