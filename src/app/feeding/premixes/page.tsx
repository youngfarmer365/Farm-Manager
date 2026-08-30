'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Ingredient {
  id: string
  name: string
  premix_diet_id: string | null
}

interface Line {
  ingredient_id: string
  percent: string
}

export default function PremixesPage() {
  const [farmId, setFarmId] = useState<string | null>(null)
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [premixes, setPremixes] = useState<{ id: string; name: string }[]>([])
  const [name, setName] = useState('')
  const [cost, setCost] = useState('')
  const [lines, setLines] = useState<Line[]>([{ ingredient_id: '', percent: '' }])
  const [error, setError] = useState<string | null>(null)
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

    const [{ data: ing }, { data: diets }] = await Promise.all([
      supabase
        .from('ingredients')
        .select('id, name, premix_diet_id')
        .eq('farm_id', membership.farm_id)
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('diets')
        .select('id, name')
        .eq('farm_id', membership.farm_id)
        .eq('diet_type', 'premix')
        .eq('is_active', true)
        .order('name'),
    ])
    setIngredients((ing as Ingredient[]) || [])
    setPremixes(diets || [])
  }

  useEffect(() => {
    load()
  }, [])

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

    // Premix also appears as an ingredient for use in other diets
    const { error: iErr } = await supabase.from('ingredients').insert({
      farm_id: farmId,
      name: name.trim(),
      unit: 'kg',
      cost_per_unit: cost ? Number(cost) : 0,
      premix_diet_id: diet.id,
      notes: 'Premix',
    })
    if (iErr) setError(iErr.message)
    else {
      setName('')
      setCost('')
      setLines([{ ingredient_id: '', percent: '' }])
      await load()
    }
  }

  // Only non-premix ingredients as components (avoid nesting confusion for now)
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
          Build a premix, mix it on its own when needed. It is also added as an ingredient so you can
          put it into starter/finisher diets.
        </p>

        <form onSubmit={createPremix} className="bg-white rounded-xl border p-5 space-y-3 shadow-sm">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Premix name"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="number"
            step="0.0001"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="Cost €/kg of finished premix (optional)"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />

          {lines.map((line, idx) => (
            <div key={idx} className="flex gap-2">
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
            + line (keeps order)
          </button>
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
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}