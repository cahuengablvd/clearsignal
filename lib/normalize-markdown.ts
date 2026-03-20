/**
 * Simple heuristic markdown normalization for LLM analysis.
 * Strips nav/footer boilerplate, keeps hero + CTA + social proof sections.
 */
export function normalizeMarkdown(raw: string): string {
  const lines = raw.split('\n')
  const filtered: string[] = []
  let inNav = false
  let inFooter = false

  for (const line of lines) {
    const lower = line.toLowerCase().trim()

    // Detect navigation sections
    if (lower.match(/^#{1,3}\s*(navigation|menu|nav|skip to)/)) {
      inNav = true
      continue
    }
    if (inNav && line.match(/^#{1,3}\s/)) {
      inNav = false // New heading = end of nav
    }
    if (inNav) continue

    // Detect footer sections
    if (lower.match(/^#{1,3}\s*(footer|copyright|©|all rights reserved)/)) {
      inFooter = true
      continue
    }
    if (inFooter) continue

    // Skip common boilerplate lines
    if (lower.match(/^(cookie|privacy|terms|sitemap|© \d{4}|all rights reserved)/)) continue
    if (lower === '') {
      // Collapse multiple blank lines
      if (filtered.length > 0 && filtered[filtered.length - 1] === '') continue
    }

    // Skip very short link-only lines (nav items)
    if (lower.match(/^\[.{1,20}\]\(.*\)$/) && !lower.includes('sign up') && !lower.includes('get started')) {
      continue
    }

    filtered.push(line)
  }

  let result = filtered.join('\n').trim()

  // Truncate to ~8000 chars to fit in prompt context
  if (result.length > 8000) {
    result = result.slice(0, 8000) + '\n\n[...truncated]'
  }

  return result
}
