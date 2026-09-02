'use client'

import { useState, useEffect, useCallback } from 'react'
import { AnimalFiltersPanel } from '@/components/animals/AnimalFilters'
import { AnimalsTable } from '@/components/animals/AnimalsTable'
import type {
  AnimalEnriched,
  AnimalFilters,
  AnimalSort,
  AnimalSortField,
  Group,
  Pen,
} from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { groupPensByShed, housingPens, penLabel } from '@/lib/pens'

interface Herd {
  id: string
  herd_number: string
  name: string | null
}

export default function AnimalsPage() {
  const [animals, setAnimals] = useState<AnimalEnriched[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [pens, setPens] = useState<Pen[]>([])
  const [herds, setHerds] = useState<Herd[]>([])
  const [filters, setFilters] = useState<AnimalFilters>({})
  const [sort, setSort] = useState<AnimalSort>({ field: 'tag', direction: 'asc' })
  const [loading, setLoading] = useState(true)
  const [count, setCount] = useState(0)
  const [farmId, setFarmId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [movePenId, setMovePenId] = useState('')
  const [withdrawalByAnimal, setWithdrawalByAnimal] = useState<Record<string, number>>({})

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data: membership } = await supabase
        .from('farm_members')
        .select('farm_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()

      if (!membership) {
        setLoading(false)
        return
      }

      setFarmId(membership.farm_id)

      const [{ data: g }, { data: p }, { data: h }] = await Promise.all([
        supabase.from('groups').select('*').eq('farm_id', membership.farm_id).eq('is_active', true),
        supabase.from('pens').select('*').eq('farm_id', membership.farm_id).eq('is_active', true),
        supabase
          .from('herds')
          .select('id, herd_number, name')
          .eq('farm_id', membership.farm_id)
          .order('herd_number'),
      ])

      setGroups((g as Group[]) || [])
      setPens((p as Pen[]) || [])
      setHerds((h as Herd[]) || [])
    }
    init()
  }, [])

  const loadAnimals = useCallback(async () => {
    if (!farmId) return
    setLoading(true)
    const supabase = createClient()

    let query = supabase
      .from('animals_enriched')
      .select('*', { count: 'exact' })
      .eq('farm_id', farmId)

    if (filters.status?.length) query = query.in('status', filters.status)
    else query = query.eq('status', 'active')

    if (filters.group_ids?.length) query = query.in('group_id', filters.group_ids)
    if (filters.pen_ids?.length) query = query.in('pen_id', filters.pen_ids)
    if ((filters as any).herd_ids?.length) {
      query = query.in('herd_id', (filters as any).herd_ids)
    }
    if (filters.sex?.length) query = query.in('sex', filters.sex)
    if (filters.min_days_on_farm != null) query = query.gte('days_on_farm', filters.min_days_on_farm)
    if (filters.max_days_on_farm != null) query = query.lte('days_on_farm', filters.max_days_on_farm)
    if (filters.min_age_days != null) query = query.gte('age_days', filters.min_age_days)
    if (filters.max_age_days != null) query = query.lte('age_days', filters.max_age_days)
    if (filters.purchase_date_from) query = query.gte('purchase_date', filters.purchase_date_from)
    if (filters.purchase_date_to) query = query.lte('purchase_date', filters.purchase_date_to)
    if (filters.exit_date_from) query = query.gte('exit_date', filters.exit_date_from)
    if (filters.exit_date_to) query = query.lte('exit_date', filters.exit_date_to)
    if ((filters as any).sale_date_from) {
      query = query.gte('sale_date', (filters as any).sale_date_from)
    }
    if ((filters as any).sale_date_to) {
      query = query.lte('sale_date', (filters as any).sale_date_to)
    }
    if (filters.min_adg != null) query = query.gte('adg_kg_per_day', filters.min_adg)
    if (filters.max_adg != null) query = query.lte('adg_kg_per_day', filters.max_adg)
    if (filters.min_weight != null) query = query.gte('latest_weight_kg', filters.min_weight)
    if (filters.max_weight != null) query = query.lte('latest_weight_kg', filters.max_weight)
    if ((filters as any).is_flagged === true) query = query.eq('is_flagged', true)

    if (filters.search) {
      const term = `%${filters.search}%`
      query = query.or(`tag.ilike.${term},eid.ilike.${term},breed.ilike.${term}`)
    }

    query = query.order(sort.field, {
      ascending: sort.direction === 'asc',
      nullsFirst: false,
    })
    query = query.range(0, 499)

    const { data, count: c, error } = await query
    if (error) console.error(error)

    const list = (data as AnimalEnriched[]) || []
    setAnimals(list)
    setCount(c || 0)
    setSelected(new Set())

    try {
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
          if (left > 0) {
            map[t.animal_id] = Math.max(map[t.animal_id] || 0, left)
          }
        }
        setWithdrawalByAnimal(map)
      } else {
        setWithdrawalByAnimal({})
      }
    } catch {
      setWithdrawalByAnimal({})
    }

    setLoading(false)
  }, [farmId, filters, sort])

  useEffect(() => {
    loadAnimals()
  }, [loadAnimals])

  const handleSort = (field: AnimalSortField) => {
    setSort((prev) =>
      prev.field === field
        ? { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { field, direction: 'asc' }
    )
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === displayAnimals.length) setSelected(new Set())
    else setSelected(new Set(displayAnimals.map((a) => a.id)))
  }

  async function bulkDelete() {
    if (selected.size === 0) return
    if (
      !confirm(
        `Permanently delete ${selected.size} animal(s)? This cannot be undone.`
      )
    ) {
      return
    }
    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase.from('animals').delete().in('id', Array.from(selected))
    setBusy(false)
    if (error) {
      alert(error.message)
      return
    }
    setSelected(new Set())
    await loadAnimals()
  }

  async function bulkMoveToPen() {
    if (selected.size === 0 || !movePenId) return
    const dest = pens.find((p) => p.id === movePenId)
    const label = movePenId === '__none__' ? 'no pen' : dest ? penLabel(dest, pens) : 'pen'
    if (
      !confirm(
        'Move ' + selected.size + ' animal(s) to ' + label + '? Tags and doses stay the same.'
      )
    ) {
      return
    }
    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('animals')
      .update({ pen_id: movePenId === '__none__' ? null : movePenId })
      .in('id', Array.from(selected))
    setBusy(false)
    if (error) {
      alert(error.message)
      return
    }
    setSelected(new Set())
    setMovePenId('')
    await loadAnimals()
  }

  async function bulkSetFlag(flagged: boolean) {
    if (selected.size === 0) return
    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('animals')
      .update({ is_flagged: flagged })
      .in('id', Array.from(selected))
    setBusy(false)
    if (error) {
      alert(error.message)
      return
    }
    setSelected(new Set())
    await loadAnimals()
  }

  async function toggleFlag(id: string, current: boolean) {
    const supabase = createClient()
    const { error } = await supabase
      .from('animals')
      .update({ is_flagged: !current })
      .eq('id', id)
    if (error) {
      alert(error.message)
      return
    }
    setAnimals((prev) =>
      prev.map((a) => (a.id === id ? { ...a, is_flagged: !current } : a))
    )
  }

  const displayAnimals =
    (filters as any).in_withdrawal === true
      ? animals.filter((a) => (withdrawalByAnimal[a.id] || 0) > 0)
      : animals

  const navLink =
    'rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-800 hover:border-brand-300 hover:bg-brand-100'

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-4 py-3 print:hidden">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-700">
              Farm Manager
            </p>
            <h1 className="text-xl font-bold text-slate-900">Animals</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/home" className={navLink}>
              Home
            </Link>
            <Link href="/herds" className={navLink}>
              Herds
            </Link>
            <Link href="/pens" className={navLink}>
              Pens
            </Link>
            <Link href="/intake" className={navLink}>
              EID intake
            </Link>
            <Link href="/import" className={navLink}>
              Upload
            </Link>
            <Link href="/medicines" className={navLink}>
              Medicines
            </Link>
            <Link href="/animals/new" className={navLink}>
              + Add animal
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          <aside className="print:hidden lg:col-span-1">
            <AnimalFiltersPanel
              groups={groups}
              pens={pens}
              herds={herds}
              initialFilters={filters}
              onApply={setFilters}
            />
          </aside>

          <section className="space-y-3 lg:col-span-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
              <span className="font-medium text-slate-800">
                {loading ? 'Loading…' : `${count} animal${count === 1 ? '' : 's'}`}
                {!loading && displayAnimals.length !== count && (
                  <span className="ml-1 font-normal text-slate-500">
                    ({displayAnimals.length} shown)
                  </span>
                )}
              </span>
              <button
                  type="button"
                  onClick={toggleSelectAll}
                  disabled={loading || displayAnimals.length === 0}
                  className="rounded-lg border-2 border-slate-700 bg-white px-3 py-1.5 text-sm font-bold text-slate-900 disabled:opacity-50"
                >
                  {selected.size === displayAnimals.length && displayAnimals.length > 0
                    ? 'Clear selection'
                    : 'Select all ' + displayAnimals.length}
                </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-800 hover:border-sky-300 hover:bg-sky-100 print:hidden"
              >
                Print list
              </button>
            </div>

            {selected.size > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm print:hidden">
                <span className="font-semibold text-amber-950">{selected.size} selected</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => bulkSetFlag(true)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
                >
                  Flag
                </button>

                <select
                  value={movePenId}
                  onChange={(e) => setMovePenId(e.target.value)}
                  className="min-h-[36px] rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs"
                >
                  <option value="">Move to pen…</option>
                  <option value="__none__">No pen</option>
                  {groupPensByShed(housingPens(pens)).grouped.map(({ shed, pens: inShed }) => (
                    <optgroup key={shed.id} label={shed.name}>
                      {inShed.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                  {groupPensByShed(housingPens(pens)).ungrouped.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={busy || !movePenId}
                  onClick={bulkMoveToPen}
                  className="rounded-lg border-2 border-brand-800 bg-brand-700 px-2.5 py-1 text-xs font-bold text-white disabled:opacity-50"
                >
                  Move
                </button>
                
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => bulkSetFlag(false)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
                >
                  Unflag
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={bulkDelete}
                  className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {busy ? 'Working…' : 'Delete selected'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelected(new Set())}
                  className="text-xs text-slate-600 underline"
                >
                  Clear
                </button>
              </div>
            )}

            <AnimalsTable
              animals={displayAnimals}
              sort={sort}
              onSort={handleSort}
              selected={selected}
              onToggleSelect={toggleSelect}
              onToggleSelectAll={toggleSelectAll}
              onToggleFlag={toggleFlag}
              withdrawalByAnimal={withdrawalByAnimal}
            />
          </section>
        </div>
      </main>
    </div>
  )
}
