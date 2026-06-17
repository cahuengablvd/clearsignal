import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { scrapeUrl } from '@/lib/firecrawl'
import { normalizeMarkdown } from '@/lib/normalize-markdown'
import { callClaudeJSON } from '@/lib/anthropic'
import { ClearSignalScoreSchema, type ClearSignalScore, type GeoResult } from '@/lib/schemas'
import { MODEL_SCORE, SCORE_SYSTEM, scoreUserPrompt } from '@/lib/prompts'
import { runGeoScan } from '@/lib/geo'
import { enforceRateLimits, clientIp, emailDomain } from '@/lib/rate-limit'

// Free score runs a live multi-engine GEO probe, which can take ~30-45s.
export const maxDuration = 60

// Cap the GEO probe so a slow/stuck answer engine can't push us toward the
// Vercel function timeout - the score still returns without GEO.
const GEO_BUDGET_MS = 35_000

function geoWithTimeout(p: Promise<GeoResult>): Promise<GeoResult | null> {
  return Promise.race([
    p,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), GEO_BUDGET_MS)),
  ]).catch((err) => {
    console.error('GEO scan failed (continuing without it):', err)
    return null
  })
}

const requestSchema = z.object({
  url: z.string().url(),
  email: z.string().email(),
  competitor_1: z.string().url().optional().or(z.literal('')),
  icp_description: z.string().optional(),
})

function brandFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    const name = host.split('.')[0]
    return name.charAt(0).toUpperCase() + name.slice(1)
  } catch {
    return url
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const input = requestSchema.parse(body)

    // Abuse guard: each free score spends Firecrawl + Claude + web-search
    // credits. Limit by both email and client IP (so neither alone can be
    // rotated to bypass the cap).
    const hour = 60 * 60 * 1000
    const rl = await enforceRateLimits([
      { key: `score:email:${input.email.toLowerCase()}`, limit: 3, windowMs: hour },
      { key: `score:domain:${emailDomain(input.email)}`, limit: 10, windowMs: hour },
      { key: `score:ip:${clientIp(req)}`, limit: 8, windowMs: hour },
    ])
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Rate limit reached. Free scores are limited per hour - please try again later.' },
        { status: 429 }
      )
    }

    // Scrape the target URL
    const rawMarkdown = await scrapeUrl(input.url)
    if (!rawMarkdown) {
      return NextResponse.json(
        { error: 'Could not scrape the provided URL. Please check the URL and try again.' },
        { status: 400 }
      )
    }

    const markdown = normalizeMarkdown(rawMarkdown)
    const brand = brandFromUrl(input.url)

    // Run the heuristic clarity score and the live AI-visibility probe in
    // parallel. The GEO probe is the headline number; keep it light for the
    // free tier (few queries, Claude engine only) to stay within the timeout.
    const [scores, geo] = await Promise.all([
      callClaudeJSON<ClearSignalScore>({
        model: MODEL_SCORE,
        system: SCORE_SYSTEM,
        user: scoreUserPrompt(markdown, input.icp_description),
        validate: (data) => ClearSignalScoreSchema.parse(data),
        maxTokens: 1024,
      }),
      geoWithTimeout(
        runGeoScan({
          brand,
          url: input.url,
          category: markdown.slice(0, 400),
          icp: input.icp_description,
          competitors: input.competitor_1 ? [input.competitor_1] : [],
          queryCount: 3,
          engines: ['claude'],
        })
      ),
    ])

    // Save to database (GEO nested into the jsonb - no schema migration needed)
    const { data: row, error: dbError } = await supabaseAdmin
      .from('scores')
      .insert({
        url: input.url,
        email: input.email,
        competitor_1: input.competitor_1 || null,
        scores: { ...scores, geo },
        top_insight: geo?.summary || scores.top_insight,
        status: 'done',
      })
      .select('id')
      .single()

    if (dbError) {
      console.error('DB insert error:', dbError)
      return NextResponse.json({ error: 'Failed to save score' }, { status: 500 })
    }

    return NextResponse.json({ id: row.id, scores, geo })
  } catch (err: unknown) {
    console.error('Score API error:', err)
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: err.errors }, { status: 400 })
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
