'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getFarmAccess, isYardStaff, type FarmRole } from '@/lib/farm-access'
import { isPhoneDevice } from '@/lib/device'

const tile =
  'flex min-h-[100px] flex-col justify-center rounded-2xl border-4 p-5 text-left'

export default function MobileHomePage() {
  const router = useRouter()
  const [role, setRole] = useState<FarmRole | null>(null)
  const [farmName, setFarmName] = useState('Farm Manager')
  const [email, setEmail] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    getFarmAccess().then(async (a) => {
      setRole(a.role)
      setEmail(a.email)
      const stay =
        typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('stay') === '1'
      if (a.role && !isYardStaff(a.role) && !isPhoneDevice() && !stay) {
        router.replace('/home')
        return
      }
      if (a.farmId) {
        const supabase = createClient()
        const { data } = await supabase.from('farms').select('name').eq('id', a.farmId).maybeSingle()
        if (data?.name) setFarmName(data.name)
      }
      setReady(true)
    })
  }, [router])

  const yard = isYardStaff(role)

  if (!ready) {
    return <p className="p-10 text-center text-lg font-bold text-slate-800">Loading…</p>
  }

  return (
    <div className="min-h-screen bg-slate-200">
      <header className="border-b-4 border-brand-800 bg-brand-800 px-5 pb-6 pt-6 text-white">
        <p className="text-sm font-bold uppercase tracking-wide text-brand-100">Farm Manager</p>
        <h1 className="mt-1 text-3xl font-bold">{farmName}</h1>
        <p className="mt-2 text-base font-semibold capitalize text-brand-50">
          {role ? (yard ? 'Yard access' : role + ' access') : '…'}
        </p>
        {email && <p className="mt-1 break-all text-xs font-semibold text-brand-100">{email}</p>}
      </header>
      <main className="grid grid-cols-1 gap-3 p-4">
        <Link href="/m/feeding/run" className={tile + ' border-brand-900 bg-brand-700 text-white'}>
          <span className="text-2xl font-bold">Feeding run</span>
          <span className="mt-1 font-semibold text-brand-50">Start today’s load</span>
        </Link>
        <Link href="/feeding/premix-run" className={tile + ' border-amber-800 bg-amber-600 text-white'}>
          <span className="text-2xl font-bold">Premix</span>
          <span className="mt-1 font-semibold text-amber-50">Mix a batch into the bay</span>
        </Link>
        {!yard && (
          <>
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
      </main>
    </div>
  )
}
