'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getFarmAccess, hideFeedPrices } from '@/lib/farm-access'
import Link from 'next/link'

interface Ingredient {
  id: string
  name: string
  premix_diet_id: string | null
  cost_per_unit: number | null
}

interface Line {
  ingredient_id: string
  percent: string
}

function premixCostPerKg(lines: Line[], ingredients: Ingredient[]) {
  return lines.reduce((sum, line) => {
    const ing = ingredients.find((i) => i.id === line.ingredient_id)
    const pct = Number(line.percent) || 0
    const unitCost = Number(ing?.cost_per_unit) || 0
    return sum + (pct / 100) * unitCost
  }, 0)
}

export default function PremixesPage() {
  const [farmId, setFarmId] = useState<string | null>(null)
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [premixes, setPremixes] = useState<{ id: string; name: string; cost_per_unit?: number | null }[]>([])
  const [name, setName] = useState('')
  const [lines, setLines] = useState<Line[]>([{ ingredient_id: '', percent: '' }])
  const [error, setError] = useState<string | null>(null)
  const [hidePrices, setHidePrices] = useState(false)
  const supabase = createClient()

  async function load() {
    const access = await getFarmAccess()
    if (!access.farmId) return
    setFarmId(access.farmId)
    setHidePrices(hideFeedPrices(access.role))

    const [{ data: ing }, { data: diets }] = await Promise.all([
      supabase
        .from('ingredients')
        .select('id, name, premix_diet_id, cost_per_unit')
        .eq('farm_id', access.farmId)
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('diets')
        .select('id, name')
        .eq('farm_id', access.farmId)
        .eq('diet_type', 'premix')
        .eq('is_active', true)
        .order('name'),
    ])
    const list = (ing as Ingredient[]) || []
    setIngredients(list)

    const dietRows = diets || []
    const withCost = dietRows.map((d) => {
      const asIng = list.find((i) => i.premix_diet_id === d.id)
      return { ...d, cost_per_unit: asIng?.cost_per_unit ?? null }
    })
    setPremixes(withCost)
  }

  useEffect(() => {
    load()
  }, [])

  const calculated = useMemo(() => premixCostPerKg(lines, ingredients), [lines, ingredients])
  const missingPrice = lines.some((l) => {
    if (!l.ingredient_id || !(Number(l.percent) > 0)) return false
    const ing = ingredients.find((i) => i.id === l.ingredient_id)
    return !ing || !Number(ing.cost_per_unit)
  })

  async function createPremix(e: React.FormEvent) {
    e.preventDefault()
    if (!farmId || !name.trim()) return
    setError(null)

    const total = lines.reduce((s, l) => s + (Number(l.percent) || 0), 0)
    if (Math.abs(total - 100) > 0.5) {
      setError(`Percentages should total ~100 (now ${total.toFixed(1)})`)
      return
    }

    const { data: diet, error: dErr } = await supabase
      .from('diets')
      .insert({
        farm_id: farmId,
        name: name.trim(),
        diet_type: 'premix',
      })
      .select('id')
      .single()

    if (dErr || !diet) {
      setError(dErr?.message || 'Failed to create premix diet')
      return
    }

    const rows = lines
      .filter((l) => l.ingredient_id && Number(l.percent) > 0)
      .map((l, idx) => ({
        diet_id: diet.id,
        ingredient_id: l.ingredient_id,
        percent: Number(l.percent),
        sort_order: idx,
      }))

    const { error: lErr } = await supabase.from('diet_ingredients').insert(rows)
    if (lErr) {
      setError(lErr.message)
      return
    }

    const cost = Number(calculated.toFixed(6))
    const { error: iErr } = await supabase.from('ingredients').insert({
      farm_id: farmId,
      name: name.trim(),
      unit: 'kg',
      cost_per_unit: cost,
      premix_diet_id: diet.id,
      notes: 'Premix — cost from ingredient % × €/kg',
    })
    if (iErr) setError(iErr.message)
    else {
      setName('')
      setLines([{ ingredient_id: '', percent: '' }])
      await load()
    }
  }

  const baseIngredients = ingredients.filter((i) => !i.premix_diet_id)

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b px-4 py-3">
        <div className="max-w-2xl mx-auto flex justify-between">
          <h1 className="text-xl font-bold">Premixes</h1>
          <Link href="/feeding" className="text-sm text-slate-600 hover:underline">
            Feeding
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <p className="text-sm text-slate-600">
          Price of the mix is calculated from each ingredient’s €/kg × the percentage used.
        </p>

        <form onSubmit={createPremix} className="bg-white rounded-xl border p-5 space-y-3 shadow-sm">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Premix name"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />

          {lines.map((line, idx) => {
            const ing = ingredients.find((i) => i.id === line.ingredient_id)
            const lineCost =
              ((Number(line.percent) || 0) / 100) * Number(ing?.cost_per_unit || 0)
            return (
              <div key={idx} className="space-y-1">
                <div className="flex gap-2">
                  <select
                    value={line.ingredient_id}
                    onChange={(e) => {
                      const next = [...lines]
                      next[idx] = { ...next[idx], ingredient_id: e.target.value }
                      setLines(next)
                    }}
                    className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">Ingredient…</option>
                    {baseIngredients.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                        {!hidePrices && Number(i.cost_per_unit)
                          ? ` · €${Number(i.cost_per_unit).toFixed(4)}/kg`
                          : ''}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="%"
                    value={line.percent}
                    onChange={(e) => {
                      const next = [...lines]
                      next[idx] = { ...next[idx], percent: e.target.value }
                      setLines(next)
                    }}
                    className="w-24 rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                {!hidePrices && line.ingredient_id && (
                  <p className="text-xs text-slate-500">
                    {(Number(line.percent) || 0).toFixed(1)}% × €
                    {Number(ing?.cost_per_unit || 0).toFixed(4)} = €{lineCost.toFixed(4)} / kg of mix
                  </p>
                )}
              </div>
            )
          })}
          <button
            type="button"
            onClick={() => setLines([...lines, { ingredient_id: '', percent: '' }])}
            className="text-xs text-brand-700"
          >
            + line (keeps order)
          </button>
          {!hidePrices && (
            <div className="rounded-lg border-2 border-brand-800 bg-brand-50 px-3 py-2 text-sm font-bold">
              Mix cost: €{calculated.toFixed(4)} / kg
              {missingPrice ? ' (set ingredient prices first for a full figure)' : ''}
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" className="rounded-lg bg-brand-600 text-white px-4 py-2 text-sm">
            Save premix
          </button>
        </form>

        <ul className="bg-white rounded-xl border divide-y">
          {premixes.map((p) => (
            <li key={p.id} className="px-4 py-3 text-sm font-medium">
              {p.name}
              <span className="text-xs text-slate-500 font-normal ml-2">also in ingredients list</span>
              {!hidePrices && p.cost_per_unit != null && (
                <span className="text-xs text-slate-500 font-normal ml-2">
                  €{Number(p.cost_per_unit).toFixed(4)}/kg
                </span>
              )}
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}
