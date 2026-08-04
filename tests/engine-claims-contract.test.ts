import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const contractPath = join(root, 'lib', 'engine-scope.ts')

function source(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

describe('public engine claims contract', () => {
  it('uses one shared contract for free-score execution, paid execution, and score-page copy', async () => {
    expect(existsSync(contractPath), 'lib/engine-scope.ts must define the shared engine contract').toBe(true)
    if (!existsSync(contractPath)) return

    const contract = await import('../lib/engine-scope')
    expect(contract.FREE_SCORE_ENGINES).toEqual(['claude'])
    expect(contract.FULL_AUDIT_ENGINES).toEqual(['claude', 'perplexity', 'openai'])
    expect(contract.SCORE_ENGINE_SCOPE_COPY).toBe(
      'The free score samples one engine (Claude) on a handful of buyer questions. The full audit tests ChatGPT, Claude and Perplexity across your buyer question set and has a person review the result.'
    )

    expect(source('lib/score-runner.ts')).toContain('engines: [...FREE_SCORE_ENGINES]')
    expect(source('lib/geo/engines.ts')).toContain('FULL_AUDIT_ENGINES.filter')
    expect(source('app/score/page.tsx')).toContain('{SCORE_ENGINE_SCOPE_COPY}')

    for (const publicPath of ['app/page.tsx', 'app/checkout/page.tsx', 'app/layout.tsx']) {
      expect(source(publicPath), publicPath).toContain(contract.FULL_AUDIT_ENGINE_NAMES)
    }
  })
})
