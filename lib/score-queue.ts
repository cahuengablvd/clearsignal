import { runFreeScore, type FreeScoreInput } from './score-runner'

export async function enqueueFreeScore(scoreId: string, input: FreeScoreInput): Promise<void> {
  if (process.env.TRIGGER_SECRET_KEY) {
    const { runFreeScoreTask } = await import('../trigger/score-task')
    await runFreeScoreTask.trigger({ scoreId, input })
    return
  }

  // Local development remains end-to-end without a Trigger.dev credential.
  void runFreeScore(scoreId, input)
}
