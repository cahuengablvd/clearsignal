export type RoleAssignableFix = {
  title: string
  description: string
  category: string
}

export const ROLE_BY_CATEGORY: Record<string, string> = {
  copy: 'Copywriter',
  cta: 'Founder / marketing',
  ai_search: 'SEO',
  structure: 'SEO',
  proof: 'Founder / marketing',
}

export function inferFixOwner(fix: RoleAssignableFix): string {
  const text = `${fix.title} ${fix.description}`.toLowerCase()

  if (/\b(svg|logo render|broken logo|logos? (?:not|don'?t|failed|failing|broken)|image rendering|visual asset)\b/.test(text)) {
    return 'Developer'
  }
  if (/\b(testimonial|review|customer|case stud|proof|g2|capterra|clutch|designrush|partner|roundup)\b/.test(text)) {
    return 'Founder / marketing'
  }
  if (/\b(cta|call-to-action|button|demo request|book demo|contact sales)\b/.test(text)) {
    return 'Founder / marketing'
  }
  if (/\b(headline|tagline|copy|message|messaging|positioning|cta|call-to-action|hero|rewrite|narrative)\b/.test(text)) {
    return 'Copywriter'
  }
  if (/\b(use case|web3|service page|landing page|comparison|alternatives|faq|keyword|directory|citation|ai visibility|source|indexable|meta title|meta description)\b/.test(text)) {
    return 'SEO'
  }

  return ROLE_BY_CATEGORY[fix.category] || 'Founder / marketing'
}

export function inferFixImplementer(fix: RoleAssignableFix): string {
  const text = `${fix.title} ${fix.description}`.toLowerCase()

  if (/\b(svg|logo render|broken logo|image|html|css|json-ld|schema|structured data|script|developer|technical|rendered html|implement|publish|build|cta|call-to-action|button)\b/.test(text)) {
    return 'Developer'
  }
  if (/\b(headline|tagline|copy|message|messaging|positioning|cta|call-to-action|hero|rewrite|narrative|case stud|process section)\b/.test(text)) {
    return 'Copywriter'
  }
  if (/\b(use case|web3|service page|landing page|comparison|alternatives|faq|keyword|directory|citation|ai visibility|source|indexable|meta title|meta description)\b/.test(text)) {
    return 'SEO'
  }

  return inferFixOwner(fix)
}
