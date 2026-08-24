/**
 * Weekly AI Visibility Monitoring - the recurring-revenue core.
 *
 * A daily Trigger.dev sweep finds monitored sites whose next_run_at is due,
 * runs a GEO scan for each, computes the delta vs the previous run, raises
 * alerts on meaningful changes, and reschedules. This turns the one-off audit
 * into a subscription product ("is your AI visibility rising or falling?").
 */
import { supabaseAdmin } from './supabase'
import { runGeoScan } from './geo'
import type { GeoResult, MonitoringAlert, MonitoringDelta } from './schemas'
import { logSupabaseWriteFailure } from './supabase-write'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const SCORE_ALERT_THRESHOLD = 5 // points

function brandFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    const name = host.split('.')[0]
    return name.charAt(0).toUpperCase() + name.slice(1)
  } catch {
    return url
  }
}

function round(n: number): number {
  return Math.round(n * 10) / 10
}

/**
 * Compute the change between the current and previous GEO results and turn the
 * meaningful changes into human-readable alerts.
 */
export function computeDelta(
  current: GeoResult,
  previous: GeoResult | null
): { delta: MonitoringDelta; alerts: MonitoringAlert[] } {
  if (!previous) {
    return {
      delta: {
        is_first_run: true,
        ai_visibility_score: 0,
        mention_rate: 0,
        share_of_voice: 0,
        citation_rate: 0,
        new_competitors: [],
        new_cited_domains: [],
        brand_citation_change: 'none',
      },
      alerts: [
        {
          level: 'info',
          message: `Baseline established: AI visibility ${current.ai_visibility_score}/100.`,
        },
      ],
    }
  }

  const dScore = current.ai_visibility_score - previous.ai_visibility_score
  const prevCompetitors = new Set(previous.competitor_visibility.map((c) => c.name.toLowerCase()))
  const newCompetitors = current.competitor_visibility
    .filter((c) => !prevCompetitors.has(c.name.toLowerCase()))
    .map((c) => c.name)

  const prevDomains = new Set(previous.cited_domains_ranked.map((d) => d.domain))
  const newCitedDomains = current.cited_domains_ranked
    .map((d) => d.domain)
    .filter((d) => !prevDomains.has(d))

  let brandCitationChange: 'gained' | 'lost' | 'none' = 'none'
  if ((current.citation_rate ?? 0) > 0 && (previous.citation_rate ?? 0) === 0) brandCitationChange = 'gained'
  else if ((current.citation_rate ?? 0) === 0 && (previous.citation_rate ?? 0) > 0) brandCitationChange = 'lost'

  const delta: MonitoringDelta = {
    is_first_run: false,
    ai_visibility_score: dScore,
    mention_rate: round(current.mention_rate - previous.mention_rate),
    share_of_voice: round(current.share_of_voice - previous.share_of_voice),
    citation_rate: round((current.citation_rate ?? 0) - (previous.citation_rate ?? 0)),
    new_competitors: newCompetitors,
    new_cited_domains: newCitedDomains,
    brand_citation_change: brandCitationChange,
  }

  const alerts: MonitoringAlert[] = []

  if (dScore <= -SCORE_ALERT_THRESHOLD) {
    alerts.push({
      level: 'down',
      message: `AI visibility dropped from ${previous.ai_visibility_score} to ${current.ai_visibility_score}.`,
    })
  } else if (dScore >= SCORE_ALERT_THRESHOLD) {
    alerts.push({
      level: 'up',
      message: `AI visibility rose from ${previous.ai_visibility_score} to ${current.ai_visibility_score}.`,
    })
  }

  // A competitor now out-mentions the brand (and is gaining).
  const prevByName = new Map(previous.competitor_visibility.map((c) => [c.name.toLowerCase(), c.mention_rate]))
  for (const c of current.competitor_visibility) {
    const prevRate = prevByName.get(c.name.toLowerCase()) ?? 0
    if (c.mention_rate > current.mention_rate && c.mention_rate - prevRate >= 10) {
      alerts.push({
        level: 'down',
        message: `${c.name} is now mentioned in ${Math.round(c.mention_rate)}% of answers (up from ${Math.round(prevRate)}%).`,
      })
    }
  }

  if (brandCitationChange === 'lost') {
    alerts.push({ level: 'down', message: 'Your brand lost its citations in AI answers.' })
  } else if (brandCitationChange === 'gained') {
    alerts.push({ level: 'up', message: 'Your brand is now cited as a source in AI answers.' })
  }

  for (const d of newCitedDomains.slice(0, 3)) {
    alerts.push({ level: 'info', message: `New cited source appeared: ${d}.` })
  }

  return { delta, alerts: alerts.slice(0, 6) }
}

/** Run one monitoring check for a site and persist the run. */
export async function runMonitoringForSite(siteId: string): Promise<void> {
  const { data: site, error } = await supabaseAdmin
    .from('monitored_sites')
    .select('*')
    .eq('id', siteId)
    .single()
  if (error || !site) throw new Error(`Monitored site ${siteId} not found: ${error?.message}`)

  const nextRunAt = new Date(Date.now() + WEEK_MS).toISOString()

  try {
    const geo = await runGeoScan({
      brand: site.brand || brandFromUrl(site.url),
      url: site.url,
      icp: site.icp_description || '',
      competitors: (site.competitors as string[] | null) || [],
      queryCount: 5,
      engines: ['claude'],
      narrative: false,
      webSearch: false,
    })

    // Previous run for delta.
    const { data: prevRun } = await supabaseAdmin
      .from('monitoring_runs')
      .select('geo')
      .eq('site_id', siteId)
      .eq('run_status', 'done')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const previousGeo = (prevRun?.geo as GeoResult | null) || null
    const { delta, alerts } = computeDelta(geo, previousGeo)

    const { error: runWriteError } = await supabaseAdmin.from('monitoring_runs').insert({
      site_id: siteId,
      run_status: 'done',
      ai_visibility_score: geo.ai_visibility_score,
      mention_rate: geo.mention_rate,
      share_of_voice: geo.share_of_voice,
      citation_rate: geo.citation_rate,
      cited_domains: geo.cited_domains_ranked,
      competitor_visibility: geo.competitor_visibility,
      evidence: geo.evidence,
      geo,
      delta_vs_previous: delta,
      alerts,
    })
    logSupabaseWriteFailure(runWriteError, `monitoring_runs completed run for site ${siteId}`)

    const { error: scheduleWriteError } = await supabaseAdmin
      .from('monitored_sites')
      .update({ last_run_at: new Date().toISOString(), next_run_at: nextRunAt })
      .eq('id', siteId)
    logSupabaseWriteFailure(scheduleWriteError, `monitored_sites schedule for site ${siteId}`)
  } catch (err) {
    console.error(`[monitoring] run failed for site ${siteId}:`, err)
    const { error: failedRunWriteError } = await supabaseAdmin.from('monitoring_runs').insert({ site_id: siteId, run_status: 'failed', alerts: [] })
    logSupabaseWriteFailure(failedRunWriteError, `monitoring_runs failed run for site ${siteId}`)
    // Still reschedule so a single failure doesn't hammer or stall the loop.
    const { error: failedScheduleWriteError } = await supabaseAdmin
      .from('monitored_sites')
      .update({ last_run_at: new Date().toISOString(), next_run_at: nextRunAt })
      .eq('id', siteId)
    logSupabaseWriteFailure(failedScheduleWriteError, `monitored_sites failure schedule for site ${siteId}`)
    throw err
  }
}

/** Run every monitored site whose next_run_at is due. Called by the daily cron. */
export async function processDueSites(): Promise<{ processed: number }> {
  const { data: sites, error } = await supabaseAdmin
    .from('monitored_sites')
    .select('id')
    .eq('status', 'active')
    .lte('next_run_at', new Date().toISOString())
    .limit(100)

  if (error) throw new Error(`Failed to query due sites: ${error.message}`)

  let processed = 0
  for (const site of sites || []) {
    try {
      await runMonitoringForSite(site.id)
      processed += 1
    } catch (err) {
      console.error('[monitoring] processDueSites: site failed', site.id, err)
    }
  }
  return { processed }
}

/** Create a monitored site (subscription). First run happens on the next sweep. */
export async function createMonitoredSite(input: {
  email: string
  url: string
  competitors?: string[]
  icp_description?: string
}): Promise<{ id: string }> {
  const { data, error } = await supabaseAdmin
    .from('monitored_sites')
    .insert({
      email: input.email,
      url: input.url,
      brand: brandFromUrl(input.url),
      competitors: input.competitors || [],
      icp_description: input.icp_description || null,
      cadence: 'weekly',
      status: 'active',
      next_run_at: new Date().toISOString(), // due immediately
    })
    .select('id')
    .single()

  if (error || !data) throw new Error(`Failed to create monitored site: ${error?.message}`)
  return { id: data.id }
}
