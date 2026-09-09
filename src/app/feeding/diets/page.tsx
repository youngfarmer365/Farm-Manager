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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
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

  function resetForm() {
    setEditingId(null)
    setName('')
    setDietType('starter')
    setLines([{ ingredient_id: '', percent: '' }])
    setError(null)
  }

  function moveLine(idx: number, dir: -1 | 1) {
    const j = idx + dir
    if (j < 0 || j >= lines.length) return
    const next = [...lines]
    const tmp = next[idx]
    next[idx] = next[j]
    next[j] = tmp
    setLines(next)
  }

  async function openDiet(id: string) {
    setSelectedDiet(id)
    const { data } = await supabase
      .from('diet_ingredients')
      .select('percent, sort_order, ingredient_id, ingredients(name)')
      .eq('diet_id', id)
      .order('sort_order')
    setDietLines(data || [])
  }

  async function startEdit(d: Diet) {
    setEditingId(d.id)
    setName(d.name)
    setDietType(d.diet_type || 'other')
    setSelectedDiet(d.id)
    const { data } = await supabase
      .from('diet_ingredients')
      .select('percent, sort_order, ingredient_id, ingredients(name)')
      .eq('diet_id', d.id)
      .order('sort_order')
    setDietLines(data || [])
    const next =
      (data || []).map((l: any) => ({
        ingredient_id: l.ingredient_id,
        percent: String(l.percent),
      })) || []
    setLines(next.length ? next : [{ ingredient_id: '', percent: '' }])
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function deleteDiet(id: string) {
    if (!confirm('Remove this diet? Completed loads keep the mix they used that day.')) return
    await supabase.from('diets').update({ is_active: false }).eq('id', id)
    if (selectedDiet === id) {
      setSelectedDiet(null)
      setDietLines([])
    }
    if (editingId === id) resetForm()
    await load()
  }

  async function saveDiet(e: React.FormEvent) {
    e.preventDefault()
    if (!farmId || !name.trim()) return
    setError(null)
    const total = lines.reduce((s, l) => s + (Number(l.percent) || 0), 0)
    if (Math.abs(total - 100) > 0.5) {
      setError(`Percentages should total ~100 (currently ${total.toFixed(1)})`)
      return
    }
    const rows = lines
      .filter((l) => l.ingredient_id && Number(l.percent) > 0)
      .map((l, idx) => ({
        ingredient_id: l.ingredient_id,
        percent: Number(l.percent),
        sort_order: idx,
      }))
    if (!rows.length) {
      setError('Add at least one ingredient')
      return
    }
    setBusy(true)
    if (editingId) {
      const { error: uErr } = await supabase
        .from('diets')
        .update({ name: name.trim(), diet_type: dietType })
        .eq('id', editingId)
      if (uErr) {
        setBusy(false)
        setError(uErr.message)
        return
      }
      await supabase.from('diet_ingredients').delete().eq('diet_id', editingId)
      const { error: lErr } = await supabase.from('diet_ingredients').insert(
        rows.map((r) => ({ ...r, diet_id: editingId }))
      )
      setBusy(false)
      if (lErr) {
        setError(lErr.message)
        return
      }
      resetForm()
      await load()
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
      setBusy(false)
      setError(dErr?.message || 'Failed')
      return
    }
    const { error: lErr } = await supabase.from('diet_ingredients').insert(
      rows.map((r) => ({ ...r, diet_id: diet.id }))
    )
    setBusy(false)
    if (lErr) setError(lErr.message)
    else {
      resetForm()
      await load()
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white px-4 py-3">
        <div className="mx-auto flex max-w-2xl justify-between">
          <h1 className="text-xl font-bold">Diets</h1>
          <Link href="/feeding" className="text-sm text-slate-600 hover:underline">
            Feeding
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <div className="grid grid-cols-2 gap-3">
          <Link href="/feeding/ingredients" className="rounded-xl border bg-white p-4 text-center shadow-sm">
            <div className="text-sm font-semibold">Ingredients</div>
            <div className="mt-1 text-xs text-slate-500">Names & €/kg</div>
          </Link>
          <Link href="/feeding/premixes" className="rounded-xl border bg-white p-4 text-center shadow-sm">
            <div className="text-sm font-semibold">Premixes</div>
            <div className="mt-1 text-xs text-slate-500">Batch recipes</div>
          </Link>
        </div>

        <p className="text-sm text-slate-600">
          Line order is the mixer fill order. Use ↑ ↓ so straw, starter, maize, silage
          stay in that sequence on the feeding run. Edit changes the diet for the next
          run. Completed loads keep the mix they used that day.
        </p>

        <form onSubmit={saveDiet} className="space-y-3 rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="font-semibold">{editingId ? 'Edit diet' : 'New diet'}</h2>
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
            <div key={idx} className="flex items-center gap-2">
              <span className="w-5 text-xs text-slate-400">{idx + 1}.</span>
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
              <button type="button" className="text-xs" onClick={() => moveLine(idx, -1)} disabled={idx === 0}>
                ↑
              </button>
              <button
                type="button"
                className="text-xs"
                onClick={() => moveLine(idx, 1)}
                disabled={idx === lines.length - 1}
              >
                ↓
              </button>
              {lines.length > 1 && (
                <button
                  type="button"
                  className="text-xs text-red-600"
                  onClick={() => setLines(lines.filter((_, i) => i !== idx))}
                >
                  x
                </button>
              )}
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
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white disabled:opacity-50">
              {editingId ? 'Save changes' : 'Save diet'}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="rounded-lg border px-4 py-2 text-sm">
                Cancel
              </button>
            )}
          </div>
        </form>

        <ul className="divide-y rounded-xl border bg-white shadow-sm">
          {diets.map((d) => (
            <li key={d.id} className="px-4 py-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <button type="button" onClick={() => openDiet(d.id)} className="flex-1 text-left">
                  <span className="font-medium">{d.name}</span>
                  <span className="ml-2 capitalize text-slate-500">{d.diet_type}</span>
                </button>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(d)}
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteDiet(d.id)}
                    className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
              {selectedDiet === d.id && (
                <ol className="mt-2 list-inside list-decimal space-y-0.5 text-xs text-slate-600">
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
