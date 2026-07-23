import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import {
  buildClientReport,
  validateClientReportProjection,
} from '../lib/client-report'
import type { ClearSignalReport } from '../lib/schemas'

function loadRozie(): ClearSignalReport {
  return JSON.parse(
    readFileSync(join(process.cwd(), 'tests', 'fixtures', 'golden-report-rozie.json'), 'utf8')
  ) as ClearSignalReport
}

describe('client report projection', () => {
  it('structurally excludes operator outreach before web or PDF rendering', () => {
    const source = loadRozie()
    expect(source.action.outreach_messages.length).toBeGreaterThan(0)

    const client = buildClientReport(source)
    const text = JSON.stringify(client)

    expect('outreach_messages' in client.action).toBe(false)
    expect(text).not.toMatch(/Rewritten Outreach Messages/i)
    expect(text).not.toMatch(/ahead of reaching out/i)
    expect(validateClientReportProjection(client)).toEqual([])
  })

  it('rejects operator markers if a renderer reintroduces them', () => {
    const client = buildClientReport(loadRozie())
    const contaminated = {
      ...client,
      data_limitations: [
        ...(client.data_limitations || []),
        'Rewritten Outreach Messages ahead of reaching out.',
      ],
    }

    expect(validateClientReportProjection(contaminated)).toEqual([
      'client_report_operator_leak: operator outreach heading',
      'client_report_operator_leak: operator outreach instruction',
    ])
  })
})
