'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { AppHeader } from '@/components/layout/AppHeader'
import { getFarmAccess } from '@/lib/farm-access'
import { createClient } from '@/lib/supabase/client'
import { loadFarmFields, type FarmFieldRow } from '@/lib/fields'
import { GRAZE_COLORS, daysBetween, fieldGrazeStatus, type GrazeStatus } from '@/lib/grazing'

const FarmMap = dynamic(() => import('@/components/map/FarmMap').then((m) => m.FarmMap), {
  ssr: false,
})

type Stay = {
  id: string
  animal_id: string
  field_id: string | null
  from_pen_id: string | null
  to_pen_id: string | null
  started_on: string
  ended_on: string | null
}

type AnimalLite = { id: string; tag: string; field_id: string | null; pen_id: string | null }

const LABELS: Record<GrazeStatus, string> = {
  ready: 'Ready to graze',
  grazing: 'Currently grazing',
  move: 'Need moved / finished',
  rest: 'Rested — back in rotation soon',
}

export default function GrazingMapPage() {
  const [farmId, setFarmId] = useState<string | null>(null)
  const [fields, setFields] = useState<FarmFieldRow[]>([])
  const [stays, setStays] = useState<Stay[]>([])
  const [animals, setAnimals] = useState<AnimalLite[]>([])
  const [error, setError] = useState<string | null>(null)
  const [restDaysDefault, setRestDaysDefault] = useState(21)
  const [grazeDaysDefault, setGrazeDaysDefault] = useState(14)

  async function load() {
    const a = await getFarmAccess()
    if (!a.farmId) return
    setFarmId(a.farmId)
    const supabase = createClient()
    const loaded = await loadFarmFields(a.farmId)
    if (loaded.error) setError(loaded.error)
    setFields(loaded.data)

    const [{ data: s, error: se }, { data: an }] = await Promise.all([
      supabase
        .from('grazing_stays')
        .select('id, animal_id, field_id, from_pen_id, to_pen_id, started_on, ended_on')
        .eq('farm_id', a.farmId)
        .order('started_on', { ascending: false })
        .limit(2000),
      supabase.from('animals').select('id, tag, field_id, pen_id').eq('farm_id', a.farmId).eq('status', 'active'),
    ])
    if (se) setError(se.message)
    setStays((s as Stay[]) || [])
    setAnimals((an as AnimalLite[]) || [])
  }

  useEffect(() => {
    load()
  }, [])

  const byField = useMemo(() => {
    return fields.map((f) => {
      const grazeDays = Number((f as FarmFieldRow & { graze_days?: number }).graze_days) || grazeDaysDefault
      const restDays = Number((f as FarmFieldRow & { rest_days?: number }).rest_days) || restDaysDefault
      const here = animals.filter((a) => a.field_id === f.id)
      const open = stays.filter((s) => s.field_id === f.id && !s.ended_on)
      const closed = stays.filter((s) => s.field_id === f.id && s.ended_on)
      const oldestOpen = open.reduce<string | null>((acc, s) => {
        if (!acc || s.started_on < acc) return s.started_on
        return acc
      }, null)
      const lastEnded = closed.reduce<string | null>((acc, s) => {
        if (!s.ended_on) return acc
        if (!acc || s.ended_on > acc) return s.ended_on
        return acc
      }, null)
      const status = fieldGrazeStatus({
        headcount: here.length,
        grazeDays,
        restDays,
        oldestOpenStart: oldestOpen,
        lastEndedOn: lastEnded,
      })
      return {
        ...f,
        color: GRAZE_COLORS[status],
        status,
        headcount: here.length,
        daysOn: oldestOpen ? daysBetween(oldestOpen) : 0,
        restSoFar: lastEnded && here.length === 0 ? daysBetween(lastEnded) : 0,
        grazeDays,
        restDays,
        tags: here.map((a) => a.tag).slice(0, 8),
      }
    })
  }, [fields, animals, stays, grazeDaysDefault, restDaysDefault])

  return (
    <div className="min-h-screen bg-slate-200">
      <AppHeader title="Grazing map" />
      <main className="mx-auto max-w-5xl space-y-4 p-4">
        <p className="text-sm font-semibold text-slate-700">
          Colours are grazing status, not crop colour. Move cattle from the animals list; this map shows where they
          are now.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.keys(LABELS) as GrazeStatus[]).map((k) => (
            <div key={k} className="flex items-center gap-2 rounded-xl border-2 border-slate-500 bg-white px-3 py-2">
              <span className="h-6 w-6 rounded-md border border-slate-700" style={{ background: GRAZE_COLORS[k] }} />
              <span className="text-xs font-bold text-slate-800">{LABELS[k]}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 rounded-2xl border-4 border-slate-500 bg-white p-3">
          <label className="text-sm font-bold">
            Graze days before red
            <input
              type="number"
              min={1}
              value={grazeDaysDefault}
              onChange={(e) => setGrazeDaysDefault(Number(e.target.value) || 14)}
              className="mt-1 min-h-[44px] w-full rounded-xl border-2 border-slate-400 px-3"
            />
          </label>
          <label className="text-sm font-bold">
            Rest days (blue → green)
            <input
              type="number"
              min={1}
              value={restDaysDefault}
              onChange={(e) => setRestDaysDefault(Number(e.target.value) || 21)}
              className="mt-1 min-h-[44px] w-full rounded-xl border-2 border-slate-400 px-3"
            />
          </label>
        </div>
        {error && (
          <p className="font-semibold text-red-700">
            {error}. If the table is missing, run 007_grazing.sql in Supabase.
          </p>
        )}
        <FarmMap fields={byField} farmId={farmId} selectable={false} />
        <ul className="space-y-2">
          {byField.map((f) => (
            <li key={f.id} className="rounded-2xl border-4 border-slate-600 bg-white p-4">
              <div className="flex items-start gap-3">
                <span className="h-12 w-12 shrink-0 rounded-xl border-2 border-slate-700" style={{ background: f.color }} />
                <div className="min-w-0 flex-1">
                  <div className="text-xl font-bold">{f.name}</div>
                  <div className="text-sm font-semibold text-slate-700">
                    {LABELS[f.status]}
                    {f.headcount ? ` · ${f.headcount} head · ${f.daysOn} days on` : ''}
                    {f.status === 'rest' ? ` · ${f.restSoFar} / ${f.restDays} rest days` : ''}
                    {f.area_ha != null ? ` · ${f.area_ha} ha` : ''}
                  </div>
                  {f.tags.length > 0 && (
                    <div className="mt-1 font-mono text-xs text-slate-600">{f.tags.join(' · ')}</div>
                  )}
                </div>
                <Link href={`/fields/${f.id}`} className="text-sm font-bold text-brand-800 underline">
                  Field
                </Link>
              </div>
            </li>
          ))}
        </ul>
        <p className="text-sm font-semibold text-slate-600">
          Open <Link href="/animals" className="underline">Animals</Link> → select a pen or tags → Move to field.
        </p>
      </main>
    </div>
  )
}
