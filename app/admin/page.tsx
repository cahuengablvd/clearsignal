'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, RefreshCw, ExternalLink, LogIn, X, Plus } from 'lucide-react'

type Audit = {
  id: string
  created_at: string
  email: string
  url: string
  payment_status: string
  audit_status: string
  tier: string
  admin_notes: string | null
  report_url?: string | null
  has_report?: boolean
  validation_repair_count?: number
  api_cost_usd?: number | string | null
  last_generated_at?: string | null
  last_rerendered_at?: string | null
  last_delivered_at?: string | null
  last_activity_at?: string | null
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
  scraped: boolean
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [audits, setAudits] = useState<Audit[]>([])
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
    const res = await fetch('/api/admin/audits')
    if (res.ok) {
      const data = await res.json()
      setAudits(data.audits)
    }
    setLoading(false)
  }

  async function regenerateAudit(auditId: string) {
    setRegeneratingId(auditId)
    setRegenMsg(null)
    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audit_id: auditId }),
      })
      const data = await res.json().catch(() => ({}))
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
                  admin_notes: audit.admin_notes
                    ? `${audit.admin_notes}\n[${now}] Queued for regeneration.`
                    : `[${now}] Queued for regeneration.`,
                }
              : audit
          )
        )
        setRegenMsg({ ok: true, text: `Audit queued for regeneration: ${auditId}` })
      } else {
        setRegenMsg({ ok: false, text: data.error || `Regeneration failed (${res.status})` })
      }
      await loadAudits()
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
    setPreviewing(true)
    setCreateMsg(null)
    try {
      const res = await fetch('/api/admin/audits/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (res.ok) {
        setPreview(data as AuditPreview)
        setEditedQueries((data as AuditPreview).queries)
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
    try {
      const res = await fetch('/api/admin/audits/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, queries: finalQueries }),
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

  async function markDelivered(auditId: string) {
    await fetch('/api/admin/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audit_id: auditId, audit_status: 'delivered' }),
    })
    await loadAudits()
  }

  async function approveAndSend(auditId: string) {
    setApprovingId(auditId)
    setRegenMsg(null)
    try {
      const res = await fetch('/api/admin/audits/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audit_id: auditId }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setRegenMsg({ ok: true, text: `Report approved and emailed: ${auditId}` })
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
    // Check if already authed
    fetch('/api/admin/audits').then(res => {
      if (res.ok) {
        setAuthed(true)
        res.json().then(data => setAudits(data.audits))
      }
    })
  }, [])

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-sm">
          <CardContent className="p-6">
            <h1 className="text-xl font-bold mb-4">Admin Login</h1>
            <form onSubmit={handleLogin} className="space-y-4">
              <Input
                type="password"
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

  function formatDate(value?: string | null): string | null {
    if (!value) return null
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return null
    return d.toLocaleString()
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
                <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div><span className="text-muted-foreground">Brand:</span> <strong>{preview.brand}</strong></div>
                  <div className="break-all"><span className="text-muted-foreground">URL:</span> {preview.url}</div>
                  <div className="sm:col-span-2"><span className="text-muted-foreground">ICP:</span> {preview.icp_description || <em className="text-muted-foreground">none</em>}</div>
                  <div className="sm:col-span-2">
                    <span className="text-muted-foreground">Business context:</span>{' '}
                    {preview.business_context ? (
                      <span>
                        {preview.business_context.business_model} / {preview.business_context.primary_conversion_goal}
                        {preview.business_context.target_markets_languages ? ` | ${preview.business_context.target_markets_languages}` : ''}
                      </span>
                    ) : (
                      <em className="text-muted-foreground">none</em>
                    )}
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-muted-foreground">Competitors:</span>{' '}
                    {preview.competitors.length ? preview.competitors.join(', ') : <em className="text-muted-foreground">none</em>}
                  </div>
                </div>
                {!preview.scraped && (
                  <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                    Could not scrape the homepage - queries are based on the brand/ICP only. Check the URL.
                  </div>
                )}
                <div>
                  <div className="text-xs font-semibold text-muted-foreground mb-2">
                    Buyer queries that will be tested ({editedQueries.length}) - edit, remove, or add before running
                  </div>
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
                  type="url"
                  placeholder="Homepage URL * (https://...)"
                  required
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                />
                <Input
                  type="url"
                  placeholder="Competitor 1 (optional)"
                  value={form.competitor_1}
                  onChange={(e) => setForm({ ...form, competitor_1: e.target.value })}
                />
                <Input
                  type="url"
                  placeholder="Competitor 2 (optional)"
                  value={form.competitor_2}
                  onChange={(e) => setForm({ ...form, competitor_2: e.target.value })}
                />
                <Input
                  type="url"
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
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.business_context.business_model}
                    onChange={(e) => setForm({
                      ...form,
                      business_context: { ...form.business_context, business_model: e.target.value },
                    })}
                  >
                    <option value="unknown">Business model unknown</option>
                    <option value="ecommerce">Ecommerce</option>
                    <option value="marketplace">Marketplace</option>
                    <option value="service_business">Service business</option>
                    <option value="portfolio">Portfolio</option>
                    <option value="gallery">Gallery</option>
                    <option value="archive">Archive</option>
                    <option value="media_content_site">Media/content site</option>
                    <option value="other">Other</option>
                  </select>
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.business_context.primary_conversion_goal}
                    onChange={(e) => setForm({
                      ...form,
                      business_context: { ...form.business_context, primary_conversion_goal: e.target.value },
                    })}
                  >
                    <option value="unknown">Goal unknown</option>
                    <option value="purchase">Purchase</option>
                    <option value="inquiry">Inquiry</option>
                    <option value="booking">Booking</option>
                    <option value="signup">Signup</option>
                    <option value="download">Download</option>
                    <option value="portfolio_viewing">Portfolio viewing</option>
                    <option value="other">Other</option>
                  </select>
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.business_context.purchase_availability}
                    onChange={(e) => setForm({
                      ...form,
                      business_context: { ...form.business_context, purchase_availability: e.target.value },
                    })}
                  >
                    <option value="unknown">Purchase availability unknown</option>
                    <option value="yes">Available for purchase</option>
                    <option value="some">Some available</option>
                    <option value="no">Not directly available</option>
                  </select>
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.business_context.ships_internationally}
                    onChange={(e) => setForm({
                      ...form,
                      business_context: { ...form.business_context, ships_internationally: e.target.value },
                    })}
                  >
                    <option value="unknown">Shipping unknown</option>
                    <option value="yes">Ships internationally</option>
                    <option value="no">No international shipping</option>
                  </select>
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm sm:col-span-2"
                    value={form.business_context.provenance_or_authentication}
                    onChange={(e) => setForm({
                      ...form,
                      business_context: { ...form.business_context, provenance_or_authentication: e.target.value },
                    })}
                  >
                    <option value="unknown">Certificates/provenance unknown</option>
                    <option value="yes">Certificates/provenance confirmed</option>
                    <option value="no">No certificates/provenance</option>
                    <option value="not_applicable">Not applicable</option>
                  </select>
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

        {loading ? (
          <div className="text-center py-20">
            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
          </div>
        ) : audits.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">No audits yet.</div>
        ) : (
          <div className="space-y-4">
            {audits.map((audit) => (
              <Card key={audit.id}>
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

                  <div className="flex items-center gap-2 mb-3">
                    {['done', 'awaiting_review', 'delivery_failed', 'delivered'].includes(audit.audit_status) && (
                      <a href={audit.report_url || `/audit/${audit.id}`} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm" className="gap-1">
                          <ExternalLink className="h-3 w-3" /> View Report
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
                      onClick={() => regenerateAudit(audit.id)}
                      disabled={regeneratingId === audit.id}
                      className="gap-1"
                    >
                      {regeneratingId === audit.id ? (
                        <><Loader2 className="h-3 w-3 animate-spin" /> Regenerating...</>
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
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
