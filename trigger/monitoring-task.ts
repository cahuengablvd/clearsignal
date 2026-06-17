import { schedules } from '@trigger.dev/sdk'
import { processDueSites } from '../lib/monitoring'

/**
 * Daily sweep: run a fresh AI-visibility check for every monitored site whose
 * weekly cadence is due. Each site's GEO scan runs server-side with retries.
 */
export const monitoringSweep = schedules.task({
  id: 'monitoring-weekly-sweep',
  cron: '0 8 * * *', // every day at 08:00 UTC
  maxDuration: 3600,
  run: async () => {
    const result = await processDueSites()
    return result
  },
})
