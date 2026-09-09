'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Diet {
  id: string
  name: string
  diet_type: string
}

interface Program {
  id: string
  name: string
  start_date: string | null
  status: string
}

interface PhaseRow {
  diet_id: string
  steady_days: string
  transition_days: string
}

export default function ProgramsPage() {
  const [programs, setPrograms] = useState<Program[]>([])
  const [diets, setDiets] = useState<Diet[]>([])
  const [farmId, setFarmId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [phases, setPhases] = useState<PhaseRow[]>([
    { diet_id: '', steady_days: '14', transition_days: '7' },
    { diet_id: '', steady_days: '999', transition_days: '0' },
  ])
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [openPhases, setOpenPhases] = useState<any[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const supabase = createClient()

  async function load() {
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

    const [{ data: p }, { data: d }] = await Promise.all([
      supabase
        .from('feeding_programs')
        .select('id, name, start_date, status')
        .eq('farm_id', membership.farm_id)
        .order('created_at', { ascending: false }),
      supabase
        .from('diets')
        .select('id, name, diet_type')
        .eq('farm_id', membership.farm_id)
        .eq('is_active', true)
        .neq('diet_type', 'premix')
        .order('name'),
    ])
    setPrograms((p as Program[]) || [])
    setDiets((d as Diet[]) || [])
  }

  useEffect(() => {
    load()
  }, [])

  function resetForm() {
    setEditingId(null)
    setName('')
    setStartDate('')
    setPhases([
      { diet_id: '', steady_days: '14', transition_days: '7' },
      { diet_id: '', steady_days: '999', transition_days: '0' },
    ])
    setError(null)
  }

  async function startEdit(p: Program) {
    setEditingId(p.id)
    setName(p.name)
    setStartDate(p.start_date || '')
    setOpenId(p.id)
    const { data } = await supabase
      .from('program_phases')
      .select('sort_order, steady_days, transition_days, diet_id, diets(name)')
      .eq('program_id', p.id)
      .order('sort_order')
    setOpenPhases(data || [])
    const next = (data || []).map((ph: any) => ({
      diet_id: ph.diet_id,
      steady_days: String(ph.steady_days ?? 0),
      transition_days: String(ph.transition_days ?? 0),
    }))
    setPhases(next.length ? next : [{ diet_id: '', steady_days: '14', transition_days: '0' }])
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function saveProgram(e: React.FormEvent) {
    e.preventDefault()
    if (!farmId) return
    setError(null)
    const valid = phases.filter((ph) => ph.diet_id)
    if (valid.length < 1) {
      setError('Add at least one phase with a diet')
      return
    }
    const header: Record<string, unknown> = {
      name: name.trim() || 'Feeding programme',
      starter_days: Number(valid[0].steady_days) || 0,
      transition_days: Number(valid[0].transition_days) || 0,
      starter_diet_id: valid[0].diet_id,
      finisher_diet_id: valid[valid.length - 1].diet_id,
    }
    if (startDate) header.start_date = startDate
    else if (!editingId) header.start_date = null
    const phaseRows = valid.map((ph, idx) => ({
      sort_order: idx,
      diet_id: ph.diet_id,
      steady_days: Number(ph.steady_days) || 0,
      transition_days: idx === valid.length - 1 ? 0 : Number(ph.transition_days) || 0,
    }))
    setBusy(true)
    if (editingId) {
      const { error: uErr } = await supabase.from('feeding_programs').update(header).eq('id', editingId)
      if (uErr) {
        setBusy(false)
        setError(
          uErr.message.includes('null')
            ? uErr.message + ' — run 012_program_start_optional.sql in Supabase.'
            : uErr.message
        )
        return
      }
      await supabase.from('program_phases').delete().eq('program_id', editingId)
      const { error: phErr } = await supabase.from('program_phases').insert(
        phaseRows.map((r) => ({ ...r, program_id: editingId }))
      )
      setBusy(false)
      if (phErr) {
        setError(phErr.message)
        return
      }
      resetForm()
      await load()
      return
    }
    const { data: prog, error: pErr } = await supabase
      .from('feeding_programs')
      .insert({
        farm_id: farmId,
        status: 'active',
        ...header,
      })
      .select('id')
      .single()
    if (pErr || !prog) {
      setBusy(false)
      setError(
        pErr?.message
          ? pErr.message.includes('null')
            ? pErr.message + ' — run 012_program_start_optional.sql in Supabase.'
            : pErr.message
          : 'Failed'
      )
      return
    }
    const { error: phErr } = await supabase.from('program_phases').insert(
      phaseRows.map((r) => ({ ...r, program_id: prog.id }))
    )
    setBusy(false)
    if (phErr) setError(phErr.message)
    else {
      resetForm()
      await load()
    }
  }

  async function deleteProgram(id: string) {
    if (!confirm('Delete this programme? Completed loads keep what they used that day.')) return
    await supabase.from('feeding_programs').delete().eq('id', id)
    if (openId === id) {
      setOpenId(null)
      setOpenPhases([])
    }
    if (editingId === id) resetForm()
    await load()
  }

  async function viewPhases(programId: string) {
    setOpenId(programId)
    const { data } = await supabase
      .from('program_phases')
      .select('sort_order, steady_days, transition_days, diet_id, diets(name)')
      .eq('program_id', programId)
      .order('sort_order')
    setOpenPhases(data || [])
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white px-4 py-3">
        <div className="mx-auto flex max-w-3xl justify-between">
          <h1 className="text-xl font-bold">Feeding programmes</h1>
          <Link href="/feeding" className="text-sm text-slate-600 hover:underline">
            Feeding
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <p className="text-sm text-slate-600">
          Set the diets and days here. Leave the start date blank — the cycle begins the day you
          put this programme on a load.
        </p>

        <form onSubmit={saveProgram} className="space-y-4 rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="font-semibold">{editingId ? 'Edit programme' : 'New programme'}</h2>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name e.g. Shed block spring 2026"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <div>
            <label className="mb-1 block text-xs">Start date (optional)</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-slate-500">
              Leave blank to start the clock when this programme is added to a load.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-medium">Phases (in order)</h3>
            {phases.map((ph, idx) => (
              <div key={idx} className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-medium text-slate-500">Phase {idx + 1}</div>
                <select
                  value={ph.diet_id}
                  onChange={(e) => {
                    const next = [...phases]
                    next[idx] = { ...next[idx], diet_id: e.target.value }
                    setPhases(next)
                  }}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Diet…</option>
                  {diets.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-500">Days at 100%</label>
                    <input
                      type="number"
                      min="0"
                      value={ph.steady_days}
                      onChange={(e) => {
                        const next = [...phases]
                        next[idx] = { ...next[idx], steady_days: e.target.value }
                        setPhases(next)
                      }}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500">Transition days → next</label>
                    <input
                      type="number"
                      min="0"
                      value={ph.transition_days}
                      onChange={(e) => {
                        const next = [...phases]
                        next[idx] = { ...next[idx], transition_days: e.target.value }
                        setPhases(next)
                      }}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      disabled={idx === phases.length - 1}
                    />
                  </div>
                </div>
                {phases.length > 1 && (
                  <button
                    type="button"
                    className="text-xs text-red-600"
                    onClick={() => setPhases(phases.filter((_, i) => i !== idx))}
                  >
                    Remove phase
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setPhases([...phases, { diet_id: '', steady_days: '14', transition_days: '0' }])}
              className="text-xs font-medium text-brand-700"
            >
              + Add phase / transition
            </button>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white disabled:opacity-50">
              {editingId ? 'Save changes' : 'Create programme'}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="rounded-lg border px-4 py-2 text-sm">
                Cancel
              </button>
            )}
          </div>
        </form>

        <ul className="divide-y rounded-xl border bg-white shadow-sm">
          {programs.map((p) => (
            <li key={p.id} className="px-4 py-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <button type="button" onClick={() => viewPhases(p.id)} className="flex-1 text-left">
                  <span className="font-medium">{p.name}</span>
                  <span className="ml-2 text-xs text-slate-500">
                    {p.start_date ? `from ${p.start_date}` : 'starts when added to a load'}
                  </span>
                </button>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(p)}
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteProgram(p.id)}
                    className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
              {openId === p.id && (
                <ol className="mt-2 list-inside list-decimal space-y-1 text-xs text-slate-600">
                  {openPhases.map((ph: any, i: number) => (
                    <li key={i}>
                      {ph.diets?.name || ph.diet_id}: {ph.steady_days}d steady
                      {ph.transition_days > 0 ? ` → ${ph.transition_days}d transition` : ''}
                    </li>
                  ))}
                </ol>
              )}
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}
