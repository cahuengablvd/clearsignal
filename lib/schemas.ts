import { z } from 'zod'

// --- Free Score ---

export const ClearSignalScoreSchema = z.object({
  icp: z.number().min(1).max(10),
  headline: z.number().min(1).max(10),
  cta: z.number().min(1).max(10),
  trust: z.number().min(1).max(10),
  ai_search: z.number().min(1).max(10),
  top_insight: z.string(),
})

export type ClearSignalScore = z.infer<typeof ClearSignalScoreSchema>

// --- GEO / AEO (Answer Engine Optimization) ---

/** One engine's answer to one buyer-intent query, analyzed for brand presence. */
export const GeoQueryResultSchema = z.object({
  engine: z.string(),
  query: z.string(),
  brand_mentioned: z.boolean(),
  // Rank of the brand within the engine's answer (1 = first recommended).
  // null when the brand is not mentioned at all.
  brand_position: z.number().nullable(),
  brand_cited: z.boolean(), // brand's own domain appears in the engine's sources
  competitors_mentioned: z.array(z.string()),
  cited_domains: z.array(z.string()),
})

export type GeoQueryResult = z.infer<typeof GeoQueryResultSchema>

/** The analysis Claude produces from the raw engine responses. */
export const GeoAnalysisSchema = z.object({
  ai_visibility_score: z.number().min(0).max(100),
  mention_rate: z.number().min(0).max(100), // % of (query, engine) pairs that mention the brand
  share_of_voice: z.number().min(0).max(100), // brand mentions / (brand + competitor mentions)
  per_query: z.array(GeoQueryResultSchema),
  competitor_visibility: z.array(
    z.object({ name: z.string(), mention_rate: z.number().min(0).max(100) })
  ),
  cited_domains_ranked: z.array(z.object({ domain: z.string(), count: z.number() })),
  missing_signals: z.array(z.string()),
  recommendations: z.array(z.string()),
  summary: z.string(),
})

export type GeoAnalysis = z.infer<typeof GeoAnalysisSchema>

/** Full GEO result persisted with a score/audit. */
export const GeoResultSchema = GeoAnalysisSchema.extend({
  brand: z.string(),
  queries_tested: z.number(),
  engines_tested: z.array(z.string()),
})

export type GeoResult = z.infer<typeof GeoResultSchema>

// --- Severity & Impact Enums ---

const severitySchema = z.enum(['critical', 'medium', 'low'])
const impactSchema = z.enum(['high', 'medium', 'low'])
const effortSchema = z.enum(['easy', 'medium', 'hard'])
const categorySchema = z.enum(['copy', 'structure', 'proof', 'cta', 'ai_search'])
const channelSchema = z.enum(['linkedin', 'email', 'twitter'])
const tierSchema = z.enum(['automated', 'reviewed', 'sprint'])

// --- Report Sub-schemas ---

const metaSchema = z.object({
  url: z.string(),
  generated_at: z.string(),
  icp_description: z.string(),
  competitors: z.array(z.string()),
  tier: tierSchema,
})

const claritySchema = z.object({
  overall_score: z.number(),
  icp_visibility: z.object({
    score: z.number(),
    finding: z.string(),
    severity: severitySchema,
  }),
  headline: z.object({
    score: z.number(),
    current_headline: z.string(),
    finding: z.string(),
    suggested_rewrite: z.string(),
    severity: severitySchema,
  }),
  cta: z.object({
    score: z.number(),
    finding: z.string(),
    suggested_rewrite: z.string(),
    severity: severitySchema,
  }),
  trust_proof: z.object({
    score: z.number(),
    finding: z.string(),
    missing_elements: z.array(z.string()),
    severity: severitySchema,
  }),
  messaging_fit: z.object({
    score: z.number(),
    finding: z.string(),
    severity: severitySchema,
  }),
})

const gapSchema = z.object({
  competitor_analysis: z.array(z.object({
    url: z.string(),
    headline: z.string(),
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
    clarity_score: z.number(),
  })),
  where_you_lose: z.array(z.string()),
  where_you_win: z.array(z.string()),
  ai_search: z.object({
    score: z.number(),
    finding: z.string(),
    is_likely_cited: z.boolean(),
    missing_signals: z.array(z.string()),
    severity: severitySchema,
  }),
})

const actionSchema = z.object({
  executive_summary: z.string(),
  top_fixes: z.array(z.object({
    id: z.number(),
    title: z.string(),
    description: z.string(),
    impact: impactSchema,
    effort: effortSchema,
    category: categorySchema,
  })),
  ship_first: z.array(z.string()),
  ignore_for_now: z.array(z.string()),
  outreach_messages: z.array(z.object({
    channel: channelSchema,
    message: z.string(),
    note: z.string(),
  })),
})

// --- Full Report ---

export const ClearSignalReportSchema = z.object({
  meta: metaSchema,
  clarity: claritySchema,
  gap: gapSchema,
  action: actionSchema,
  // Live multi-engine AI-visibility measurement. Optional so older reports
  // (and runs where every engine was unreachable) still validate.
  geo: GeoResultSchema.optional().nullable(),
})

export type ClearSignalReport = z.infer<typeof ClearSignalReportSchema>

// Sub-schemas exported for individual prompt validation
export const ClarityBlockSchema = claritySchema
export const GapBlockSchema = gapSchema
export const ActionBlockSchema = actionSchema

export type ClarityBlock = z.infer<typeof ClarityBlockSchema>
export type GapBlock = z.infer<typeof GapBlockSchema>
export type ActionBlock = z.infer<typeof ActionBlockSchema>
