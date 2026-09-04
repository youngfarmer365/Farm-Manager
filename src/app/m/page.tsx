'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getFarmAccess, isYardStaff, type FarmRole } from '@/lib/farm-access'
import { LogoutButton } from '@/components/layout/LogoutButton'

const tile =
  'flex min-h-[100px] flex-col justify-center rounded-2xl border-4 p-5 text-left'

export default function MobileHomePage() {
  const [role, setRole] = useState<FarmRole | null>(null)
  const [farmName, setFarmName] = useState('Farm Manager')
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    getFarmAccess().then(async (a) => {
      setRole(a.role)
      setEmail(a.email)
      if (!a.farmId) return
      const supabase = createClient()
      const { data } = await supabase.from('farms').select('name').eq('id', a.farmId).maybeSingle()
      if (data?.name) setFarmName(data.name)
    })
  }, [])

  const yard = isYardStaff(role)

  return (
    <div className="min-h-screen bg-slate-200">
      <header className="border-b-4 border-brand-800 bg-brand-800 px-5 pb-6 pt-6 text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-brand-100">Farm Manager</p>
            <h1 className="mt-1 text-3xl font-bold">{farmName}</h1>
            <p className="mt-2 text-base font-semibold capitalize text-brand-50">
              {role ? (yard ? 'Yard access' : role + ' access') : '…'}
            </p>
            {email && <p className="mt-1 break-all text-xs font-semibold text-brand-100">{email}</p>}
          </div>
          <LogoutButton className="rounded-xl border-2 border-white bg-white px-3 py-2 text-sm font-bold text-brand-900" />
        </div>
      </header>
      <main className="grid grid-cols-1 gap-3 p-4">
        <Link href="/m/feeding/run" className={tile + ' border-brand-900 bg-brand-700 text-white'}>
          <span className="text-2xl font-bold">Feeding run</span>
          <span className="mt-1 font-semibold text-brand-50">Start today’s load</span>
        </Link>
        <Link href="/m/stock" className={tile + ' border-slate-600 bg-white'}>
          <span className="text-2xl font-bold">Stock check</span>
          <span className="mt-1 font-semibold text-slate-700">Head count by pen and field</span>
        </Link>

        {!yard && (
          <>
            <Link href="/fields" className={tile + ' border-slate-600 bg-white'}>
              <span className="text-2xl font-bold">Fields</span>
              <span className="mt-1 font-semibold text-slate-700">Map, soil, grass, crops</span>
            </Link>
            <Link href="/jobs" className={tile + ' border-slate-600 bg-white'}>
              <span className="text-2xl font-bold">Jobs</span>
              <span className="mt-1 font-semibold text-slate-700">Pending and completed</span>
            </Link>
            <Link href="/m/animals" className={tile + ' border-slate-600 bg-white'}>
              <span className="text-2xl font-bold">Animals</span>
              <span className="mt-1 font-semibold text-slate-700">List, search, weights</span>
            </Link>
            <Link href="/m/intake" className={tile + ' border-brand-900 bg-white'}>
              <span className="text-2xl font-bold">EID intake</span>
              <span className="mt-1 font-semibold text-slate-700">Scan tags into the farm</span>
            </Link>
            <Link href="/m/feeding" className={tile + ' border-slate-600 bg-white'}>
              <span className="text-2xl font-bold">Feeding setup</span>
              <span className="mt-1 font-semibold text-slate-700">Diets, loads, team</span>
            </Link>
          </>
        )}

        <Link href="/m/account" className={tile + ' border-red-800 bg-white'}>
          <span className="text-2xl font-bold">Account / log out</span>
          <span className="mt-1 font-semibold text-slate-700">Switch back to owner login</span>
        </Link>
      </main>
    </div>
  )
}
