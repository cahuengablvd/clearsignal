import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { scrapeUrl } from '@/lib/firecrawl'
import { normalizeMarkdown } from '@/lib/normalize-markdown'
import { callClaudeJSON } from '@/lib/anthropic'
import { ClearSignalScoreSchema, type ClearSignalScore } from '@/lib/schemas'
import { MODEL_SCORE, SCORE_SYSTEM, scoreUserPrompt } from '@/lib/prompts'

const requestSchema = z.object({
  url: z.string().url(),
  email: z.string().email(),
  competitor_1: z.string().url().optional().or(z.literal('')),
  icp_description: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const input = requestSchema.parse(body)

    // Scrape the target URL
    const rawMarkdown = await scrapeUrl(input.url)
    if (!rawMarkdown) {
      return NextResponse.json(
        { error: 'Could not scrape the provided URL. Please check the URL and try again.' },
        { status: 400 }
      )
    }

    const markdown = normalizeMarkdown(rawMarkdown)

    // Generate score via Claude
    const scores = await callClaudeJSON<ClearSignalScore>({
      model: MODEL_SCORE,
      system: SCORE_SYSTEM,
      user: scoreUserPrompt(markdown, input.icp_description),
      validate: (data) => ClearSignalScoreSchema.parse(data),
      maxTokens: 1024,
    })

    // Save to database
    const { data: row, error: dbError } = await supabaseAdmin
      .from('scores')
      .insert({
        url: input.url,
        email: input.email,
        competitor_1: input.competitor_1 || null,
        scores: scores,
        top_insight: scores.top_insight,
        status: 'done',
      })
      .select('id')
      .single()

    if (dbError) {
      console.error('DB insert error:', dbError)
      return NextResponse.json({ error: 'Failed to save score' }, { status: 500 })
    }

    return NextResponse.json({ id: row.id, scores })
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
