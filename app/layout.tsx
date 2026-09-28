import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Fraunces, Instrument_Sans } from 'next/font/google'
import './globals.css'
import { WorkspaceShell } from '@/components/workspace-shell'
import { ThemeProvider } from '@/components/theme-provider'

const body = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
})

const displayFallback = Fraunces({
  subsets: ['latin'],
  variable: '--font-display-fallback',
  style: ['normal', 'italic'],
  axes: ['opsz', 'SOFT', 'WONK'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'OwnMind AI — Sovereign Second Brain for Project Teams',
  description:
    'A local-first, privacy-preserving project intelligence workspace. Your knowledge, decisions and actions stay under your control.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#E7ECDD' },
    { media: '(prefers-color-scheme: dark)', color: '#1F1F1F' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${body.variable} ${displayFallback.variable}`}>
      <body className="antialiased">
        <ThemeProvider>
          <WorkspaceShell>{children}</WorkspaceShell>
        </ThemeProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
