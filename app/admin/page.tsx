'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, RefreshCw, ExternalLink, LogIn } from 'lucide-react'

type Audit = {
  id: string
  created_at: string
  email: string
  url: string
  payment_status: string
  audit_status: string
  tier: string
  admin_notes: string | null
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [audits, setAudits] = useState<Audit[]>([])
  const [loading, setLoading] = useState(false)
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null)

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
                      <a href={`/audit/${audit.id}`} target="_blank" rel="noopener noreferrer">
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
