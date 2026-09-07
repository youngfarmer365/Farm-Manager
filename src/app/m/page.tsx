'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getFarmAccess, isYardStaff, type FarmRole } from '@/lib/farm-access'
import { isPhoneDevice } from '@/lib/device'
import { programmeClockDay } from '@/lib/feeding'
import { applyMobilePrefs } from '@/lib/mobile-prefs'
import { readRunDraft } from '@/lib/run-draft'

const tile = 'flex min-h-[88px] items-center rounded-2xl border-4 px-5 text-left'

export default function MobileHomePage() {
  const router = useRouter()
  const [role, setRole] = useState<FarmRole | null>(null)
  const [farmName, setFarmName] = useState('Farm Manager')
  const [ready, setReady] = useState(false)
  const [today, setToday] = useState({
    load: '',
    day: '',
    premixKg: '',
    flagged: 0,
    withdrawal: 0,
    draft: '',
  })

  useEffect(() => {
    applyMobilePrefs()
    getFarmAccess().then(async (a) => {
      setRole(a.role)
      const stay =
        typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('stay') === '1'
      if (a.role && !isYardStaff(a.role) && !isPhoneDevice() && !stay) {
        router.replace('/home')
        return
      }
      const supabase = createClient()
      if (a.farmId) {
        const { data } = await supabase.from('farms').select('name').eq('id', a.farmId).maybeSingle()
        if (data?.name) setFarmName(data.name)

        const [{ data: loads }, { data: programs }, { data: ings }, { data: stock }, { data: animals }] =
          await Promise.all([
            supabase.from('feed_loads').select('id, name, program_id').eq('farm_id', a.farmId).order('created_at', { ascending: false }).limit(8),
            supabase.from('feeding_programs').select('id, name, start_date, pause_days, paused_on, status').eq('farm_id', a.farmId),
            supabase.from('ingredients').select('id, name, premix_diet_id').eq('farm_id', a.farmId).eq('is_active', true),
            supabase.from('feed_stock').select('ingredient_id, quantity_kg').eq('farm_id', a.farmId),
            supabase.from('animals').select('id, is_flagged').eq('farm_id', a.farmId).eq('status', 'active').limit(500),
          ])
        const load = (loads || [])[0]
        const prog = load?.program_id ? (programs || []).find((p) => p.id === load.program_id) : null
        const day = prog
          ? programmeClockDay({
              start_date: prog.start_date || new Date().toISOString().slice(0, 10),
              pause_days: (prog as any).pause_days,
              paused_on: (prog as any).paused_on,
            })
          : ''
        const premixIds = (ings || []).filter((i) => i.premix_diet_id).map((i) => i.id)
        const premixKg = (stock || [])
          .filter((s) => premixIds.includes(s.ingredient_id))
          .reduce((n, s) => n + Number(s.quantity_kg || 0), 0)
        const flagged = (animals || []).filter((x) => x.is_flagged).length
        let withdrawal = 0
        const ids = (animals || []).map((x) => x.id)
        if (ids.length) {
          const { data: txs } = await supabase
            .from('treatments')
            .select('animal_id, treated_at, withdrawal_days')
            .in('animal_id', ids.slice(0, 400))
          const todayD = new Date()
          const seen = new Set<string>()
          for (const t of txs || []) {
            if (!t.withdrawal_days || !t.treated_at) continue
            const end = new Date(t.treated_at)
            end.setDate(end.getDate() + Number(t.withdrawal_days))
            if (end > todayD) seen.add(t.animal_id)
          }
          withdrawal = seen.size
        }
        const draft = readRunDraft()
        setToday({
          load: load ? load.name + (prog ? ' · ' + prog.name : '') : '',
          day: prog ? ((prog as any).paused_on || prog.status === 'paused' ? 'paused' : 'day ' + day) : '',
          premixKg: premixKg ? Math.round(premixKg) + ' kg in bay' : '',
          flagged,
          withdrawal,
          draft: draft ? 'Unfinished run saved on phone' : '',
        })
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
      <header className="border-b-4 border-brand-800 bg-brand-800 px-5 pb-5 pt-6 text-white phone-header">
        <p className="text-sm font-bold uppercase tracking-wide text-brand-100">Farm Manager</p>
        <h1 className="mt-1 text-3xl font-bold">{farmName}</h1>
        <p className="mt-2 text-base font-semibold capitalize text-brand-50">
          {role ? (yard ? 'Yard access' : role + ' access') : ''}
        </p>
      </header>
      <main className="grid grid-cols-1 gap-3 p-4">
        <div className="rounded-2xl border-4 border-slate-700 bg-white p-4">
          <p className="text-xs font-bold uppercase text-slate-500">Today</p>
          <p className="mt-1 text-base font-bold text-slate-900">{today.load || 'No load set'}</p>
          {today.day && <p className="text-sm font-semibold text-slate-600">{today.day}</p>}
          {today.premixKg && <p className="text-sm font-semibold text-slate-600">{today.premixKg}</p>}
          <p className="mt-1 text-sm font-semibold text-slate-700">
            {today.flagged} flagged · {today.withdrawal} in withdrawal
          </p>
          {today.draft && <p className="mt-1 text-sm font-bold text-amber-800">{today.draft}</p>}
        </div>

        <Link href="/m/feeding/run" className={tile + ' border-brand-900 bg-brand-700 text-white'}>
          <span className="text-2xl font-bold">Feeding run</span>
        </Link>
        <Link href="/m/feeding/premix" className={tile + ' border-amber-800 bg-amber-600 text-white'}>
          <span className="text-2xl font-bold">Premix</span>
        </Link>
        {!yard && (
          <>
            <Link href="/m/animals" className={tile + ' border-slate-600 bg-white'}>
              <span className="text-2xl font-bold">Animals</span>
            </Link>
            <Link href="/m/intake" className={tile + ' border-slate-600 bg-white'}>
              <span className="text-2xl font-bold">EID intake</span>
            </Link>
            <Link href="/m/feeding" className={tile + ' border-slate-600 bg-white'}>
              <span className="text-2xl font-bold">Feeding setup</span>
            </Link>
          </>
        )}
        <Link href="/m/account" className="px-2 py-2 text-center text-sm font-bold text-slate-600 underline">
          Account
        </Link>
      </main>
    </div>
  )
}
