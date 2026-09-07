'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { getFarmAccess, hideFeedPrices } from '@/lib/farm-access'
import { recordIngredientPrice } from '@/lib/ingredient-prices'

interface Ingredient {
  id: string
  name: string
  unit: string
  cost_per_unit: number | null
  premix_diet_id: string | null
}

export default function IngredientsPage() {
  const [items, setItems] = useState<Ingredient[]>([])
  const [farmId, setFarmId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [cost, setCost] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [hidePrices, setHidePrices] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editCost, setEditCost] = useState('')
  const [editDate, setEditDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [busy, setBusy] = useState(false)
  const supabase = createClient()

  async function load() {
    const access = await getFarmAccess()
    if (!access.farmId) return
    setFarmId(access.farmId)
    setHidePrices(hideFeedPrices(access.role))
    const { data } = await supabase
      .from('ingredients')
      .select('*')
      .eq('farm_id', access.farmId)
      .eq('is_active', true)
      .order('name')
    setItems((data as Ingredient[]) || [])
  }

  useEffect(() => {
    load()
  }, [])

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!farmId || !name.trim()) return
    setError(null)
    const price = cost ? Number(cost) : 0
    const { data, error } = await supabase
      .from('ingredients')
      .insert({
        farm_id: farmId,
        name: name.trim(),
        unit: 'kg',
        cost_per_unit: price,
      })
      .select('id')
      .single()
    if (error) {
      setError(error.message)
      return
    }
    if (data?.id) {
      await recordIngredientPrice({
        farmId,
        ingredientId: data.id,
        costPerUnit: price,
        effectiveOn: new Date().toISOString().slice(0, 10),
        notes: 'Added',
      })
    }
    setName('')
    setCost('')
    await load()
  }

  function startEdit(i: Ingredient) {
    setEditing(i.id)
    setEditName(i.name)
    setEditCost(String(Number(i.cost_per_unit || 0)))
    setEditDate(new Date().toISOString().slice(0, 10))
    setError(null)
  }

  async function saveEdit(id: string) {
    if (!farmId || !editName.trim()) return
    setBusy(true)
    setError(null)
    const prev = items.find((x) => x.id === id)
    const { error } = await supabase.from('ingredients').update({ name: editName.trim() }).eq('id', id)
    if (error) {
      setBusy(false)
      setError(error.message)
      return
    }
    const nextPrice = Number(editCost)
    if (!hidePrices && prev && Number(prev.cost_per_unit || 0) !== nextPrice) {
      const priced = await recordIngredientPrice({
        farmId,
        ingredientId: id,
        costPerUnit: nextPrice,
        effectiveOn: editDate,
        notes: 'Price edit',
      })
      if (priced.error) {
        setBusy(false)
        setError(priced.error + ' — run 008_ingredient_prices.sql in Supabase.')
        return
      }
    }
    setBusy(false)
    setEditing(null)
    await load()
  }

  async function remove(id: string) {
    if (!confirm('Remove this ingredient from the list? Old feed runs keep their costs.')) return
    const { error } = await supabase.from('ingredients').update({ is_active: false }).eq('id', id)
    if (error) {
      setError(error.message)
      return
    }
    await load()
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white px-4 py-3">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-bold">Ingredients</h1>
          <div className="flex gap-3">
            <Link href="/feeding/prices" className="text-sm font-semibold text-brand-800 underline">
              Price history
            </Link>
            <Link href="/feeding" className="text-sm text-slate-600 hover:underline">
              Feeding
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <form onSubmit={add} className="space-y-3 rounded-xl border bg-white p-5 shadow-sm">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          {!hidePrices && (
            <input
              type="number"
              step="0.0001"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="€ / kg"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white">
            Add ingredient
          </button>
        </form>

        <ul className="divide-y rounded-xl border bg-white shadow-sm">
          {items.length === 0 && (
            <li className="px-4 py-6 text-sm text-slate-500">No ingredients yet.</li>
          )}
          {items.map((i) => (
            <li key={i.id} className="px-4 py-3 text-sm">
              {editing === i.id ? (
                <div className="space-y-2">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2"
                  />
                  {!hidePrices && (
                    <>
                      <label className="block text-xs font-semibold text-slate-600">
                        New € / kg (old loads keep the old price)
                      </label>
                      <input
                        type="number"
                        step="0.0001"
                        value={editCost}
                        onChange={(e) => setEditCost(e.target.value)}
                        className="w-full rounded-md border border-slate-300 px-3 py-2"
                      />
                      <label className="block text-xs font-semibold text-slate-600">Takes effect from</label>
                      <input
                        type="date"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        className="w-full rounded-md border border-slate-300 px-3 py-2"
                      />
                    </>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => saveEdit(i.id)}
                      className="rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button type="button" onClick={() => setEditing(null)} className="rounded-lg border px-3 py-1.5 text-xs">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="font-medium">{i.name}</span>
                    {i.premix_diet_id && <span className="ml-2 text-xs text-slate-400">(premix)</span>}
                    {!hidePrices && (
                      <span className="ml-2 text-slate-500">
                        €{Number(i.cost_per_unit || 0).toFixed(4)}/kg
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(i)}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold hover:bg-slate-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(i.id)}
                      className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}
