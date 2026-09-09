'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { groupPensByShed, penLabel, type PenRow } from '@/lib/pens'
import { clockFromLoad, localISODate, programmeClockDay, programmeDayIndex } from '@/lib/feeding'
import { LoadProgramEditor } from '@/components/feeding/LoadProgramEditor'

interface Program {
  id: string
  name: string
  start_date?: string | null
  status?: string | null
  pause_days?: number | null
  paused_on?: string | null
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
  program_start_date?: string | null
  program_pause_days?: number | null
  program_paused_on?: string | null
  program_status?: string | null
}

interface LoadPen {
  id: string
  pen_id: string
  daily_amount_kg: number
  sort_order: number
  pen_name: string
}

const LOAD_CLOCK_COLS =
  'id, name, program_id, program_start_date, program_pause_days, program_paused_on, program_status'

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
  const [editName, setEditName] = useState('')
  const [editProgramId, setEditProgramId] = useState('')
  const [editStartDate, setEditStartDate] = useState('')
  const [sqlHint, setSqlHint] = useState(false)
  const supabase = createClient()

  function missingClockSql(message?: string | null) {
    if (!message) return false
    return /program_start_date|program_pause_days|program_paused_on|program_status/i.test(message)
  }

  async function fetchLoads(farm: string) {
    const withClock = await supabase
      .from('feed_loads')
      .select(LOAD_CLOCK_COLS)
      .eq('farm_id', farm)
      .order('created_at', { ascending: false })
    if (withClock.error) {
      if (missingClockSql(withClock.error.message)) setSqlHint(true)
      const fallback = await supabase
        .from('feed_loads')
        .select('id, name, program_id')
        .eq('farm_id', farm)
        .order('created_at', { ascending: false })
      return (fallback.data as Load[]) || []
    }
    return (withClock.data as Load[]) || []
  }

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
    const [{ data: progs }, { data: pensData }, loadsData] = await Promise.all([
      supabase
        .from('feeding_programs')
        .select('id, name, start_date, status, pause_days, paused_on')
        .eq('farm_id', membership.farm_id)
        .order('created_at', { ascending: false }),
      supabase
        .from('pens')
        .select('id, name, type, parent_id')
        .eq('farm_id', membership.farm_id)
        .eq('is_active', true)
        .order('name'),
      fetchLoads(membership.farm_id),
    ])
    setPrograms((progs as Program[]) || [])
    setPens((pensData as Pen[]) || [])
    setLoads(loadsData)
  }

  useEffect(() => {
    loadMeta()
  }, [])

  function loadClock(l: Load) {
    const prog = programs.find((p) => p.id === l.program_id)
    return clockFromLoad(l, prog || null)
  }

  async function createLoad(e: React.FormEvent) {
    e.preventDefault()
    if (!farmId || !name.trim()) return
    setError(null)
    const today = localISODate()
    const row: Record<string, unknown> = {
      farm_id: farmId,
      name: name.trim(),
      program_id: programId || null,
    }
    if (programId) {
      row.program_start_date = today
      row.program_pause_days = 0
      row.program_paused_on = null
      row.program_status = 'active'
    }
    const { error } = await supabase.from('feed_loads').insert(row)
    if (error) {
      if (missingClockSql(error.message)) {
        setSqlHint(true)
        const basic = await supabase.from('feed_loads').insert({
          farm_id: farmId,
          name: name.trim(),
          program_id: programId || null,
        })
        if (basic.error) setError(basic.error.message)
        else {
          setName('')
          await loadMeta()
        }
        return
      }
      setError(error.message)
    } else {
      setName('')
      await loadMeta()
    }
  }

  async function pauseLoad(load: Load) {
    const today = localISODate()
    const { error } = await supabase
      .from('feed_loads')
      .update({ program_status: 'paused', program_paused_on: today })
      .eq('id', load.id)
    if (error) {
      setSqlHint(missingClockSql(error.message) || sqlHint)
      setError(
        missingClockSql(error.message)
          ? 'Run 013_load_program_clock.sql in Supabase so each load can pause on its own.'
          : error.message
      )
    }
    await loadMeta()
  }

  async function startLoadClock(load: Load) {
    const clock = loadClock(load)
    const extra = clock.paused_on ? Math.max(0, programmeDayIndex(clock.paused_on)) : 0
    const { error } = await supabase
      .from('feed_loads')
      .update({
        program_status: 'active',
        program_paused_on: null,
        program_pause_days: Number(clock.pause_days || 0) + extra,
        program_start_date: clock.start_date || localISODate(),
      })
      .eq('id', load.id)
    if (error) {
      setSqlHint(missingClockSql(error.message) || sqlHint)
      setError(
        missingClockSql(error.message)
          ? 'Run 013_load_program_clock.sql in Supabase so each load can start on its own.'
          : error.message
      )
    }
    await loadMeta()
  }

  async function saveLoadMeta() {
    if (!activeLoad || !editName.trim()) return
    setError(null)
    const changing = (editProgramId || null) !== (activeLoad.program_id || null)
    const patch: Record<string, unknown> = {
      name: editName.trim(),
      program_id: editProgramId || null,
    }
    if (!editProgramId) {
      patch.program_start_date = null
      patch.program_pause_days = 0
      patch.program_paused_on = null
      patch.program_status = 'active'
    } else if (changing) {
      patch.program_start_date = editStartDate || localISODate()
      patch.program_pause_days = 0
      patch.program_paused_on = null
      patch.program_status = 'active'
    } else if (editStartDate) {
      patch.program_start_date = editStartDate
    }
    const { error } = await supabase.from('feed_loads').update(patch).eq('id', activeLoad.id)
    if (error) {
      if (missingClockSql(error.message)) {
        setSqlHint(true)
        const basic = await supabase
          .from('feed_loads')
          .update({ name: editName.trim(), program_id: editProgramId || null })
          .eq('id', activeLoad.id)
        if (basic.error) {
          setError(basic.error.message)
          return
        }
      } else {
        setError(error.message)
        return
      }
    }
    setActiveLoad({
      ...activeLoad,
      name: editName.trim(),
      program_id: editProgramId || null,
      program_start_date: (patch.program_start_date as string | null) ?? activeLoad.program_start_date,
      program_pause_days:
        typeof patch.program_pause_days === 'number'
          ? patch.program_pause_days
          : activeLoad.program_pause_days,
      program_paused_on: patch.program_paused_on === null ? null : activeLoad.program_paused_on,
      program_status: (patch.program_status as string) || activeLoad.program_status,
    })
    await loadMeta()
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
    setEditName(load.name)
    setEditProgramId(load.program_id || '')
    setEditStartDate(loadClock(load).start_date || '')
    setSelectedPenIds(new Set())
    const { data: rows } = await supabase
      .from('feed_load_pens')
      .select('id, pen_id, daily_amount_kg, sort_order')
      .eq('load_id', load.id)
      .order('sort_order')
    const penIds = (rows || []).map((r) => r.pen_id)
    const { data: penRows } = penIds.length
      ? await supabase.from('pens').select('id, name, type, parent_id').in('id', penIds)
      : { data: [] }
    const parentIds = [
      ...new Set(((penRows || []) as PenRow[]).map((p) => p.parent_id).filter((id): id is string => !!id)),
    ]
    const { data: shedRows } = parentIds.length
      ? await supabase.from('pens').select('id, name, type, parent_id').in('id', parentIds)
      : { data: [] }
    const allPens = [...(penRows || []), ...(shedRows || [])] as PenRow[]
    const nameById = new Map(((penRows || []) as PenRow[]).map((p) => [p.id, penLabel(p, allPens)]))
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
    let order = loadPens.length === 0 ? 0 : Math.max(...loadPens.map((p) => p.sort_order)) + 1
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
    await supabase.from('feed_load_pens').update({ daily_amount_kg: Number(kg) || 0 }).eq('id', id)
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

  const used = new Set(loadPens.map((lp) => lp.pen_id))
  const allGroups = groupPensByShed(pens as PenRow[])
  const shedGroups = {
    grouped: allGroups.grouped
      .map(({ shed, pens: inShed }) => ({ shed, pens: inShed.filter((p) => !used.has(p.id)) }))
      .filter((g) => g.pens.length > 0),
    ungrouped: allGroups.ungrouped.filter((p) => !used.has(p.id)),
  }
  const availablePens = [...shedGroups.grouped.flatMap((g) => g.pens), ...shedGroups.ungrouped]

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
          <p className="text-xs text-slate-500">
            The same programme can go on as many loads as you like. This load starts on its own
            today. Pause and day number stay on this load only.
          </p>
          {sqlHint && (
            <p className="text-sm text-amber-800">
              Run <span className="font-mono">013_load_program_clock.sql</span> in Supabase so
              loads keep separate clocks.
            </p>
          )}
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
                {(() => {
                  const prog = programs.find((p) => p.id === l.program_id)
                  if (!prog) return <span className="ml-2 text-xs text-slate-400">No programme</span>
                  const clock = loadClock(l)
                  const paused = clock.status === 'paused' || !!clock.paused_on
                  if (!clock.start_date) {
                    return (
                      <span className="ml-2 text-xs font-semibold text-slate-600">
                        \u00b7 {prog.name} \u00b7 waiting to start
                      </span>
                    )
                  }
                  const day = programmeClockDay(clock)
                  return (
                    <span className="ml-2 text-xs font-semibold text-slate-600">
                      \u00b7 {prog.name}
                      {paused ? ' \u00b7 paused' : ` \u00b7 day ${day}`}
                    </span>
                  )
                })()}
              </button>
              {(() => {
                const prog = programs.find((p) => p.id === l.program_id)
                if (!prog) return null
                const clock = loadClock(l)
                const paused = clock.status === 'paused' || !!clock.paused_on
                return paused ? (
                  <button
                    type="button"
                    onClick={() => startLoadClock(l)}
                    className="text-xs font-semibold text-green-800 border border-green-300 rounded-md px-2 py-1"
                  >
                    Start
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => pauseLoad(l)}
                    className="text-xs font-semibold text-amber-800 border border-amber-300 rounded-md px-2 py-1"
                  >
                    Pause
                  </button>
                )
              })()}
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
            <LoadProgramEditor
              name={editName}
              programId={editProgramId}
              startDate={editStartDate}
              programs={programs}
              onName={setEditName}
              onProgram={(id) => {
                setEditProgramId(id)
                if (id && id !== activeLoad.program_id) setEditStartDate(localISODate())
                if (!id) setEditStartDate('')
              }}
              onStartDate={setEditStartDate}
              onSave={saveLoadMeta}
            />
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
                            {selectedPenIds.has(p.id) ? '\u2713' : ''}
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
                          {selectedPenIds.has(p.id) ? '\u2713' : ''}
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
                    \u2191
                  </button>
                  <button type="button" className="text-xs" onClick={() => movePen(idx, 1)}>
                    \u2193
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
