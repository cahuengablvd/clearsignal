import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { competitorUrlSchema, icpTextSchema } from '@/lib/schemas'
import { enforceRateLimits, clientIp, emailDomain } from '@/lib/rate-limit'
import { signToken } from '@/lib/tokens'
import { normalizeWebsiteUrl } from '@/lib/normalize-url'
import { enqueueFreeScore } from '@/lib/score-queue'

const DAY_MS = 24 * 60 * 60 * 1000
const FREE_SCORE_DAILY_LIMIT = Number(process.env.FREE_SCORE_DAILY_LIMIT ?? 50)

const requestSchema = z.object({
  url: z
    .string()
    .trim()
    .transform(normalizeWebsiteUrl)
    .refine((value): value is string => value !== null, 'Enter a valid homepage URL'),
  email: z.string().email(),
  competitor_1: competitorUrlSchema,
  icp_description: icpTextSchema,
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const input = requestSchema.parse(body)

    // Preserve whether the user supplied a scheme before normalization. This
    // controls the narrow HTTP-only fallback and never downgrades typed HTTPS.
    const rawUrl = typeof body.url === 'string' ? body.url.trim().replace(/\s+/g, '') : ''
    const allowHttpFallback = !/^[a-z][a-z0-9+.-]*:\/\//i.test(rawUrl)

    // Rate limiting remains before the row insert and enqueue: a blocked request
    // must not cause Firecrawl, Claude, GEO, or Trigger.dev spend.
    const hour = 60 * 60 * 1000
    const rl = await enforceRateLimits([
      { key: 'score:global:daily', limit: FREE_SCORE_DAILY_LIMIT, windowMs: DAY_MS },
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

    const { data: row, error: dbError } = await supabaseAdmin
      .from('scores')
      .insert({
        url: input.url,
        email: input.email,
        competitor_1: input.competitor_1 || null,
        scores: null,
        top_insight: null,
        status: 'processing',
      })
      .select('id')
      .single()

    if (dbError || !row) {
      console.error('DB insert error:', dbError)
      return NextResponse.json({ error: 'Failed to start score' }, { status: 500 })
    }

    const token = signToken('score', row.id)
    try {
      await enqueueFreeScore(row.id, {
        url: input.url,
        email: input.email,
        competitor_1: input.competitor_1 || '',
        icp_description: input.icp_description,
        allowHttpFallback,
      })
    } catch (err) {
      console.error('Free score enqueue failed:', err)
      await supabaseAdmin
        .from('scores')
        .update({
          status: 'failed',
          top_insight: 'We could not start the check. Please try again.',
        })
        .eq('id', row.id)
      return NextResponse.json(
        { error: 'We could not start the check. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ id: row.id, token }, { status: 202 })
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
