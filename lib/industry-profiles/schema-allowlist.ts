import type { MaterialCategory } from '../materials'

export type SchemaCategory = MaterialCategory | 'marketplace' | 'tailoring'

const SCHEMA_ALLOWLIST: Record<SchemaCategory, string[]> = {
  // LocalBusiness is valid as a verified supertype for movers, but guidance prefers MovingCompany/Service.
  moving_service: ['MovingCompany', 'Service', 'FAQPage', 'Organization', 'LocalBusiness'],
  video_production: ['ProfessionalService', 'Organization', 'Service', 'FAQPage', 'VideoObject'],
  tailoring_atelier: ['LocalBusiness', 'ProfessionalService', 'Service', 'FAQPage', 'Organization'],
  tailoring: ['LocalBusiness', 'ProfessionalService', 'Service', 'FAQPage', 'Organization'],
  art_gallery: ['ArtGallery', 'Organization', 'VisualArtwork', 'FAQPage', 'LocalBusiness'],
  marketplace: ['Organization', 'WebSite', 'FAQPage', 'ItemList', 'OfferCatalog'],
  default: ['Organization', 'FAQPage', 'WebSite'],
}

export function allowedSchemaTypes(category: string): string[] | null {
  const normalized = category.trim().toLowerCase().replace(/[\s-]+/g, '_') as SchemaCategory
  return SCHEMA_ALLOWLIST[normalized] ?? null
}
