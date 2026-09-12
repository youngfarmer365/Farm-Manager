'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { adjustStock } from '@/lib/feed-stock'

interface Row {
  ingredient_id: string
  name: string
  quantity_kg: number
  avg_daily_kg: number
  days_left: number | null
  isPremix: boolean
}

export default function StockPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [farmId, setFarmId] = useState<string | null>(null)
  const [ingredients, setIngredients] = useState<
    { id: string; name: string; premix_diet_id: string | null }[]
  >([])
  const [ingId, setIngId] = useState('')
  const [qty, setQty] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const currentKg = rows.find((r) => r.ingredient_id === ingId)?.quantity_kg ?? 0
  const addKg = Number(qty) || 0

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

    const { data: ings } = await supabase
      .from('ingredients')
      .select('id, name, premix_diet_id')
      .eq('farm_id', membership.farm_id)
      .eq('is_active', true)
      .order('name')
    setIngredients(ings || [])

    const { data: stock } = await supabase
      .from('feed_stock')
      .select('ingredient_id, quantity_kg')
      .eq('farm_id', membership.farm_id)

    const since = new Date()
    since.setHours(0, 0, 0, 0)
    since.setDate(since.getDate() - 6)
    const { data: runs } = await supabase
      .from('feed_runs')
      .select('id, finished_at')
      .eq('farm_id', membership.farm_id)
      .gte('finished_at', since.toISOString())

    const runIds = (runs || []).map((r) => r.id)
    const usage: Record<string, number> = {}
    function addUse(id: string | null | undefined, kg: number) {
      if (!id || !(kg > 0)) return
      usage[id] = (usage[id] || 0) + kg
    }

    const premixDietIds = (ings || []).map((i) => i.premix_diet_id).filter(Boolean) as string[]
    const recipeByDiet = new Map<string, { ingredient_id: string; percent: number }[]>()
    if (premixDietIds.length) {
      const { data: rec } = await supabase
        .from('diet_ingredients')
        .select('diet_id, ingredient_id, percent')
        .in('diet_id', premixDietIds)
      for (const row of rec || []) {
        const list = recipeByDiet.get(row.diet_id) || []
        list.push({ ingredient_id: row.ingredient_id, percent: Number(row.percent) || 0 })
        recipeByDiet.set(row.diet_id, list)
      }
    }
    const premixDietByIng = new Map(
      (ings || []).filter((i) => i.premix_diet_id).map((i) => [i.id, i.premix_diet_id as string])
    )

    if (runIds.length) {
      const { data: used } = await supabase
        .from('feed_run_ingredients')
        .select('ingredient_id, kg')
        .in('run_id', runIds)
      for (const u of used || []) {
        const kg = Number(u.kg) || 0
        addUse(u.ingredient_id, kg)
        const dietId = u.ingredient_id ? premixDietByIng.get(u.ingredient_id) : null
        if (dietId) {
          for (const line of recipeByDiet.get(dietId) || []) {
            addUse(line.ingredient_id, (kg * line.percent) / 100)
          }
        }
      }
    }

    const daysSpan = 7
    const stockMap = new Map((stock || []).map((s) => [s.ingredient_id, Number(s.quantity_kg)]))
    const list: Row[] = (ings || []).map((ing) => {
      const q = stockMap.get(ing.id) ?? 0
      const totalUsed = usage[ing.id] || 0
      const avg = totalUsed / daysSpan
      const days_left = avg > 0 ? q / avg : null
      return {
        ingredient_id: ing.id,
        name: ing.name,
        quantity_kg: q,
        avg_daily_kg: avg,
        days_left,
        isPremix: !!ing.premix_diet_id,
      }
    })
    setRows(list)
  }

  useEffect(() => {
    load()
  }, [])

  async function addLoad(e: React.FormEvent) {
    e.preventDefault()
    if (!farmId || !ingId || addKg === 0) return
    setBusy(true)
    setError(null)
    const { error: err } = await adjustStock(farmId, ingId, addKg)
    setBusy(false)
    if (err) {
      setError(err)
      return
    }
    setQty('')
    await load()
  }

  async function setExact() {
    if (!farmId || !ingId) return
    const next = Number(qty)
    if (Number.isNaN(next)) return
    if (!confirm('Replace on-hand with ' + next + ' kg? This does not add to current stock.')) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.from('feed_stock').upsert(
      {
        farm_id: farmId,
        ingredient_id: ingId,
        quantity_kg: Math.max(0, next),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'farm_id,ingredient_id' }
    )
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    setQty('')
    await load()
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b px-4 py-3">
        <div className="max-w-3xl mx-auto flex justify-between">
          <h1 className="text-xl font-bold">Feed stock</h1>
          <Link href="/feeding" className="text-sm text-slate-600 hover:underline">
            Feeding
          </Link>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <p className="text-sm text-slate-600">
          On hand is bags in the bay. Premix mix takes ingredients off and puts finished premix on.
          A feeding run takes off whatever went in the wagon, including both diets when a programme
          is blending. Days left uses the last 7 calendar days of feeding (premix recipes exploded
          so starter inside a premix counts).
        </p>

        <form onSubmit={addLoad} className="bg-white rounded-xl border p-4 flex flex-wrap gap-2 items-end shadow-sm">
          <div className="flex-1 min-w-[10rem]">
            <label className="block text-xs mb-1">Ingredient</label>
            <select
              value={ingId}
              onChange={(e) => setIngId(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              required
            >
              <option value="">…</option>
              {ingredients.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                  {i.premix_diet_id ? ' (premix)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1">Add load (kg)</label>
            <input
              type="number"
              step="0.1"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="w-32 rounded-md border border-slate-300 px-3 py-2 text-sm"
              required
            />
          </div>
          <button
            type="submit"
            disabled={busy || !ingId}
            className="rounded-lg bg-brand-600 text-white px-4 py-2 text-sm disabled:opacity-50"
          >
            Add to stock
          </button>
          <button
            type="button"
            disabled={busy || !ingId}
            onClick={setExact}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:opacity-50"
          >
            Set exact kg
          </button>
          {ingId ? (
            <p className="w-full text-xs text-slate-600">
              On hand now: <strong>{currentKg.toFixed(0)} kg</strong>
              {addKg !== 0 ? (
                <>
                  {' '}
                  → after add: <strong>{(currentKg + addKg).toFixed(0)} kg</strong>
                </>
              ) : null}
            </p>
          ) : null}
          {error && <p className="w-full text-sm text-red-600">{error}</p>}
        </form>

        <table className="w-full text-sm bg-white rounded-xl border shadow-sm overflow-hidden">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-3 py-2">Ingredient</th>
              <th className="px-3 py-2">On hand</th>
              <th className="px-3 py-2">Avg kg/day (7d)</th>
              <th className="px-3 py-2">Days left</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.ingredient_id} className="border-t">
                <td className="px-3 py-2 font-medium">
                  {r.name}
                  {r.isPremix ? <span className="ml-2 text-xs text-slate-400">premix</span> : null}
                </td>
                <td className="px-3 py-2">{r.quantity_kg.toFixed(0)} kg</td>
                <td className="px-3 py-2">{r.avg_daily_kg.toFixed(1)}</td>
                <td className="px-3 py-2">{r.days_left == null ? '—' : r.days_left.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </div>
  )
}
