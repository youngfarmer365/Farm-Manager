import type { Metadata, Viewport } from 'next'
import './globals.css'
import { AppGate } from '@/components/access/AppGate'
import { BackBar } from '@/components/layout/BackBar'

export const metadata: Metadata = {
  title: {
    default: 'Farm Manager',
    template: '%s · Farm Manager',
  },
  description: 'Livestock and farm operations — animals, feeding, intake and performance',
  applicationName: 'Farm Manager',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Farm Manager',
    statusBarStyle: 'black-translucent',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#166534',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en-IE">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <AppGate>
          <BackBar />
          {children}
        </AppGate>
      </body>
    </html>
  )
}
