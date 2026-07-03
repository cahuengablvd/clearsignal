/**
 * Evidence-based cited-source analysis.
 *
 * Turns "AI cites g2.com, reddit.com, competitor-a.com" into "here is WHY they
 * get cited and exactly what your site lacks vs them". Structured signals are
 * extracted per page; the missing-signal gap is computed deterministically; the
 * LLM only explains why each source is quotable and how to match it.
 *
 * Every step degrades gracefully - a page that won't scrape is skipped, and a
 * total failure returns null so the rest of the GEO result is unaffected.
 */
import { z } from 'zod'
import { callClaudeJSON } from '../anthropic'
import type { CostEvent } from '../cost-tracker'
import type { AnthropicRequestMeta } from '../ai-observability'
import { scrapeUrl } from '../firecrawl'
import { normalizeMarkdown } from '../normalize-markdown'
import {
  MODEL_GEO_ANALYSIS,
  GEO_SOURCES_SYSTEM,
  geoSourcesUserPrompt,
  GEO_SIGNAL_KEYS,
  GEO_SIGNAL_LABELS,
} from '../prompts'
import type { GeoSourceGap, GeoEvidence } from '../schemas'
import { registrableDomain } from './detect'

const signalsShape = Object.fromEntries(GEO_SIGNAL_KEYS.map((k) => [k, z.boolean()])) as Record<
  (typeof GEO_SIGNAL_KEYS)[number],
  z.ZodBoolean
>
const SignalsSchema = z.object(signalsShape)
type Signals = z.infer<typeof SignalsSchema>

const SourcesLlmSchema = z.object({
  target_signals: SignalsSchema,
  sources: z.array(
    z.object({
      url: z.string(),
      signals: SignalsSchema,
      why_cited: z.string(),
      recommended_fix: z.string(),
    })
  ),
})

function labels(signals: Signals): string[] {
  return GEO_SIGNAL_KEYS.filter((k) => signals[k]).map((k) => GEO_SIGNAL_LABELS[k])
}

/** Top cited URLs to analyze - one representative URL per most-cited domain. */
function topCitedUrls(evidence: GeoEvidence[], maxSources: number, brandDomain: string): string[] {
  const domainCount = new Map<string, number>()
  const domainBestUrl = new Map<string, { url: string; count: number }>()
  const urlCount = new Map<string, number>()

  for (const e of evidence) {
    for (const url of e.citations) {
      const dom = registrableDomain(url)
      if (!dom || dom === brandDomain) continue // skip the brand's own pages
      urlCount.set(url, (urlCount.get(url) || 0) + 1)
      domainCount.set(dom, (domainCount.get(dom) || 0) + 1)
      const best = domainBestUrl.get(dom)
      const c = urlCount.get(url) || 1
      if (!best || c > best.count) domainBestUrl.set(dom, { url, count: c })
    }
  }

  return [...domainCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxSources)
    .map(([dom]) => domainBestUrl.get(dom)?.url)
    .filter((u): u is string => !!u)
}

export interface AnalyzeSourcesOptions {
  brand: string
  targetUrl: string
  targetMarkdown: string
  evidence: GeoEvidence[]
  maxSources: number
  onUsage?: (event: CostEvent) => void
  meta?: AnthropicRequestMeta
}

export async function analyzeCitedSources(
  opts: AnalyzeSourcesOptions
): Promise<GeoSourceGap[] | null> {
  const { brand, targetUrl, targetMarkdown, evidence, maxSources, onUsage } = opts
  try {
    const urls = topCitedUrls(evidence, maxSources, registrableDomain(targetUrl))
    if (urls.length === 0) return null

    // Scrape cited sources in parallel; skip any that fail.
    const scraped = (
      await Promise.all(
        urls.map(async (url) => {
          const raw = await scrapeUrl(url)
          onUsage?.({ provider: 'firecrawl', purpose: 'geo:cited_source_scrape', scrape_count: 1 })
          return raw ? { url, markdown: normalizeMarkdown(raw) } : null
        })
      )
    ).filter((s): s is { url: string; markdown: string } => !!s)

    if (scraped.length === 0) return null

    const llm = await callClaudeJSON({
      model: MODEL_GEO_ANALYSIS,
      system: GEO_SOURCES_SYSTEM,
      user: geoSourcesUserPrompt(brand, targetUrl, targetMarkdown, scraped),
      validate: (d) => SourcesLlmSchema.parse(d),
      maxTokens: 2048,
      purpose: 'geo:cited_source_analysis',
      onUsage,
      meta: opts.meta,
    })

    const targetSignals = llm.target_signals

    // Deterministic gap: signals the source HAS that the target LACKS.
    return llm.sources.map((s): GeoSourceGap => {
      const missing = GEO_SIGNAL_KEYS.filter((k) => s.signals[k] && !targetSignals[k]).map(
        (k) => GEO_SIGNAL_LABELS[k]
      )
      return {
        cited_source: registrableDomain(s.url) || s.url,
        signals_found: labels(s.signals),
        target_missing_signals: missing,
        why_this_source_gets_cited: s.why_cited,
        recommended_fix: s.recommended_fix,
      }
    })
  } catch (err) {
    console.warn('Cited-source analysis failed (continuing without it):', err)
    return null
  }
}
