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
  if (/\b(schema|json-ld|structured data|review-rating|review schema|faqpage|organization schema|artgallery schema|artwork schema)\b/.test(text)) {
    return 'SEO'
  }
  if (/\b(inquiry process|inquiry path|inquiry flow|contact info|contact information|contact details|contact page|contact form|availability inquiry)\b/.test(text)) {
    return 'Founder / marketing'
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

  if (/\b(svg|logo render|broken logo|image|html|css|json-ld|schema|structured data|script|developer|technical|rendered html|implement|publish|build|cta|call-to-action|button|contact info|contact information|contact details|contact page|contact form|inquiry form|inquiry path|inquiry flow)\b/.test(text)) {
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

export function inferFixContributor(fix: RoleAssignableFix): string | undefined {
  const text = `${fix.title} ${fix.description}`.toLowerCase()

  if (/\b(schema|json-ld|structured data|faqpage|organization schema|localbusiness|movingcompany)\b/.test(text)) {
    return inferFixOwner(fix) === 'SEO' ? undefined : 'SEO'
  }
  if (/\b(inquiry process|inquiry path|inquiry flow|contact info|contact information|contact details|contact page|contact form|availability inquiry)\b/.test(text)) {
    return 'Copywriter'
  }
  if (/\b(service page|landing page|faq|headline|tagline|copy|message|messaging|positioning|case stud|process section)\b/.test(text)) {
    return inferFixOwner(fix) === 'Copywriter' ? undefined : 'Copywriter'
  }
  if (/\b(directory|citation|ai visibility|source|google business profile|homestars|yelp|bbb|thumbtack|reddit|facebook)\b/.test(text)) {
    return inferFixOwner(fix) === 'SEO' ? undefined : 'SEO'
  }

  return undefined
}
