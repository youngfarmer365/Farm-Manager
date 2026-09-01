'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Medicine {
  id: string
  name: string
  default_withdrawal_days: number
  default_cost: number | null
}

interface AnimalRow {
  id: string
  tag: string
  breed: string | null
  group_name: string | null
  pen_name: string | null
}

export default function TreatPage() {
  const [medicines, setMedicines] = useState<Medicine[]>([])
  const [animals, setAnimals] = useState<AnimalRow[]>([])
  const [farmId, setFarmId] = useState<string | null>(null)
  const [medicineId, setMedicineId] = useState('')
  const [treatedAt, setTreatedAt] = useState(new Date().toISOString().slice(0, 10))
  const [withdrawal, setWithdrawal] = useState('0')
  const [costPerMl, setCostPerMl] = useState('')
  const [mlUsed, setMlUsed] = useState('')
  const [batchRef, setBatchRef] = useState('')
  const [notes, setNotes] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const costPerAnimal = useMemo(() => {
    const rate = Number(costPerMl)
    const ml = Number(mlUsed)
    if (!rate || !ml || rate < 0 || ml < 0) return null
    return Number((rate * ml).toFixed(2))
  }, [costPerMl, mlUsed])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: membership } = await supabase
        .from('farm_members')
        .select('farm_id')
        .eq('user_id', user.id)
        .limit(1)
        .single()

      if (!membership) return
      setFarmId(membership.farm_id)

      const [{ data: meds }, { data: anims }] = await Promise.all([
        supabase
          .from('medicines')
          .select('id, name, default_withdrawal_days, default_cost')
          .eq('farm_id', membership.farm_id)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('animals_enriched')
          .select('id, tag, breed, group_name, pen_name')
          .eq('farm_id', membership.farm_id)
          .eq('status', 'active')
          .order('tag'),
      ])

      setMedicines((meds as Medicine[]) || [])
      setAnimals((anims as AnimalRow[]) || [])
    }
    load()
  }, [])

  function onMedicineChange(id: string) {
    setMedicineId(id)
    const m = medicines.find((x) => x.id === id)
    if (m) {
      setWithdrawal(String(m.default_withdrawal_days ?? 0))
      setCostPerMl(m.default_cost != null ? String(m.default_cost) : '')
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const filtered = animals.filter((a) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      a.tag.toLowerCase().includes(q) ||
      (a.breed || '').toLowerCase().includes(q) ||
      (a.group_name || '').toLowerCase().includes(q) ||
      (a.pen_name || '').toLowerCase().includes(q)
    )
  })

  function selectFiltered() {
    setSelected((prev) => {
      const next = new Set(prev)
      for (const a of filtered) next.add(a.id)
      return next
    })
  }

  function clearSelection() {
    setSelected(new Set())
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!farmId || !medicineId || selected.size === 0) {
      setError('Choose a medicine and at least one animal')
      return
    }
    if (!mlUsed || Number(mlUsed) <= 0) {
      setError('Enter ml used per animal')
      return
    }

    const med = medicines.find((m) => m.id === medicineId)
    if (!med) return

    setLoading(true)
    setError(null)
    setMessage(null)

    const { data: { user } } = await supabase.auth.getUser()
    const ml = Number(mlUsed)
    const rate = Number(costPerMl) || 0
    const totalCost = Number((rate * ml).toFixed(2))

    const rows = Array.from(selected).map((animalId) => ({
      farm_id: farmId,
      animal_id: animalId,
      medicine_id: medicineId,
      medicine_name: med.name,
      treated_at: treatedAt,
      withdrawal_days: Number(withdrawal) || 0,
      cost: totalCost,
      ml_used: ml,
      dose: `${ml} ml`,
      batch_ref: batchRef.trim() || null,
      notes: notes.trim() || null,
      created_by: user?.id || null,
    }))

    const { error } = await supabase.from('treatments').insert(rows)

    if (error) {
      setError(error.message)
    } else {
      setMessage(
        `Recorded ${rows.length} treatment(s) · ${ml} ml each · €${totalCost.toFixed(2)} each` +
          (rows.length > 1 ? ` · €${(totalCost * rows.length).toFixed(2)} total` : '')
      )
      setSelected(new Set())
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold">Record treatments</h1>
          <Link href="/medicines" className="text-sm text-slate-600 hover:underline">
            Medicine catalogue
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <form onSubmit={save} className="bg-white rounded-xl border p-6 space-y-4 shadow-sm">
          <div>
            <label className="block text-sm font-medium mb-1">Medicine *</label>
            <select
              required
              value={medicineId}
              onChange={(e) => onMedicineChange(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select…</option>
              {medicines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.default_cost != null ? ` · €${Number(m.default_cost).toFixed(4)}/ml` : ''}
                  {` · ${m.default_withdrawal_days}d withdrawal`}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Treatment date *</label>
              <input
                type="date"
                required
                value={treatedAt}
                onChange={(e) => setTreatedAt(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Withdrawal (days) *</label>
              <input
                type="number"
                min="0"
                required
                value={withdrawal}
                onChange={(e) => setWithdrawal(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Cost (€ / ml)</label>
              <input
                type="number"
                step="0.0001"
                min="0"
                value={costPerMl}
                onChange={(e) => setCostPerMl(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Ml used (per animal) *</label>
              <input
                type="number"
                step="0.1"
                min="0"
                required
                value={mlUsed}
                onChange={(e) => setMlUsed(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="e.g. 12"
              />
            </div>
          </div>

          <div className="rounded-md bg-slate-50 border border-slate-200 px-3 py-2 text-sm">
            Cost per animal:{' '}
            <span className="font-semibold">
              {costPerAnimal != null ? `€${costPerAnimal.toFixed(2)}` : '—'}
            </span>
            {costPerAnimal != null && selected.size > 0 && (
              <span className="text-slate-500 ml-2">
                · batch total €{(costPerAnimal * selected.size).toFixed(2)}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Batch / bottle ref</label>
              <input
                type="text"
                value={batchRef}
                onChange={(e) => setBatchRef(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {message && <p className="text-sm text-green-700">{message}</p>}

          <button
            type="submit"
            disabled={loading || selected.size === 0}
            className="rounded-lg bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? 'Saving…' : `Save for ${selected.size} animal(s)`}
          </button>
        </form>

        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b flex flex-wrap gap-2 items-center">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tag, group, pen…"
              className="flex-1 min-w-[12rem] rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
                        <button
              type="button"
              onClick={selectFiltered}
              disabled={filtered.length === 0}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
            >
              Select all {filtered.length}
            </button>
            <button
              type="button"
              onClick={clearSelection}
              disabled={selected.size === 0}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
            >
              Clear
            </button>
            <span className="text-xs text-slate-500">{selected.size} selected</span>
          </div>
          <div className="max-h-96 overflow-y-auto">
            <ul className="divide-y">
              {filtered.map((a) => {
                const on = selected.has(a.id)
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => toggle(a.id)}
                      className={`w-full px-4 py-2.5 flex items-center gap-3 text-sm text-left ${
                        on ? 'bg-brand-50 hover:bg-brand-100' : 'hover:bg-slate-50'
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                          on ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300'
                        }`}
                      >
                        {on && (
                          <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none">
                            <path
                              d="M3 7.5L6 10.5L11 3.5"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </span>
                      <div>
                        <span className="font-mono font-medium">{a.tag}</span>
                        <div className="text-xs text-slate-400">
                          {a.group_name || 'No group'} · {a.pen_name || 'No pen'}
                        </div>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </main>
    </div>
  )
}
