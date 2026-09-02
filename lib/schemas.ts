import { z } from 'zod'
import { normalizeWebsiteUrl } from './normalize-url'

// --- Free Score ---

export const ClearSignalScoreSchema = z.object({
  icp: z.number().min(1).max(10),
  headline: z.number().min(1).max(10),
  cta: z.number().min(1).max(10),
  trust: z.number().min(1).max(10),
  ai_search: z.number().min(1).max(10),
  top_insight: z.string(),
  business_description_draft: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .refine((value) => !/[.!?]\s+[A-Z]/.test(value), 'Business description draft must be one sentence'),
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
  brand_aliases: z.string().max(1000).optional().superRefine((value, ctx) => {
    if (!value) return
    const aliases = value.split(';').map((item) => item.trim()).filter(Boolean)
    if (aliases.length > 10) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Brand aliases must contain 10 names or fewer' })
    }
  }),
  // A4 operator-confirmed structured plan. JSON only; no database migration.
  query_plan: z.unknown().optional(),
})
export type BusinessContext = z.infer<typeof BusinessContextSchema>

export const ObservedBusinessContextSchema = z.object({
  inferred_business_type: z.string().optional(),
  observed_primary_cta: z.string().optional(),
  observed_service_category: z.string().optional(),
  observed_location: z.array(z.string()).optional(),
  observed_services: z.array(z.string()).optional(),
  observed_marketplace_structure: z.object({
    search_url_template: z.string().optional(),
    list_name: z.string().optional(),
    item_names: z.array(z.string()).optional(),
    offer_catalog_name: z.string().optional(),
  }).optional(),
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
  .trim()
  .transform((value) => value === '' ? '' : normalizeWebsiteUrl(value))
  .refine((value): value is string => value !== null, { message: 'Competitor must be an http(s) URL' })
  .optional()
  .or(z.literal(''))

/**
 * Paid checkout intake is persisted before the customer leaves for Stripe.
 * Stripe metadata receives only the resulting audit id, never these free-text fields.
 */
export const CheckoutIntakeSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  url: z
    .string()
    .trim()
    .transform(normalizeWebsiteUrl)
    .refine((value): value is string => value !== null, 'Enter a valid homepage URL'),
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
}).superRefine((input, ctx) => {
  if (!input.icp_description.trim() && !input.score_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['icp_description'],
      message: 'Describe the business before starting the audit',
    })
  }
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

export const READY_MATERIALS_LIMITS = {
  faq: { min: 4, max: 6 },
  cta: { min: 3, max: 5 },
} as const

/** What the LLM produces (meta + FAQ + CTAs). JSON-LD is built deterministically. */
export const ReadyMaterialsLlmSchema = z.object({
  meta_title: z.string(),
  meta_description: z.string(),
  faq: z.array(FaqItemSchema).min(READY_MATERIALS_LIMITS.faq.min).max(READY_MATERIALS_LIMITS.faq.max),
  cta_variants: z.array(z.string()).min(READY_MATERIALS_LIMITS.cta.min).max(READY_MATERIALS_LIMITS.cta.max),
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
  // Deterministic buyer-intent taxonomy. Optional for saved legacy evidence.
  query_intent: z.enum([
    'category_discovery',
    'comparison',
    'alternatives',
    'problem',
    'local',
    'trust',
    'pricing',
    'use_case',
    'other',
  ]).optional(),
  status: z.enum(['ok_grounded', 'ok_no_citations', 'tool_failure', 'provider_error', 'timeout', 'empty', 'invalid', 'skipped']).optional(),
  grounding: z.enum(['grounded', 'no_citations']).optional(),
  tool_events: z.object({ search_requests: z.number(), search_results: z.number(), tool_errors: z.array(z.string()), protocol: z.enum(['claude_web_search', 'openai_web_search_preview', 'perplexity_sonar', 'none']) }).optional(),
  sample_index: z.number().int().positive().optional(),
  query_id: z.string().optional(), combination_id: z.string().optional(), model: z.string().optional(), observed_at: z.string().optional(),
  answer_text: z.string().optional(), excerpt_offset: z.number().int().nonnegative().optional(),
  retrieved_urls: z.array(z.string()).nullable().optional(),
  retrieval_capture: z.enum(['resolved', 'unsupported']).optional(),
  retrieved_meta: z.array(z.object({ url: z.string(), page_age: z.string().nullable().optional() })).optional(),
  cited_urls: z.array(z.string()).nullable().optional(),
  citation_attachment: z.enum(['resolved', 'unresolved', 'unsupported']).optional(),
  /** Whether this sample can be included in a citation-rate denominator. */
  citation_evaluable: z.boolean().optional(),
  /** RD-02 disclosure: resolved RD-00 attachment or a non-authoritative legacy state. */
  citation_semantics: z.enum(['resolved', 'mixed_legacy', 'unresolved', 'unsupported']).optional(),
  engine_issued_queries: z.array(z.string()).optional(),
  stop_reason: z.string().nullable().optional(),
  truncated_at: z.number().int().nonnegative().nullable().optional(),
  /** A missing brand observation is indeterminate when the provider stopped or storage clipped it. */
  absence_observation: z.enum(['observed', 'censored', 'not_applicable']).optional(),
  raw_response_sha256: z.string().nullable().optional(),
  started_at: z.string().optional(), finished_at: z.string().optional(),
  scope: z.enum(['core', 'supplemental']).optional(),
  entity_observations: z.array(z.object({ entity_id: z.string(), name_as_written: z.string(), role: z.enum(['competitor', 'channel_or_directory', 'source_or_publisher', 'engine', 'generic', 'unknown']), span_start: z.number().int().nonnegative(), span_end: z.number().int().nonnegative(), matched_alias: z.string(), text_source: z.enum(['answer_text', 'answer_excerpt']) })).optional(),
})

export type GeoEvidence = z.infer<typeof GeoEvidenceSchema>

/** Reproducible breakdown of how ai_visibility_score was computed. */
export const GeoScoreBreakdownSchema = z.object({
  mention_rate: z.number(), // 0-100
  citation_rate: z.number().nullable(), // 0-100
  position_score: z.number().nullable(), // 0-100, higher = named earlier
  share_of_voice: z.number().nullable(), // 0-100
  weights: z.object({
    mention: z.number(),
    citation: z.number(),
    position: z.number(),
    share_of_voice: z.number(),
  }),
  unavailable_reason: z.string().optional(),
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

export const GeoQueryIntentSchema = z.enum([
  'category_discovery',
  'comparison',
  'alternatives',
  'problem',
  'local',
  'trust',
  'pricing',
  'use_case',
  'other',
])
export type GeoQueryIntent = z.infer<typeof GeoQueryIntentSchema>

export const GeneratedQuerySchema = z.object({
  query: z.string(),
  slot: z.enum(['category_discovery', 'problem_need', 'comparison_alternatives', 'icp_use_case', 'trust_or_pricing', 'local_or_second_decision']),
  intent_choice: z.enum(['trust', 'pricing', 'local', 'use_case', 'comparison', 'alternatives']).optional(),
  language: z.string(), model_language: z.string().optional(), market: z.string().optional(), geo_scope: z.enum(['explicit', 'implicit', 'none']), rationale: z.string(),
})
export const QueryProvenanceSchema = GeneratedQuerySchema.extend({
  query_id: z.string(), intent: GeoQueryIntentSchema,
  language_source: z.enum(['intake', 'operator', 'page_detected', 'legacy']),
  scope: z.enum(['core', 'supplemental']), source: z.enum(['generator', 'operator', 'legacy']),
  validation: z.object({ passed: z.boolean(), errors: z.array(z.string()), warnings: z.array(z.string()), regenerated: z.boolean(), overridden_by_operator: z.boolean().optional() }),
  state: z.enum(['valid', 'unavailable']), unavailable_reason: z.string().optional(), slot_mismatch: z.boolean().optional(),
})
export type QueryProvenance = z.infer<typeof QueryProvenanceSchema>

export const GeoQueryAnalysisSchema = z.object({
  taxonomy_version: z.literal('v1'),
  queries: z.array(z.object({
    query: z.string(),
    intent: GeoQueryIntentSchema,
  })),
  coverage: z.array(z.object({
    intent: GeoQueryIntentSchema,
    query_count: z.number().int().nonnegative(),
    successful_combinations: z.number().int().nonnegative(),
    mentioned_combinations: z.number().int().nonnegative(),
    cited_combinations: z.number().int().nonnegative(),
    mention_rate: z.number().min(0).max(100),
    citation_rate: z.number().min(0).max(100),
  })),
})
export type GeoQueryAnalysis = z.infer<typeof GeoQueryAnalysisSchema>

export const GeoActionEvidenceCatalogSchema = z.object({
  query_intent_coverage: z.array(z.object({
    evidence_id: z.string(),
    intent: GeoQueryIntentSchema,
    query_count: z.number().int().nonnegative(),
    successful_combinations: z.number().int().nonnegative(),
    mentioned_combinations: z.number().int().nonnegative(),
    cited_combinations: z.number().int().nonnegative(),
    mention_rate: z.number().min(0).max(100),
    citation_rate: z.number().min(0).max(100),
  })),
  top_competitors: z.array(z.object({
    evidence_id: z.string(),
    name: z.string(),
    mention_count: z.number().int().nonnegative(),
    mention_rate: z.number().min(0).max(100),
  })),
  cited_domains: z.array(z.object({
    evidence_id: z.string(),
    domain: z.string(),
    citation_count: z.number().int().nonnegative(),
  })),
  source_gaps: z.array(z.object({
    evidence_id: z.string(),
    cited_source: z.string(),
    observed_characteristics: z.array(z.string()),
    target_missing_signals: z.array(z.string()),
  })),
})
export type GeoActionEvidenceCatalog = z.infer<typeof GeoActionEvidenceCatalogSchema>

export const EligibilityStatusSchema = z.enum(['eligible', 'blocked', 'warning', 'unknown'])
export const TechnicalEligibilitySchema = z.object({
  overall_status: z.enum(['eligible', 'limited', 'blocked', 'unknown']),
  checked_at: z.string(),
  checks: z.array(z.object({
    id: z.string(),
    label: z.string(),
    status: EligibilityStatusSchema,
    detail: z.string(),
    evidence: z.string().optional(),
  })),
  crawler_access: z.array(z.object({
    engine: z.string(),
    crawler: z.string(),
    status: EligibilityStatusSchema,
    detail: z.string(),
  })),
})
export type TechnicalEligibility = z.infer<typeof TechnicalEligibilitySchema>

export const RecommendationStageSchema = z.enum([
  'ACCESS',
  'RETRIEVAL',
  'CITATION',
  'ENTITY',
  'AUTHORITY',
  'PROMINENCE',
  'MEASUREMENT',
])
export type RecommendationStage = z.infer<typeof RecommendationStageSchema>

export const StagedGeoRecommendationSchema = z.object({
  stage: RecommendationStageSchema,
  action: z.string(),
  depends_on_access: z.boolean(),
  blocking_reason: z.string().optional(),
  evidence_ids: z.array(z.string()).optional(),
})
export type StagedGeoRecommendation = z.infer<typeof StagedGeoRecommendationSchema>

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
  expected_samples: z.number().optional(), successful_samples: z.number().optional(), grounded_samples: z.number().optional(), no_citation_samples: z.number().optional(),
  supplemental_expected_combinations: z.number().optional(), supplemental_successful_combinations: z.number().optional(),
})
export type GeoTestCounts = z.infer<typeof GeoTestCountsSchema>

/** A1 per-engine coverage row (typed; optional on GeoResult for legacy reports). */
export const EngineCoverageSchema = z.object({
  engine: z.string(),
  configured_queries: z.number(),
  expected_samples: z.number(),
  successful_samples: z.number(),
  grounded_samples: z.number(),
  no_citation_samples: z.number(),
  tool_failure_samples: z.number(),
  provider_error_samples: z.number(),
  timeout_samples: z.number(),
  empty_or_invalid_samples: z.number(),
  skipped_samples: z.number(),
  queries_with_evidence: z.number(),
  gate_passed: z.boolean(),
  gate_reasons: z.array(z.string()),
})
export type EngineCoverageRow = z.infer<typeof EngineCoverageSchema>

/** A1 deterministic coverage gate (typed; optional on GeoResult for legacy reports). */
export const CoverageGateSchema = z.object({
  passed: z.boolean(),
  reasons: z.array(z.string()),
  thresholds: z.object({ min_queries_per_engine_ratio: z.number(), min_overall_success_ratio: z.number(), min_valid_core_slots: z.number() }),
  evaluated_at: z.string(),
})

export const GeoResultSchema = z.object({
  brand: z.string(),
  brand_domain: z.string(),
  queries_tested: z.number(),
  engines_tested: z.array(z.string()),
  test_counts: GeoTestCountsSchema.optional(),
  // Deterministic metrics
  ai_visibility_score: z.number().min(0).max(100).nullable(),
  mention_rate: z.number().min(0).max(100),
  citation_rate: z.number().min(0).max(100).nullable(),
  share_of_voice: z.number().min(0).max(100).nullable(),
  avg_position: z.number().nullable(),
  score_breakdown: GeoScoreBreakdownSchema,
  evidence: z.array(GeoEvidenceSchema),
  competitor_visibility: z.array(
    z.object({ name: z.string(), mention_rate: z.number().min(0).max(100) })
  ),
  entity_resolution: z.object({ version: z.enum(['v1', 'legacy']), entities: z.array(z.object({ entity_id: z.string(), display_name: z.string(), aliases: z.array(z.string()), role: z.enum(['competitor', 'channel_or_directory', 'source_or_publisher', 'engine', 'generic', 'unknown']), role_source: z.enum(['operator', 'dictionary', 'extractor', 'reviewer']), state: z.enum(['accepted', 'channel', 'unconfirmed', 'rejected']), state_reason: z.string().optional(), occurrences: z.number(), distinct_queries: z.number(), distinct_engines: z.number(), domain_corroborated: z.boolean(), operator_provided: z.boolean(), possible_competitor_flag: z.boolean().optional(), composite: z.boolean().optional() })) }).optional(),
  channels_observed: z.array(z.object({ name: z.string(), kind: z.string(), mention_rate: z.number().min(0).max(100), role_source: z.enum(['operator', 'dictionary', 'extractor', 'reviewer']) })).optional(),
  cited_domains_ranked: z.array(z.object({ domain: z.string(), count: z.number() })),
  // LLM narrative
  missing_signals: z.array(z.string()),
  recommendations: z.array(z.string()),
  summary: z.string(),
  // Evidence-based "why these sources get cited" analysis. Optional so older
  // reports and runs without source analysis still validate.
  source_gap_analysis: z.array(GeoSourceGapSchema).optional().nullable(),
  // Measurement v2 fields are optional so historical reports remain valid.
  query_analysis: GeoQueryAnalysisSchema.optional(),
  technical_eligibility: TechnicalEligibilitySchema.optional(),
  staged_recommendations: z.array(StagedGeoRecommendationSchema).optional(),
  ledger: z.array(z.object({ query_id: z.string(), query: z.string(), engine: z.string(), sample_index: z.number(), status: z.enum(['ok_grounded', 'ok_no_citations', 'tool_failure', 'provider_error', 'timeout', 'empty', 'invalid', 'skipped']), status_reason: z.string().optional(), tool_events: z.object({ search_requests: z.number(), search_results: z.number(), tool_errors: z.array(z.string()), protocol: z.enum(['claude_web_search', 'openai_web_search_preview', 'perplexity_sonar', 'none']) }).optional(), attempts: z.number(), model: z.string().optional(), http_status: z.number().optional(), answer_length: z.number(), citations_count: z.number(), latency_ms: z.number().optional(), observed_at: z.string(), evidence_id: z.string().optional(), diagnostic_answer_text: z.string().optional() })).optional(),
  engine_coverage: z.array(EngineCoverageSchema).optional(),
  coverage_gate: CoverageGateSchema.optional(),
  observed_at: z.string().optional(),
  observed_until: z.string().optional(),
  query_provenance: z.array(QueryProvenanceSchema).optional(),
  query_plan: z.object({ valid_core_slots: z.number(), review_required: z.boolean(), primary_language: z.string(), markets: z.array(z.string()), warnings: z.array(z.string()).optional() }).optional(),
  supplemental_probes: z.array(z.object({ query_id: z.string(), slot: z.string(), language: z.string(), query: z.string(), per_engine: z.array(z.object({ engine: z.string(), successful: z.number(), mentioned: z.number(), cited: z.number() })) })).optional(),
  acquisition_protocol: z.object({ version: z.string(), engines: z.array(z.object({ engine: z.string(), model_requested: z.string(), tool_type_version: z.string(), max_uses: z.number().nullable(), max_tokens: z.number().nullable(), web_search_mode: z.string() })), user_location: z.null(), samples_per_combination: z.literal(1), query_plan_hash: z.string() }).optional(),
  acquisition_operational: z.object({ provider_concurrency: z.array(z.object({ engine: z.string(), concurrency: z.number() })) }).optional(),
  /** Computation identity, deliberately separate from immutable acquisition facts. */
  computation_version: z.string().optional(),
  computed_by: z.object({ version: z.string(), at: z.string(), source: z.enum(['fresh', 'reused', 'rerender']) }).optional(),
  measurement_methodology: z.object({ market: z.string().nullable(), languages_tested: z.array(z.string()), core_queries: z.number(), supplemental_queries: z.number(), providers: z.array(z.object({ engine: z.string(), model: z.string().nullable() })), samples_per_combination: z.number(), user_location: z.null(), location_behavior: z.string() }).optional(),
})

export type GeoResult = z.infer<typeof GeoResultSchema>

// --- Severity & Impact Enums ---

const severitySchema = z.enum(['critical', 'medium', 'low'])
export const ACTION_FIX_IMPACTS = ['high', 'medium', 'low'] as const
export const ACTION_FIX_EFFORTS = ['easy', 'medium', 'hard'] as const
export const ACTION_FIX_CATEGORIES = ['copy', 'structure', 'proof', 'cta', 'ai_search'] as const
export const ACTION_OUTREACH_CHANNELS = ['linkedin', 'email', 'twitter'] as const
const impactSchema = z.enum(ACTION_FIX_IMPACTS)
const effortSchema = z.enum(ACTION_FIX_EFFORTS)
const categorySchema = z.enum(ACTION_FIX_CATEGORIES)
const channelSchema = z.enum(ACTION_OUTREACH_CHANNELS)
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
  // Deployment identity is captured by the Trigger worker when it generates
  // the report. It must survive later Vercel re-renders unchanged.
  engine_version: z.string().optional(),
  engine_commit: z.string().optional(),
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

const actionFixSchema = z.object({
    id: z.number(),
    title: z.string(),
    description: z.string().trim().min(1),
    impact: impactSchema,
    effort: effortSchema,
    category: categorySchema,
    // Required for fresh AI-visibility fixes by ActionGenerationBlockSchema;
    // optional here so historical stored reports remain readable.
    observed: z.string().optional(),
    inferred: z.string().optional(),
    recommended: z.string().optional(),
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
    recommendation_stage: RecommendationStageSchema.optional(),
    depends_on_access: z.boolean().optional(),
    blocking_reason: z.string().optional(),
})

const actionSchema = z.object({
  executive_summary: z.string(),
  top_fixes: z.array(actionFixSchema).min(3).max(10),
  ship_first: z.array(z.string()),
  ignore_for_now: z.array(z.string()),
  outreach_messages: z.array(OutreachMessageSchema).superRefine((messages, ctx) => {
    const channels = messages.map((m) => m.channel)
    const unique = new Set(channels)
    if (messages.length !== ACTION_OUTREACH_CHANNELS.length || unique.size !== ACTION_OUTREACH_CHANNELS.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'outreach_messages must contain exactly one linkedin, one email, and one twitter message',
      })
      return
    }
    for (const channel of ACTION_OUTREACH_CHANNELS) {
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
  // Technical access/indexability gate. Independent from whether AI engines responded.
  technical_eligibility: TechnicalEligibilitySchema.optional().nullable(),
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
export const ActionGenerationBlockSchema = actionSchema.superRefine((action, ctx) => {
  action.top_fixes.forEach((fix, index) => {
    if (fix.category !== 'ai_search') return
    for (const field of ['observed', 'inferred', 'recommended'] as const) {
      if (!fix[field]?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['top_fixes', index, field],
          message: `AI-visibility fixes require a non-empty ${field} statement`,
        })
      }
    }
    if (fix.inferred && !/\b(?:may|might|could|possible|does not (?:prove|show|establish)|not causal|non-causal)\b/i.test(fix.inferred)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['top_fixes', index, 'inferred'],
        message: 'AI-visibility inference must be explicitly non-causal',
      })
    }
  })
})

export type ClarityBlock = z.infer<typeof ClarityBlockSchema>
export type GapBlock = z.infer<typeof GapBlockSchema>
export type ActionBlock = z.infer<typeof ActionBlockSchema>
