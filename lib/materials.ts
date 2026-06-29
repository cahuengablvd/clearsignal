/**
 * Ready-to-ship materials (#17).
 *
 * The LLM writes the copy (meta/FAQ/CTA). The JSON-LD snippet is built
 * DETERMINISTICALLY here from the brand + FAQ so it is always valid schema.org
 * (Organization + FAQPage) rather than hallucinated markup.
 */
import type { ReadyMaterialsLlm, ReadyMaterials } from './schemas'

function orgName(brand: string, url: string): string {
  if (brand && brand.trim()) return brand.trim()
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** Build a valid Organization + FAQPage JSON-LD <script> block from the FAQ. */
export function buildJsonLd(
  brand: string,
  url: string,
  faq: { question: string; answer: string }[]
): string {
  const graph: Record<string, unknown>[] = [
    { '@type': 'Organization', name: orgName(brand, url), url },
  ]
  if (faq.length > 0) {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: faq.map((f) => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    })
  }
  const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2)
  return `<script type="application/ld+json">\n${json}\n</script>`
}

/** Combine LLM copy with the deterministic JSON-LD snippet. */
export function assembleMaterials(
  brand: string,
  url: string,
  llm: ReadyMaterialsLlm
): ReadyMaterials {
  return { ...llm, json_ld: buildJsonLd(brand, url, llm.faq) }
}
