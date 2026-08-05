export const SCRAPE_CHALLENGE_MESSAGE =
  'We received a browser-verification page instead of readable homepage content. Please check the site access settings before trying again.'

export const SCRAPE_THIN_MESSAGE =
  'We could not find enough readable homepage content to run the check.'

const MIN_READABLE_CHARACTERS = 200
const MAX_CHALLENGE_CHARACTERS = 2000

const CHALLENGE_MARKERS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'browser verification', pattern: /just a moment|checking your browser|verify (?:that you are )?human|enable (?:java)?script(?: and cookies)?/i },
  { label: 'Cloudflare challenge', pattern: /cf-browser-verification|ray id|performance\s*&\s*security by cloudflare|attention required/i },
  { label: 'Akamai challenge', pattern: /akamai.*(?:reference|access denied)|reference #\d+/i },
  { label: 'PerimeterX challenge', pattern: /perimeterx|px-captcha/i },
  { label: 'DataDome challenge', pattern: /datadome|captcha-delivery\.com/i },
  { label: 'Imperva challenge', pattern: /incapsula|imperva.*(?:incident|access denied)/i },
  { label: 'Sucuri challenge', pattern: /sucuri website firewall|access denied.*sucuri/i },
]

export type ScrapeQualityAssessment =
  | { kind: 'substantive'; readableCharacters: number }
  | { kind: 'challenge'; readableCharacters: number; marker: string; message: string }
  | { kind: 'thin'; readableCharacters: number; message: string }

export function assessScrapeQuality(content: string): ScrapeQualityAssessment {
  const normalized = content.replace(/\s+/g, ' ').trim()
  const marker = CHALLENGE_MARKERS.find(({ pattern }) => pattern.test(normalized))

  if (marker && normalized.length < MAX_CHALLENGE_CHARACTERS) {
    return {
      kind: 'challenge',
      readableCharacters: normalized.length,
      marker: marker.label,
      message: SCRAPE_CHALLENGE_MESSAGE,
    }
  }

  if (normalized.length < MIN_READABLE_CHARACTERS) {
    return {
      kind: 'thin',
      readableCharacters: normalized.length,
      message: SCRAPE_THIN_MESSAGE,
    }
  }

  return { kind: 'substantive', readableCharacters: normalized.length }
}

export class UnusableScrapeError extends Error {
  readonly kind: 'challenge' | 'thin'

  constructor(assessment: Extract<ScrapeQualityAssessment, { kind: 'challenge' | 'thin' }>) {
    super(assessment.message)
    this.name = 'UnusableScrapeError'
    this.kind = assessment.kind
  }
}

export function requireUsableScrape(content: string): void {
  const assessment = assessScrapeQuality(content)
  if (assessment.kind !== 'substantive') throw new UnusableScrapeError(assessment)
}
