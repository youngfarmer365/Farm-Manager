'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Medicine {
  id: string
  name: string
  active_ingredient: string | null
  default_withdrawal_days: number
  default_cost: number | null
  notes: string | null
  is_active: boolean
}

export default function MedicinesPage() {
  const [medicines, setMedicines] = useState<Medicine[]>([])
  const [farmId, setFarmId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [ingredient, setIngredient] = useState('')
  const [withdrawal, setWithdrawal] = useState('0')
  const [costPerMl, setCostPerMl] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

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

    const { data } = await supabase
      .from('medicines')
      .select('*')
      .eq('farm_id', membership.farm_id)
      .order('name')

    setMedicines((data as Medicine[]) || [])
  }

  useEffect(() => {
    load()
  }, [])

  async function addMedicine(e: React.FormEvent) {
    e.preventDefault()
    if (!farmId || !name.trim()) return
    setLoading(true)
    setError(null)

    const { error } = await supabase.from('medicines').insert({
      farm_id: farmId,
      name: name.trim(),
      active_ingredient: ingredient.trim() || null,
      default_withdrawal_days: Number(withdrawal) || 0,
      default_cost: costPerMl ? Number(costPerMl) : null,
      notes: notes.trim() || null,
      is_active: true,
    })

    if (error) {
      setError(error.message)
    } else {
      setName('')
      setIngredient('')
      setWithdrawal('0')
      setCostPerMl('')
      setNotes('')
      await load()
    }
    setLoading(false)
  }

  async function removeMedicine(id: string) {
    if (!confirm('Remove this medicine from the catalogue?')) return
    await supabase.from('medicines').delete().eq('id', id)
    await load()
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold">Medicines</h1>
          <div className="flex gap-3 text-sm">
            <Link href="/medicines/treat" className="text-brand-700 font-medium hover:underline">
              Record treatments
            </Link>
            <Link href="/animals" className="text-slate-600 hover:underline">
              Animals
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <form onSubmit={addMedicine} className="bg-white rounded-xl border p-6 space-y-4 shadow-sm">
          <h2 className="font-semibold">Add medicine / remedy</h2>
          <div>
            <label className="block text-sm font-medium mb-1">Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="e.g. Cydectin, Alamycin LA"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Active ingredient</label>
            <input
              type="text"
              value={ingredient}
              onChange={(e) => setIngredient(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Default withdrawal (days) *</label>
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
              <label className="block text-sm font-medium mb-1">Cost (€ / ml) *</label>
              <input
                type="number"
                step="0.0001"
                min="0"
                required
                value={costPerMl}
                onChange={(e) => setCostPerMl(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="e.g. 0.35"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Treatment cost = (€/ml) × (ml given to the animal)
              </p>
            </div>
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
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? 'Adding…' : 'Add medicine'}
          </button>
        </form>

        <div className="bg-white rounded-xl border shadow-sm">
          <div className="px-4 py-3 border-b font-medium">Catalogue</div>
          {medicines.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">No medicines added yet.</p>
          ) : (
            <ul className="divide-y">
              {medicines.map((m) => (
                <li key={m.id} className="px-4 py-3 flex items-center justify-between gap-3 text-sm">
                  <div>
                    <div className="font-medium">{m.name}</div>
                    <div className="text-xs text-slate-500">
                      Withdrawal {m.default_withdrawal_days} days
                      {m.default_cost != null && ` · €${Number(m.default_cost).toFixed(4)}/ml`}
                      {m.active_ingredient && ` · ${m.active_ingredient}`}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeMedicine(m.id)}
                    className="text-red-600 hover:underline text-xs"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  )
}