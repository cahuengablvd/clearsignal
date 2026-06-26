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
}

const emptyForm = {
  email: '',
  url: '',
  competitor_1: '',
  competitor_2: '',
  competitor_3: '',
  icp_description: '',
}

type AuditPreview = {
  brand: string
  url: string
  icp_description: string
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
  const [form, setForm] = useState(emptyForm)
  const [creating, setCreating] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [preview, setPreview] = useState<AuditPreview | null>(null)
  const [editedQueries, setEditedQueries] = useState<string[]>([])
  const [createMsg, setCreateMsg] = useState<{ ok: boolean; text: string } | null>(null)

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
    try {
      await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audit_id: auditId }),
      })
      await loadAudits()
    } catch (err) {
      console.error('Regeneration failed:', err)
    }
    setRegeneratingId(null)
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
    delivered: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
  }

  const paymentColor: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    paid: 'bg-green-100 text-green-800',
    refunded: 'bg-red-100 text-red-800',
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
                        {new Date(audit.created_at).toLocaleString()}
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
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    {['done', 'delivered'].includes(audit.audit_status) && (
                      <a href={audit.report_url || `/audit/${audit.id}`} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm" className="gap-1">
                          <ExternalLink className="h-3 w-3" /> View Report
                        </Button>
                      </a>
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
                    {audit.audit_status === 'done' && (
                      <Button variant="outline" size="sm" onClick={() => markDelivered(audit.id)}>
                        Mark Delivered
                      </Button>
                    )}
                  </div>

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
