'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  canManageFeedingSetup,
  getFarmAccess,
  type FarmRole,
} from '@/lib/farm-access'

export default function MobileFeedingHub() {
  const [role, setRole] = useState<FarmRole | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getFarmAccess().then((a) => {
      setRole(a.role)
      setLoading(false)
    })
  }, [])

  const advanced = canManageFeedingSetup(role)

  const card =
    'block min-h-[72px] rounded-2xl border-2 border-slate-500 bg-white p-5 active:bg-slate-100'
  const cardTitle = 'text-lg font-bold text-slate-900'
  const cardSub = 'mt-1 text-base font-semibold text-slate-700'

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-base font-bold text-slate-800">
        Loading…
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-200">
      <header className="border-b-4 border-slate-600 bg-white px-4 py-4">
        <p className="text-sm font-bold uppercase tracking-wide text-brand-800">
          Farm Manager
        </p>
        <h1 className="text-2xl font-bold text-slate-900">Feeding</h1>
        <p className="mt-1 text-base font-semibold capitalize text-slate-800">
          {role ? role + ' access' : '—'}
        </p>
      </header>

      <main className="space-y-4 px-4 py-5">
        <Link
          href="/m/feeding/run"
          className="block min-h-[88px] rounded-2xl border-4 border-brand-900 bg-brand-700 p-5 text-white active:bg-brand-800"
        >
          <h2 className="text-xl font-bold">Start feeding run</h2>
          <p className="mt-1 text-base font-semibold text-brand-50">
            Buffer → fill → pens → summary
          </p>
        </Link>

        {advanced ? (
          <>
            <p className="pt-1 text-base font-bold text-slate-900">Setup and reports</p>

            {[
              {
                href: '/feeding/pen-dashboard',
                title: 'Pen dashboard',
                sub: 'Multi-pen costs and P&L',
              },
              {
                href: '/feeding/history',
                title: 'Completed loads',
                sub: 'History and delete',
              },
              {
                href: '/feeding/stock',
                title: 'Stock',
                sub: 'On hand and days left',
              },
              {
                href: '/feeding/diets',
                title: 'Diets',
                sub: 'Ingredients and premixes',
              },
              {
                href: '/feeding/programs',
                title: 'Programmes',
                sub: 'Phases and transitions',
              },
              {
                href: '/feeding/loads',
                title: 'Loads',
                sub: 'Pens in feed-out order',
              },
              {
                href: '/m/feeding/team',
                title: 'Team access',
                sub: 'Basic vs advanced',
              },
            ].map((item) => (
              <Link key={item.href} href={item.href} className={card}>
                <div className={cardTitle}>{item.title}</div>
                <div className={cardSub}>{item.sub}</div>
              </Link>
            ))}
          </>
        ) : (
          <p className="rounded-xl border-2 border-slate-500 bg-white p-4 text-base font-semibold text-slate-900">
            Basic access: feeding run only. An owner can upgrade you under Team
            access.
          </p>
        )}
      </main>
    </div>
  )
}