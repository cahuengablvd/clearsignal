import { describe, expect, it } from 'vitest'
import { detectLanguage, parseMarketsLanguages } from '../lib/geo/language'

describe('A4 language planning', () => {
  it('parses ordered languages and market context', () => {
    expect(parseMarketsLanguages('Latvia, Riga - Latvian and Russian')).toMatchObject({ languages: ['lv', 'ru'], markets: ['Latvia', 'Riga'] })
    expect(parseMarketsLanguages('Malta; English')).toMatchObject({ languages: ['en'], markets: ['Malta'] })
    expect(parseMarketsLanguages('Toronto and GTA; English')).toMatchObject({ languages: ['en'], markets: ['Toronto', 'GTA'] })
    expect(parseMarketsLanguages('')).toMatchObject({ languages: [], markets: [] })
    expect(parseMarketsLanguages('Spain, Costa del Sol (Marbella, Puerto Banus); English')).toMatchObject({ languages: ['en'], markets: ['Spain', 'Costa del Sol (Marbella, Puerto Banus)'] })
    expect(parseMarketsLanguages('Latvia, Riga - Russian and Latvian').languages).toEqual(['ru', 'lv'])
    expect(parseMarketsLanguages('Germany - German and English').languages).toEqual(['de', 'en'])
    expect(parseMarketsLanguages('Poland - Polish and German').languages).toEqual(['pl', 'de'])
    expect(parseMarketsLanguages('Latvia - Latvian, Russian and English').languages).toEqual(['lv', 'ru', 'en'])
  })
  it('detects English, Latvian, Russian and unknown conservatively', () => {
    expect(detectLanguage('what is the best service for families').lang).toBe('en')
    expect(detectLanguage('kā izvēlēties labākais pakalpojums').lang).toBe('lv')
    expect(detectLanguage('как выбрать лучший сервис для семьи').lang).toBe('ru')
    expect(detectLanguage('xqz blrp')).toEqual({ lang: 'unknown', confidence: 0 })
  })
})
