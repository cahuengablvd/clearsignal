import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AUDIT_PRODUCT_LABEL } from '@/lib/audit-label'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL('https://getclearsignal.io'),
  title: `ClearSignal - ${AUDIT_PRODUCT_LABEL}`,
  description: 'ClearSignal tests real buyer questions across ChatGPT, Claude and Perplexity, shows which brands appear in the tested answers, and compares cited sources with website evidence. Every full report is reviewed by a person.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
