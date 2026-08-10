import type { Metadata } from 'next'

export const metadata: Metadata = {
  alternates: { canonical: '/score' },
}

export default function ScoreLayout({ children }: { children: React.ReactNode }) {
  return children
}
