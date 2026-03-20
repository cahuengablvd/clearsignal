// --- Model IDs ---
export const MODEL_SCORE = 'claude-haiku-4-5-20251001'
export const MODEL_AUDIT = 'claude-sonnet-4-5-20250514'

// --- Free Score ---
export const SCORE_SYSTEM = `You are a B2B SaaS conversion expert.
Analyze this homepage and score each dimension from 1 to 10.
Be direct and critical.
Return ONLY valid JSON and no commentary.`

export function scoreUserPrompt(markdown: string, icp?: string): string {
  return `Homepage content:
${markdown}

ICP provided:
${icp || 'Not provided'}

Score these dimensions and return JSON with these exact keys:
- "icp" (integer 1-10): how clearly the page identifies its target buyer
- "headline" (integer 1-10): how strong and specific the headline is
- "cta" (integer 1-10): how clear and compelling the primary CTA is
- "trust" (integer 1-10): quality of social proof, logos, testimonials, case studies
- "ai_search" (integer 1-10): how well-structured the content is for AI search citation

Also return "top_insight": one sentence, the single most important issue.

Return ONLY a JSON object with keys: icp, headline, cta, trust, ai_search, top_insight`
}

// --- Clarity Block ---
export const CLARITY_SYSTEM = `You are a senior conversion copywriter and positioning strategist.
Analyze this B2B SaaS homepage with surgical precision.
Focus only on what is costing them conversions right now.
Be specific. Reference actual copy from the page when possible.
Return ONLY valid JSON matching the ClearSignalReport.clarity schema.`

export function clarityUserPrompt(markdown: string, icp: string): string {
  return `Homepage content:
${markdown}

ICP description:
${icp || 'Not provided'}

Return a JSON object with this exact structure:
{
  "overall_score": <number 1-100>,
  "icp_visibility": { "score": <1-100>, "finding": "<string>", "severity": "critical"|"medium"|"low" },
  "headline": { "score": <1-100>, "current_headline": "<string>", "finding": "<string>", "suggested_rewrite": "<string>", "severity": "critical"|"medium"|"low" },
  "cta": { "score": <1-100>, "finding": "<string>", "suggested_rewrite": "<string>", "severity": "critical"|"medium"|"low" },
  "trust_proof": { "score": <1-100>, "finding": "<string>", "missing_elements": ["<string>"], "severity": "critical"|"medium"|"low" },
  "messaging_fit": { "score": <1-100>, "finding": "<string>", "severity": "critical"|"medium"|"low" }
}`
}

// --- Gap Block ---
export const GAP_SYSTEM = `You are a competitive intelligence analyst for B2B SaaS.
Compare the target homepage against competitors.
Identify specific messaging gaps, positioning advantages, and AI-search visibility heuristics.
Be concrete. Quote short phrases from pages when useful.
Assess AI-search visibility heuristically based on content clarity, specificity, entity signals, citation-worthiness, and structured cues.
Do not claim actual indexing or actual citation status unless directly verified.
Return ONLY valid JSON matching the ClearSignalReport.gap schema.`

export function gapUserPrompt(
  targetMarkdown: string,
  competitors: { url: string; markdown: string }[],
  clarityOutput: string
): string {
  const compSections = competitors
    .map((c, i) => `--- Competitor ${i + 1}: ${c.url} ---\n${c.markdown}`)
    .join('\n\n')

  return `Target homepage:
${targetMarkdown}

${compSections ? `Competitors:\n${compSections}` : 'No competitor data available.'}

Clarity analysis already done:
${clarityOutput}

Return a JSON object with this exact structure:
{
  "competitor_analysis": [{ "url": "<string>", "headline": "<string>", "strengths": ["<string>"], "weaknesses": ["<string>"], "clarity_score": <number> }],
  "where_you_lose": ["<string>"],
  "where_you_win": ["<string>"],
  "ai_search": { "score": <1-100>, "finding": "<string>", "is_likely_cited": <boolean>, "missing_signals": ["<string>"], "severity": "critical"|"medium"|"low" }
}

If no competitor data is available, return an empty competitor_analysis array and focus on where_you_lose, where_you_win, and ai_search based on the target alone.`
}

// --- Action Block ---
export const ACTION_SYSTEM = `You are a B2B SaaS growth advisor writing an action plan.
Based on the audit findings, generate:
1. an executive summary (3 to 4 sentences)
2. top 10 fixes prioritized by impact and effort
3. three outreach messages rewritten to reflect the positioning improvements
Be direct.
Write fixes as specific actions, not vague advice.
Return ONLY valid JSON matching the ClearSignalReport.action schema.`

export function actionUserPrompt(clarityOutput: string, gapOutput: string, icp: string): string {
  return `Clarity analysis:
${clarityOutput}

Gap analysis:
${gapOutput}

ICP description:
${icp || 'Not provided'}

Return a JSON object with this exact structure:
{
  "executive_summary": "<string, 3-4 sentences>",
  "top_fixes": [{ "id": <number>, "title": "<string>", "description": "<string>", "impact": "high"|"medium"|"low", "effort": "easy"|"medium"|"hard", "category": "copy"|"structure"|"proof"|"cta"|"ai_search" }],
  "ship_first": ["<string>"],
  "ignore_for_now": ["<string>"],
  "outreach_messages": [{ "channel": "linkedin"|"email"|"twitter", "message": "<string>", "note": "<string>" }]
}

Provide exactly 10 fixes, 3-5 ship_first items, 2-3 ignore_for_now items, and exactly 3 outreach messages (one per channel).`
}
