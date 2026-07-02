import { schedules } from '@trigger.dev/sdk'
import { checkAnthropicBalance } from '../lib/anthropic-balance'

/**
 * Best-effort cost guard. This task never blocks audits: if Anthropic's Admin
 * API cannot expose a usable balance for the account, the result is `unknown`.
 */
export const anthropicBalanceSweep = schedules.task({
  id: 'anthropic-balance-sweep',
  cron: '0 */6 * * *', // every 6 hours
  maxDuration: 120,
  run: async () => {
    const result = await checkAnthropicBalance()
    console.log('[anthropic-balance-sweep]', JSON.stringify(result))
    return result
  },
})
