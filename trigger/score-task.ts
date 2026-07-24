import { queue, task } from '@trigger.dev/sdk'
import { runFreeScore, type FreeScoreInput } from '../lib/score-runner'

export const freeScoreQueue = queue({
  name: 'free-score',
  concurrencyLimit: 2,
})

export const runFreeScoreTask = task({
  id: 'run-free-score',
  queue: freeScoreQueue,
  maxDuration: 120,
  run: async (payload: { scoreId: string; input: FreeScoreInput }) => {
    await runFreeScore(payload.scoreId, payload.input)
    return { scoreId: payload.scoreId }
  },
})
