import { callClaudeJSON } from './anthropic'
import { scrapeUrl } from './firecrawl'
import { runGeoScan } from './geo'
import { normalizeMarkdown } from './normalize-markdown'
import { MODEL_SCORE, SCORE_SYSTEM, scoreUserPrompt } from './prompts'
import {
  ClearSignalScoreSchema,
  type ClearSignalScore,
  type GeoResult,
} from './schemas'
import { supabaseAdmin } from './supabase'

const GEO_BUDGET_MS = 35_000

export type FreeScoreInput = {
  url: string
  email: string
  competitor_1: string
  icp_description: string
  allowHttpFallback: boolean
}

function brandFromUrl(url: string): string {
  const host = new URL(url).hostname.replace(/^www\./, '')
  const name = host.split('.')[0]
  return name.charAt(0).toUpperCase() + name.slice(1)
}

function geoWithTimeout(promise: Promise<GeoResult>): Promise<GeoResult | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), GEO_BUDGET_MS)),
  ]).catch((err) => {
    console.error('GEO scan failed (continuing without it):', err)
    return null
  })
}

export async function runFreeScore(scoreId: string, input: FreeScoreInput): Promise<void> {
  try {
    const { error: startError } = await supabaseAdmin
      .from('scores')
      .update({ scores: { _processing_started_at: new Date().toISOString() } })
      .eq('id', scoreId)
    if (startError) throw new Error(`Failed to mark score processing start: ${startError.message}`)

    const rawMarkdown = await scrapeUrl(input.url, {
      allowHttpFallback: input.allowHttpFallback,
    })
    if (!rawMarkdown) {
      throw new Error('We could not read this website. Check the URL and try again.')
    }

    const markdown = normalizeMarkdown(rawMarkdown)
    const brand = brandFromUrl(input.url)
    const [scores, geo] = await Promise.all([
      callClaudeJSON<ClearSignalScore>({
        model: MODEL_SCORE,
        system: SCORE_SYSTEM,
        user: scoreUserPrompt(markdown, input.icp_description),
        validate: (data) => ClearSignalScoreSchema.parse(data),
        maxTokens: 1024,
        purpose: 'score:clarity',
        meta: {
          auditId: null,
          stage: 'score_clarity',
          trigger: 'free_score',
          endpoint: 'trigger:run-free-score',
        },
      }),
      geoWithTimeout(
        runGeoScan({
          brand,
          url: input.url,
          category: markdown.slice(0, 400),
          icp: input.icp_description,
          competitors: input.competitor_1 ? [input.competitor_1] : [],
          queryCount: 4,
          engines: ['claude'],
          discoverCompetitors: true,
          narrative: false,
          webSearch: false,
          meta: {
            auditId: null,
            stage: 'score_geo_scan',
            trigger: 'free_score',
            endpoint: 'trigger:run-free-score',
          },
        })
      ),
    ])

    const { error } = await supabaseAdmin
      .from('scores')
      .update({
        scores: { ...scores, geo },
        top_insight: geo?.summary || scores.top_insight,
        status: 'done',
      })
      .eq('id', scoreId)

    if (error) throw new Error(`Failed to save score: ${error.message}`)
  } catch (err) {
    console.error('[free-score] failed:', scoreId, err)
    await supabaseAdmin
      .from('scores')
      .update({
        status: 'failed',
        top_insight: 'We could not finish the check. Please try again.',
      })
      .eq('id', scoreId)
  }
}
