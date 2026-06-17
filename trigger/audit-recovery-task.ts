import { schedules } from '@trigger.dev/sdk'
import { recoverStuckAudits } from '../lib/audit-recovery'

/**
 * Automated safety net: every 10 minutes, re-enqueue any paid audit stuck in
 * queued or stale processing. Shares logic with POST /api/admin/audits/recover.
 * Failed re-enqueues raise an alert via notify('audit_recovery_failed', ...).
 */
export const auditRecoverySweep = schedules.task({
  id: 'audit-recovery-sweep',
  cron: '*/10 * * * *', // every 10 minutes
  maxDuration: 300,
  run: async () => {
    const summary = await recoverStuckAudits()
    if (summary.found > 0) {
      console.log('[audit-recovery-sweep]', JSON.stringify(summary))
    }
    return summary
  },
})
