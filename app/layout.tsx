import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL('https://getclearsignal.io'),
  title: 'ClearSignal - Expert-reviewed AI Visibility Audit',
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
