import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AUDIT_PRODUCT_LABEL } from '@/lib/audit-label'
import { SITE_DESCRIPTION } from '@/lib/site-description'

const inter = Inter({ subsets: ['latin'] })
// Public description names ChatGPT, Claude and Perplexity; it is shared with the landing schema.

export const metadata: Metadata = {
  metadataBase: new URL('https://getclearsignal.io'),
  title: `ClearSignal - ${AUDIT_PRODUCT_LABEL}`,
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: '/',
  },
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
