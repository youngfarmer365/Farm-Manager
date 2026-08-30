'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { getFarmAccess, hideFeedPrices } from '@/lib/farm-access'

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
    const { error } = await supabase.from('ingredients').insert({
      farm_id: farmId,
      name: name.trim(),
      unit: 'kg',
      cost_per_unit: cost ? Number(cost) : 0,
    })
    if (error) setError(error.message)
    else {
      setName('')
      setCost('')
      await load()
    }
  }

  async function remove(id: string) {
    if (!confirm('Remove this ingredient?')) return
    await supabase.from('ingredients').update({ is_active: false }).eq('id', id)
    await load()
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b px-4 py-3">
        <div className="max-w-2xl mx-auto flex justify-between">
          <h1 className="text-xl font-bold">Ingredients</h1>
          <Link href="/feeding" className="text-sm text-slate-600 hover:underline">
            Feeding
          </Link>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <form onSubmit={add} className="bg-white rounded-xl border p-5 space-y-3 shadow-sm">
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
          <button type="submit" className="rounded-lg bg-brand-600 text-white px-4 py-2 text-sm">
            Add ingredient
          </button>
        </form>

        <ul className="bg-white rounded-xl border divide-y shadow-sm">
          {items.map((i) => (
            <li key={i.id} className="px-4 py-3 flex justify-between items-center text-sm gap-3">
              <div>
                <span className="font-medium">{i.name}</span>
                {i.premix_diet_id && (
                  <span className="text-xs text-slate-400 ml-2">(premix)</span>
                )}
                {!hidePrices && (
                  <span className="text-slate-500 ml-2">
                    €{Number(i.cost_per_unit || 0).toFixed(4)}/kg
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => remove(i.id)}
                className="text-xs text-red-600 border border-red-200 rounded-md px-2 py-1 hover:bg-red-50"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}