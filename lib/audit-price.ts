export const AUDIT_PRICE_CURRENCY = 'eur'
export const AUDIT_PRICE_UNIT_AMOUNT = 14_900

export type StripeAuditPrice = {
  active: boolean
  currency: string
  unit_amount: number | null
  type: string
}

export function auditPriceConfigurationError(price: StripeAuditPrice): string | null {
  if (!price.active) return 'Audit price is inactive'
  if (price.type !== 'one_time') return 'Audit price must be one-time'
  if (price.currency.toLowerCase() !== AUDIT_PRICE_CURRENCY) {
    return `Audit price currency must be ${AUDIT_PRICE_CURRENCY.toUpperCase()}`
  }
  if (price.unit_amount !== AUDIT_PRICE_UNIT_AMOUNT) {
    return `Audit price must be EUR ${(AUDIT_PRICE_UNIT_AMOUNT / 100).toFixed(2)}`
  }
  return null
}
