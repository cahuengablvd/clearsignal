import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { isValidAdminCookie, ADMIN_COOKIE } from '@/lib/auth'
import { BusinessContextSchema, competitorUrlSchema, icpTextSchema } from '@/lib/schemas'
import { generateValidatedQueryPlan } from '@/lib/geo'
import { scrapeUrl } from '@/lib/firecrawl'
import { normalizeMarkdown } from '@/lib/normalize-markdown'
import { assessScrapeQuality } from '@/lib/scrape-quality'

export const maxDuration = 60

const requestSchema = z.object({
  url: z.string().url(),
  competitor_1: competitorUrlSchema,
  competitor_2: competitorUrlSchema,
  competitor_3: competitorUrlSchema,
  icp_description: icpTextSchema,
  business_context: BusinessContextSchema.optional(),
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

/**
 * Preview step for a manual audit: scrape the homepage for context, generate
 * the buyer-intent queries the GEO scan will test, and return everything for an
 * operator confirmation screen. Nothing is created or charged here.
 */
export async function POST(req: NextRequest) {
  if (!isValidAdminCookie(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let input: z.infer<typeof requestSchema>
  try {
    input = requestSchema.parse(await req.json())
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: err.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const competitors = [input.competitor_1, input.competitor_2, input.competitor_3].filter(
    (c): c is string => !!c
  )
  const brand = brandFromUrl(input.url)

  // Best-effort homepage snippet for better query relevance (don't fail if down).
  let category = ''
  const raw = await scrapeUrl(input.url).catch(() => null)
  if (raw) {
    category = normalizeMarkdown(raw)
    const scrapeQuality = assessScrapeQuality(category)
    if (scrapeQuality.kind !== 'substantive') {
      return NextResponse.json(
        { error: scrapeQuality.message, scraped: false },
        { status: 422 }
      )
    }
    category = category.slice(0, 600)
  }
  if (!raw && !input.icp_description.trim()) {
    return NextResponse.json(
      { error: 'We could not read the homepage. Add a business description before generating queries.', scraped: false },
      { status: 422 }
    )
  }

  try {
    const plan = await generateValidatedQueryPlan({
      brand,
      category,
      icp: input.icp_description,
      targetMarketsLanguages: input.business_context?.target_markets_languages,
      brandAliases: [brand, new URL(input.url).hostname.replace(/^www\./, '')],
      meta: {
        auditId: null,
        stage: 'preview_query_generation',
        trigger: 'admin_preview',
        endpoint: '/api/admin/audits/preview',
      },
    })
    return NextResponse.json({
      brand,
      url: input.url,
      icp_description: input.icp_description,
      competitors,
      business_context: BusinessContextSchema.parse(input.business_context || {}),
      queries: plan.core.map((q) => q.query),
      plan,
      scraped: !!raw,
    })
  } catch (err) {
    console.error('[admin/preview] query generation failed:', err)
    const insufficient = err instanceof Error && err.message === 'query_plan_insufficient'
    const plan = insufficient ? (err as Error & { plan?: unknown }).plan : undefined
    if (plan) {
      return NextResponse.json({
        error: 'query_plan_insufficient',
        status: 'query_plan_insufficient',
        brand,
        url: input.url,
        icp_description: input.icp_description,
        competitors,
        business_context: BusinessContextSchema.parse(input.business_context || {}),
        queries: [],
        plan,
        scraped: !!raw,
      }, { status: 422 })
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to generate queries' },
      { status: 500 }
    )
  }
}
