import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AUDIT_PRODUCT_LABEL } from '@/lib/audit-label'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL('https://getclearsignal.io'),
  title: `ClearSignal - ${AUDIT_PRODUCT_LABEL}`,
  description: 'ClearSignal tests the buyer questions that matter across ChatGPT, Claude and Perplexity, shows who appears instead of you, and delivers an expert-reviewed plan to improve your visibility.',
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
