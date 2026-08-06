import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function ReviewerNote({ note }: { note?: string | null }) {
  const text = note?.trim()
  if (!text) return null

  const reviewerName = process.env.REVIEWER_NAME?.trim() || 'ClearSignal reviewer'

  return (
    <Card className="mb-8 border-[#E9A96B]/60 bg-[#FFF8F0]">
      <CardHeader>
        <CardTitle className="text-lg">Reviewed by {reviewerName} {'\u2014'} read the full report before delivery.</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="whitespace-pre-wrap leading-relaxed">{text}</p>
      </CardContent>
    </Card>
  )
}
