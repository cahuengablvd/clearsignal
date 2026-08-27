'use client'

import { Fragment, useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { hasInsufficientQueryPlan } from '@/lib/admin-preview'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, RefreshCw, ExternalLink, LogIn, X, Plus } from 'lucide-react'
import { pollAuditStatus } from '@/lib/audit-polling'
import { normalizeWebsiteUrl } from '@/lib/normalize-url'
import { BAND_LABEL, bandFor } from '@/lib/audit-bands'
import { adminSessionState } from '@/lib/admin-session'
import { buildAdminEntityDiagnostics } from '@/lib/entity-presentation'

type Audit = {
  id: string
  created_at: string
  email: string
  url: string
  payment_status: string
  audit_status: string
  tier: string
  admin_notes: string | null
  reviewer_note: string | null
  report_url?: string | null
  has_report?: boolean
  validation_repair_count?: number
  api_cost_usd?: number | string | null
  ai_cost_summary?: {
    ai_call_count: number
    stages_executed: string[]
    input_tokens: number
    output_tokens: number
    cache_read_tokens: number
    cache_creation_tokens: number
    estimated_cost_usd: number
    recovery_attempts: number
    duplicate_stage_warning: boolean
    triggers: string[]
  } | null
  engine_coverage_summary?: {
    configured_engines: string[]
    engines_with_evidence: string[]
    missing_engines: string[]
    expected_combinations: number
    successful_combinations: number
    failed_or_skipped_combinations: number
    complete: boolean
    gate?: { passed: boolean; reasons: string[] } | null
    per_engine?: Array<{ engine: string; successful_samples: number; expected_samples: number; grounded_samples: number; no_citation_samples: number; tool_failure_samples: number; provider_error_samples: number; timeout_samples: number }>
    failed_rows?: Array<{ query: string; engine: string; status: string; status_reason?: string; attempts: number; diagnostic_answer_text?: string }>
    observed_at?: string
    evidence_age_days?: number
  } | null
  quality_summary?: {
    stage: string | null
    shadow_mode: boolean
    critic: {
      model: string | null
      ranAt: string | null
      attempt: number | null
      droppedIssues: number
      issue_count: number
      counts: {
        critical: number
        high: number
        medium: number
        low: number
      }
      issues: Array<{
        id: string
        severity: string
        category: string
        path: string
        explanation: string
        currentText?: string
        suggestedReplacement?: string
        canAutoFix: boolean
      }>
    } | null
    criticError?: { message?: string; ranAt?: string; attempt?: number } | null
  } | null
  last_generated_at?: string | null
  last_rerendered_at?: string | null
  last_delivered_at?: string | null
  last_activity_at?: string | null
  app_commit?: string | null
  expected_engine_version?: string | null
  engine_version?: string | null
  engine_commit?: string | null
  engine_version_drift?: boolean
  deterministic_failure?: boolean
  business_context?: { brand_aliases?: string }
  entity_diagnostics?: Array<{ entity_id: string; display_name: string; role: string; state: string; state_reason?: string; role_source: string; occurrences: number; distinct_queries: number; distinct_engines: number; domain_corroborated: boolean; operator_provided: boolean; possible_competitor_flag?: boolean; composite?: boolean }>
}

type DailyAiSpend = {
  utc_date: string
  spend_usd: number | null
  cap_usd: number
  queue_blocked: boolean
  error?: string
}

const emptyForm = {
  email: '',
  url: '',
  competitor_1: '',
  competitor_2: '',
  competitor_3: '',
  icp_description: '',
  business_context: {
    business_model: 'unknown',
    primary_conversion_goal: 'unknown',
    purchase_availability: 'unknown',
    ships_internationally: 'unknown',
    provenance_or_authentication: 'unknown',
    target_markets_languages: '',
    verified_facts: '',
  },
}

type AuditPreview = {
  brand: string
  url: string
  icp_description: string
  business_context?: typeof emptyForm.business_context
  competitors: string[]
  queries: string[]
  status?: 'query_plan_insufficient'
  plan?: { core: Array<{ query: string; slot: string; language: string }>; supplemental: Array<{ query: string; slot: string; language: string }>; provenance: Array<{ query_id: string; query: string; slot: string; language: string; model_language?: string; scope: string; state: string; validation: { errors: string[]; warnings: string[] } }>; valid_core_slots: number; review_required: boolean; primary_language: string; markets: string[]; warnings?: string[] }
  scraped: boolean
}

const CUSTOM_OPTION = '__custom__'

type BusinessContextKey = keyof typeof emptyForm.business_context

type SelectOption = {
  value: string
  label: string
}

const businessContextOptions: Record<
  Exclude<BusinessContextKey, 'target_markets_languages' | 'verified_facts'>,
  { label: string; error: string; options: SelectOption[] }
> = {
  business_model: {
    label: 'Business model',
    error: 'Enter a custom business model or select another option.',
    options: [
      { value: 'unknown', label: 'Unknown / not confirmed' },
      { value: 'service_business', label: 'Service business' },
      { value: 'product_business', label: 'Product business' },
      { value: 'saas_software', label: 'SaaS / software' },
      { value: 'marketplace', label: 'Marketplace' },
      { value: 'two_sided_marketplace', label: 'Two-sided marketplace' },
      { value: 'ecommerce', label: 'E-commerce' },
      { value: 'gallery', label: 'Gallery' },
      { value: 'agency_studio', label: 'Agency / studio' },
      { value: 'local_business', label: 'Local business' },
      { value: 'nonprofit', label: 'Nonprofit' },
      { value: 'media_publication', label: 'Media / publication' },
      { value: 'not_applicable', label: 'Not applicable' },
      { value: CUSTOM_OPTION, label: 'Other / Custom' },
    ],
  },
  primary_conversion_goal: {
    label: 'Primary conversion goal',
    error: 'Enter a custom conversion goal or select another option.',
    options: [
      { value: 'unknown', label: 'Unknown / not confirmed' },
      { value: 'inquiry', label: 'Inquiry' },
      { value: 'booking', label: 'Booking' },
      { value: 'purchase', label: 'Purchase' },
      { value: 'app_download', label: 'App download' },
      { value: 'registration_signup', label: 'Registration / sign-up' },
      { value: 'lead_generation', label: 'Lead generation' },
      { value: 'quote_request', label: 'Quote request' },
      { value: 'demo_booking', label: 'Demo booking' },
      { value: 'subscription', label: 'Subscription' },
      { value: 'contact', label: 'Contact' },
      { value: 'job_application', label: 'Job application' },
      { value: 'provider_onboarding', label: 'Provider onboarding' },
      { value: 'not_applicable', label: 'Not applicable' },
      { value: CUSTOM_OPTION, label: 'Other / Custom' },
    ],
  },
  purchase_availability: {
    label: 'Purchase / booking availability',
    error: 'Enter custom purchase or booking availability, or select another option.',
    options: [
      { value: 'unknown', label: 'Unknown / not confirmed' },
      { value: 'available_website', label: 'Available directly on the website' },
      { value: 'available_app', label: 'Available through a mobile app' },
      { value: 'available_inquiry', label: 'Available through an inquiry' },
      { value: 'available_quote', label: 'Available through a quote request' },
      { value: 'available_appointment', label: 'Available by appointment' },
      { value: 'third_party_platforms', label: 'Available through third-party platforms' },
      { value: 'not_currently_available', label: 'Not currently available' },
      { value: 'not_applicable', label: 'Not applicable' },
      { value: CUSTOM_OPTION, label: 'Other / Custom' },
    ],
  },
  ships_internationally: {
    label: 'Shipping / service availability',
    error: 'Enter custom shipping or service availability, or select another option.',
    options: [
      { value: 'unknown', label: 'Unknown / not confirmed' },
      { value: 'local_only', label: 'Local only' },
      { value: 'national', label: 'National' },
      { value: 'international', label: 'International' },
      { value: 'selected_regions', label: 'Selected countries or regions' },
      { value: 'digital_delivery', label: 'Digital delivery' },
      { value: 'on_site_service', label: 'On-site service' },
      { value: 'service_no_shipping', label: 'No shipping - service business' },
      { value: 'not_applicable', label: 'Not applicable' },
      { value: CUSTOM_OPTION, label: 'Other / Custom' },
    ],
  },
  provenance_or_authentication: {
    label: 'Certificates / provenance / verification',
    error: 'Enter custom verification details, or select another option.',
    options: [
      { value: 'unknown', label: 'Unknown / not confirmed' },
      { value: 'verified_certificates', label: 'Verified certificates available' },
      { value: 'professional_licences', label: 'Professional licences or qualifications' },
      { value: 'provider_identity_verification', label: 'Provider identity verification' },
      { value: 'background_checks', label: 'Background checks' },
      { value: 'product_provenance', label: 'Product provenance available' },
      { value: 'authentication_documentation', label: 'Authentication documentation available' },
      { value: 'no_formal_verification', label: 'No formal verification stated' },
      { value: 'not_applicable', label: 'Not applicable' },
      { value: CUSTOM_OPTION, label: 'Other / Custom' },
    ],
  },
}

function isCustomOption(value: string): boolean {
  return value.startsWith(`${CUSTOM_OPTION}:`)
}

function customValue(value: string): string {
  return isCustomOption(value) ? value.slice(CUSTOM_OPTION.length + 1) : ''
}

function selectValue(value: string, options: SelectOption[]): string {
  if (isCustomOption(value)) return CUSTOM_OPTION
  return options.some((o) => o.value === value) ? value : CUSTOM_OPTION
}

function resolvedBusinessContextValue(value: string): string {
  return isCustomOption(value) ? customValue(value).trim() : value
}

function setBusinessContextValue(
  current: typeof emptyForm,
  key: Exclude<BusinessContextKey, 'target_markets_languages' | 'verified_facts'>,
  value: string
) {
  return {
    ...current,
    business_context: {
      ...current.business_context,
      [key]: value,
    },
  }
}

function resolvedBusinessContext(context: typeof emptyForm.business_context): typeof emptyForm.business_context {
  return {
    ...context,
    business_model: resolvedBusinessContextValue(context.business_model),
    primary_conversion_goal: resolvedBusinessContextValue(context.primary_conversion_goal),
    purchase_availability: resolvedBusinessContextValue(context.purchase_availability),
    ships_internationally: resolvedBusinessContextValue(context.ships_internationally),
    provenance_or_authentication: resolvedBusinessContextValue(context.provenance_or_authentication),
  }
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [audits, setAudits] = useState<Audit[]>([])
  const [dailyAiSpend, setDailyAiSpend] = useState<DailyAiSpend | null>(null)
  // Finding one audit in a long list is the daily pain, not archiving. A filter
  // over what is already loaded solves it without a migration or a second screen.
  const [query, setQuery] = useState('')
  const [hideFinished, setHideFinished] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)
  // Finished work is hidden by default: it is the bulk of the list and there is
  // nothing left to do with it. Typing a filter searches everything regardless,
  // so a delivered audit is always findable by name.
  const needle = query.trim().toLowerCase()
  const visibleAudits = audits.filter((audit) => {
    if (needle) {
      return (
        audit.url?.toLowerCase().includes(needle) ||
        audit.email?.toLowerCase().includes(needle) ||
        audit.audit_status?.toLowerCase().includes(needle)
      )
    }
    // Everything is visible unless the operator asks to hide finished work. The
    // opposite default made a delivered audit vanish the moment it was sent, and
    // findable only by typing its name into the filter.
    return !hideFinished || bandFor(audit.audit_status) !== 'finished'
  })
  const [loading, setLoading] = useState(false)
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null)
  const [rerenderingId, setRerenderingId] = useState<string | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [creating, setCreating] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [preview, setPreview] = useState<AuditPreview | null>(null)
  const [editedQueries, setEditedQueries] = useState<string[]>([])
  const [createMsg, setCreateMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [regenMsg, setRegenMsg] = useState<{ ok: boolean; text: string } | null>(null)

  function businessContextErrors(): string[] {
    return (Object.entries(businessContextOptions) as Array<[Exclude<BusinessContextKey, 'target_markets_languages' | 'verified_facts'>, typeof businessContextOptions.business_model]>)
      .filter(([key]) => selectValue(form.business_context[key], businessContextOptions[key].options) === CUSTOM_OPTION)
      .filter(([key]) => !customValue(form.business_context[key]).trim())
      .map(([, config]) => config.error)
  }

  // Simple password gate (check against env via API)
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (res.ok) {
      setAuthed(true)
      loadAudits()
    } else {
      alert('Invalid password')
    }
  }

  async function loadAudits() {
    setLoading(true)
    await refreshAudits()
    setLoading(false)
  }

  async function refreshAudits(): Promise<Audit[]> {
    // A failed request must never render as an empty database. On 2026-08-07 a
    // missing column made this return [], the page said "No audits yet", and it
    // read as total data loss (R23).
    let res: Response
    try {
      res = await fetch('/api/admin/audits', { cache: 'no-store' })
    } catch {
      setLoadError('Could not reach the server. Check your connection and retry.')
      return []
    }
    if (!res.ok) {
      setLoadError(`Could not load audits (HTTP ${res.status}). Existing audits are unaffected.`)
      return []
    }
    const data = await res.json()
    const nextAudits = (data.audits || []) as Audit[]
    setDailyAiSpend((data.daily_ai_spend || null) as DailyAiSpend | null)
    setLoadError(null)
    setAudits(nextAudits)
    return nextAudits
  }

  async function pollAuditUntilTerminal(auditId: string): Promise<Audit | null> {
    return pollAuditStatus(auditId, refreshAudits)
  }

  async function regenerateAudit(auditId: string, overrideDeterministicFailure = false) {
    setRegeneratingId(auditId)
    setRegenMsg(null)
    try {
      const requestRegeneration = (confirmReuseAge = false) => fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audit_id: auditId,
          reuse_geo_evidence: true,
          confirm_reuse_age: confirmReuseAge,
          override_deterministic_failure: overrideDeterministicFailure,
        }),
      })
      let res = await requestRegeneration()
      let data = await res.json().catch(() => ({}))
      if (res.status === 409 && data.error === 'reuse_evidence_age_confirmation_required') {
        const observed = data.observed_at ? ` Observed ${String(data.observed_at).slice(0, 10)}.` : ''
        const confirmed = window.confirm(`Stored GEO evidence is ${data.evidence_age_days} days old (warning threshold: ${data.threshold_days} days).${observed}\n\nReuse this stored evidence for regeneration?`)
        if (!confirmed) {
          setRegenMsg({ ok: false, text: 'Regeneration cancelled; stored GEO evidence was not reused.' })
          setRegeneratingId(null)
          return
        }
        res = await requestRegeneration(true)
        data = await res.json().catch(() => ({}))
      }
      if (res.ok) {
        const now = new Date().toISOString()
        setAudits((items) =>
          items.map((audit) =>
            audit.id === auditId
              ? {
                  ...audit,
                  audit_status: 'queued',
                  last_generated_at: now,
                  last_activity_at: now,
                  deterministic_failure: false,
                  admin_notes: audit.admin_notes
                    ? `${audit.admin_notes}\n[${now}] ${overrideDeterministicFailure ? 'Deterministic failure override by admin operator. ' : ''}Queued for regeneration.`
                    : `[${now}] ${overrideDeterministicFailure ? 'Deterministic failure override by admin operator. ' : ''}Queued for regeneration.`,
                }
              : audit
          )
        )
        setRegenMsg({ ok: true, text: `Audit queued for regeneration: ${auditId}` })
      } else {
        setRegenMsg({ ok: false, text: data.error || `Regeneration failed (${res.status})` })
      }
      if (res.ok) {
        const terminal = await pollAuditUntilTerminal(auditId)
        if (terminal) {
          setRegenMsg({
            ok: !['failed', 'failed-validation'].includes(terminal.audit_status),
            text: `Regeneration finished with status: ${terminal.audit_status}`,
          })
        } else {
          setRegenMsg({
            ok: false,
            text: 'Regeneration is still running after 30 minutes. Use Refresh to check its status.',
          })
        }
      } else {
        await refreshAudits()
      }
    } catch (err) {
      console.error('Regeneration failed:', err)
      setRegenMsg({ ok: false, text: 'Regeneration request failed' })
    }
    setRegeneratingId(null)
  }

  async function rerenderAudit(auditId: string) {
    setRerenderingId(auditId)
    setRegenMsg(null)
    try {
      const res = await fetch('/api/admin/audits/rerender', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audit_id: auditId }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setRegenMsg({
          ok: true,
          text: `Report re-rendered without new AI calls: ${auditId} (${data.validation_repair_count || 0} repairs)`,
        })
      } else {
        setRegenMsg({ ok: false, text: data.error || `Re-render failed (${res.status})` })
      }
      await loadAudits()
    } catch (err) {
      console.error('Re-render failed:', err)
      setRegenMsg({ ok: false, text: 'Re-render request failed' })
    }
    setRerenderingId(null)
  }

  // Step 1: preview - generate the queries and show a confirmation screen.
  async function previewAudit(e: React.FormEvent) {
    e.preventDefault()
    const errors = businessContextErrors()
    if (errors.length) {
      setCreateMsg({ ok: false, text: errors[0] })
      return
    }
    setPreviewing(true)
    setCreateMsg(null)
    const normalizedUrl = normalizeWebsiteUrl(form.url)
    const rawCompetitors = [form.competitor_1, form.competitor_2, form.competitor_3]
    const normalizedCompetitors = [form.competitor_1, form.competitor_2, form.competitor_3]
      .map((value) => value ? normalizeWebsiteUrl(value) : '')
    if (!normalizedUrl || normalizedCompetitors.some((value, index) => rawCompetitors[index] && !value)) {
      setCreateMsg({ ok: false, text: 'Enter a valid homepage URL' })
      setPreviewing(false)
      return
    }
    const payload = {
      ...form,
      url: normalizedUrl,
      competitor_1: normalizedCompetitors[0],
      competitor_2: normalizedCompetitors[1],
      competitor_3: normalizedCompetitors[2],
      business_context: resolvedBusinessContext(form.business_context),
    }
    try {
      const res = await fetch('/api/admin/audits/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (res.ok || hasInsufficientQueryPlan(data)) {
        setPreview(data as AuditPreview)
        const previewData = data as AuditPreview
        setEditedQueries(previewData.status === 'query_plan_insufficient'
          ? previewData.plan!.provenance.filter((item) => item.scope === 'core').map((item) => item.query)
          : previewData.queries)
        if (!res.ok) setCreateMsg({ ok: false, text: 'Query plan is insufficient. Correct the unavailable rows; the server will not create an audit until at least four core rows validate.' })
      } else {
        setCreateMsg({ ok: false, text: data.error || 'Failed to preview audit' })
      }
    } catch {
      setCreateMsg({ ok: false, text: 'Preview request failed' })
    }
    setPreviewing(false)
  }

  // Step 2: confirm - only now is the audit created and run.
  async function confirmAudit() {
    const finalQueries = editedQueries.map((q) => q.trim()).filter(Boolean)
    if (finalQueries.length === 0) {
      setCreateMsg({ ok: false, text: 'Add at least one query before running.' })
      return
    }
    setCreating(true)
    setCreateMsg(null)
    const payload = {
      ...form,
      url: normalizeWebsiteUrl(form.url),
      competitor_1: form.competitor_1 ? normalizeWebsiteUrl(form.competitor_1) : '',
      competitor_2: form.competitor_2 ? normalizeWebsiteUrl(form.competitor_2) : '',
      competitor_3: form.competitor_3 ? normalizeWebsiteUrl(form.competitor_3) : '',
      business_context: resolvedBusinessContext(form.business_context),
    }
    try {
      const res = await fetch('/api/admin/audits/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, queries: finalQueries, ...(preview?.plan ? { query_plan: preview.plan } : {}) }),
      })
      const data = await res.json()
      if (res.ok) {
        setCreateMsg({ ok: true, text: `Audit queued. Share link: ${data.report_url}` })
        setForm(emptyForm)
        setPreview(null)
        await loadAudits()
      } else {
        setCreateMsg({ ok: false, text: data.error || 'Failed to create audit' })
        await loadAudits()
      }
    } catch {
      setCreateMsg({ ok: false, text: 'Request failed' })
    }
    setCreating(false)
  }

  async function saveNotes(auditId: string, notes: string) {
    await fetch('/api/admin/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audit_id: auditId, notes }),
    })
  }

  async function saveReviewerNote(auditId: string, reviewerNote: string) {
    await fetch('/api/admin/reviewer-note', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audit_id: auditId, reviewer_note: reviewerNote }),
    })
  }

  async function markDelivered(auditId: string) {
    await fetch('/api/admin/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audit_id: auditId, audit_status: 'delivered' }),
    })
    await loadAudits()
  }

  async function approveAndSend(auditId: string, force = false, reason?: string) {
    setApprovingId(auditId)
    setRegenMsg(null)
    try {
      const res = await fetch('/api/admin/audits/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audit_id: auditId, force, reason }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        // Sending flips the audit to `delivered`, so it moves to the Finished
        // band. Say where it went; the row changing place unannounced is what
        // read as data loss.
        setRegenMsg({ ok: true, text: 'Report emailed. It moved to the Finished section below.' })
        setHideFinished(false)
      } else if (res.status === 409 && data.error === 'coverage_gate_failed') {
        const overrideReason = window.prompt(`Coverage gate failed: ${(data.reasons || []).join('; ')}\n\nEnter a reason to force approval:`)
        if (overrideReason?.trim()) await approveAndSend(auditId, true, overrideReason.trim())
        else setRegenMsg({ ok: false, text: 'Approval requires a non-empty override reason when coverage failed.' })
      } else {
        setRegenMsg({ ok: false, text: data.error || `Email delivery failed (${res.status})` })
      }
      await loadAudits()
    } catch (err) {
      console.error('Approve & send failed:', err)
      setRegenMsg({ ok: false, text: 'Approve & send request failed' })
    }
    setApprovingId(null)
  }

  useEffect(() => {
    // Resolve the existing session BEFORE deciding what to draw. Rendering the
    // login form first and swapping it for the list a second later is why the
    // operator could not tell when a password would be required.
    async function checkSession() {
      try {
        const res = await fetch('/api/admin/audits', { cache: 'no-store' })
        const session = adminSessionState(res.status)
        setAuthed(session.authed)
        setLoadError(session.loadError)
        if (!session.authed || session.loadError) return

        // A server failure does not prove the session is invalid. Keep the
        // operator in the admin surface so the real error remains visible.
        const data = await res.json()
        setAudits((data.audits || []) as Audit[])
        setDailyAiSpend((data.daily_ai_spend || null) as DailyAiSpend | null)
      } catch {
        setAuthed(true)
        setLoadError('Could not reach the server. Check your connection and retry.')
      } finally {
        setCheckingSession(false)
      }
    }
    void checkSession()
  }, [])

  if (checkingSession) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="text-sm text-muted-foreground">Checking your session…</p>
      </div>
    )
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-sm">
          <CardContent className="p-6">
            <h1 className="text-xl font-bold mb-4">Admin Login</h1>
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Password managers only offer to save when they can identify the
                  form. They need a named password field with autoComplete, plus a
                  username to file the entry under - hidden, since this panel has
                  a single operator and no username to type. */}
              <input
                type="text"
                name="username"
                autoComplete="username"
                value="admin"
                readOnly
                hidden
              />
              <Input
                type="password"
                name="password"
                autoComplete="current-password"
                placeholder="Admin password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button type="submit" className="w-full gap-2">
                <LogIn className="h-4 w-4" /> Login
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  const statusColor: Record<string, string> = {
    queued: 'bg-gray-100 text-gray-800',
    processing: 'bg-blue-100 text-blue-800',
    done: 'bg-green-100 text-green-800',
    awaiting_review: 'bg-purple-100 text-purple-800',
    delivery_failed: 'bg-yellow-100 text-yellow-800',
    delivered: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    'failed-validation': 'bg-red-100 text-red-900',
  }

  const paymentColor: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    paid: 'bg-green-100 text-green-800',
    refunded: 'bg-red-100 text-red-800',
  }

  function formatCost(value: Audit['api_cost_usd']): string | null {
    if (value == null) return null
    const n = Number(value)
    if (!Number.isFinite(n)) return null
    return `$${n.toFixed(2)}`
  }

  function formatNumber(value?: number | null): string {
    return Number(value || 0).toLocaleString()
  }

  function formatEngineName(engine: string): string {
    if (engine === 'openai') return 'ChatGPT'
    return engine.charAt(0).toUpperCase() + engine.slice(1)
  }

  function formatDate(value?: string | null): string | null {
    if (!value) return null
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return null
    return d.toLocaleString()
  }

  function renderBusinessContextSelect(
    key: Exclude<BusinessContextKey, 'target_markets_languages' | 'verified_facts'>
  ) {
    const config = businessContextOptions[key]
    const raw = form.business_context[key]
    const selected = selectValue(raw, config.options)
    const custom = customValue(raw)
    const showError = selected === CUSTOM_OPTION && !custom.trim()

    return (
      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-700">{config.label}</label>
        <select
          className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={selected}
          onChange={(e) => {
            const nextValue = e.target.value === CUSTOM_OPTION ? `${CUSTOM_OPTION}:` : e.target.value
            setForm(setBusinessContextValue(form, key, nextValue))
          }}
        >
          {config.options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        {selected === CUSTOM_OPTION && (
          <>
            <Input
              value={custom}
              maxLength={120}
              placeholder={`Custom ${config.label.toLowerCase()}`}
              onChange={(e) => {
                setForm(setBusinessContextValue(form, key, `${CUSTOM_OPTION}:${e.target.value.slice(0, 120)}`))
              }}
            />
            {showError && <p className="text-xs text-red-700">{config.error}</p>}
          </>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <nav className="border-b">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="text-xl font-bold tracking-tight">ClearSignal Admin</span>
          <Button variant="outline" size="sm" onClick={loadAudits} className="gap-2">
            <RefreshCw className="h-3 w-3" /> Refresh
          </Button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {dailyAiSpend && (
          <div className={`mb-4 rounded border px-4 py-3 text-sm ${
            dailyAiSpend.queue_blocked
              ? 'border-red-200 bg-red-50 text-red-900'
              : 'border-emerald-200 bg-emerald-50 text-emerald-900'
          }`}>
            <span className="font-semibold">AI spend today (UTC):</span>{' '}
            {formatCost(dailyAiSpend.spend_usd) || 'unavailable'} / {formatCost(dailyAiSpend.cap_usd)}
            {' \u00b7 '}{dailyAiSpend.queue_blocked ? 'Queue blocked' : 'Queue open'}
          </div>
        )}

        {/* Create manual / comped audit (no Stripe) */}
        <Card className="mb-8">
          <CardContent className="p-5">
            <h2 className="font-semibold mb-1">Create manual audit</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Runs the full audit with no payment (comped). For friends &amp; feedback.
            </p>

            {preview ? (
              /* Step 2: confirmation screen - nothing runs until "Confirm & run". */
              <div className="space-y-4">
                {preview.status === 'query_plan_insufficient' && (
                  <div className="text-xs text-red-800 bg-red-50 border border-red-200 rounded p-2">
                    Query plan is insufficient. No audit has been created.
                  </div>
                )}
                <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div><span className="text-muted-foreground">Brand:</span> <strong>{preview.brand}</strong></div>
                  <div className="break-all"><span className="text-muted-foreground">URL:</span> {preview.url}</div>
                  <div className="sm:col-span-2"><span className="text-muted-foreground">ICP:</span> {preview.icp_description || <em className="text-muted-foreground">none</em>}</div>
                  <div className="sm:col-span-2">
                    <span className="text-muted-foreground">Business context:</span>{' '}
                    {preview.business_context ? (
                      <div className="mt-1 grid sm:grid-cols-2 gap-x-4 gap-y-1">
                        <div>Business model: {preview.business_context.business_model}</div>
                        <div>Conversion goal: {preview.business_context.primary_conversion_goal}</div>
                        <div>Purchase / booking availability: {preview.business_context.purchase_availability}</div>
                        <div>Shipping / service availability: {preview.business_context.ships_internationally}</div>
                        <div className="sm:col-span-2">Verification: {preview.business_context.provenance_or_authentication}</div>
                        {preview.business_context.target_markets_languages && (
                          <div className="sm:col-span-2">Markets/languages: {preview.business_context.target_markets_languages}</div>
                        )}
                      </div>
                    ) : (
                      <em className="text-muted-foreground">none</em>
                    )}
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-muted-foreground">Competitors:</span>{' '}
                    {preview.competitors.length ? preview.competitors.join(', ') : <em className="text-muted-foreground">none</em>}
                  </div>
                </div>
                {preview.scraped ? (
                  <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded p-2">
                    Homepage read successfully - queries use the observed page content and the supplied context.
                  </div>
                ) : (
                  <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                    Could not read the homepage - queries are based on the brand and supplied description only, not on page content. Check the URL.
                  </div>
                )}
                <div>
                  <div className="text-xs font-semibold text-muted-foreground mb-2">
                    Buyer queries that will be tested ({editedQueries.length}) - edit, remove, or add before running
                  </div>
                  {preview.plan ? <div className="mt-4 overflow-x-auto"><p className="text-xs font-semibold text-muted-foreground mb-2">Query plan</p><table className="w-full text-xs"><thead><tr className="text-left text-muted-foreground"><th>Slot</th><th>Language</th><th>Status</th><th>Reason</th></tr></thead><tbody>{preview.plan.provenance.map((item) => <tr key={item.query_id} className="border-t"><td className="py-1">{item.slot}</td><td>{item.language}</td><td>{item.state}</td><td>{[...item.validation.errors, ...item.validation.warnings].join(', ') || 'valid'}</td></tr>)}</tbody></table></div> : null}
                  <div className="space-y-2">
                    {editedQueries.map((q, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-4 text-right">{i + 1}.</span>
                        <Input
                          value={q}
                          onChange={(e) => {
                            const next = [...editedQueries]
                            next[i] = e.target.value
                            setEditedQueries(next)
                          }}
                          className="text-sm"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="shrink-0 text-muted-foreground hover:text-red-600"
                          onClick={() => setEditedQueries(editedQueries.filter((_, j) => j !== i))}
                          aria-label="Remove query"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  {editedQueries.length < 10 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 gap-1"
                      onClick={() => setEditedQueries([...editedQueries, ''])}
                    >
                      <Plus className="h-3 w-3" /> Add query
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Button variant="outline" onClick={() => setPreview(null)} disabled={creating}>
                    Back
                  </Button>
                  <Button onClick={confirmAudit} disabled={creating} className="gap-2">
                    {creating ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Running...</>
                    ) : (
                      'Confirm & run'
                    )}
                  </Button>
                  {createMsg && (
                    <span className={`text-xs ${createMsg.ok ? 'text-green-700' : 'text-red-700'} break-all`}>
                      {createMsg.text}
                    </span>
                  )}
                </div>
              </div>
            ) : (
            <form onSubmit={previewAudit} className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <Input
                  type="email"
                  placeholder="Email *"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
                <Input
                  type="text"
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="Homepage URL * (yourproduct.com)"
                  required
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                />
                <Input
                  type="text"
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="Competitor 1 (optional)"
                  value={form.competitor_1}
                  onChange={(e) => setForm({ ...form, competitor_1: e.target.value })}
                />
                <Input
                  type="text"
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="Competitor 2 (optional)"
                  value={form.competitor_2}
                  onChange={(e) => setForm({ ...form, competitor_2: e.target.value })}
                />
                <Input
                  type="text"
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="Competitor 3 (optional)"
                  value={form.competitor_3}
                  onChange={(e) => setForm({ ...form, competitor_3: e.target.value })}
                />
              </div>
              <Textarea
                placeholder="ICP description (optional)"
                rows={2}
                value={form.icp_description}
                onChange={(e) => setForm({ ...form, icp_description: e.target.value })}
              />
              <div className="rounded border p-3 space-y-3">
                <div>
                  <div className="text-xs font-semibold text-muted-foreground">Business context</div>
                  <p className="text-xs text-muted-foreground">
                    Used to prevent unverified claims about sales, shipping, certificates, pricing, and markets.
                  </p>
                </div>
                <div className="grid sm:grid-cols-3 gap-3">
                  {renderBusinessContextSelect('business_model')}
                  {renderBusinessContextSelect('primary_conversion_goal')}
                  {renderBusinessContextSelect('purchase_availability')}
                  {renderBusinessContextSelect('ships_internationally')}
                  <div className="sm:col-span-2">
                    {renderBusinessContextSelect('provenance_or_authentication')}
                  </div>
                </div>
                <Textarea
                  placeholder="Target markets and languages (e.g. Latvia + international collectors; Latvian and English)"
                  rows={2}
                  value={form.business_context.target_markets_languages}
                  onChange={(e) => setForm({
                    ...form,
                    business_context: { ...form.business_context, target_markets_languages: e.target.value },
                  })}
                />
                <Textarea
                  placeholder="Verified facts ClearSignal may use (e.g. purchase terms, shipping, certificates, pricing, awards). Leave blank if unknown."
                  rows={2}
                  value={form.business_context.verified_facts}
                  onChange={(e) => setForm({
                    ...form,
                    business_context: { ...form.business_context, verified_facts: e.target.value },
                  })}
                />
                {form.business_context.business_model === 'unknown' &&
                  form.business_context.primary_conversion_goal === 'unknown' &&
                  !form.business_context.verified_facts.trim() && (
                    <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      Business context is empty. The audit can still run, but Ready-to-ship copy will avoid claims about credentials, pricing, timing, service availability, and proof until you add verified facts.
                    </div>
                  )}
              </div>
              <div className="flex items-center gap-3">
                <Button type="submit" disabled={previewing} className="gap-2">
                  {previewing ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Preparing preview...</>
                  ) : (
                    'Preview & confirm'
                  )}
                </Button>
                {createMsg && (
                  <span className={`text-xs ${createMsg.ok ? 'text-green-700' : 'text-red-700'} break-all`}>
                    {createMsg.text}
                  </span>
                )}
              </div>
            </form>
            )}
          </CardContent>
        </Card>

        {regenMsg && (
          <div className={`mb-4 text-sm ${regenMsg.ok ? 'text-green-700' : 'text-red-700'} break-all`}>
            {regenMsg.text}
          </div>
        )}

        {!loading && audits.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by site or email"
              className="h-9 max-w-xs"
            />
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={hideFinished}
                onChange={(e) => setHideFinished(e.target.checked)}
              />
              Hide finished ({audits.filter((a) => bandFor(a.audit_status) === 'finished').length})
            </label>
            {visibleAudits.length !== audits.length && (
              <span className="text-xs text-muted-foreground">
                {visibleAudits.length} of {audits.length} shown
              </span>
            )}
          </div>
        )}

        {loading ? (
          <div className="text-center py-20">
            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
          </div>
        ) : loadError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
            <p className="text-sm font-semibold text-red-800">{loadError}</p>
            <Button variant="outline" size="sm" className="mt-3 gap-2" onClick={loadAudits}>
              <RefreshCw className="h-4 w-4" /> Retry
            </Button>
          </div>
        ) : audits.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">No audits yet.</div>
        ) : visibleAudits.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            Nothing matches that filter.
          </div>
        ) : (
          <div className="space-y-4">
            {visibleAudits.map((audit, index) => (
              <Fragment key={audit.id}>
              {(index === 0 || bandFor(visibleAudits[index - 1].audit_status) !== bandFor(audit.audit_status)) && (
                <div className="flex items-baseline gap-2 pt-4 first:pt-0">
                  <h2 className="text-sm font-semibold">{BAND_LABEL[bandFor(audit.audit_status)]}</h2>
                  <span className="text-xs text-muted-foreground">
                    {visibleAudits.filter((item) => bandFor(item.audit_status) === bandFor(audit.audit_status)).length}
                  </span>
                </div>
              )}
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <div className="font-semibold text-sm truncate max-w-md">{audit.url}</div>
                      <div className="text-xs text-muted-foreground">{audit.email}</div>
                      <div className="text-xs text-muted-foreground">
                        Created: {new Date(audit.created_at).toLocaleString()}
                      </div>
                      {formatDate(audit.last_activity_at) && (
                        <div className="text-xs font-medium text-muted-foreground">
                          Last activity: {formatDate(audit.last_activity_at)}
                        </div>
                      )}
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {formatDate(audit.last_generated_at) && (
                          <span>Generated: {formatDate(audit.last_generated_at)}</span>
                        )}
                        {formatDate(audit.last_rerendered_at) && (
                          <span>Re-rendered: {formatDate(audit.last_rerendered_at)}</span>
                        )}
                        {formatDate(audit.last_delivered_at) && (
                          <span>Delivered: {formatDate(audit.last_delivered_at)}</span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>App: {audit.app_commit || 'not recorded'}</span>
                        <span className={audit.engine_version_drift ? 'font-semibold text-amber-700' : undefined}>
                          Engine: {audit.engine_version || 'not recorded'}
                          {audit.engine_commit ? ` (${audit.engine_commit.slice(0, 7)})` : ''}
                          {audit.engine_version_drift ? ` \u2014 expected ${audit.expected_engine_version}` : ''}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className={paymentColor[audit.payment_status] || ''}>
                        {audit.payment_status}
                      </Badge>
                      <Badge className={statusColor[audit.audit_status] || ''}>
                        {audit.audit_status}
                      </Badge>
                      <Badge variant="outline">{audit.tier}</Badge>
                      {formatCost(audit.api_cost_usd) && (
                        <Badge variant="outline" className="bg-slate-50 text-slate-800">
                          Cost {formatCost(audit.api_cost_usd)}
                        </Badge>
                      )}
                      {(audit.validation_repair_count || 0) > 0 && (
                        <Badge variant="outline" className="bg-amber-50 text-amber-800">
                          {audit.validation_repair_count} repairs
                        </Badge>
                      )}
                    </div>
                  </div>

                  {audit.ai_cost_summary && audit.ai_cost_summary.ai_call_count > 0 && (
                    <div className="mb-3 rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900">AI cost</span>
                        <Badge variant="outline">{audit.ai_cost_summary.ai_call_count} calls</Badge>
                        <Badge variant="outline">
                          {formatCost(audit.ai_cost_summary.estimated_cost_usd) || '$0.00'}
                        </Badge>
                        {audit.ai_cost_summary.recovery_attempts > 0 && (
                          <Badge variant="outline" className="bg-amber-50 text-amber-800">
                            recovery {audit.ai_cost_summary.recovery_attempts}
                          </Badge>
                        )}
                        {audit.ai_cost_summary.duplicate_stage_warning && (
                          <Badge variant="outline" className="bg-red-50 text-red-800">
                            duplicate stage
                          </Badge>
                        )}
                      </div>
                      <div className="grid gap-2 sm:grid-cols-4">
                        <div>
                          <div className="text-muted-foreground">Input tokens</div>
                          <div className="font-medium text-slate-900">{formatNumber(audit.ai_cost_summary.input_tokens)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Output tokens</div>
                          <div className="font-medium text-slate-900">{formatNumber(audit.ai_cost_summary.output_tokens)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Cache tokens</div>
                          <div className="font-medium text-slate-900">
                            {formatNumber(
                              audit.ai_cost_summary.cache_read_tokens + audit.ai_cost_summary.cache_creation_tokens
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Triggers</div>
                          <div className="font-medium text-slate-900">
                            {audit.ai_cost_summary.triggers.length ? audit.ai_cost_summary.triggers.join(', ') : 'none'}
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 text-muted-foreground">
                        Stages: {audit.ai_cost_summary.stages_executed.length
                          ? audit.ai_cost_summary.stages_executed.join(', ')
                          : 'no stage records'}
                      </div>
                    </div>
                  )}

                  {audit.engine_coverage_summary && (
                    <div className={`mb-3 rounded border p-3 text-xs ${
                      audit.engine_coverage_summary.complete
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                        : 'border-amber-300 bg-amber-50 text-amber-950'
                    }`}>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="font-semibold">
                          {audit.engine_coverage_summary.complete
                            ? 'Engine coverage complete'
                            : 'Engine coverage gap before approval'}
                        </span>
                        <Badge variant="outline" className="bg-white">
                          {audit.engine_coverage_summary.successful_combinations}/
                          {audit.engine_coverage_summary.expected_combinations} combinations succeeded
                        </Badge>
                        {audit.engine_coverage_summary.failed_or_skipped_combinations > 0 && (
                          <Badge variant="outline" className="bg-white text-amber-900">
                            {audit.engine_coverage_summary.failed_or_skipped_combinations} failed or skipped
                          </Badge>
                        )}
                      </div>
                      <div>
                        Evidence: {audit.engine_coverage_summary.engines_with_evidence.length
                          ? audit.engine_coverage_summary.engines_with_evidence.map(formatEngineName).join(', ')
                          : 'none'}
                      </div>
                      {audit.engine_coverage_summary.missing_engines.length > 0 && (
                        <div className="mt-1 font-semibold">
                          No evidence: {audit.engine_coverage_summary.missing_engines.map(formatEngineName).join(', ')}
                        </div>
                      )}
                      {audit.engine_coverage_summary.gate && <div className="mt-2 font-semibold">Coverage gate: {audit.engine_coverage_summary.gate.passed ? 'PASS' : 'FAIL'}</div>}
                      {audit.engine_coverage_summary.gate?.reasons.map((reason) => <div key={reason} className="mt-1">{reason}</div>)}
                      {audit.engine_coverage_summary.observed_at && <div className="mt-1">Observed: {formatDate(audit.engine_coverage_summary.observed_at)}{audit.engine_coverage_summary.evidence_age_days !== undefined ? ` · Evidence age: ${audit.engine_coverage_summary.evidence_age_days} days` : ''}</div>}
                      {audit.engine_coverage_summary.per_engine?.length ? <div className="mt-2 space-y-1 border-t pt-2">{audit.engine_coverage_summary.per_engine.map((engine) => <div key={engine.engine}><span className="font-medium">{formatEngineName(engine.engine)}</span>: {engine.successful_samples}/{engine.expected_samples} successful; grounded {engine.grounded_samples}; no citations {engine.no_citation_samples}; tool failures {engine.tool_failure_samples}; provider errors {engine.provider_error_samples}; timeouts {engine.timeout_samples}</div>)}</div> : null}
                      {audit.engine_coverage_summary.failed_rows?.length ? <div className="mt-2 space-y-2 border-t pt-2"><div className="font-semibold">Failed sample ledger</div>{audit.engine_coverage_summary.failed_rows.map((row, index) => <div key={`${row.engine}-${row.query}-${index}`} className="rounded border bg-white p-2"><div><span className="font-medium">{formatEngineName(row.engine)}</span> · {row.status} · attempts {row.attempts}</div><div className="mt-1">{row.query}</div>{row.status_reason && <div className="mt-1 text-muted-foreground">Reason: {row.status_reason}</div>}{row.diagnostic_answer_text && <div className="mt-1 text-muted-foreground">Diagnostic: {row.diagnostic_answer_text}</div>}</div>)}</div> : null}
                    </div>
                  )}

                  {audit.quality_summary?.critic && (
                    <div className="mb-3 rounded border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-900">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="font-semibold">Quality critic</span>
                        <Badge variant="outline" className="bg-white text-indigo-900">
                          shadow mode - not applied
                        </Badge>
                        <Badge variant="outline" className="bg-white text-indigo-900">
                          {audit.quality_summary.critic.issue_count} issues
                        </Badge>
                        {audit.quality_summary.critic.counts.critical > 0 && (
                          <Badge variant="outline" className="bg-red-50 text-red-800">
                            {audit.quality_summary.critic.counts.critical} critical
                          </Badge>
                        )}
                        {audit.quality_summary.critic.counts.high > 0 && (
                          <Badge variant="outline" className="bg-orange-50 text-orange-800">
                            {audit.quality_summary.critic.counts.high} high
                          </Badge>
                        )}
                        {audit.quality_summary.critic.counts.medium > 0 && (
                          <Badge variant="outline" className="bg-amber-50 text-amber-800">
                            {audit.quality_summary.critic.counts.medium} medium
                          </Badge>
                        )}
                        {audit.quality_summary.critic.counts.low > 0 && (
                          <Badge variant="outline" className="bg-slate-50 text-slate-800">
                            {audit.quality_summary.critic.counts.low} low
                          </Badge>
                        )}
                      </div>
                      <div className="mb-2 text-indigo-800">
                        Model: {audit.quality_summary.critic.model || 'unknown'}
                        {audit.quality_summary.critic.ranAt ? ` · Ran: ${formatDate(audit.quality_summary.critic.ranAt)}` : ''}
                        {audit.quality_summary.critic.droppedIssues > 0
                          ? ` · Dropped invalid issues: ${audit.quality_summary.critic.droppedIssues}`
                          : ''}
                      </div>
                      {audit.quality_summary.critic.issues.length > 0 && (
                        <details>
                          <summary className="cursor-pointer font-medium">Issue list</summary>
                          <div className="mt-2 space-y-2">
                            {audit.quality_summary.critic.issues.map((issue) => (
                              <div key={`${issue.id}-${issue.path}`} className="rounded border border-indigo-100 bg-white p-2">
                                <div className="flex flex-wrap gap-2 font-medium">
                                  <span>{issue.severity}</span>
                                  <span>{issue.category}</span>
                                  <span className="font-mono text-[11px]">{issue.path}</span>
                                  {issue.canAutoFix && <span>auto-fix candidate</span>}
                                </div>
                                <div className="mt-1 text-indigo-900">{issue.explanation}</div>
                                {issue.suggestedReplacement && (
                                  <div className="mt-1 text-indigo-700">Suggestion: {issue.suggestedReplacement}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  )}

                  {audit.quality_summary?.criticError && (
                    <div className="mb-3 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                      <span className="font-semibold">Quality critic failed in shadow mode:</span>{' '}
                      {audit.quality_summary.criticError.message || 'unknown error'}
                    </div>
                  )}

                  {audit.entity_diagnostics?.length ? <details className="mb-3 rounded border border-slate-200 bg-slate-50 p-3 text-xs"><summary className="cursor-pointer font-semibold">A3 entity diagnostics ({audit.entity_diagnostics.length})</summary><div className="mt-2 space-y-2">{buildAdminEntityDiagnostics(audit.entity_diagnostics).map((entity) => <div key={entity.entity_id} className="rounded border bg-white p-2"><div className="font-medium">{entity.display_name} <span className="text-muted-foreground">· {entity.role} · {entity.state}</span></div><div>{entity.kind === 'channel_or_directory' ? 'Channel/directory' : 'Competitor candidate'} · source: {entity.role_source} · occurrences: {entity.occurrences} · queries: {entity.distinct_queries} · engines: {entity.distinct_engines}</div><div>Domain corroborated: {String(entity.domain_corroborated)} · operator provided: {String(entity.operator_provided)}{entity.possible_competitor_flag !== undefined ? ` · possible competitor: ${entity.possible_competitor_flag}` : ''}{entity.composite !== undefined ? ` · composite: ${entity.composite}` : ''}</div>{entity.state_reason ? <div className="text-muted-foreground">Reason: {entity.state_reason}</div> : null}</div>)}</div></details> : null}

                  <div className="flex items-center gap-2 mb-3">
                    {['done', 'awaiting_review', 'delivery_failed', 'delivered'].includes(audit.audit_status) && (
                      <a href={audit.report_url || `/audit/${audit.id}`} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm" className="gap-1">
                          <ExternalLink className="h-3 w-3" /> View Report
                        </Button>
                      </a>
                    )}
                    {audit.has_report && (
                      <a
                        href={`/admin/audits/${audit.id}/operator`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="outline" size="sm" className="gap-1">
                          Operator appendix
                        </Button>
                      </a>
                    )}
                    {['awaiting_review', 'delivery_failed'].includes(audit.audit_status) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => approveAndSend(audit.id)}
                        disabled={approvingId === audit.id}
                      >
                        {approvingId === audit.id ? (
                          <><Loader2 className="h-3 w-3 animate-spin" /> Sending...</>
                        ) : (
                          'Approve & send'
                        )}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => regenerateAudit(audit.id, Boolean(audit.deterministic_failure))}
                      disabled={regeneratingId === audit.id}
                      className="gap-1"
                    >
                      {regeneratingId === audit.id ? (
                        <><Loader2 className="h-3 w-3 animate-spin" /> Regenerating...</>
                      ) : audit.deterministic_failure ? (
                        <><RefreshCw className="h-3 w-3" /> Override failure &amp; re-generate</>
                      ) : (
                        <><RefreshCw className="h-3 w-3" /> Re-generate</>
                      )}
                    </Button>
                    {audit.has_report && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => rerenderAudit(audit.id)}
                        disabled={rerenderingId === audit.id}
                        className="gap-1"
                      >
                        {rerenderingId === audit.id ? (
                          <><Loader2 className="h-3 w-3 animate-spin" /> Re-rendering...</>
                        ) : (
                          'Re-render'
                        )}
                      </Button>
                    )}
                    {['done', 'delivery_failed'].includes(audit.audit_status) && (
                      <Button variant="outline" size="sm" onClick={() => markDelivered(audit.id)}>
                        Mark Delivered
                      </Button>
                    )}
                  </div>

                  {['awaiting_review', 'delivery_failed'].includes(audit.audit_status) && (
                    <div className="mb-3 rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                      <div className="font-semibold text-slate-900 mb-2">Review checklist before sending</div>
                      <ul className="space-y-1 list-disc pl-4">
                        <li>Meta, FAQ, and JSON-LD describe this business, industry, and services.</li>
                        <li>Prices and scores include currency or scale and match the client's page.</li>
                        <li>Outreach has three different channels, the correct domain, and no odd instructions.</li>
                        <li>No sentence reads like an internal instruction or template.</li>
                        <li>GEO summary numbers match the stat blocks.</li>
                        <li>Suggested copy contains no unverified commitments about response times, guarantees, or availability.</li>
                      </ul>
                    </div>
                  )}

                  <div>
                    <Textarea
                      placeholder="Admin notes..."
                      defaultValue={audit.admin_notes || ''}
                      rows={2}
                      className="text-xs"
                      onBlur={(e) => saveNotes(audit.id, e.target.value)}
                    />
                  </div>
                  <div className="mt-3">
                    <label className="mb-1 block text-xs font-medium text-slate-700" htmlFor={`reviewer-note-${audit.id}`}>
                      Reviewer note (printed at the top of the client report)
                    </label>
                    <Textarea
                      id={`reviewer-note-${audit.id}`}
                      placeholder=""
                      defaultValue={audit.reviewer_note || ''}
                      rows={4}
                      className="text-xs"
                      onBlur={(e) => saveReviewerNote(audit.id, e.target.value)}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">Guide: 300{'\u2013'}600 characters (about 3{'\u2013'}4 sentences). No hard limit.</p>
                  </div>
                </CardContent>
              </Card>
              </Fragment>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
