const ABBREVIATIONS = [
  'e.g.',
  'i.e.',
  'vs.',
  'etc.',
  'mr.',
  'mrs.',
  'ms.',
  'dr.',
  'st.',
  'no.',
]

function protectedPeriod(text: string, index: number): boolean {
  const left = text.slice(Math.max(0, index - 16), index + 1).toLowerCase()
  if (ABBREVIATIONS.some((abbr) => left.endsWith(abbr))) return true
  if (/[a-z]\.[a-z]/i.test(text.slice(Math.max(0, index - 1), index + 2))) return true
  if (/\d\.\d/.test(text.slice(Math.max(0, index - 1), index + 2))) return true
  if (/[a-z0-9-]\.[a-z]{2,}(?:[/?#:]|$)/i.test(text.slice(Math.max(0, index - 30), index + 20))) return true
  if (text[index - 1] === '.' || text[index + 1] === '.') return true
  return false
}

function insidePair(text: string, index: number, open: string, close: string): boolean {
  let depth = 0
  for (let i = 0; i < index; i++) {
    if (text[i] === open) depth++
    else if (text[i] === close && depth > 0) depth--
  }
  return depth > 0
}

function insideQuote(text: string, index: number, quote: '"' | "'"): boolean {
  let count = 0
  for (let i = 0; i < index; i++) {
    if (text[i] === quote && text[i - 1] !== '\\') count++
  }
  return count % 2 === 1
}

/**
 * Split prose into sentence-like segments while preserving trailing whitespace.
 * The invariant is: splitSentences(t).join('') === t.
 */
export function splitSentences(text: string): string[] {
  if (!text) return ['']
  const segments: string[] = []
  let start = 0

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch !== '.' && ch !== '!' && ch !== '?') continue
    if (ch === '.' && protectedPeriod(text, i)) continue
    if (insidePair(text, i, '(', ')') || insidePair(text, i, '[', ']')) continue
    if (insideQuote(text, i, '"') || insideQuote(text, i, "'")) continue

    let end = i + 1
    while (end < text.length && /\s/.test(text[end])) end++
    segments.push(text.slice(start, end))
    start = end
  }

  if (start < text.length) segments.push(text.slice(start))
  return segments.length ? segments : [text]
}
