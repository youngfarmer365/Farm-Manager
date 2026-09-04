'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { getFarmAccess, isYardStaff } from '@/lib/farm-access'

const fullTabs = [
  { href: '/m', label: 'Home', match: (p: string) => p === '/m' },
  { href: '/fields', label: 'Fields', match: (p: string) => p.startsWith('/fields') },
  { href: '/jobs', label: 'Jobs', match: (p: string) => p.startsWith('/jobs') },
  { href: '/m/account', label: 'Account', match: (p: string) => p.startsWith('/m/account') },
]

const yardTabs = [
  { href: '/m', label: 'Home', match: (p: string) => p === '/m' },
  { href: '/m/feeding/run', label: 'Feed', match: (p: string) => p.startsWith('/m/feeding') },
  { href: '/m/stock', label: 'Stock', match: (p: string) => p.startsWith('/m/stock') },
  { href: '/m/account', label: 'Account', match: (p: string) => p.startsWith('/m/account') },
]

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/m'
  const [yard, setYard] = useState(false)

  useEffect(() => {
    getFarmAccess().then((a) => setYard(isYardStaff(a.role)))
  }, [])

  const hideNav = pathname.startsWith('/m/feeding/run')
  const tabs = yard ? yardTabs : fullTabs

  return (
    <div className="min-h-screen bg-slate-300 text-slate-900 antialiased">
      <div className="mx-auto min-h-screen max-w-lg bg-slate-200 sm:border-x-2 sm:border-slate-400">
        <div className={hideNav ? 'pb-0' : 'pb-32'}>{children}</div>
        {!hideNav && (
          <nav
            className="fixed bottom-0 left-0 right-0 z-50 border-t-4 border-slate-700 bg-slate-900 phone-footer"
          >
            <div className="mx-auto flex max-w-lg items-stretch justify-around px-1 pt-2">
              {tabs.map((t) => {
                const active = t.match(pathname)
                return (
                  <Link
                    key={t.href}
                    href={t.href}
                    className={`flex min-h-[56px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-sm font-bold ${
                      active ? 'bg-brand-700 text-white' : 'text-slate-200 active:bg-slate-800'
                    }`}
                  >
                    <span className={`h-1.5 w-10 rounded-full ${active ? 'bg-white' : 'bg-transparent'}`} />
                    {t.label}
                  </Link>
                )
              })}
            </div>
          </nav>
        )}
      </div>
    </div>
  )
}
