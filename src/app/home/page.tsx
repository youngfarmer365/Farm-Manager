'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { canInviteStaff, getFarmAccess, homePathForRole, isYardStaff } from '@/lib/farm-access'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { LogoutButton } from '@/components/layout/LogoutButton'

const tile =
  'flex min-h-[140px] flex-col justify-center rounded-2xl border-4 p-6 text-left active:opacity-90'

export default function HomeHubPage() {
  const router = useRouter()
  const [farmName, setFarmName] = useState('Farm Manager')
  const [ready, setReady] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [email, setEmail] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    async function boot() {
      const a = await getFarmAccess()
      if (!a.userId) {
        router.push('/auth/login')
        return
      }
      if (!a.farmId) {
        router.push('/onboarding')
        return
      }
      if (isYardStaff(a.role)) {
        router.replace(homePathForRole(a.role))
        return
      }
      const supabase = createClient()
      const { data } = await supabase.from('farms').select('name').eq('id', a.farmId).maybeSingle()
      if (data?.name) setFarmName(data.name)
      setShowInvite(canInviteStaff(a.role))
      setEmail(a.email)
      setRole(a.role)
      setReady(true)
    }
    boot()
  }, [router])

  if (!ready) {
    return <p className="p-10 text-center text-lg font-bold text-slate-800">Loading…</p>
  }

  return (
    <div className="min-h-screen bg-slate-200">
      <header className="border-b-4 border-brand-900 bg-brand-800 px-5 py-8 text-white">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-brand-100">Farm Manager</p>
            <h1 className="mt-1 text-3xl font-bold">{farmName}</h1>
            <p className="mt-2 text-base font-semibold capitalize text-brand-50">
              {role} · {email}
            </p>
          </div>
          <LogoutButton className="rounded-xl border-2 border-white bg-white px-4 py-2 text-sm font-bold text-brand-900" />
        </div>
      </header>
      <main className="mx-auto grid max-w-4xl grid-cols-1 gap-4 p-4 sm:grid-cols-2">
        <Link href="/m" className={tile + ' border-brand-900 bg-brand-700 text-white sm:col-span-2'}>
          <span className="text-2xl font-bold">Phone app</span>
          <span className="mt-2 text-base font-semibold text-brand-50">
            Yard view — add to Home Screen
          </span>
        </Link>
        <Link href="/animals" className={tile + ' border-slate-700 bg-white text-slate-900'}>
          <span className="text-2xl font-bold">Animals</span>
          <span className="mt-2 text-base font-semibold text-slate-700">
            List, weights, sales, medicines, intake
          </span>
        </Link>
        <Link href="/fields" className={tile + ' border-slate-700 bg-white text-slate-900'}>
          <span className="text-2xl font-bold">Fields</span>
          <span className="mt-2 text-base font-semibold text-slate-700">
            Map, soil samples, grass, crop history and planning
          </span>
        </Link>
        <Link href="/jobs" className={tile + ' border-slate-700 bg-white text-slate-900'}>
          <span className="text-2xl font-bold">Jobs</span>
          <span className="mt-2 text-base font-semibold text-slate-700">
            Multi-field jobs, pending until marked complete
          </span>
        </Link>
        <Link href="/feeding" className={tile + ' border-slate-700 bg-white text-slate-900'}>
          <span className="text-2xl font-bold">Feeding</span>
          <span className="mt-2 text-base font-semibold text-slate-700">
            Diets, loads, run, stock
          </span>
        </Link>
        {showInvite && (
          <Link
            href="/m/feeding/team"
            className={tile + ' border-slate-700 bg-white text-slate-900 sm:col-span-2'}
          >
            <span className="text-2xl font-bold">Access levels</span>
            <span className="mt-2 text-base font-semibold text-slate-700">
              Invite yard staff — feeding + stock check only
            </span>
          </Link>
        )}
      </main>
    </div>
  )
}
