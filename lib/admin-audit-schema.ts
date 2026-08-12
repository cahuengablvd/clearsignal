// Keep the admin query and its migration diagnostic in lockstep. A missing
// field here means the admin page cannot load its audit list.
export const ADMIN_AUDIT_COLUMNS = [
  'id',
  'created_at',
  'email',
  'url',
  'payment_status',
  'audit_status',
  'tier',
  'admin_notes',
  'reviewer_note',
  'api_cost_usd',
  'api_cost_breakdown',
  'last_generated_at',
  'last_rerendered_at',
  'last_delivered_at',
  'report',
  'quality',
] as const

// Keep this literal: Supabase uses it to infer the returned row type.
export const ADMIN_AUDIT_SELECT = 'id, created_at, email, url, payment_status, audit_status, tier, admin_notes, reviewer_note, api_cost_usd, api_cost_breakdown, last_generated_at, last_rerendered_at, last_delivered_at, report, quality' as const
