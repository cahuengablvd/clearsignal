import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import {
  ACTION_SYSTEM,
  CLARITY_SYSTEM,
  GAP_SYSTEM,
  GEO_ANALYSIS_SYSTEM,
  PLAIN_LANGUAGE_GUIDANCE,
  actionUserPrompt,
} from '../lib/prompts'

type StyleFixture = {
  name: string
  entities: string[]
  action: {
    executive_summary: string
    top_fixes: { description: string }[]
  }
  clarity: Record<string, { finding?: string }>
}

const fixtureDir = join(process.cwd(), 'tests', 'fixtures', 'plain-report')
const fixturePaths = readdirSync(fixtureDir)
  .filter((file) => file.endsWith('.json'))
  .map((file) => join(fixtureDir, file))
const fixtures = fixturePaths.map(
  (path) => JSON.parse(readFileSync(path, 'utf8')) as StyleFixture
)

const bannedPhrases = [
  'leverage',
  'holistic',
  'robust',
  'best-in-class',
  'synergy',
  'highest-leverage path',
  'represents an opportunity to',
]
const hedgePattern = /\bmay\b|\bmight\b|\bcould\b|\bappears to\b|\bseems to\b|\bpotentially\b/gi

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
}

function wordCount(text: string): number {
  return text.match(/[\p{L}\p{N}]+(?:[-'][\p{L}\p{N}]+)*/gu)?.length ?? 0
}

function expectPlainLanguage(text: string): void {
  const proseSentences = sentences(text)
  const lengths = proseSentences.map(wordCount)
  const mean = lengths.reduce((total, length) => total + length, 0) / lengths.length

  expect(proseSentences.length).toBeGreaterThan(0)
  expect(mean).toBeLessThan(22)
  expect(Math.max(...lengths)).toBeLessThanOrEqual(35)
  for (const sentence of proseSentences) {
    expect((sentence.match(hedgePattern) ?? []).length).toBeLessThanOrEqual(1)
  }
  for (const phrase of bannedPhrases) {
    expect(text.toLowerCase()).not.toContain(phrase)
  }
}

describe('plain report prompt contract', () => {
  it('uses the shared plain-language guidance in every analysis prompt', () => {
    expect(PLAIN_LANGUAGE_GUIDANCE).toContain('one idea per sentence')
    expect(PLAIN_LANGUAGE_GUIDANCE).toContain('no more than one hedge')
    for (const systemPrompt of [
      ACTION_SYSTEM,
      CLARITY_SYSTEM,
      GAP_SYSTEM,
      GEO_ANALYSIS_SYSTEM,
    ]) {
      expect(systemPrompt).toContain(PLAIN_LANGUAGE_GUIDANCE)
    }
  })

  it('requires the executive summary to present evidence in the specified order', () => {
    const prompt = actionUserPrompt('{}', '{}', 'buyers', 'Example Brand')
    const working = prompt.indexOf('strongest observed thing working')
    const absent = prompt.indexOf('where the brand was absent')
    const competitors = prompt.indexOf('competitors that appeared instead')
    const firstAction = prompt.indexOf('single first action')

    expect(working).toBeGreaterThan(-1)
    expect(working).toBeLessThan(absent)
    expect(absent).toBeLessThan(competitors)
    expect(competitors).toBeLessThan(firstAction)
    expect(prompt).toContain('Do not open with a sentence that only says the brand was reviewed')
    expect(prompt).toContain('exactly 4 sentences')
    expect(prompt).toContain('Each sentence must contain at most 18 words')
    expect(prompt).toContain('Do not put evidence IDs in prose')
  })
})

describe('plain report fixture contract', () => {
  it('covers the golden fixture and at least two other stored report fixtures', () => {
    expect(fixtures.map((fixture) => fixture.name)).toContain('golden')
    expect(fixtures.length).toBeGreaterThanOrEqual(3)
  })

  for (const fixture of fixtures) {
    it(`${fixture.name} keeps generated prose short and concrete`, () => {
      const clarityFindings = Object.values(fixture.clarity)
        .map((section) => section.finding)
        .filter((finding): finding is string => Boolean(finding))
      const proseFields = [
        fixture.action.executive_summary,
        ...clarityFindings,
        ...fixture.action.top_fixes.map((fix) => fix.description),
      ]

      for (const field of proseFields) expectPlainLanguage(field)

      const firstSentence = sentences(fixture.action.executive_summary)[0]
      const namesEntity = fixture.entities.some((entity) =>
        firstSentence.toLowerCase().includes(entity.toLowerCase())
      )
      const namesMeasuredCount = /\b\d+\s+(?:of|out of)\s+\d+\b/i.test(firstSentence)
      expect(namesEntity || namesMeasuredCount).toBe(true)
    })
  }
})
