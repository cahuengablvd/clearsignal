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

/**
 * Raw, auditable evidence for one (engine, query) pair. Detection flags are
 * computed deterministically (string/domain matching), NOT by an LLM - so the
 * report can show the actual answer next to "your status".
 */
export const GeoEvidenceSchema = z.object({
  engine: z.string(),
  query: z.string(),
  answer_excerpt: z.string(), // trimmed raw answer the engine produced
  citations: z.array(z.string()), // source URLs the engine grounded on
  brand_mentioned: z.boolean(),
  brand_cited: z.boolean(), // brand's own domain appears in the engine's sources
  // Rank of the brand vs competitors by first mention (1 = named first).
  // null when the brand is not mentioned.
  brand_position: z.number().nullable(),
  competitors_mentioned: z.array(z.string()),
  cited_domains: z.array(z.string()),
})

export type GeoEvidence = z.infer<typeof GeoEvidenceSchema>

/** Reproducible breakdown of how ai_visibility_score was computed. */
export const GeoScoreBreakdownSchema = z.object({
  mention_rate: z.number(), // 0-100
  citation_rate: z.number(), // 0-100
  position_score: z.number(), // 0-100, higher = named earlier
  share_of_voice: z.number(), // 0-100
  weights: z.object({
    mention: z.number(),
    citation: z.number(),
    position: z.number(),
    share_of_voice: z.number(),
  }),
})

/** The LLM's narrative layer - explanation only, never the underlying facts. */
export const GeoAnalysisSchema = z.object({
  missing_signals: z.array(z.string()),
  recommendations: z.array(z.string()),
  summary: z.string(),
})

export type GeoAnalysis = z.infer<typeof GeoAnalysisSchema>

/**
 * Why a frequently-cited source wins, and what the target lacks vs it.
 * signals_found / target_missing_signals are derived from structured boolean
 * signal extraction; the why/fix text is the LLM's explanation.
 */
export const GeoSourceGapSchema = z.object({
  cited_source: z.string(), // domain or URL the engines cited
  signals_found: z.array(z.string()), // citation-friendly signals this source has
  target_missing_signals: z.array(z.string()), // signals the source has and the target lacks
  why_this_source_gets_cited: z.string(),
  recommended_fix: z.string(),
})

export type GeoSourceGap = z.infer<typeof GeoSourceGapSchema>

/** Full GEO result persisted with a score/audit. */
export const GeoResultSchema = z.object({
  brand: z.string(),
  brand_domain: z.string(),
  queries_tested: z.number(),
  engines_tested: z.array(z.string()),
  // Deterministic metrics
  ai_visibility_score: z.number().min(0).max(100),
  mention_rate: z.number().min(0).max(100),
  citation_rate: z.number().min(0).max(100),
  share_of_voice: z.number().min(0).max(100),
  avg_position: z.number().nullable(),
  score_breakdown: GeoScoreBreakdownSchema,
  evidence: z.array(GeoEvidenceSchema),
  competitor_visibility: z.array(
    z.object({ name: z.string(), mention_rate: z.number().min(0).max(100) })
  ),
  cited_domains_ranked: z.array(z.object({ domain: z.string(), count: z.number() })),
  // LLM narrative
  missing_signals: z.array(z.string()),
  recommendations: z.array(z.string()),
  summary: z.string(),
  // Evidence-based "why these sources get cited" analysis. Optional so older
  // reports and runs without source analysis still validate.
  source_gap_analysis: z.array(GeoSourceGapSchema).optional().nullable(),
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
