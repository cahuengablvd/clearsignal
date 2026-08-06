import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import { ReviewerNote } from '../components/reviewer-note'

const originalReviewerName = process.env.REVIEWER_NAME

afterEach(() => {
  if (originalReviewerName === undefined) delete process.env.REVIEWER_NAME
  else process.env.REVIEWER_NAME = originalReviewerName
})

describe('reviewer note', () => {
  it('renders above the executive summary with the named reviewer and escaped text', () => {
    process.env.REVIEWER_NAME = 'Alex <Reviewer>'
    const markup = renderToStaticMarkup(<ReviewerNote note={'I read this report.\n<script>never run</script>'} />)

    expect(markup).toContain('Reviewed by Alex &lt;Reviewer&gt; \u2014 read the full report before delivery.')
    expect(markup).toContain('I read this report.')
    expect(markup).toContain('&lt;script&gt;never run&lt;/script&gt;')
  })

  it('renders nothing for an empty note, preserving the existing report output', () => {
    expect(renderToStaticMarkup(<ReviewerNote note={null} />)).toBe('')
    expect(renderToStaticMarkup(<ReviewerNote note="   " />)).toBe('')
  })

  it('never renders admin_notes in the client report or its PDF projection', () => {
    const reportPage = readFileSync(resolve(process.cwd(), 'app/audit/[id]/page.tsx'), 'utf8')
    const pdf = readFileSync(resolve(process.cwd(), 'lib/pdf.ts'), 'utf8')

    expect(reportPage).not.toContain('audit.admin_notes')
    expect(pdf).toContain('/audit/${auditId}?pdf=true&token=${token}')
  })
})
