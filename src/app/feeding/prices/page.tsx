'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getFarmAccess, hideFeedPrices } from '@/lib/farm-access'

type Ingredient = { id: string; name: string; cost_per_unit: number | null }
type Price = {
  id: string
  ingredient_id: string
  cost_per_unit: number
  effective_on: string
  notes: string | null
}

export default function IngredientPricesPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [prices, setPrices] = useState<Price[]>([])
  const [filterId, setFilterId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [hidePrices, setHidePrices] = useState(false)

  useEffect(() => {
    getFarmAccess().then(async (a) => {
      if (!a.farmId) return
      setHidePrices(hideFeedPrices(a.role))
      const supabase = createClient()
      const [{ data: ings }, { data: hist, error: he }] = await Promise.all([
        supabase
          .from('ingredients')
          .select('id, name, cost_per_unit')
          .eq('farm_id', a.farmId)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('ingredient_prices')
          .select('id, ingredient_id, cost_per_unit, effective_on, notes')
          .eq('farm_id', a.farmId)
          .order('effective_on', { ascending: false }),
      ])
      if (he) setError(he.message)
      setIngredients((ings as Ingredient[]) || [])
      setPrices((hist as Price[]) || [])
    })
  }, [])

  const rows = useMemo(() => {
    const nameOf = (id: string) => ingredients.find((i) => i.id === id)?.name || 'Ingredient'
    return prices
      .filter((p) => !filterId || p.ingredient_id === filterId)
      .map((p) => ({
        ...p,
        name: nameOf(p.ingredient_id),
      }))
  }, [prices, ingredients, filterId])

  const byIng = useMemo(() => {
    return ingredients.map((i) => {
      const hist = prices
        .filter((p) => p.ingredient_id === i.id)
        .sort((a, b) => (a.effective_on < b.effective_on ? -1 : 1))
      const first = hist[0]
      const last = hist[hist.length - 1]
      const change =
        first && last && Number(first.cost_per_unit) !== 0
          ? ((Number(last.cost_per_unit) - Number(first.cost_per_unit)) / Number(first.cost_per_unit)) * 100
          : null
      return { ...i, hist, change }
    })
  }, [ingredients, prices])

  if (hidePrices) {
    return (
      <div className="p-8 text-center font-semibold text-slate-700">
        Prices are hidden for this login.{' '}
        <Link href="/feeding" className="underline">
          Back
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white px-4 py-3">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-bold">Ingredient prices</h1>
          <div className="flex gap-3">
            <Link href="/feeding/ingredients" className="text-sm font-semibold text-brand-800 underline">
              Ingredients
            </Link>
            <Link href="/feeding" className="text-sm text-slate-600 hover:underline">
              Feeding
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <p className="text-sm font-semibold text-slate-600">
          A price change only applies from the date you set. Completed loads keep the euro figure they were saved with.
        </p>
        {error && (
          <p className="font-semibold text-red-700">
            {error}. Run 008_ingredient_prices.sql in Supabase if this table is missing.
          </p>
        )}

        <label className="block text-sm font-bold">
          Ingredient
          <select
            value={filterId}
            onChange={(e) => setFilterId(e.target.value)}
            className="mt-1 min-h-[44px] w-full rounded-xl border-2 border-slate-400 bg-white px-3"
          >
            <option value="">All ingredients</option>
            {ingredients.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </label>

        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {byIng
            .filter((i) => !filterId || i.id === filterId)
            .map((i) => (
              <li key={i.id} className="rounded-xl border bg-white p-3">
                <div className="font-bold">{i.name}</div>
                <div className="text-sm text-slate-600">
                  Now €{Number(i.cost_per_unit || 0).toFixed(4)}/kg
                  {i.change != null ? ` · ${i.change >= 0 ? '+' : ''}${i.change.toFixed(0)}% vs first recorded` : ''}
                </div>
                <div className="mt-1 text-xs text-slate-500">{i.hist.length} price point{i.hist.length === 1 ? '' : 's'}</div>
              </li>
            ))}
        </ul>

        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">From</th>
                <th className="px-3 py-2">Ingredient</th>
                <th className="px-3 py-2">€ / kg</th>
                <th className="px-3 py-2">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-slate-500">
                    No price history yet. Edit an ingredient price to start the log.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-3 py-2 font-semibold">{r.effective_on}</td>
                  <td className="px-3 py-2">{r.name}</td>
                  <td className="px-3 py-2 font-mono">€{Number(r.cost_per_unit).toFixed(4)}</td>
                  <td className="px-3 py-2 text-slate-500">{r.notes || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
