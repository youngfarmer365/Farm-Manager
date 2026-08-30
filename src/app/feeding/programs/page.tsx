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
  start_date: string
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
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [phases, setPhases] = useState<PhaseRow[]>([
    { diet_id: '', steady_days: '14', transition_days: '7' },
    { diet_id: '', steady_days: '999', transition_days: '0' },
  ])
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [openPhases, setOpenPhases] = useState<any[]>([])

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

  async function createProgram(e: React.FormEvent) {
    e.preventDefault()
    if (!farmId) return
    setError(null)

    const valid = phases.filter((ph) => ph.diet_id)
    if (valid.length < 1) {
      setError('Add at least one phase with a diet')
      return
    }

    const { data: prog, error: pErr } = await supabase
      .from('feeding_programs')
      .insert({
        farm_id: farmId,
        name: name.trim() || 'Feeding programme',
        start_date: startDate,
        status: 'active',
        starter_days: Number(valid[0].steady_days) || 0,
        transition_days: Number(valid[0].transition_days) || 0,
        starter_diet_id: valid[0].diet_id,
        finisher_diet_id: valid[valid.length - 1].diet_id,
      })
      .select('id')
      .single()

    if (pErr || !prog) {
      setError(pErr?.message || 'Failed')
      return
    }

    const phaseRows = valid.map((ph, idx) => ({
      program_id: prog.id,
      sort_order: idx,
      diet_id: ph.diet_id,
      steady_days: Number(ph.steady_days) || 0,
      transition_days: idx === valid.length - 1 ? 0 : Number(ph.transition_days) || 0,
    }))

    const { error: phErr } = await supabase.from('program_phases').insert(phaseRows)
    if (phErr) setError(phErr.message)
    else {
      setName('')
      setPhases([
        { diet_id: '', steady_days: '14', transition_days: '7' },
        { diet_id: '', steady_days: '999', transition_days: '0' },
      ])
      await load()
    }
  }

  async function deleteProgram(id: string) {
    if (!confirm('Delete this programme and its phases?')) return
    await supabase.from('feeding_programs').delete().eq('id', id)
    if (openId === id) {
      setOpenId(null)
      setOpenPhases([])
    }
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
      <header className="bg-white border-b px-4 py-3">
        <div className="max-w-3xl mx-auto flex justify-between">
          <h1 className="text-xl font-bold">Feeding programmes</h1>
          <Link href="/feeding" className="text-sm text-slate-600 hover:underline">
            Feeding
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <p className="text-sm text-slate-600">
          Add phases in order. Each phase has days at 100% that diet, then optional transition into
          the next.
        </p>

        <form onSubmit={createProgram} className="bg-white rounded-xl border p-5 space-y-4 shadow-sm">
          <h2 className="font-semibold">New programme</h2>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name e.g. Shed block spring 2026"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <div>
            <label className="block text-xs mb-1">Start date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-medium">Phases (in order)</h3>
            {phases.map((ph, idx) => (
              <div key={idx} className="rounded-lg border border-slate-200 p-3 space-y-2 bg-slate-50">
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
                    <label className="block text-[10px] text-slate-500">
                      Transition days → next
                    </label>
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
              onClick={() =>
                setPhases([...phases, { diet_id: '', steady_days: '14', transition_days: '0' }])
              }
              className="text-xs text-brand-700 font-medium"
            >
              + Add phase / transition
            </button>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" className="rounded-lg bg-brand-600 text-white px-4 py-2 text-sm">
            Create programme
          </button>
        </form>

        <ul className="bg-white rounded-xl border divide-y shadow-sm">
          {programs.map((p) => (
            <li key={p.id} className="px-4 py-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <button type="button" onClick={() => viewPhases(p.id)} className="text-left flex-1">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-slate-500 ml-2 text-xs">from {p.start_date}</span>
                </button>
                <button
                  type="button"
                  onClick={() => deleteProgram(p.id)}
                  className="text-xs text-red-600 border border-red-200 rounded-md px-2 py-1 hover:bg-red-50 shrink-0"
                >
                  Delete
                </button>
              </div>
              {openId === p.id && (
                <ol className="mt-2 text-xs text-slate-600 space-y-1 list-decimal list-inside">
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