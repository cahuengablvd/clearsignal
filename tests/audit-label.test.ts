import { describe, expect, it } from 'vitest'
import { AUDIT_PROCESS_LABEL, AUDIT_PRODUCT_LABEL } from '../lib/audit-label'

describe('audit labels', () => {
  it('distinguishes the reviewed product from its automated analysis stage', () => {
    expect(AUDIT_PRODUCT_LABEL).toBe('AI Visibility Audit, reviewed by a person')
    expect(AUDIT_PROCESS_LABEL).toBe('Automated analysis + human review before delivery')
  })
})
