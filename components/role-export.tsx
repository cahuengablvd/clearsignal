'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Copy, Check, PenLine, Search, Code2, Megaphone } from 'lucide-react'

export type RoleFix = { title: string; description: string; category: string }

// Map each fix category to the person who owns it.
const ROLE_BY_CATEGORY: Record<string, string> = {
  copy: 'Copywriter',
  cta: 'Copywriter',
  ai_search: 'SEO',
  structure: 'SEO',
  proof: 'Founder / marketing',
}

function inferRole(fix: RoleFix): string {
  const text = `${fix.title} ${fix.description}`.toLowerCase()

  if (/\b(svg|logo render|broken logo|image|html|css|json-ld|schema|structured data|script|developer|technical|rendered html)\b/.test(text)) {
    return 'Developer'
  }
  if (/\b(use case|web3|service page|comparison|alternatives|faq|keyword|directory|citation|ai visibility|source|indexable|meta title|meta description)\b/.test(text)) {
    return 'SEO'
  }
  if (/\b(headline|copy|message|messaging|positioning|cta|call-to-action|hero|rewrite)\b/.test(text)) {
    return 'Copywriter'
  }
  if (/\b(testimonial|review|customer|case study|proof|g2|capterra|clutch|designrush|partner|roundup)\b/.test(text)) {
    return 'Founder / marketing'
  }

  return ROLE_BY_CATEGORY[fix.category] || 'Founder / marketing'
}

const ROLES: { name: string; icon: typeof PenLine }[] = [
  { name: 'Copywriter', icon: PenLine },
  { name: 'SEO', icon: Search },
  { name: 'Developer', icon: Code2 },
  { name: 'Founder / marketing', icon: Megaphone },
]

export function RoleExport({ fixes, label }: { fixes: RoleFix[]; label?: string }) {
  const [copied, setCopied] = useState<string | null>(null)

  const groups = ROLES.map((r) => ({
    ...r,
    items: fixes.filter((f) => inferRole(f) === r.name),
  })).filter((g) => g.items.length > 0)

  async function copyRole(role: string, items: RoleFix[]) {
    const header = `${role} tasks${label ? ` - ${label}` : ''}`
    const body = items.map((f) => `[ ] ${f.title}\n    ${f.description}`).join('\n\n')
    try {
      await navigator.clipboard.writeText(`${header}\n\n${body}`)
      setCopied(role)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      /* clipboard blocked - ignore */
    }
  }

  if (groups.length === 0) return null

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {groups.map((g) => {
        const Icon = g.icon
        return (
          <Card key={g.name}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  <h3 className="font-semibold text-sm">{g.name}</h3>
                  <span className="text-xs text-muted-foreground">({g.items.length})</span>
                </div>
                <Button variant="outline" size="sm" className="gap-1" onClick={() => copyRole(g.name, g.items)}>
                  {copied === g.name ? (
                    <><Check className="h-3 w-3" /> Copied</>
                  ) : (
                    <><Copy className="h-3 w-3" /> Copy tasks</>
                  )}
                </Button>
              </div>
              <ul className="space-y-1 text-sm">
                {g.items.map((f, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-muted-foreground">-</span>
                    <span>{f.title}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
