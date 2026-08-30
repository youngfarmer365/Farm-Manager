'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getFarmAccess } from '@/lib/farm-access'

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

interface Opt {
  id: string
  name: string
}

interface HerdOpt {
  id: string
  herd_number: string
  name: string | null
}

function shortTag(tag: string) {
  const c = (tag || '').replace(/\s/g, '')
  return c.length <= 5 ? c : c.slice(-5)
}

function formatDate(d: string | null | undefined) {
  if (!d) return '—'
  const m = String(d).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return String(d)
  return m[3] + '/' + m[2] + '/' + m[1]
}

export default function MobileAnimalsPage() {
  const [animals, setAnimals] = useState<Row[]>([])
  const [groups, setGroups] = useState<Opt[]>([])
  const [pens, setPens] = useState<Opt[]>([])
  const [herds, setHerds] = useState<HerdOpt[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const [withdrawalOnly, setWithdrawalOnly] = useState(false)
  const [groupId, setGroupId] = useState('')
  const [penId, setPenId] = useState('')
  const [herdId, setHerdId] = useState('')
  const [withdrawalByAnimal, setWithdrawalByAnimal] = useState<Record<string, number>>({})

  useEffect(() => {
    async function load() {
      const access = await getFarmAccess()
      if (!access.farmId) {
        setLoading(false)
        return
      }
      const supabase = createClient()

      const animalRes = await supabase
        .from('animals_enriched')
        .select(
          'id, tag, status, pen_id, group_id, herd_id, pen_name, group_name, herd_number, latest_weight_kg, is_flagged, source, purchase_date, entry_date'
        )
        .eq('farm_id', access.farmId)
        .eq('status', 'active')
        .order('tag')
        .limit(500)

      const groupRes = await supabase
        .from('groups')
        .select('id, name')
        .eq('farm_id', access.farmId)
        .eq('is_active', true)
        .order('name')

      const penRes = await supabase
        .from('pens')
        .select('id, name')
        .eq('farm_id', access.farmId)
        .eq('is_active', true)
        .order('name')

      const herdRes = await supabase
        .from('herds')
        .select('id, herd_number, name')
        .eq('farm_id', access.farmId)
        .order('herd_number')

      const rows = (animalRes.data as Row[]) || []
      setAnimals(rows)
      setGroups((groupRes.data as Opt[]) || [])
      setPens((penRes.data as Opt[]) || [])
      setHerds((herdRes.data as HerdOpt[]) || [])

      try {
        const ids = rows.map((a) => a.id)
        if (ids.length > 0) {
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
            if (left > 0) {
              map[t.animal_id] = Math.max(map[t.animal_id] || 0, left)
            }
          }
          setWithdrawalByAnimal(map)
        }
      } catch {
        setWithdrawalByAnimal({})
      }

      setLoading(false)
    }
    load()
  }, [])

  const filtered = useMemo(() => {
    return animals.filter((a) => {
      if (search.trim()) {
        const q = search.toLowerCase()
        const from = (a.source || '').toLowerCase()
        const tagOk = a.tag.toLowerCase().includes(q)
        const shortOk = shortTag(a.tag).toLowerCase().includes(q)
        const fromOk = from.includes(q)
        if (!tagOk && !shortOk && !fromOk) return false
      }
      if (flaggedOnly && !a.is_flagged) return false
      if (withdrawalOnly && !(withdrawalByAnimal[a.id] > 0)) return false
      if (groupId && a.group_id !== groupId) return false
      if (penId && a.pen_id !== penId) return false
      if (herdId && a.herd_id !== herdId) return false
      return true
    })
  }, [
    animals,
    search,
    flaggedOnly,
    withdrawalOnly,
    groupId,
    penId,
    herdId,
    withdrawalByAnimal,
  ])

  const activeFilterCount =
    (flaggedOnly ? 1 : 0) +
    (withdrawalOnly ? 1 : 0) +
    (groupId ? 1 : 0) +
    (penId ? 1 : 0) +
    (herdId ? 1 : 0)

  function clearFilters() {
    setFlaggedOnly(false)
    setWithdrawalOnly(false)
    setGroupId('')
    setPenId('')
    setHerdId('')
    setSearch('')
  }

  const btnOff =
    'min-h-[48px] w-full rounded-xl border-2 border-slate-500 bg-white px-3 py-3 text-left text-base font-bold text-slate-900'
  const btnOn =
    'min-h-[48px] w-full rounded-xl border-2 border-brand-900 bg-brand-700 px-3 py-3 text-left text-base font-bold text-white'
  const btnAmberOn =
    'min-h-[48px] w-full rounded-xl border-2 border-amber-900 bg-amber-600 px-3 py-3 text-left text-base font-bold text-white'
  const selectCls =
    'min-h-[48px] w-full rounded-xl border-2 border-slate-500 bg-white px-3 py-3 text-base font-bold text-slate-900'

  return (
    <div className="min-h-screen bg-slate-200">
      <header className="sticky top-0 z-10 border-b-4 border-slate-600 bg-white px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-slate-900">Animals</h1>
          <button
            type="button"
            onClick={() => setShowFilters((s) => !s)}
            className="min-h-[48px] rounded-xl border-2 border-brand-900 bg-brand-700 px-4 text-base font-bold text-white"
          >
            {showFilters ? 'Hide filters' : 'Filters'}
            {activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </button>
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tag or purchase from…"
          className="mt-3 min-h-[48px] w-full rounded-xl border-2 border-slate-500 bg-white px-3 py-3 text-base font-semibold text-slate-900 placeholder:text-slate-500"
        />

        {showFilters && (
          <div className="mt-3 space-y-3 rounded-xl border-2 border-slate-500 bg-slate-100 p-3">
            <p className="text-base font-bold text-slate-900">{filtered.length} shown</p>

            <button
              type="button"
              onClick={() => setFlaggedOnly((v) => !v)}
              className={flaggedOnly ? btnOn : btnOff}
            >
              {flaggedOnly ? '✓ ' : ''}Flagged only
            </button>

            <button
              type="button"
              onClick={() => setWithdrawalOnly((v) => !v)}
              className={withdrawalOnly ? btnAmberOn : btnOff}
            >
              {withdrawalOnly ? '✓ ' : ''}In withdrawal only
            </button>

            <div>
              <label className="mb-1 block text-sm font-bold text-slate-800">Herd number</label>
              <select
                className={selectCls}
                value={herdId}
                onChange={(e) => setHerdId(e.target.value)}
              >
                <option value="">All herds</option>
                {herds.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.herd_number}
                    {h.name ? ' — ' + h.name : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-bold text-slate-800">Group</label>
              <select
                className={selectCls}
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
              >
                <option value="">All groups</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-bold text-slate-800">Pen / field</label>
              <select
                className={selectCls}
                value={penId}
                onChange={(e) => setPenId(e.target.value)}
              >
                <option value="">All pens</option>
                {pens.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={clearFilters}
              className="min-h-[48px] w-full rounded-xl border-2 border-slate-600 bg-slate-300 text-base font-bold text-slate-900"
            >
              Clear filters
            </button>
          </div>
        )}
      </header>

      <main className="px-3 py-3">
        {loading ? (
          <p className="p-6 text-center text-base font-semibold text-slate-800">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-center text-base font-semibold text-slate-800">No animals match</p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((a) => {
              const wd = withdrawalByAnimal[a.id] || 0
              const inWd = wd > 0
              const joined = a.purchase_date || a.entry_date
              return (
                <li key={a.id}>
                  <Link
                    href={'/m/animals/' + a.id}
                    className={
                      'block min-h-[72px] rounded-xl border-2 px-4 py-3 active:opacity-90 ' +
                      (inWd
                        ? 'border-amber-700 bg-amber-100'
                        : a.is_flagged
                        ? 'border-red-600 bg-red-50'
                        : 'border-slate-400 bg-white')
                    }
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={
                              'font-mono text-xl font-bold ' +
                              (a.is_flagged ? 'text-red-700' : 'text-brand-800')
                            }
                          >
                            {shortTag(a.tag)}
                          </span>
                          {a.is_flagged && (
                            <span className="rounded-md bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
                              FLAGGED
                            </span>
                          )}
                          {inWd && (
                            <span className="rounded-md bg-amber-700 px-2 py-0.5 text-xs font-bold text-white">
                              W/D {wd}d
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-sm font-semibold text-slate-800">
                          {(a.herd_number ? a.herd_number + ' · ' : '') +
                            (a.pen_name || 'No pen') +
                            ' · ' +
                            (a.group_name || 'No group')}
                        </div>
                        <div className="mt-1 text-sm font-bold text-slate-900">
                          From: {a.source && a.source.trim() ? a.source.trim() : '—'}
                        </div>
                        <div className="text-sm font-semibold text-slate-800">
                          Joined: {formatDate(joined)}
                        </div>
                      </div>
                      <div className="shrink-0 text-right text-base font-bold tabular-nums text-slate-900">
                        {a.latest_weight_kg != null
                          ? Number(a.latest_weight_kg).toFixed(0) + ' kg'
                          : '—'}
                      </div>
                    </div>
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