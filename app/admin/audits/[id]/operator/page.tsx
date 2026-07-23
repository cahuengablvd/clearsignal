import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { isAdminAuthenticated } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import type { ClearSignalReport } from '@/lib/schemas'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CopyButton } from '@/components/copy-button'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function OperatorAppendixPage({ params }: { params: { id: string } }) {
  if (!isAdminAuthenticated()) notFound()

  const { data: audit, error } = await supabaseAdmin
    .from('audits')
    .select('id, url, report')
    .eq('id', params.id)
    .single()

  if (error || !audit?.report) notFound()

  const report = audit.report as ClearSignalReport
  const messages = report.action?.outreach_messages || []

  return (
    <main className="min-h-screen bg-muted/30 px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <Link href="/admin" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to admin
        </Link>
        <div className="mb-8">
          <Badge variant="secondary">Admin only</Badge>
          <h1 className="mt-3 text-3xl font-bold">Operator outreach appendix</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {report.meta.canonical_brand || report.meta.domain || audit.url}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            These materials are excluded from the client web report and PDF.
          </p>
        </div>

        <div className="space-y-4">
          {messages.map((message, index) => (
            <Card key={`${message.channel}-${index}`}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base capitalize">{message.channel}</CardTitle>
                <CopyButton text={message.message} />
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm">{message.message}</p>
                {message.note && (
                  <p className="mt-3 text-xs text-muted-foreground">{message.note}</p>
                )}
              </CardContent>
            </Card>
          ))}
          {messages.length === 0 && (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                No operator outreach messages were stored for this audit.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </main>
  )
}
