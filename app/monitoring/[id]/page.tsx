import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyToken } from '@/lib/tokens'
import { isAdminAuthenticated } from '@/lib/auth'
import { ArrowLeft } from 'lucide-react'
import { MonitoringDashboard, type MonitoringView } from '@/components/monitoring-dashboard'
import type { MonitoringAlert, MonitoringDelta, GeoEvidence } from '@/lib/schemas'

export const dynamic = 'force-dynamic'

function fmtDate(d: string): string {
  const dt = new Date(d)
  return `${dt.getMonth() + 1}/${dt.getDate()}`
}

export default async function MonitoringPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { token?: string }
}) {
  const hasAccess = verifyToken('monitor', params.id, searchParams.token) || isAdminAuthenticated()
  if (!hasAccess) notFound()

  const { data: site, error } = await supabaseAdmin
    .from('monitored_sites')
    .select('*')
    .eq('id', params.id)
    .single()
  if (error || !site) notFound()

  const { data: runs } = await supabaseAdmin
    .from('monitoring_runs')
    .select('*')
    .eq('site_id', params.id)
    .eq('run_status', 'done')
    .order('created_at', { ascending: false })
    .limit(8)

  const latest = runs?.[0]
  const history = [...(runs || [])]
    .reverse()
    .map((r) => ({ date: fmtDate(r.created_at), score: r.ai_visibility_score ?? 0 }))

  const view: MonitoringView = {
    url: site.url,
    brand: site.brand || site.url,
    status: site.status,
    cadence: site.cadence,
    lastRunAt: site.last_run_at,
    current: latest
      ? {
          ai_visibility_score: latest.ai_visibility_score ?? 0,
          mention_rate: Number(latest.mention_rate ?? 0),
          share_of_voice: Number(latest.share_of_voice ?? 0),
          citation_rate: Number(latest.citation_rate ?? 0),
        }
      : null,
    delta: (latest?.delta_vs_previous as MonitoringDelta | null) ?? null,
    alerts: (latest?.alerts as MonitoringAlert[] | null) ?? [],
    history,
    competitorVisibility: (latest?.competitor_visibility as { name: string; mention_rate: number }[] | null) ?? [],
    citedDomains: (latest?.cited_domains as { domain: string; count: number }[] | null) ?? [],
    evidence: (latest?.evidence as GeoEvidence[] | null) ?? [],
  }

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <nav className="border-b bg-white">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/" className="text-slate-500 hover:text-slate-950">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <Link href="/" className="text-xl font-bold tracking-tight">ClearSignal</Link>
        </div>
      </nav>
      <MonitoringDashboard view={view} />
    </div>
  )
}
