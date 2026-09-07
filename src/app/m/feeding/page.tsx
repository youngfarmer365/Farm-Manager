'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { canManageFeedingSetup, getFarmAccess, type FarmRole } from '@/lib/farm-access'

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
  const card = 'block min-h-[64px] rounded-2xl border-2 border-slate-500 bg-white p-4 active:bg-slate-100'

  if (loading) {
    return <div className="flex min-h-[50vh] items-center justify-center text-base font-bold">Loading…</div>
  }

  return (
    <div className="min-h-screen bg-slate-200">
      <header className="border-b-4 border-slate-600 bg-white px-4 py-4 phone-header">
        <h1 className="text-2xl font-bold">Feeding setup</h1>
      </header>
      <main className="space-y-4 px-4 py-5">
        <Link href="/m/feeding/run" className="block min-h-[72px] rounded-2xl border-4 border-brand-900 bg-brand-700 p-4 text-xl font-bold text-white">
          Feeding run
        </Link>
        <Link href="/m/feeding/premix" className="block min-h-[72px] rounded-2xl border-4 border-amber-800 bg-amber-600 p-4 text-xl font-bold text-white">
          Premix
        </Link>

        {advanced ? (
          <>
            <p className="pt-2 text-sm font-bold uppercase text-slate-600">Recipes</p>
            {[
              { href: '/feeding/ingredients', title: 'Ingredients' },
              { href: '/feeding/premixes', title: 'Premix recipes' },
              { href: '/feeding/diets', title: 'Diets' },
              { href: '/feeding/prices', title: 'Price history' },
            ].map((item) => (
              <Link key={item.href} href={item.href} className={card}>
                <div className="text-lg font-bold">{item.title}</div>
              </Link>
            ))}
            <p className="pt-2 text-sm font-bold uppercase text-slate-600">Loads</p>
            {[
              { href: '/feeding/programs', title: 'Programmes' },
              { href: '/feeding/loads', title: 'Loads' },
              { href: '/feeding/history', title: 'Completed loads' },
              { href: '/feeding/pen-dashboard', title: 'Pen dashboard' },
              { href: '/feeding/stock', title: 'Feed stock' },
              { href: '/m/feeding/team', title: 'Team access' },
            ].map((item) => (
              <Link key={item.href} href={item.href} className={card}>
                <div className="text-lg font-bold">{item.title}</div>
              </Link>
            ))}
          </>
        ) : (
          <p className="rounded-xl border-2 bg-white p-4 font-semibold">Basic access: run and premix only.</p>
        )}
      </main>
    </div>
  )
}
