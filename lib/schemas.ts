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

// --- Business context / verified facts ---

export const businessModelSchema = z.enum([
  'ecommerce',
  'marketplace',
  'service_business',
  'portfolio',
  'gallery',
  'archive',
  'media_content_site',
  'other',
  'unknown',
])

export const conversionGoalSchema = z.enum([
  'purchase',
  'inquiry',
  'booking',
  'signup',
  'download',
  'portfolio_viewing',
  'other',
  'unknown',
])

export const availabilitySchema = z.enum(['yes', 'no', 'some', 'unknown'])
export const triStateSchema = z.enum(['yes', 'no', 'unknown'])
export const provenanceSchema = z.enum(['yes', 'no', 'unknown', 'not_applicable'])

const customBusinessContextValueSchema = z.string().trim().min(1).max(120)

function enumOrCustom<T extends z.ZodEnum<[string, ...string[]]>>(schema: T) {
  return z.union([schema, customBusinessContextValueSchema])
}

export const BusinessContextSchema = z.object({
  business_model: enumOrCustom(businessModelSchema).optional().default('unknown'),
  primary_conversion_goal: enumOrCustom(conversionGoalSchema).optional().default('unknown'),
  purchase_availability: enumOrCustom(availabilitySchema).optional().default('unknown'),
  ships_internationally: enumOrCustom(triStateSchema).optional().default('unknown'),
  provenance_or_authentication: enumOrCustom(provenanceSchema).optional().default('unknown'),
  target_markets_languages: z.string().max(1000).optional().default(''),
  verified_facts: z.string().max(2000).optional().default(''),
})
export type BusinessContext = z.infer<typeof BusinessContextSchema>

export const ObservedBusinessContextSchema = z.object({
  inferred_business_type: z.string().optional(),
  observed_primary_cta: z.string().optional(),
  observed_service_category: z.string().optional(),
  observed_location: z.array(z.string()).optional(),
  observed_services: z.array(z.string()).optional(),
})
export type ObservedBusinessContext = z.infer<typeof ObservedBusinessContextSchema>

export const VerifiedFactSchema = z.object({
  id: z.string(),
  claim: z.string(),
  source_type: z.enum(['user_verified', 'target_page_observed', 'official_external_source', 'ai_reported', 'inferred']),
  evidence_id: z.string().optional(),
  source_url: z.string().optional(),
  confidence: z.number().min(0).max(100),
  requires_operator_confirmation: z.boolean(),
  allowed_outputs: z.array(z.enum(['analysis', 'ready_copy', 'faq', 'schema', 'outreach'])),
})
export type VerifiedFact = z.infer<typeof VerifiedFactSchema>

// --- Trust Layer: input validation ---

/** Whole value is a bare URL (so we can keep it OUT of the ICP field). */
export function looksLikeUrl(value: string): boolean {
  return /^\s*https?:\/\/\S+\s*$/i.test(value)
}

/** True when free text contains any URL-like http(s) token. */
export function containsUrl(value: string): boolean {
  return /https?:\/\/\S+/i.test(value)
}

/** ICP is a free-text description, NEVER a URL (the URL belongs in `url`). */
export const icpTextSchema = z
  .string()
  .max(2000, 'ICP description must be 2000 characters or fewer')
  .refine((v) => !looksLikeUrl(v) && !containsUrl(v), {
    message: 'ICP must be a text description, not a URL',
  })
  .optional()
  .default('')

/** A competitor is always a valid http(s) URL (or empty). */
export const competitorUrlSchema = z
  .string()
  .url()
  .refine((v) => {
    try {
      const protocol = new URL(v).protocol
      return protocol === 'http:' || protocol === 'https:'
    } catch {
      return false
    }
  }, { message: 'Competitor must be an http(s) URL' })
  .optional()
  .or(z.literal(''))

/**
 * Paid checkout intake is persisted before the customer leaves for Stripe.
 * Stripe metadata receives only the resulting audit id, never these free-text fields.
 */
export const CheckoutIntakeSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  url: z.string().trim().url('Enter a valid homepage URL'),
  competitor_1: competitorUrlSchema,
  competitor_2: competitorUrlSchema,
  competitor_3: competitorUrlSchema,
  icp_description: icpTextSchema,
  business_context: z.object({
    business_model: enumOrCustom(businessModelSchema).optional().default('unknown'),
    primary_conversion_goal: enumOrCustom(conversionGoalSchema).optional().default('unknown'),
    target_markets_languages: z
      .string()
      .max(1000, 'Target markets and languages must be 1000 characters or fewer')
      .optional()
      .default(''),
    verified_facts: z
      .string()
      .max(2000, 'Verified facts must be 2000 characters or fewer')
      .optional()
      .default(''),
  }).optional().default({}),
  score_id: z.string().optional().default(''),
  score_token: z.string().optional().default(''),
})

export type CheckoutIntake = z.infer<typeof CheckoutIntakeSchema>

// --- Trust Layer: typed findings (deterministic confidence) ---

export const FindingClassificationSchema = z.enum([
  'detected', // verified present/absent from the page
  'likely', // indirect signal, not exact
  'manual_verification', // could not verify reliably -> human should check
  'recommendation', // an action, not a measured fact
])
export type FindingClassification = z.infer<typeof FindingClassificationSchema>

export const FindingStatusSchema = z.enum([
  'present', // the signal was verified on the page
  'absent', // the absence was verified from rendered HTML
  'unknown', // crawler/browser evidence was insufficient
  'action', // this row is a recommendation rather than a page fact
])
export type FindingStatus = z.infer<typeof FindingStatusSchema>

export const FindingEvidenceSchema = z.object({
  url: z.string(),
  checked_at: z.string(),
  extracted_text: z.string().optional().nullable(),
  html_snippet: z.string().optional().nullable(),
})

/**
 * A single audit finding with a DETERMINISTIC confidence (computed from how the
 * signal was verified, never asked of an LLM) and its supporting evidence.
 */
export const FindingSchema = z.object({
  id: z.string(),
  label: z.string(),
  // Stable evidence id for cross-referencing from actions (optional / backward compatible).
  evidence_id: z.string().optional(),
  classification: FindingClassificationSchema,
  // Optional for backward compatibility with older generated reports.
  status: FindingStatusSchema.optional(),
  confidence: z.number().min(0).max(100),
  confidence_basis: z.string(),
  detail: z.string(),
  evidence: FindingEvidenceSchema.optional().nullable(),
})
export type Finding = z.infer<typeof FindingSchema>

// --- Ready-to-ship materials (#17) ---

export const FaqItemSchema = z.object({ question: z.string(), answer: z.string() })

/** What the LLM produces (meta + FAQ + CTAs). JSON-LD is built deterministically. */
export const ReadyMaterialsLlmSchema = z.object({
  meta_title: z.string(),
  meta_description: z.string(),
  faq: z.array(FaqItemSchema).min(4).max(6),
  cta_variants: z.array(z.string()).min(3).max(5),
})
export type ReadyMaterialsLlm = z.infer<typeof ReadyMaterialsLlmSchema>

/** Stored materials: LLM output plus a deterministically-built JSON-LD snippet. */
export const ReadyMaterialsSchema = ReadyMaterialsLlmSchema.extend({
  json_ld: z.string(),
})
export type ReadyMaterials = z.infer<typeof ReadyMaterialsSchema>

// --- Implementation briefs (#19) ---

/** A ticket-style brief for one fix: steps + verifiable acceptance criteria. */
export const ImplementationBriefSchema = z.object({
  fix_title: z.string(),
  steps: z.array(z.string()),
  acceptance_criteria: z.array(z.string()), // verifiable "Done when ..." conditions
})
export type ImplementationBrief = z.infer<typeof ImplementationBriefSchema>

export const ImplementationBriefsLlmSchema = z.object({
  briefs: z.array(ImplementationBriefSchema),
})

// --- GEO / AEO (Answer Engine Optimization) ---

/**
 * Raw, auditable evidence for one (engine, query) pair. Detection flags are
 * computed deterministically (string/domain matching), NOT by an LLM - so the
 * report can show the actual answer next to "your status".
 */
export const GeoEvidenceSchema = z.object({
  // Stable evidence id for cross-referencing from actions (optional / backward compatible).
  evidence_id: z.string().optional(),
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

// --- Weekly monitoring ---

export const MonitoringAlertSchema = z.object({
  level: z.enum(['up', 'down', 'info']),
  message: z.string(),
})
export type MonitoringAlert = z.infer<typeof MonitoringAlertSchema>

/** Change in this run vs the previous run for a monitored site. */
export const MonitoringDeltaSchema = z.object({
  is_first_run: z.boolean(),
  ai_visibility_score: z.number(), // signed
  mention_rate: z.number(),
  share_of_voice: z.number(),
  citation_rate: z.number(),
  new_competitors: z.array(z.string()),
  new_cited_domains: z.array(z.string()),
  brand_citation_change: z.enum(['gained', 'lost', 'none']),
})
export type MonitoringDelta = z.infer<typeof MonitoringDeltaSchema>

/** Full GEO result persisted with a score/audit. */
export const GeoTestCountsSchema = z.object({
  configured_queries: z.number(),
  configured_engines: z.number(),
  expected_combinations: z.number(),
  successful_combinations: z.number(),
  failed_combinations: z.number(),
  skipped_combinations: z.number(),
})
export type GeoTestCounts = z.infer<typeof GeoTestCountsSchema>

export const GeoResultSchema = z.object({
  brand: z.string(),
  brand_domain: z.string(),
  queries_tested: z.number(),
  engines_tested: z.array(z.string()),
  test_counts: GeoTestCountsSchema.optional(),
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
const requiredOutreachChannels = ['linkedin', 'email', 'twitter'] as const
const tierSchema = z.enum(['automated', 'reviewed', 'sprint'])
const confidenceLevelSchema = z.enum(['high', 'medium', 'low'])
const controlSchema = z.enum(['high', 'medium', 'low'])
const probabilitySchema = z.enum(['high', 'medium', 'low'])
const claimLevelSchema = z.enum(['observed', 'inferred', 'recommended'])

export const AuditIssueSeveritySchema = z.enum(['critical', 'high', 'medium', 'low'])
export const AuditIssueCategorySchema = z.enum([
  'wrong_business',
  'foreign_industry',
  'unverified_claim',
  'replacement_leak',
  'broken_sentence',
  'empty_section',
  'question_answer_mismatch',
  'schema_mismatch',
  'evidence_mismatch',
  'internal_contradiction',
  'policy_violation',
  'grammar',
  'duplicate',
  'other',
])

export const AuditIssueSchema = z.object({
  id: z.string(),
  severity: AuditIssueSeveritySchema,
  category: AuditIssueCategorySchema,
  path: z.string(),
  explanation: z.string(),
  currentText: z.string().optional(),
  suggestedReplacement: z.string().optional(),
  canAutoFix: z.boolean(),
})

export const AuditIssuesSchema = z.object({
  issues: z.array(AuditIssueSchema).max(25),
})

export type AuditIssue = z.infer<typeof AuditIssueSchema>

// --- Report Sub-schemas ---

const metaSchema = z.object({
  url: z.string(),
  generated_at: z.string(),
  icp_description: z.string(),
  competitors: z.array(z.string()),
  tier: tierSchema,
  // Brand entity (optional / backward-compatible with older saved reports).
  canonical_brand: z.string().optional(),
  domain: z.string().optional(),
  alternative_brand_forms: z.array(z.string()).optional(),
  business_context: BusinessContextSchema.optional(),
  observed_business_context: ObservedBusinessContextSchema.optional(),
  verified_facts_layer: z.array(VerifiedFactSchema).optional(),
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

const OutreachMessageSchema = z.object({
  channel: channelSchema,
  message: z.string(),
  note: z.string(),
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
    // Added after generation by deterministic evidence mapping, when possible.
    confidence: z.number().min(0).max(100).optional(),
    confidence_level: confidenceLevelSchema.optional(),
    confidence_basis: z.string().optional(),
    owner: z.string().optional(),
    contributor: z.string().optional(),
    implementer: z.string().optional(),
    claim_level: claimLevelSchema.optional(),
    control: controlSchema.optional(),
    probability: probabilitySchema.optional(),
    // Evidence linkage: ids of the findings/GEO items this fix is grounded in.
    evidence_ids: z.array(z.string()).optional(),
    evidence_basis: z.string().optional(),
  })).min(5).max(10),
  ship_first: z.array(z.string()),
  ignore_for_now: z.array(z.string()),
  outreach_messages: z.array(OutreachMessageSchema).superRefine((messages, ctx) => {
    const channels = messages.map((m) => m.channel)
    const unique = new Set(channels)
    if (messages.length !== requiredOutreachChannels.length || unique.size !== requiredOutreachChannels.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'outreach_messages must contain exactly one linkedin, one email, and one twitter message',
      })
      return
    }
    for (const channel of requiredOutreachChannels) {
      if (!unique.has(channel)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `outreach_messages is missing ${channel}`,
        })
      }
    }
  }),
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
  // Deterministic, evidence-backed structural findings (Trust Layer). Optional
  // for backward compatibility with reports generated before this existed.
  technical_findings: z.array(FindingSchema).optional().nullable(),
  // Ready-to-ship deliverables (meta, FAQ, JSON-LD, CTA variants). Optional.
  ready_materials: ReadyMaterialsSchema.optional().nullable(),
  // Ticket-style implementation briefs with acceptance criteria. Optional.
  implementation_briefs: z.array(ImplementationBriefSchema).optional().nullable(),
  // Evidence boundary shown near the top of the report. Optional for old reports.
  data_limitations: z.array(z.string()).optional(),
  // Deterministic pre-save validation notes (contradictions found/repaired).
  // Optional / backward compatible.
  validation_warnings: z.array(z.string()).optional(),
})

export type ClearSignalReport = z.infer<typeof ClearSignalReportSchema>

// Sub-schemas exported for individual prompt validation
export const ClarityBlockSchema = claritySchema
export const GapBlockSchema = gapSchema
export const ActionBlockSchema = actionSchema

export type ClarityBlock = z.infer<typeof ClarityBlockSchema>
export type GapBlock = z.infer<typeof GapBlockSchema>
export type ActionBlock = z.infer<typeof ActionBlockSchema>
