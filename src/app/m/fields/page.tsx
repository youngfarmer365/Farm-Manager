'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getFarmAccess } from '@/lib/farm-access'
import { fieldGrazeStatus, GRAZE_COLORS, type GrazeStatus } from '@/lib/grazing'

const LABELS: Record<GrazeStatus, string> = {
  ready: 'Ready',
  grazing: 'Grazing',
  move: 'Need moved',
  rest: 'Resting',
}

export default function MobileFieldsPage() {
  const [rows, setRows] = useState<
    { id: string; name: string; status: GrazeStatus; head: number; days: number }[]
  >([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const a = await getFarmAccess()
      if (!a.farmId) return
      const supabase = createClient()
      const [{ data: fields, error: fErr }, { data: animals }] = await Promise.all([
        supabase.from('farm_fields').select('id, name, graze_days, rest_days').eq('farm_id', a.farmId).order('name'),
        supabase.from('animals').select('id, field_id').eq('farm_id', a.farmId).eq('status', 'active'),
      ])
      if (fErr) {
        const fallback = await supabase.from('farm_fields').select('id, name').eq('farm_id', a.farmId).order('name')
        if (fallback.error) {
          setError(fallback.error.message)
          return
        }
        setRows(
          (fallback.data || []).map((f: any) => ({
            id: f.id,
            name: f.name,
            status: 'ready' as GrazeStatus,
            head: (animals || []).filter((x) => x.field_id === f.id).length,
            days: 0,
          }))
        )
        return
      }
      const { data: stays } = await supabase
        .from('grazing_stays')
        .select('field_id, started_on, ended_on')
        .eq('farm_id', a.farmId)
      setRows(
        (fields || []).map((f: any) => {
          const here = (animals || []).filter((x) => x.field_id === f.id)
          const open = (stays || []).filter((s) => s.field_id === f.id && !s.ended_on)
          const closed = (stays || []).filter((s) => s.field_id === f.id && s.ended_on)
          const oldest = open.map((s) => s.started_on).sort()[0] || null
          const lastEnded = closed.map((s) => s.ended_on as string).sort().slice(-1)[0] || null
          const status = fieldGrazeStatus({
            headcount: here.length,
            grazeDays: Number(f.graze_days) || 14,
            restDays: Number(f.rest_days) || 21,
            oldestOpenStart: oldest,
            lastEndedOn: lastEnded,
          })
          const days = oldest ? Math.max(0, Math.round((Date.now() - new Date(oldest + 'T00:00:00').getTime()) / 86400000)) : 0
          return { id: f.id, name: f.name, status, head: here.length, days }
        })
      )
    }
    load()
  }, [])

  const grouped = useMemo(() => {
    const order: GrazeStatus[] = ['move', 'grazing', 'ready', 'rest']
    return order.map((status) => ({ status, items: rows.filter((r) => r.status === status) }))
  }, [rows])

  return (
    <div className="min-h-screen bg-slate-200">
      <header className="border-b-4 border-slate-600 bg-white px-4 py-4 phone-header">
        <h1 className="text-2xl font-bold">Fields</h1>
        <p className="text-sm font-semibold text-slate-600">Grazing status on the phone</p>
      </header>
      <main className="space-y-4 p-4">
        {error && <p className="rounded-xl border-2 border-red-300 bg-red-50 p-3 font-semibold text-red-800">{error}</p>}
        <Link href="/fields/grazing" className="block min-h-[52px] rounded-2xl border-4 border-slate-700 bg-white px-4 py-3 text-center text-base font-bold">
          Open full grazing map
        </Link>
        {grouped.map(({ status, items }) =>
          items.length ? (
            <section key={status}>
              <h2 className="mb-2 text-sm font-bold uppercase" style={{ color: GRAZE_COLORS[status] }}>
                {LABELS[status]}
              </h2>
              <ul className="space-y-2">
                {items.map((f) => (
                  <li key={f.id}>
                    <Link
                      href={'/fields/' + f.id}
                      className="block rounded-2xl border-4 bg-white p-4"
                      style={{ borderColor: GRAZE_COLORS[status] }}
                    >
                      <div className="text-xl font-bold">{f.name}</div>
                      <div className="mt-1 text-sm font-semibold text-slate-600">
                        {f.head ? f.head + ' head' : 'Empty'}
                        {f.head && f.days ? ' · ' + f.days + ' days on' : ''}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null
        )}
        {rows.length === 0 && !error && <p className="font-semibold text-slate-600">No fields mapped yet.</p>}
      </main>
    </div>
  )
}
