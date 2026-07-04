import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { CostTracker } from '../lib/cost-tracker'
import { runQualityCriticPass } from '../lib/quality/critic'
import { validateReport } from '../lib/report-validator'
import { sanitizeGeneratedReportValue } from '../lib/sanitize'
import type { ClearSignalReport } from '../lib/schemas'

const fixtureDir = join(process.cwd(), 'tests', 'fixtures')
const fixtures = ['az-moving', 'blvdprod', 'latvianart', 'monokelriga']
const runShadow = process.env.RUN_QUALITY_CRITIC_SHADOW === 'true'

describe('quality critic shadow fixture run', () => {
  const shadowIt = runShadow ? it : it.skip

  shadowIt('runs the critic over stored fixtures and prints review data', async () => {
    const results = []

    for (const slug of fixtures) {
      const path = join(fixtureDir, `golden-report-${slug}.json`)
      if (!existsSync(path)) {
        results.push({ slug, skipped: true, reason: 'fixture missing' })
        continue
      }

      const source = JSON.parse(readFileSync(path, 'utf8')) as ClearSignalReport
      const sanitized = sanitizeGeneratedReportValue(source, undefined, undefined, {
        businessContext: source.meta.business_context,
      })
      const validation = validateReport(sanitized)
      expect(validation.errors).toEqual([])

      const cost = new CostTracker()
      const critic = await runQualityCriticPass({
        report: validation.report,
        onUsage: (event) => cost.add(event),
        meta: {
          auditId: `fixture:${slug}`,
          stage: 'quality_critic_shadow_fixture',
          trigger: 'unknown',
          recoveryAttempt: 0,
          endpoint: 'quality-critic-shadow.test',
        },
      })

      results.push({
        slug,
        estimatedCostUsd: cost.totalUsd(),
        issueCount: critic.issues.length,
        droppedIssues: critic.droppedIssues,
        issues: critic.issues.map((issue) => ({
          severity: issue.severity,
          category: issue.category,
          path: issue.path,
          explanation: issue.explanation,
          canAutoFix: issue.canAutoFix,
        })),
      })
    }

    console.log('[quality-critic-shadow-results]', JSON.stringify(results, null, 2))
  }, 120000)
})
