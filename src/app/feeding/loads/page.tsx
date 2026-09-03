'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { groupPensByShed, housingPens, type PenRow } from '@/lib/pens'

interface Program {
  id: string
  name: string
}

interface Pen {
  id: string
  name: string
  type?: string | null
  parent_id?: string | null
}

interface Load {
  id: string
  name: string
  program_id: string | null
}

interface LoadPen {
  id: string
  pen_id: string
  daily_amount_kg: number
  sort_order: number
  pen_name: string
}

export default function LoadsPage() {
  const [farmId, setFarmId] = useState<string | null>(null)
  const [programs, setPrograms] = useState<Program[]>([])
  const [pens, setPens] = useState<Pen[]>([])
  const [loads, setLoads] = useState<Load[]>([])

  const [name, setName] = useState('')
  const [programId, setProgramId] = useState('')
  const [error, setError] = useState<string | null>(null)

  const [activeLoad, setActiveLoad] = useState<Load | null>(null)
  const [loadPens, setLoadPens] = useState<LoadPen[]>([])
  const [selectedPenIds, setSelectedPenIds] = useState<Set<string>>(new Set())
  const [defaultKg, setDefaultKg] = useState('0')

  const supabase = createClient()

  async function loadMeta() {
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
    if (!membership) return
    setFarmId(membership.farm_id)

    const [{ data: progs }, { data: pensData }, { data: loadsData }] = await Promise.all([
      supabase
        .from('feeding_programs')
        .select('id, name')
        .eq('farm_id', membership.farm_id)
        .order('created_at', { ascending: false }),
      supabase
        .from('pens')
        .select('id, name, type, parent_id')
        .eq('farm_id', membership.farm_id)
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('feed_loads')
        .select('id, name, program_id')
        .eq('farm_id', membership.farm_id)
        .order('created_at', { ascending: false }),
    ])
    setPrograms((progs as Program[]) || [])
    setPens((pensData as Pen[]) || [])
    setLoads((loadsData as Load[]) || [])
  }

  useEffect(() => {
    loadMeta()
  }, [])

  async function createLoad(e: React.FormEvent) {
    e.preventDefault()
    if (!farmId || !name.trim()) return
    setError(null)
    const { error } = await supabase.from('feed_loads').insert({
      farm_id: farmId,
      name: name.trim(),
      program_id: programId || null,
    })
    if (error) setError(error.message)
    else {
      setName('')
      await loadMeta()
    }
  }

  async function deleteLoad(id: string) {
    if (!confirm('Delete this load template and its pen list?')) return
    await supabase.from('feed_loads').delete().eq('id', id)
    if (activeLoad?.id === id) {
      setActiveLoad(null)
      setLoadPens([])
    }
    await loadMeta()
  }

  async function openLoad(load: Load) {
    setActiveLoad(load)
    setSelectedPenIds(new Set())
    const { data: rows } = await supabase
      .from('feed_load_pens')
      .select('id, pen_id, daily_amount_kg, sort_order')
      .eq('load_id', load.id)
      .order('sort_order')

    const penIds = (rows || []).map((r) => r.pen_id)
    const { data: penRows } = penIds.length
      ? await supabase.from('pens').select('id, name').in('id', penIds)
      : { data: [] }
    const nameById = new Map((penRows || []).map((p) => [p.id, p.name]))

    setLoadPens(
      (rows || []).map((r) => ({
        id: r.id,
        pen_id: r.pen_id,
        daily_amount_kg: Number(r.daily_amount_kg) || 0,
        sort_order: r.sort_order,
        pen_name: nameById.get(r.pen_id) || r.pen_id,
      }))
    )
  }

  function toggleSelect(penId: string) {
    setSelectedPenIds((prev) => {
      const next = new Set(prev)
      if (next.has(penId)) next.delete(penId)
      else next.add(penId)
      return next
    })
  }

  async function addSelectedPens() {
    if (!activeLoad || selectedPenIds.size === 0) return
    const kg = Number(defaultKg) || 0
    let order =
      loadPens.length === 0 ? 0 : Math.max(...loadPens.map((p) => p.sort_order)) + 1

    for (const penId of selectedPenIds) {
      if (loadPens.some((lp) => lp.pen_id === penId)) continue
      await supabase.from('feed_load_pens').insert({
        load_id: activeLoad.id,
        pen_id: penId,
        daily_amount_kg: kg,
        sort_order: order++,
      })
    }
    setSelectedPenIds(new Set())
    await openLoad(activeLoad)
  }

  async function removeLoadPen(id: string) {
    if (!activeLoad) return
    await supabase.from('feed_load_pens').delete().eq('id', id)
    await openLoad(activeLoad)
  }

  async function updateKg(id: string, kg: string) {
    await supabase
      .from('feed_load_pens')
      .update({ daily_amount_kg: Number(kg) || 0 })
      .eq('id', id)
    if (activeLoad) await openLoad(activeLoad)
  }

  async function movePen(index: number, dir: -1 | 1) {
    if (!activeLoad) return
    const j = index + dir
    if (j < 0 || j >= loadPens.length) return
    const a = loadPens[index]
    const b = loadPens[j]
    await supabase.from('feed_load_pens').update({ sort_order: j }).eq('id', a.id)
    await supabase.from('feed_load_pens').update({ sort_order: index }).eq('id', b.id)
    await openLoad(activeLoad)
  }

  const availablePens = housingPens(pens as PenRow[]).filter((p) => !loadPens.some((lp) => lp.pen_id === p.id))
  const shedGroups = groupPensByShed(availablePens)

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b px-4 py-3">
        <div className="max-w-3xl mx-auto flex justify-between">
          <h1 className="text-xl font-bold">Loads</h1>
          <Link href="/feeding" className="text-sm text-slate-600 hover:underline">
            Feeding
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <form onSubmit={createLoad} className="bg-white rounded-xl border p-5 space-y-3 shadow-sm">
          <h2 className="font-semibold">New load</h2>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Load name"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={programId}
            onChange={(e) => setProgramId(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Programme (optional)</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" className="rounded-lg bg-brand-600 text-white px-4 py-2 text-sm">
            Create load
          </button>
        </form>

        <ul className="bg-white rounded-xl border divide-y shadow-sm">
          {loads.map((l) => (
            <li key={l.id} className="flex items-center gap-2 px-2">
              <button
                type="button"
                onClick={() => openLoad(l)}
                className="flex-1 text-left px-2 py-3 text-sm hover:bg-slate-50 rounded-lg"
              >
                <span className="font-medium">{l.name}</span>
              </button>
              <button
                type="button"
                onClick={() => deleteLoad(l.id)}
                className="text-xs text-red-600 border border-red-200 rounded-md px-2 py-1 mr-2"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>

        {activeLoad && (
          <section className="bg-white rounded-xl border p-5 shadow-sm space-y-4">
            <h2 className="font-semibold">{activeLoad.name}</h2>

            <div>
              <p className="text-sm font-medium mb-2">Add pens (from sheds)</p>
              <div className="flex items-center gap-2 mb-2">
                <label className="text-xs text-slate-500">Default kg each</label>
                <input
                  type="number"
                  value={defaultKg}
                  onChange={(e) => setDefaultKg(e.target.value)}
                  className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm"
                />
              </div>
              {availablePens.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No more pens available.{' '}
                  <Link href="/pens" className="underline">
                    Manage pens
                  </Link>
                </p>
              ) : (
                                <ul className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                  {shedGroups.grouped.map(({ shed, pens: inShed }) => (
                    <li key={shed.id}>
                      <button
                        type="button"
                        className="w-full px-3 py-1.5 text-xs font-bold bg-slate-100 text-left"
                        onClick={() => {
                          setSelectedPenIds((prev) => {
                            const next = new Set(prev)
                            const ids = inShed.map((p) => p.id)
                            const allOn = ids.every((id) => next.has(id))
                            if (allOn) ids.forEach((id) => next.delete(id))
                            else ids.forEach((id) => next.add(id))
                            return next
                          })
                        }}
                      >
                        {shed.name} — tap to select all
                      </button>
                      {inShed.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => toggleSelect(p.id)}
                          className={`w-full text-left px-3 py-2.5 text-sm flex items-center gap-2 ${
                            selectedPenIds.has(p.id) ? 'bg-green-50' : 'hover:bg-slate-50'
                          }`}
                        >
                          <span
                            className={`h-4 w-4 rounded border flex items-center justify-center text-[10px] ${
                              selectedPenIds.has(p.id)
                                ? 'bg-green-600 border-green-600 text-white'
                                : 'border-slate-300'
                            }`}
                          >
                            {selectedPenIds.has(p.id) ? '✓' : ''}
                          </span>
                          {p.name}
                        </button>
                      ))}
                    </li>
                  ))}
                  {shedGroups.ungrouped.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => toggleSelect(p.id)}
                        className={`w-full text-left px-3 py-2.5 text-sm flex items-center gap-2 ${
                          selectedPenIds.has(p.id) ? 'bg-green-50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <span
                          className={`h-4 w-4 rounded border flex items-center justify-center text-[10px] ${
                            selectedPenIds.has(p.id)
                              ? 'bg-green-600 border-green-600 text-white'
                              : 'border-slate-300'
                          }`}
                        >
                          {selectedPenIds.has(p.id) ? '✓' : ''}
                        </span>
                        {p.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                onClick={addSelectedPens}
                disabled={selectedPenIds.size === 0}
                className="mt-2 rounded-lg bg-slate-800 text-white px-4 py-2 text-sm disabled:opacity-40"
              >
                Add {selectedPenIds.size || ''} selected (in list order)
              </button>
            </div>

            <ol className="space-y-2">
              {loadPens.map((lp, idx) => (
                <li
                  key={lp.id}
                  className="flex flex-wrap items-center gap-2 text-sm border rounded-lg px-3 py-2"
                >
                  <span className="text-slate-400 w-6">{idx + 1}.</span>
                  <span className="font-medium flex-1">{lp.pen_name}</span>
                  <input
                    type="number"
                    step="0.1"
                    defaultValue={lp.daily_amount_kg}
                    onBlur={(e) => updateKg(lp.id, e.target.value)}
                    className="w-24 rounded-md border border-slate-300 px-2 py-1"
                  />
                  <span className="text-xs text-slate-500">kg</span>
                  <button type="button" className="text-xs" onClick={() => movePen(idx, -1)}>
                    ↑
                  </button>
                  <button type="button" className="text-xs" onClick={() => movePen(idx, 1)}>
                    ↓
                  </button>
                  <button
                    type="button"
                    className="text-xs text-red-600 border border-red-200 rounded px-2 py-0.5"
                    onClick={() => removeLoadPen(lp.id)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ol>
          </section>
        )}
      </main>
    </div>
  )
}
