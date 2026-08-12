import { describe, expect, it, vi } from 'vitest'
import { logSupabaseWriteFailure, requireSupabaseWrite } from '../lib/supabase-write'

describe('Supabase write handling', () => {
  it('fails fulfillment writes loudly with their table and audit id', () => {
    const error = { message: 'permission denied' }
    expect(() => requireSupabaseWrite(error, 'audits report for audit audit-1')).toThrow(
      /audits report for audit audit-1.*permission denied/
    )
  })

  it('logs a telemetry write failure without aborting', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(() => logSupabaseWriteFailure({ message: 'timeout' }, 'audit_ai_call_logs telemetry for audit audit-1')).not.toThrow()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('audit_ai_call_logs telemetry for audit audit-1 failed: timeout'))
    warn.mockRestore()
  })
})
