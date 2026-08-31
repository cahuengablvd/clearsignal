import { describe, expect, it } from 'vitest'
import config from '../trigger.config'

describe('Trigger runtime compatibility', () => {
  it('uses the supported Node 22 runtime required by Supabase Realtime', () => {
    expect(config.runtime).toBe('node-22')
  })
})
