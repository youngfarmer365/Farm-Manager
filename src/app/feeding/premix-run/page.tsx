'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getFarmAccess } from '@/lib/farm-access'
import { adjustStock } from '@/lib/feed-stock'

type Step = 'pick' | 'amount' | 'fill' | 'bay' | 'done'

type Premix = {
  dietId: string
  name: string
  ingredientId: string | null
  batchKg: number
}

type Line = {
  ingredientId: string
  name: string
  percent: number
  kg: number
}

export default function PremixRunPage() {
  const [farmId, setFarmId] = useState<string | null>(null)
  const [premixes, setPremixes] = useState<Premix[]>([])
  const [step, setStep] = useState<Step>('pick')
  const [chosen, setChosen] = useState<Premix | null>(null)
  const [amount, setAmount] = useState('500')
  const [lines, setLines] = useState<Line[]>([])
  const [fillIndex, setFillIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [stockAfter, setStockAfter] = useState<number | null>(null)
  const supabase = createClient()

  async function loadList() {
    const access = await getFarmAccess()
    if (!access.farmId) return
    setFarmId(access.farmId)
    let dietsRes = await supabase
      .from('diets')
      .select('id, name, batch_kg')
      .eq('farm_id', access.farmId)
      .eq('diet_type', 'premix')
      .eq('is_active', true)
      .order('name')
    if (dietsRes.error) {
      dietsRes = await supabase
        .from('diets')
        .select('id, name')
        .eq('farm_id', access.farmId)
        .eq('diet_type', 'premix')
        .eq('is_active', true)
        .order('name')
    }
    const { data: ings } = await supabase
      .from('ingredients')
      .select('id, name, premix_diet_id')
      .eq('farm_id', access.farmId)
      .eq('is_active', true)
    const list: Premix[] = (dietsRes.data || []).map((d: any) => {
      const asIng = (ings || []).find((i: any) => i.premix_diet_id === d.id)
      const stored =
        typeof window !== 'undefined' ? window.localStorage.getItem('fm_premix_batch_' + d.id) : null
      const batch = Number(d.batch_kg || stored || 500) || 500
      return { dietId: d.id, name: d.name, ingredientId: asIng?.id || null, batchKg: batch }
    })
    setPremixes(list)
  }

  useEffect(() => {
    loadList()
  }, [])

  async function startPremix(p: Premix) {
    setError(null)
    setChosen(p)
    setAmount(String(p.batchKg))
    const { data } = await supabase
      .from('diet_ingredients')
      .select('percent, sort_order, ingredient_id, ingredients(name)')
      .eq('diet_id', p.dietId)
      .order('sort_order')
    if (!data?.length) {
      setError('This premix has no ingredients. Set them under Feeding → Premixes.')
      return
    }
    setLines(
      data.map((row: any) => ({
        ingredientId: row.ingredient_id,
        name: row.ingredients?.name || 'Ingredient',
        percent: Number(row.percent) || 0,
        kg: 0,
      }))
    )
    setStep('amount')
  }

  const kgLines = useMemo(() => {
    const total = Number(amount) || 0
    return lines.map((l) => ({ ...l, kg: Number(((total * l.percent) / 100).toFixed(2)) }))
  }, [lines, amount])

  function goFill() {
    const total = Number(amount)
    if (!total || total <= 0) {
      setError('Enter how many kg to mix')
      return
    }
    setError(null)
    if (chosen) {
      window.localStorage.setItem('fm_premix_batch_' + chosen.dietId, String(total))
      supabase.from('diets').update({ batch_kg: total }).eq('id', chosen.dietId).then(() => {})
    }
    setFillIndex(0)
    setStep('fill')
  }

  async function finish() {
    if (!farmId || !chosen) return
    setSaving(true)
    setError(null)
    let premixIngId = chosen.ingredientId
    if (!premixIngId) {
      const { data, error: iErr } = await supabase
        .from('ingredients')
        .insert({
          farm_id: farmId,
          name: chosen.name,
          unit: 'kg',
          cost_per_unit: 0,
          premix_diet_id: chosen.dietId,
        })
        .select('id')
        .single()
      if (iErr || !data) {
        setSaving(false)
        setError(iErr?.message || 'Could not create premix stock item')
        return
      }
      premixIngId = data.id
    }
    const total = Number(amount) || 0
    for (const line of kgLines) {
      if (!line.ingredientId || line.kg <= 0) continue
      const r = await adjustStock(farmId, line.ingredientId, -line.kg)
      if (r.error) {
        setSaving(false)
        setError(r.error)
        return
      }
    }
    const add = await adjustStock(farmId, premixIngId, total)
    setSaving(false)
    if (add.error) {
      setError(add.error)
      return
    }
    setStockAfter(add.quantity_kg)
    setStep('done')
  }

  function reset() {
    setChosen(null)
    setLines([])
    setFillIndex(0)
    setError(null)
    setStockAfter(null)
    setStep('pick')
    loadList()
  }

  const current = kgLines[fillIndex]

  return (
    <div className="min-h-screen bg-slate-200">
      <header className="border-b-4 border-slate-600 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-brand-800">Feeding</p>
            <h1 className="text-2xl font-bold text-slate-900">Premix</h1>
          </div>
          <Link href="/m" className="rounded-xl border-2 border-slate-500 bg-white px-4 py-2 text-sm font-bold">
            Home
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-xl space-y-4 px-4 py-6">
        {error && <p className="rounded-xl border-2 border-red-300 bg-red-50 p-3 font-semibold text-red-800">{error}</p>}
        {step === 'pick' && (
          <>
            <p className="text-base font-semibold text-slate-700">Select the premix to mix.</p>
            {premixes.length === 0 && (
              <p className="rounded-xl border-2 bg-white p-4 text-sm font-semibold text-slate-600">
                No premixes yet. <Link href="/feeding/premixes" className="underline">Create one</Link>
              </p>
            )}
            <ul className="space-y-3">
              {premixes.map((p) => (
                <li key={p.dietId}>
                  <button type="button" onClick={() => startPremix(p)} className="min-h-[72px] w-full rounded-2xl border-4 border-slate-600 bg-white p-4 text-left">
                    <div className="text-xl font-bold">{p.name}</div>
                    <div className="mt-1 text-sm font-semibold text-slate-600">Usual batch {p.batchKg} kg</div>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        {step === 'amount' && chosen && (
          <>
            <h2 className="text-xl font-bold">{chosen.name}</h2>
            <p className="font-semibold text-slate-700">How many kg to mix?</p>
            <input type="number" min="1" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} className="min-h-[64px] w-full rounded-2xl border-4 border-slate-500 px-4 text-3xl font-bold" />
            <div className="flex flex-wrap gap-2">
              {[250, 500, 750, 1000, 1500].map((n) => (
                <button key={n} type="button" onClick={() => setAmount(String(n))} className={`rounded-xl border-2 px-4 py-2 font-bold ${Number(amount) === n ? 'border-brand-800 bg-brand-700 text-white' : 'border-slate-400 bg-white'}`}>
                  {n} kg
                </button>
              ))}
            </div>
            <ul className="divide-y rounded-2xl border-2 bg-white">
              {kgLines.map((l) => (
                <li key={l.ingredientId} className="flex justify-between px-4 py-3 font-semibold">
                  <span>{l.name}</span>
                  <span>{l.kg.toFixed(1)} kg</span>
                </li>
              ))}
            </ul>
            <button type="button" onClick={goFill} className="min-h-[56px] w-full rounded-2xl bg-brand-700 text-lg font-bold text-white">Start loading</button>
          </>
        )}
        {step === 'fill' && current && (
          <>
            <p className="text-sm font-bold uppercase text-slate-600">Load {fillIndex + 1} of {kgLines.length}</p>
            <div className="rounded-3xl border-4 border-brand-900 bg-brand-700 p-6 text-white">
              <p className="text-2xl font-bold">{current.name}</p>
              <p className="mt-2 text-5xl font-bold">{current.kg.toFixed(1)} kg</p>
            </div>
            <button type="button" onClick={() => (fillIndex + 1 >= kgLines.length ? setStep('bay') : setFillIndex(fillIndex + 1))} className="min-h-[56px] w-full rounded-2xl bg-brand-700 text-lg font-bold text-white">
              {fillIndex + 1 >= kgLines.length ? 'All in — empty into bay' : 'Loaded — next ingredient'}
            </button>
          </>
        )}
        {step === 'bay' && (
          <>
            <div className="rounded-3xl border-4 border-amber-700 bg-amber-50 p-6">
              <h2 className="text-2xl font-bold text-amber-950">Empty into bay</h2>
              <p className="mt-2 font-semibold text-amber-900">{chosen?.name} · {amount} kg is mixed.</p>
            </div>
            <button type="button" disabled={saving} onClick={finish} className="min-h-[64px] w-full rounded-2xl bg-brand-800 text-xl font-bold text-white disabled:opacity-50">
              {saving ? 'Saving…' : 'Completed'}
            </button>
          </>
        )}
        {step === 'done' && (
          <div className="space-y-4 rounded-3xl border-4 border-green-800 bg-white p-6">
            <h2 className="text-2xl font-bold text-green-900">Premix in the bay</h2>
            <p className="font-semibold text-slate-700">{amount} kg of {chosen?.name} added. Ingredients taken off main stock.</p>
            {stockAfter != null && <p className="text-lg font-bold text-green-900">{stockAfter.toFixed(0)} kg of this premix now on hand</p>}
            <button type="button" onClick={reset} className="min-h-[52px] w-full rounded-2xl bg-brand-700 font-bold text-white">Mix another batch</button>
            <Link href="/m" className="block text-center font-bold text-brand-800 underline">Home</Link>
          </div>
        )}
      </main>
    </div>
  )
}
