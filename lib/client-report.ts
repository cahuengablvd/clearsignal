import type { ClearSignalReport } from './schemas'

export type ClientReport = Omit<ClearSignalReport, 'action'> & {
  action: Omit<ClearSignalReport['action'], 'outreach_messages'>
}

const OPERATOR_MARKERS: Array<[RegExp, string]> = [
  [/\bRewritten Outreach Messages\b/i, 'operator outreach heading'],
  [/\bahead of reaching out\b/i, 'operator outreach instruction'],
  [/\boperator outreach appendix\b/i, 'operator appendix heading'],
]

export function buildClientReport(report: ClearSignalReport): ClientReport {
  const cloned = JSON.parse(JSON.stringify(report)) as ClearSignalReport
  const { outreach_messages: _outreach, ...clientAction } = cloned.action
  return {
    ...cloned,
    action: clientAction,
  }
}

export function validateClientReportProjection(report: ClientReport): string[] {
  const text = JSON.stringify(report)
  return OPERATOR_MARKERS.flatMap(([pattern, label]) =>
    pattern.test(text) ? [`client_report_operator_leak: ${label}`] : []
  )
}
