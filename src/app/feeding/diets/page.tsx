'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Ingredient {
  id: string
  name: string
  premix_diet_id: string | null
}

interface Diet {
  id: string
  name: string
  diet_type: string
}

interface Line {
  ingredient_id: string
  percent: string
}

export default function DietsPage() {
  const [diets, setDiets] = useState<Diet[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [farmId, setFarmId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [dietType, setDietType] = useState('starter')
  const [lines, setLines] = useState<Line[]>([{ ingredient_id: '', percent: '' }])
  const [error, setError] = useState<string | null>(null)
  const [selectedDiet, setSelectedDiet] = useState<string | null>(null)
  const [dietLines, setDietLines] = useState<any[]>([])
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

    const [{ data: d }, { data: i }] = await Promise.all([
      supabase
        .from('diets')
        .select('id, name, diet_type')
        .eq('farm_id', membership.farm_id)
        .eq('is_active', true)
        .neq('diet_type', 'premix')
        .order('name'),
      supabase
        .from('ingredients')
        .select('id, name, premix_diet_id')
        .eq('farm_id', membership.farm_id)
        .eq('is_active', true)
        .order('name'),
    ])
    setDiets((d as Diet[]) || [])
    setIngredients((i as Ingredient[]) || [])
  }

  useEffect(() => {
    load()
  }, [])

  async function openDiet(id: string) {
    setSelectedDiet(id)
    const { data } = await supabase
      .from('diet_ingredients')
      .select('percent, sort_order, ingredient_id, ingredients(name)')
      .eq('diet_id', id)
      .order('sort_order')
    setDietLines(data || [])
  }

  async function deleteDiet(id: string) {
    if (!confirm('Remove this diet?')) return
    await supabase.from('diets').update({ is_active: false }).eq('id', id)
    if (selectedDiet === id) {
      setSelectedDiet(null)
      setDietLines([])
    }
    await load()
  }

  async function createDiet(e: React.FormEvent) {
    e.preventDefault()
    if (!farmId || !name.trim()) return
    setError(null)

    const total = lines.reduce((s, l) => s + (Number(l.percent) || 0), 0)
    if (Math.abs(total - 100) > 0.5) {
      setError(`Percentages should total ~100 (currently ${total.toFixed(1)})`)
      return
    }

    const { data: diet, error: dErr } = await supabase
      .from('diets')
      .insert({
        farm_id: farmId,
        name: name.trim(),
        diet_type: dietType,
      })
      .select('id')
      .single()

    if (dErr || !diet) {
      setError(dErr?.message || 'Failed')
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
    if (lErr) setError(lErr.message)
    else {
      setName('')
      setLines([{ ingredient_id: '', percent: '' }])
      await load()
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b px-4 py-3">
        <div className="max-w-2xl mx-auto flex justify-between">
          <h1 className="text-xl font-bold">Diets</h1>
          <Link href="/feeding" className="text-sm text-slate-600 hover:underline">
            Feeding
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Nested setup: ingredients & premixes under diets */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/feeding/ingredients"
            className="rounded-xl border bg-white p-4 text-center shadow-sm hover:border-slate-400"
          >
            <div className="font-semibold text-sm">Ingredients</div>
            <div className="text-xs text-slate-500 mt-1">Names & €/kg</div>
          </Link>
          <Link
            href="/feeding/premixes"
            className="rounded-xl border bg-white p-4 text-center shadow-sm hover:border-slate-400"
          >
            <div className="font-semibold text-sm">Premixes</div>
            <div className="text-xs text-slate-500 mt-1">Batch recipes</div>
          </Link>
        </div>

        <p className="text-sm text-slate-600">
          Build diets from ingredients/premixes. Line order = feeder fill order.
        </p>

        <form onSubmit={createDiet} className="bg-white rounded-xl border p-5 space-y-3 shadow-sm">
          <h2 className="font-semibold">New diet</h2>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name e.g. Starter mix"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={dietType}
            onChange={(e) => setDietType(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="starter">Starter</option>
            <option value="finisher">Finisher</option>
            <option value="other">Other</option>
          </select>

          {lines.map((line, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <span className="text-xs text-slate-400 w-5">{idx + 1}.</span>
              <select
                value={line.ingredient_id}
                onChange={(e) => {
                  const next = [...lines]
                  next[idx] = { ...next[idx], ingredient_id: e.target.value }
                  setLines(next)
                }}
                className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Ingredient / premix…</option>
                {ingredients.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                    {i.premix_diet_id ? ' (premix)' : ''}
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
          ))}
          <button
            type="button"
            onClick={() => setLines([...lines, { ingredient_id: '', percent: '' }])}
            className="text-xs text-brand-700"
          >
            + ingredient line
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" className="rounded-lg bg-brand-600 text-white px-4 py-2 text-sm">
            Save diet
          </button>
        </form>

        <ul className="bg-white rounded-xl border divide-y shadow-sm">
          {diets.map((d) => (
            <li key={d.id} className="px-4 py-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <button type="button" onClick={() => openDiet(d.id)} className="text-left flex-1">
                  <span className="font-medium">{d.name}</span>
                  <span className="text-slate-500 ml-2 capitalize">{d.diet_type}</span>
                </button>
                <button
                  type="button"
                  onClick={() => deleteDiet(d.id)}
                  className="text-xs text-red-600 border border-red-200 rounded-md px-2 py-1"
                >
                  Delete
                </button>
              </div>
              {selectedDiet === d.id && (
                <ol className="mt-2 text-xs text-slate-600 space-y-0.5 list-decimal list-inside">
                  {dietLines.map((l: any, i: number) => (
                    <li key={i}>
                      {l.ingredients?.name || l.ingredient_id}: {l.percent}%
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