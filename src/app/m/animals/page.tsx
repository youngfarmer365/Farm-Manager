'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getFarmAccess } from '@/lib/farm-access'
import { groupPensByShed, type PenRow } from '@/lib/pens'
import { MobileMoveBar } from '@/components/animals/MobileMoveBar'

interface Row {
  id: string
  tag: string
  status: string
  pen_id: string | null
  group_id: string | null
  herd_id: string | null
  pen_name: string | null
  group_name: string | null
  herd_number: string | null
  latest_weight_kg: number | null
  is_flagged?: boolean
  source: string | null
  purchase_date: string | null
  entry_date: string | null
}

function shortTag(tag: string) {
  const c = (tag || '').replace(/\s/g, '')
  return c.length <= 5 ? c : c.slice(-5)
}

export default function MobileAnimalsPage() {
  const [animals, setAnimals] = useState<Row[]>([])
  const [pens, setPens] = useState<PenRow[]>([])
  const [fields, setFields] = useState<{ id: string; name: string }[]>([])
  const [farmId, setFarmId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [shedId, setShedId] = useState('')
  const [penId, setPenId] = useState('')
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const [withdrawalOnly, setWithdrawalOnly] = useState(false)
  const [withdrawalByAnimal, setWithdrawalByAnimal] = useState<Record<string, number>>({})

  useEffect(() => {
    async function load() {
      const access = await getFarmAccess()
      if (!access.farmId) {
        setLoading(false)
        return
      }
      setFarmId(access.farmId)
      const supabase = createClient()
      const [{ data: rows }, { data: penRows }, { data: fieldRows }] = await Promise.all([
        supabase
          .from('animals_enriched')
          .select(
            'id, tag, status, pen_id, group_id, herd_id, pen_name, group_name, herd_number, latest_weight_kg, is_flagged, source, purchase_date, entry_date'
          )
          .eq('farm_id', access.farmId)
          .eq('status', 'active')
          .order('tag')
          .limit(500),
        supabase.from('pens').select('id, name, type, parent_id').eq('farm_id', access.farmId).eq('is_active', true),
        supabase.from('farm_fields').select('id, name').eq('farm_id', access.farmId).order('name'),
      ])
      const list = (rows as Row[]) || []
      setAnimals(list)
      setPens((penRows as PenRow[]) || [])
      setFields((fieldRows as { id: string; name: string }[]) || [])
      setSelected(new Set())
      const ids = list.map((a) => a.id)
      if (ids.length) {
        const { data: txs } = await supabase
          .from('treatments')
          .select('animal_id, treated_at, withdrawal_days')
          .in('animal_id', ids)
        const map: Record<string, number> = {}
        const today = new Date()
        for (const t of txs || []) {
          if (!t.withdrawal_days || !t.treated_at) continue
          const end = new Date(t.treated_at)
          end.setDate(end.getDate() + Number(t.withdrawal_days))
          const left = Math.ceil((end.getTime() - today.getTime()) / 86400000)
          if (left > 0) map[t.animal_id] = Math.max(map[t.animal_id] || 0, left)
        }
        setWithdrawalByAnimal(map)
      }
      setLoading(false)
    }
    load()
  }, [])

  const sheds = groupPensByShed(pens)
  const filtered = useMemo(() => {
    return animals.filter((a) => {
      if (search.trim()) {
        const q = search.toLowerCase()
        if (!a.tag.toLowerCase().includes(q) && !shortTag(a.tag).toLowerCase().includes(q)) return false
      }
      if (flaggedOnly && !a.is_flagged) return false
      if (withdrawalOnly && !(withdrawalByAnimal[a.id] > 0)) return false
      if (penId && a.pen_id !== penId) return false
      if (shedId) {
        const pen = pens.find((p) => p.id === a.pen_id)
        if (!pen || pen.parent_id !== shedId) return false
      }
      return true
    })
  }, [animals, search, flaggedOnly, withdrawalOnly, penId, shedId, pens, withdrawalByAnimal])

  return (
    <div className="min-h-screen bg-slate-200">
      <header className="sticky top-0 z-10 border-b-4 border-slate-600 bg-white px-4 py-4 phone-header">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-bold">Animals</h1>
          <Link href="/m/stock" className="min-h-[48px] rounded-xl border-2 border-slate-600 bg-white px-3 font-bold leading-[48px]">
            Count
          </Link>
        </div>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tag…" className="mt-3 min-h-[48px] w-full rounded-xl border-2 px-3 text-base font-semibold" />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <select value={shedId} onChange={(e) => { setShedId(e.target.value); setPenId('') }} className="min-h-[48px] rounded-xl border-2 bg-white px-2 font-bold">
            <option value="">All sheds</option>
            {sheds.grouped.map(({ shed }) => (
              <option key={shed.id} value={shed.id}>{shed.name}</option>
            ))}
          </select>
          <select value={penId} onChange={(e) => setPenId(e.target.value)} className="min-h-[48px] rounded-xl border-2 bg-white px-2 font-bold">
            <option value="">All pens</option>
            {sheds.grouped.filter((g) => !shedId || g.shed.id === shedId).map(({ shed, pens: inShed }) => (
              <optgroup key={shed.id} label={shed.name}>
                {inShed.map((p) => (
                  <option key={p.id} value={p.id}>{shed.name} · {p.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={() => setFlaggedOnly((v) => !v)} className={'min-h-[44px] flex-1 rounded-xl border-2 font-bold ' + (flaggedOnly ? 'bg-brand-700 text-white' : 'bg-white')}>
            Flagged
          </button>
          <button type="button" onClick={() => setWithdrawalOnly((v) => !v)} className={'min-h-[44px] flex-1 rounded-xl border-2 font-bold ' + (withdrawalOnly ? 'bg-amber-600 text-white' : 'bg-white')}>
            Withdrawal
          </button>
        </div>
      </header>
      <main className="space-y-3 px-3 py-3">
        {farmId && (
          <MobileMoveBar farmId={farmId} selected={Array.from(selected)} pens={pens} fields={fields} onDone={() => window.location.reload()} />
        )}
        {filtered.length > 0 && (
          <button
            type="button"
            onClick={() => setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map((a) => a.id)))}
            className="min-h-[48px] w-full rounded-xl border-2 bg-white font-bold"
          >
            {selected.size === filtered.length ? 'Clear selection' : 'Select shown'}
          </button>
        )}
        {loading ? (
          <p className="p-6 text-center font-semibold">Loading…</p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((a) => {
              const wd = withdrawalByAnimal[a.id] || 0
              return (
                <li key={a.id} className="flex items-stretch gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelected((prev) => {
                        const next = new Set(prev)
                        if (next.has(a.id)) next.delete(a.id)
                        else next.add(a.id)
                        return next
                      })
                    }}
                    className={'min-w-[48px] rounded-xl border-2 text-xl font-bold ' + (selected.has(a.id) ? 'border-brand-800 bg-brand-700 text-white' : 'bg-white')}
                  >
                    {selected.has(a.id) ? '✓' : ''}
                  </button>
                  <Link href={'/m/animals/' + a.id} className={'block min-h-[72px] flex-1 rounded-xl border-2 px-4 py-3 ' + (wd ? 'border-amber-700 bg-amber-100' : a.is_flagged ? 'border-red-600 bg-red-50' : 'border-slate-400 bg-white')}>
                    <div className="font-mono text-xl font-bold">{shortTag(a.tag)}</div>
                    <div className="text-sm font-semibold text-slate-700">{a.pen_name || 'No pen'}{wd ? ' · W/D ' + wd + 'd' : ''}</div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </div>
  )
}
