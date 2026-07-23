import type { MetadataRoute } from 'next'

const BASE_URL = 'https://getclearsignal.io'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    '',
    '/score',
    '/sample',
    '/checkout',
    '/terms',
    '/privacy',
    '/refund',
  ].map((path) => ({
    url: `${BASE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency: path === '' ? 'weekly' : 'monthly',
    priority: path === '' ? 1 : path === '/score' ? 0.9 : 0.6,
  }))
}
