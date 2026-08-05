import type { TechnicalEligibility } from '../schemas'
import { assessScrapeQuality } from '../scrape-quality'

type Fetcher = typeof fetch

const CRAWLERS = [
  { engine: 'OpenAI / ChatGPT Search', crawler: 'OAI-SearchBot' },
  { engine: 'Perplexity', crawler: 'PerplexityBot' },
] as const

type RobotsRule = { allow: boolean; path: string }
type RobotsGroup = { agents: string[]; rules: RobotsRule[] }

function compact(value: string, limit = 240): string {
  const text = value.replace(/\s+/g, ' ').trim()
  return text.length > limit ? `${text.slice(0, limit)}...` : text
}

function stripTags(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseRobots(text: string): RobotsGroup[] {
  const groups: RobotsGroup[] = []
  let current: RobotsGroup = { agents: [], rules: [] }

  const flush = () => {
    if (current.agents.length) groups.push(current)
    current = { agents: [], rules: [] }
  }

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim()
    if (!line) {
      if (current.rules.length) flush()
      continue
    }
    const match = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line)
    if (!match) continue
    const directive = match[1].toLowerCase()
    const value = match[2].trim()
    if (directive === 'user-agent') {
      if (current.rules.length) flush()
      current.agents.push(value.toLowerCase())
    } else if ((directive === 'allow' || directive === 'disallow') && current.agents.length && value) {
      current.rules.push({ allow: directive === 'allow', path: value })
    }
  }
  flush()
  return groups
}

function robotsPattern(path: string): RegExp {
  const anchored = path.endsWith('$')
  const source = path
    .replace(/\$$/, '')
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
  return new RegExp(`^${source}${anchored ? '$' : ''}`)
}

function crawlerAllowed(robots: string, crawler: string, pathname: string): { allowed: boolean; rule?: string } {
  const groups = parseRobots(robots)
  const exact = groups.filter((group) => group.agents.includes(crawler.toLowerCase()))
  const selected = exact.length ? exact : groups.filter((group) => group.agents.includes('*'))
  const matching = selected
    .flatMap((group) => group.rules)
    .filter((rule) => robotsPattern(rule.path).test(pathname))
    .sort((a, b) => b.path.length - a.path.length || Number(b.allow) - Number(a.allow))
  if (!matching.length) return { allowed: true }
  return { allowed: matching[0].allow, rule: `${matching[0].allow ? 'Allow' : 'Disallow'}: ${matching[0].path}` }
}

function canonicalFromHtml(html: string): string | null {
  const link = /<link\b[^>]*rel=["'][^"']*canonical[^"']*["'][^>]*>/i.exec(html)?.[0]
  if (!link) return null
  return /\bhref=["']([^"']+)["']/i.exec(link)?.[1]?.trim() || null
}

function normalizedComparableUrl(value: string, base?: string): string | null {
  try {
    const url = new URL(value, base)
    const path = url.pathname.replace(/\/+$/, '') || '/'
    return `${url.hostname.replace(/^www\./, '').toLowerCase()}${path}`
  } catch {
    return null
  }
}

async function safeFetch(fetcher: Fetcher, url: string, init?: RequestInit): Promise<Response | null> {
  try {
    return await fetcher(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(10_000),
      ...init,
    })
  } catch {
    return null
  }
}

export async function checkTechnicalEligibility(input: {
  url: string
  renderedHtml: string
  markdown: string
  fetcher?: Fetcher
}): Promise<TechnicalEligibility> {
  const checkedAt = new Date().toISOString()
  const scrapeQuality = assessScrapeQuality(input.markdown)
  if (scrapeQuality.kind === 'challenge') {
    const detail = 'Our crawler received a browser-verification challenge at this URL; answer-engine crawlers may receive the same. This observation does not confirm whether any answer-engine crawler is blocked.'
    return {
      overall_status: 'unknown',
      checked_at: checkedAt,
      checks: [{
        id: 'ELIG-CHALLENGE-001',
        label: 'Browser-verification challenge observed',
        status: 'unknown',
        detail,
        evidence: `${scrapeQuality.readableCharacters} text characters observed`,
      }],
      crawler_access: CRAWLERS.map(({ engine, crawler }) => ({
        engine,
        crawler,
        status: 'unknown',
        detail,
      })),
    }
  }
  const fetcher = input.fetcher || fetch
  const target = new URL(input.url)
  const targetResponse = await safeFetch(fetcher, target.toString(), {
    headers: { 'user-agent': 'ClearSignal-Audit/1.0' },
  })

  const checks: TechnicalEligibility['checks'] = []
  if (!targetResponse) {
    checks.push({
      id: 'ELIG-HTTP-001',
      label: 'Public HTTP access',
      status: 'unknown',
      detail: 'A direct HTTP check did not complete. The rendered crawl succeeded, so CDN or WAF access requires verification.',
    })
  } else if (targetResponse.status === 404 || targetResponse.status === 410) {
    checks.push({
      id: 'ELIG-HTTP-001',
      label: 'Public HTTP access',
      status: 'blocked',
      detail: `The target returned HTTP ${targetResponse.status}.`,
      evidence: targetResponse.url,
    })
  } else if (targetResponse.ok) {
    checks.push({
      id: 'ELIG-HTTP-001',
      label: 'Public HTTP access',
      status: 'eligible',
      detail: `The target returned HTTP ${targetResponse.status}.`,
      evidence: targetResponse.url,
    })
  } else {
    checks.push({
      id: 'ELIG-HTTP-001',
      label: 'Public HTTP access',
      status: 'unknown',
      detail: `A direct request returned HTTP ${targetResponse.status}; CDN or WAF behavior may differ by crawler.`,
      evidence: targetResponse.url,
    })
  }

  const xRobots = targetResponse?.headers.get('x-robots-tag') || ''
  const metaNoindex = /<meta\b[^>]*name=["']robots["'][^>]*content=["'][^"']*\bnoindex\b[^"']*["']/i.test(input.renderedHtml) ||
    /<meta\b[^>]*content=["'][^"']*\bnoindex\b[^"']*["'][^>]*name=["']robots["']/i.test(input.renderedHtml)
  const headerNoindex = /\bnoindex\b/i.test(xRobots)
  checks.push({
    id: 'ELIG-INDEX-001',
    label: 'Index directives',
    status: metaNoindex || headerNoindex ? 'blocked' : 'eligible',
    detail: metaNoindex || headerNoindex
      ? 'An explicit noindex directive was detected.'
      : 'No explicit noindex directive was detected in rendered HTML or the HTTP response.',
    evidence: metaNoindex ? '<meta name="robots" content="noindex">' : headerNoindex ? `X-Robots-Tag: ${compact(xRobots)}` : undefined,
  })

  const canonical = canonicalFromHtml(input.renderedHtml)
  const targetComparable = normalizedComparableUrl(input.url)
  const canonicalComparable = canonical ? normalizedComparableUrl(canonical, input.url) : null
  checks.push({
    id: 'ELIG-CANONICAL-001',
    label: 'Canonical target',
    status: !canonical
      ? 'warning'
      : canonicalComparable === targetComparable
        ? 'eligible'
        : 'warning',
    detail: !canonical
      ? 'No canonical URL was detected in the rendered HTML.'
      : canonicalComparable === targetComparable
        ? 'The canonical URL points to the audited page.'
        : 'The canonical URL points to a different page; verify that this is intentional.',
    evidence: canonical || undefined,
  })

  const renderedTextLength = Math.max(stripTags(input.renderedHtml).length, input.markdown.trim().length)
  checks.push({
    id: 'ELIG-RENDERED-001',
    label: 'Crawlable rendered content',
    status: renderedTextLength >= 200 ? 'eligible' : 'unknown',
    detail: renderedTextLength >= 200
      ? 'Substantive text was present in the rendered crawl.'
      : 'Very little rendered text was available; critical facts may be visual-only, gated, or client-rendered.',
    evidence: `${renderedTextLength} text characters observed`,
  })

  const robotsUrl = new URL('/robots.txt', target.origin).toString()
  const robotsResponse = await safeFetch(fetcher, robotsUrl, {
    headers: { 'user-agent': 'ClearSignal-Audit/1.0' },
  })
  const robotsText = robotsResponse?.ok ? await robotsResponse.text() : null
  const crawlerAccess: TechnicalEligibility['crawler_access'] = CRAWLERS.map(({ engine, crawler }) => {
    if (robotsResponse?.status === 404) {
      return {
        engine,
        crawler,
        status: 'eligible' as const,
        detail: 'No robots.txt file was found, so no crawler-specific disallow rule was observed.',
      }
    }
    if (!robotsResponse || !robotsText) {
      return {
        engine,
        crawler,
        status: 'unknown' as const,
        detail: 'robots.txt could not be read; crawler access was not confirmed.',
      }
    }
    const result = crawlerAllowed(robotsText, crawler, target.pathname || '/')
    return {
      engine,
      crawler,
      status: result.allowed ? 'eligible' as const : 'blocked' as const,
      detail: result.allowed
        ? 'No matching robots.txt disallow rule was observed.'
        : `robots.txt blocks this crawler for the audited path (${result.rule}).`,
    }
  })

  const globallyBlocked = checks.some((check) => check.status === 'blocked')
  const crawlerBlocked = crawlerAccess.some((item) => item.status === 'blocked')
  const criticalUnknown = checks.some((check) => check.id === 'ELIG-HTTP-001' && check.status === 'unknown') ||
    crawlerAccess.every((item) => item.status === 'unknown')
  const overallStatus: TechnicalEligibility['overall_status'] = globallyBlocked
    ? 'blocked'
    : crawlerBlocked
      ? 'limited'
      : criticalUnknown
        ? 'unknown'
        : 'eligible'

  return {
    overall_status: overallStatus,
    checked_at: checkedAt,
    checks,
    crawler_access: crawlerAccess,
  }
}

export const eligibilityInternals = { parseRobots, crawlerAllowed }
