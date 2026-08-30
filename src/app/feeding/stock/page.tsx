'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Row {
  ingredient_id: string
  name: string
  quantity_kg: number
  avg_daily_kg: number
  days_left: number | null
}

export default function StockPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [farmId, setFarmId] = useState<string | null>(null)
  const [ingredients, setIngredients] = useState<{ id: string; name: string }[]>([])
  const [ingId, setIngId] = useState('')
  const [qty, setQty] = useState('')
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

    const { data: ings } = await supabase
      .from('ingredients')
      .select('id, name')
      .eq('farm_id', membership.farm_id)
      .eq('is_active', true)
      .order('name')
    setIngredients(ings || [])

    const { data: stock } = await supabase
      .from('feed_stock')
      .select('ingredient_id, quantity_kg')
      .eq('farm_id', membership.farm_id)

    // Average daily use from last 14 days of completed runs
    const since = new Date()
    since.setDate(since.getDate() - 14)
    const { data: runs } = await supabase
      .from('feed_runs')
      .select('id, finished_at')
      .eq('farm_id', membership.farm_id)
      .gte('finished_at', since.toISOString())

    const runIds = (runs || []).map((r) => r.id)
    let usage: Record<string, number> = {}
    if (runIds.length) {
      const { data: used } = await supabase
        .from('feed_run_ingredients')
        .select('ingredient_id, kg')
        .in('run_id', runIds)
      for (const u of used || []) {
        if (!u.ingredient_id) continue
        usage[u.ingredient_id] = (usage[u.ingredient_id] || 0) + Number(u.kg)
      }
    }
    const daysSpan = Math.max(1, Math.min(14, runIds.length || 1))

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
      }
    })
    setRows(list)
  }

  useEffect(() => {
    load()
  }, [])

  async function setStock(e: React.FormEvent) {
    e.preventDefault()
    if (!farmId || !ingId) return
    await supabase.from('feed_stock').upsert(
      {
        farm_id: farmId,
        ingredient_id: ingId,
        quantity_kg: Number(qty) || 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'farm_id,ingredient_id' }
    )
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
          Set on-hand kg. Each completed load deducts ingredient use. Days left uses average use from
          recent completed loads.
        </p>

        <form onSubmit={setStock} className="bg-white rounded-xl border p-4 flex flex-wrap gap-2 items-end shadow-sm">
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
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1">On hand (kg)</label>
            <input
              type="number"
              step="0.1"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="w-32 rounded-md border border-slate-300 px-3 py-2 text-sm"
              required
            />
          </div>
          <button type="submit" className="rounded-lg bg-brand-600 text-white px-4 py-2 text-sm">
            Save stock
          </button>
        </form>

        <table className="w-full text-sm bg-white rounded-xl border shadow-sm overflow-hidden">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-3 py-2">Ingredient</th>
              <th className="px-3 py-2">On hand</th>
              <th className="px-3 py-2">Avg kg/day</th>
              <th className="px-3 py-2">Days left</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.ingredient_id} className="border-t">
                <td className="px-3 py-2 font-medium">{r.name}</td>
                <td className="px-3 py-2">{r.quantity_kg.toFixed(0)} kg</td>
                <td className="px-3 py-2">{r.avg_daily_kg.toFixed(1)}</td>
                <td className="px-3 py-2">
                  {r.days_left == null ? '—' : r.days_left.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </div>
  )
}