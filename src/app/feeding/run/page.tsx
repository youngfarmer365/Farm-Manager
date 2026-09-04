'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  programmeDayIndex,
  resolvePhaseBlend,
  blendIngredientPercents,
  mixFromTotalKg,
  type IngredientPercent,
  type Phase,
} from '@/lib/feeding'
import { getFarmAccess, hideFeedPrices } from '@/lib/farm-access'
import { penLabel, type PenRow } from '@/lib/pens'

interface Load {
  id: string
  name: string
  program_id: string | null
}

interface LoadPen {
  id: string
  pen_id: string
  daily_amount_kg: number
  sort_order: number
  pen_name: string
  planned_kg: number
}

type Step = 'pick' | 'buffer' | 'fill' | 'feed' | 'summary'

interface MixRow {
  ingredientId: string
  name: string
  percent: number
  kg: number
  cost: number
  cumulativeKg: number
}

interface SummaryPen {
  pen_id: string
  pen_name: string
  planned_kg: number
  actual_kg: number
  animal_count: number
  kg_per_head: number | null
  cost_allocated: number
  cost_per_head: number | null
}

export default function FeedingRunPage() {
  const [loads, setLoads] = useState<Load[]>([])
  const [farmId, setFarmId] = useState<string | null>(null)
  const [load, setLoad] = useState<Load | null>(null)
  const [loadPens, setLoadPens] = useState<LoadPen[]>([])
  const [step, setStep] = useState<Step>('pick')
  const [penIndex, setPenIndex] = useState(0)
  const [mixRows, setMixRows] = useState<MixRow[]>([])
  const [phaseLabel, setPhaseLabel] = useState('')
  const [pensTotalKg, setPensTotalKg] = useState(0)
  const [bufferKg, setBufferKg] = useState('0')
  const [totalKg, setTotalKg] = useState(0)
  const [totalCost, setTotalCost] = useState(0)
  const [stepSize, setStepSize] = useState(10)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [startedAt, setStartedAt] = useState<string | null>(null)
  const [finishedAt, setFinishedAt] = useState<string | null>(null)
  const [savedRunId, setSavedRunId] = useState<string | null>(null)
  const [summaryPens, setSummaryPens] = useState<SummaryPen[]>([])
  const [hidePrices, setHidePrices] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    async function init() {
      const access = await getFarmAccess()
      if (!access.farmId) return
      setFarmId(access.farmId)
      setHidePrices(hideFeedPrices(access.role))
      const { data } = await supabase
        .from('feed_loads')
        .select('id, name, program_id')
        .eq('farm_id', access.farmId)
        .order('created_at', { ascending: false })
      setLoads((data as Load[]) || [])
    }
    init()
  }, [])

  async function loadDietPercents(dietId: string): Promise<IngredientPercent[]> {
    const { data } = await supabase
      .from('diet_ingredients')
      .select('percent, sort_order, ingredient_id, ingredients(name, cost_per_unit)')
      .eq('diet_id', dietId)
      .order('sort_order')

    return (data || []).map((row: any) => ({
      ingredientId: row.ingredient_id,
      name: row.ingredients?.name || 'Ingredient',
      percent: Number(row.percent),
      costPerUnit: Number(row.ingredients?.cost_per_unit || 0),
      sortOrder: row.sort_order ?? 0,
    }))
  }

  const computeMix = useCallback(async (currentLoad: Load, pens: LoadPen[], buffer: number) => {
    const pensSum = pens.reduce((s, p) => s + Number(p.daily_amount_kg || 0), 0)
    setPensTotalKg(pensSum)
    const total = Math.max(0, pensSum + buffer)
    setTotalKg(total)

    if (total <= 0) {
      setMixRows([])
      setPhaseLabel('Fill total is 0')
      setTotalCost(0)
      return
    }

    if (!currentLoad.program_id) {
      setMixRows([])
      setPhaseLabel('No programme on this load')
      setTotalCost(0)
      return
    }

    const { data: prog } = await supabase
      .from('feeding_programs')
      .select('start_date')
      .eq('id', currentLoad.program_id)
      .single()

    const { data: phaseRows } = await supabase
      .from('program_phases')
      .select('sort_order, diet_id, steady_days, transition_days')
      .eq('program_id', currentLoad.program_id)
      .order('sort_order')

    if (!prog || !phaseRows?.length) {
      setMixRows([])
      setPhaseLabel('Programme has no phases')
      setTotalCost(0)
      return
    }

    const day = programmeDayIndex(prog.start_date)
    const blend = resolvePhaseBlend(day, phaseRows as Phase[])
    setPhaseLabel(
      `Day ${day} · ${blend.label} · ${(blend.fromShare * 100).toFixed(0)}% / ${(blend.toShare * 100).toFixed(0)}%`
    )

    const fromDiet = blend.fromDietId ? await loadDietPercents(blend.fromDietId) : []
    const toDiet =
      blend.toDietId && blend.toDietId !== blend.fromDietId
        ? await loadDietPercents(blend.toDietId)
        : fromDiet

    if (!fromDiet.length && !toDiet.length) {
      setMixRows([])
      setPhaseLabel('Diet has no ingredients')
      setTotalCost(0)
      return
    }

    const blended = blendIngredientPercents(fromDiet, toDiet, blend.fromShare, blend.toShare)
    const rows = mixFromTotalKg(total, blended)

    let running = 0
    const withCumulative = rows.map((r) => {
      running += Number(r.kg) || 0
      return {
        ingredientId: r.ingredientId,
        name: r.name,
        percent: r.percent,
        kg: Number(r.kg) || 0,
        cost: Number(r.cost) || 0,
        cumulativeKg: Number(running.toFixed(1)),
      }
    })

    setMixRows(withCumulative)
    setTotalCost(withCumulative.reduce((s, r) => s + r.cost, 0))
  }, [])

  async function startLoad(l: Load) {
    setError(null)
    setLoad(l)
    setBufferKg('0')
    setMixRows([])
    setSavedRunId(null)
    setFinishedAt(null)
    setSummaryPens([])

    const { data: rows, error: qErr } = await supabase
      .from('feed_load_pens')
      .select('id, pen_id, daily_amount_kg, sort_order')
      .eq('load_id', l.id)
      .order('sort_order')

    if (qErr) {
      setError(qErr.message)
      return
    }
    if (!rows?.length) {
      setError('This load has no pens. Add pens under Feeding → Loads.')
      return
    }

    const penIds = rows.map((r) => r.pen_id)
    const { data: penRows } = await supabase
      .from('pens')
      .select('id, name, type, parent_id')
      .in('id', penIds)
    const parentIds = [
      ...new Set(
        ((penRows || []) as PenRow[]).map((p) => p.parent_id).filter((id): id is string => !!id)
      ),
    ]
    const { data: shedRows } = parentIds.length
      ? await supabase.from('pens').select('id, name, type, parent_id').in('id', parentIds)
      : { data: [] }
    const allPens = ([...(penRows || []), ...(shedRows || [])] as PenRow[])
    const nameById = new Map(
      ((penRows || []) as PenRow[]).map((p) => [p.id, penLabel(p, allPens)])
    )

    const pens: LoadPen[] = rows.map((r) => {
      const kg = Number(r.daily_amount_kg) || 0
      return {
        id: r.id,
        pen_id: r.pen_id,
        daily_amount_kg: kg,
        sort_order: r.sort_order,
        pen_name: nameById.get(r.pen_id) || r.pen_id,
        planned_kg: kg,
      }
    })

    setLoadPens(pens)
    setPenIndex(0)
    setPensTotalKg(pens.reduce((s, p) => s + p.daily_amount_kg, 0))
    setStartedAt(new Date().toISOString())
    setStep('buffer')
  }

  async function confirmBufferAndFill() {
    if (!load) return
    const frozen = loadPens.map((p) => ({
      ...p,
      planned_kg: Number(p.daily_amount_kg) || 0,
    }))
    setLoadPens(frozen)
    await computeMix(load, frozen, Number(bufferKg) || 0)
    setStep('fill')
  }

  async function adjustCurrentPen(delta: number) {
    if (!load || !loadPens[penIndex]) return
    const pen = loadPens[penIndex]
    const nextKg = Math.max(0, Number(pen.daily_amount_kg) + delta)
    setSaving(true)

    const { error: uErr } = await supabase
      .from('feed_load_pens')
      .update({ daily_amount_kg: nextKg })
      .eq('id', pen.id)

    if (uErr) {
      setError(uErr.message)
      setSaving(false)
      return
    }

    const updated = loadPens.map((p, i) =>
      i === penIndex ? { ...p, daily_amount_kg: nextKg } : p
    )
    setLoadPens(updated)
    await computeMix(load, updated, Number(bufferKg) || 0)
    setSaving(false)
  }

  async function finishRun() {
    if (!load || !farmId) {
      setError('Missing farm or load')
      return
    }
    setSaving(true)
    setError(null)

    const buf = Number(bufferKg) || 0
    await computeMix(load, loadPens, buf)

    const pensPlanned = loadPens.reduce((s, p) => s + Number(p.planned_kg || 0), 0)
    const pensActual = loadPens.reduce((s, p) => s + Number(p.daily_amount_kg || 0), 0)
    const fillTotal = Math.max(0, pensActual + buf)
    const end = new Date().toISOString()
    setFinishedAt(end)

    let finalMix: MixRow[] = mixRows
    if (load.program_id && fillTotal > 0) {
      const { data: prog } = await supabase
        .from('feeding_programs')
        .select('start_date')
        .eq('id', load.program_id)
        .single()
      const { data: phaseRows } = await supabase
        .from('program_phases')
        .select('sort_order, diet_id, steady_days, transition_days')
        .eq('program_id', load.program_id)
        .order('sort_order')
      if (prog && phaseRows?.length) {
        const day = programmeDayIndex(prog.start_date)
        const blend = resolvePhaseBlend(day, phaseRows as Phase[])
        const fromDiet = blend.fromDietId ? await loadDietPercents(blend.fromDietId) : []
        const toDiet =
          blend.toDietId && blend.toDietId !== blend.fromDietId
            ? await loadDietPercents(blend.toDietId)
            : fromDiet
        const blended = blendIngredientPercents(fromDiet, toDiet, blend.fromShare, blend.toShare)
        const rows = mixFromTotalKg(fillTotal, blended)
        let running = 0
        finalMix = rows.map((r) => {
          running += Number(r.kg) || 0
          return {
            ingredientId: r.ingredientId,
            name: r.name,
            percent: r.percent,
            kg: Number(r.kg) || 0,
            cost: Number(r.cost) || 0,
            cumulativeKg: Number(running.toFixed(1)),
          }
        })
        setMixRows(finalMix)
        setTotalKg(fillTotal)
        setPensTotalKg(pensActual)
        setTotalCost(finalMix.reduce((s, r) => s + r.cost, 0))
      }
    }

    const { data: run, error: runErr } = await supabase
      .from('feed_runs')
      .insert({
        farm_id: farmId,
        load_id: load.id,
        load_name: load.name,
        program_id: load.program_id,
        buffer_kg: buf,
        pens_planned_kg: pensPlanned,
        pens_actual_kg: pensActual,
        fill_total_kg: fillTotal,
        started_at: startedAt || end,
        finished_at: end,
      })
      .select('id')
      .single()

    if (runErr || !run) {
      setError(runErr?.message || 'Failed to save run')
      setSaving(false)
      return
    }

    const fillCost = finalMix.reduce((s, r) => s + (Number(r.cost) || 0), 0)
    const pensActualSum =
      loadPens.reduce((s, p) => s + Number(p.daily_amount_kg || 0), 0) || 1

    const penRows: SummaryPen[] = []
    for (let idx = 0; idx < loadPens.length; idx++) {
      const p = loadPens[idx]
      const actual = Number(p.daily_amount_kg) || 0
      const planned = Number(p.planned_kg) || 0

      const { count } = await supabase
        .from('animals')
        .select('*', { count: 'exact', head: true })
        .eq('pen_id', p.pen_id)
        .eq('status', 'active')

      const heads = count || 0
      const costAllocated = (fillCost * actual) / pensActualSum
      const kgPerHead = heads > 0 ? actual / heads : null
      const costPerHead = heads > 0 ? costAllocated / heads : null

      penRows.push({
        pen_id: p.pen_id,
        pen_name: p.pen_name,
        planned_kg: planned,
        actual_kg: actual,
        animal_count: heads,
        kg_per_head: kgPerHead,
        cost_allocated: Number(costAllocated.toFixed(2)),
        cost_per_head: costPerHead != null ? Number(costPerHead.toFixed(4)) : null,
      })
    }

    await supabase.from('feed_run_pens').insert(
      penRows.map((p, idx) => ({
        run_id: run.id,
        pen_id: p.pen_id,
        pen_name: p.pen_name,
        planned_kg: p.planned_kg,
        actual_kg: p.actual_kg,
        sort_order: idx,
        animal_count: p.animal_count,
        kg_per_head: p.kg_per_head,
        cost_allocated: p.cost_allocated,
        cost_per_head: p.cost_per_head,
      }))
    )
    setSummaryPens(penRows)

    if (finalMix.length) {
      await supabase.from('feed_run_ingredients').insert(
        finalMix.map((r, idx) => ({
          run_id: run.id,
          ingredient_id: r.ingredientId,
          ingredient_name: r.name,
          percent: r.percent,
          kg: r.kg,
          cost: r.cost,
          sort_order: idx,
        }))
      )

      for (const r of finalMix) {
        if (!r.ingredientId || r.kg <= 0) continue
        const { data: stock } = await supabase
          .from('feed_stock')
          .select('id, quantity_kg')
          .eq('farm_id', farmId)
          .eq('ingredient_id', r.ingredientId)
          .maybeSingle()

        if (stock) {
          await supabase
            .from('feed_stock')
            .update({
              quantity_kg: Math.max(0, Number(stock.quantity_kg) - r.kg),
              updated_at: new Date().toISOString(),
            })
            .eq('id', stock.id)
        } else {
          await supabase.from('feed_stock').insert({
            farm_id: farmId,
            ingredient_id: r.ingredientId,
            quantity_kg: 0,
            updated_at: new Date().toISOString(),
          })
        }
      }
    }

    setSavedRunId(run.id)
    setSaving(false)
    setStep('summary')
  }

  const currentPen = loadPens[penIndex]
  const bufNum = Number(bufferKg) || 0

  if (step === 'pick') {
    return (
      <div className="min-h-screen bg-slate-100">
        <header className="bg-white border-b px-4 py-3">
          <div className="max-w-2xl mx-auto flex justify-between">
            <h1 className="text-xl font-bold">Feeding run</h1>
            <Link href="/feeding" className="text-sm text-slate-600">
              Setup
            </Link>
          </div>
        </header>
        <main className="max-w-2xl mx-auto px-4 py-8 space-y-4">
          <p className="text-sm text-slate-600">
            Load → buffer → fill → pens → summary (kg/head
            {hidePrices ? '' : ', €/head'}
            , history & stock).
          </p>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
              {error}
            </p>
          )}
          <ul className="space-y-2">
            {loads.map((l) => (
              <li key={l.id}>
                <button
                  type="button"
                  onClick={() => startLoad(l)}
                  className="w-full text-left rounded-xl border bg-white px-5 py-4 shadow-sm hover:border-green-600"
                >
                  <span className="font-semibold text-lg">{l.name}</span>
                </button>
              </li>
            ))}
          </ul>
          {loads.length === 0 && (
            <p className="text-sm text-slate-500">
              No loads.{' '}
              <Link href="/feeding/loads" className="underline">
                Create one
              </Link>
            </p>
          )}
        </main>
      </div>
    )
  }

  if (step === 'buffer') {
    const preview = Math.max(0, pensTotalKg + bufNum)
    return (
      <div className="min-h-screen bg-amber-50">
        <header className="bg-amber-500 text-white px-4 py-4">
          <div className="max-w-md mx-auto flex justify-between items-center">
            <h1 className="text-xl font-bold">BUFFER</h1>
            <button type="button" onClick={() => setStep('pick')} className="text-sm underline">
              Exit
            </button>
          </div>
        </header>
        <main className="max-w-md mx-auto px-4 py-8 space-y-6">
          <p className="text-center font-medium text-amber-950">{load?.name}</p>
          <div className="bg-white rounded-xl border border-amber-200 p-5 space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Pens total</span>
              <strong>{pensTotalKg.toFixed(0)} kg</strong>
            </div>
            <div className="flex justify-between">
              <span>Buffer</span>
              <strong>
                {bufNum >= 0 ? '+' : ''}
                {bufNum.toFixed(0)} kg
              </strong>
            </div>
            <div className="flex justify-between border-t pt-2 text-lg">
              <span>Fill total</span>
              <strong>{preview.toFixed(0)} kg</strong>
            </div>
          </div>
          <input
            type="number"
            step="1"
            value={bufferKg}
            onChange={(e) => setBufferKg(e.target.value)}
            className="w-full rounded-xl border-2 border-amber-400 px-4 py-4 text-3xl text-center font-bold bg-white"
          />
          <div className="flex gap-2 justify-center flex-wrap">
            {[-100, -50, -25, 0, 25, 50, 100].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setBufferKg(String(n))}
                className="px-3 py-1.5 rounded-full border bg-white text-sm"
              >
                {n > 0 ? `+${n}` : String(n)}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={confirmBufferAndFill}
            className="w-full rounded-2xl bg-green-600 text-white py-4 text-lg font-bold"
          >
            Continue to fill sheet →
          </button>
        </main>
      </div>
    )
  }

  if (step === 'fill') {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col">
        <header className="px-4 py-3 border-b border-slate-700 flex justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold">FILL · {load?.name}</h1>
            <p className="text-xs text-slate-400">{phaseLabel}</p>
          </div>
          <div className="flex gap-3 text-sm shrink-0">
            <button type="button" onClick={() => setStep('buffer')} className="underline text-amber-300">
              Buffer
            </button>
            <button type="button" onClick={() => setStep('pick')} className="text-slate-500">
              Exit
            </button>
          </div>
        </header>
        <main className="flex-1 px-3 py-4 max-w-2xl mx-auto w-full">
          <div className="text-center mb-4">
            <div className="text-slate-400 text-xs">
              Pens {pensTotalKg.toFixed(0)}
              {bufNum !== 0 && (
                <>
                  {' '}
                  · Buffer {bufNum > 0 ? '+' : ''}
                  {bufNum.toFixed(0)}
                </>
              )}
            </div>
            <div className="text-4xl font-bold">{totalKg.toFixed(0)} kg</div>
          </div>
          <div className="grid grid-cols-[1fr_72px_88px] gap-1 px-2 mb-2 text-[11px] font-semibold text-slate-400 uppercase">
            <span>Ingredient</span>
            <span className="text-right text-amber-400">Add kg</span>
            <span className="text-right text-green-400">Scale =</span>
          </div>
          {mixRows.length === 0 ? (
            <p className="text-center text-slate-400 py-10 text-sm">{phaseLabel || 'No mix'}</p>
          ) : (
            <ol className="space-y-2">
              {mixRows.map((r, i) => (
                <li
                  key={r.ingredientId + i}
                  className="grid grid-cols-[1fr_72px_88px] gap-1 items-center rounded-xl bg-slate-800 px-3 py-3"
                >
                  <div className="truncate">
                    <span className="text-slate-500 text-sm">{i + 1}. </span>
                    <span className="font-semibold">{r.name}</span>
                  </div>
                  <div className="text-right text-2xl font-bold text-amber-300 tabular-nums">
                    {r.kg.toFixed(0)}
                  </div>
                  <div className="text-right text-2xl font-bold text-green-400 tabular-nums">
                    {r.cumulativeKg.toFixed(0)}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </main>
        <div className="p-4 border-t border-slate-700 max-w-2xl mx-auto w-full">
          <button
            type="button"
            onClick={() => {
              setPenIndex(0)
              setStep('feed')
            }}
            className="w-full rounded-2xl bg-green-600 py-5 text-xl font-bold"
          >
            Start feed out →
          </button>
        </div>
      </div>
    )
  }

  if (step === 'summary') {
    const pensPlanned = loadPens.reduce((s, p) => s + Number(p.planned_kg || 0), 0)
    const pensActual = loadPens.reduce((s, p) => s + Number(p.daily_amount_kg || 0), 0)
    const pensToShow = summaryPens.length
      ? summaryPens
      : loadPens.map((p) => ({
          pen_id: p.pen_id,
          pen_name: p.pen_name,
          planned_kg: p.planned_kg,
          actual_kg: p.daily_amount_kg,
          animal_count: 0,
          kg_per_head: null as number | null,
          cost_allocated: 0,
          cost_per_head: null as number | null,
        }))

    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-green-700 text-white px-4 py-4">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-xl font-bold">Load complete</h1>
            <p className="text-sm text-green-100">{load?.name}</p>
          </div>
        </header>
        <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
          <div className="bg-white rounded-xl border p-4 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Started</span>
              <span>{startedAt ? new Date(startedAt).toLocaleString('en-IE') : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Finished</span>
              <span>{finishedAt ? new Date(finishedAt).toLocaleString('en-IE') : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Buffer</span>
              <span>
                {bufNum >= 0 ? '+' : ''}
                {bufNum.toFixed(0)} kg
              </span>
            </div>
            <div className="flex justify-between font-medium border-t pt-2">
              <span>Pens planned → actual</span>
              <span>
                {pensPlanned.toFixed(0)} → {pensActual.toFixed(0)} kg
              </span>
            </div>
            <div className="flex justify-between font-medium">
              <span>Fill total</span>
              <span>
                {totalKg.toFixed(0)} kg
                {!hidePrices && <> · €{totalCost.toFixed(2)}</>}
              </span>
            </div>
          </div>

          <div className="bg-white rounded-xl border p-4">
            <h2 className="font-semibold mb-2">{hidePrices ? 'Pens (intake)' : 'Pens (intake & cost)'}</h2>
            <ul className="space-y-3 text-sm">
              {pensToShow.map((p) => {
                const diff = Number(p.actual_kg) - Number(p.planned_kg)
                return (
                  <li key={p.pen_id} className="border-b border-slate-100 pb-2">
                    <div className="flex justify-between font-medium">
                      <span>{p.pen_name}</span>
                      <span className="tabular-nums">
                        {Number(p.planned_kg).toFixed(0)} → {Number(p.actual_kg).toFixed(0)} kg
                        {diff !== 0 && (
                          <span className={diff > 0 ? ' text-green-700' : ' text-red-600'}>
                            {' '}
                            ({diff > 0 ? '+' : ''}
                            {diff.toFixed(0)})
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {p.animal_count} head
                      {p.kg_per_head != null && (
                        <> · {Number(p.kg_per_head).toFixed(1)} kg/head</>
                      )}
                      {!hidePrices && p.cost_per_head != null && (
                        <> · €{Number(p.cost_per_head).toFixed(2)}/head</>
                      )}
                      {!hidePrices && p.cost_allocated > 0 && (
                        <> · €{Number(p.cost_allocated).toFixed(2)} pen total</>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
            <p className="text-[11px] text-slate-400 mt-2">
              Head count = active animals in that pen at finish.
              {hidePrices
                ? ''
                : ' € from ingredient costs on the mix. Once/day ≈ € per head per day for that day.'}
            </p>
          </div>

          <div className="bg-white rounded-xl border p-4">
            <h2 className="font-semibold mb-2">Ingredients (stock deducted)</h2>
            {mixRows.length === 0 ? (
              <p className="text-sm text-slate-500">No ingredient breakdown</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {mixRows.map((r) => (
                  <li key={r.ingredientId} className="flex justify-between">
                    <span>{r.name}</span>
                    <span className="tabular-nums">
                      {r.kg.toFixed(1)} kg
                      {!hidePrices && <> · €{r.cost.toFixed(2)}</>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {savedRunId && (
            <p className="text-xs text-slate-500">
              Saved to completed loads ({savedRunId.slice(0, 8)}…)
            </p>
          )}

          <div className="flex flex-col gap-2">
            <Link
              href="/feeding/history"
              className="block text-center rounded-xl bg-slate-900 text-white py-3 font-medium"
            >
              View completed loads
            </Link>
            <Link
              href="/feeding/stock"
              className="block text-center rounded-xl border bg-white py-3 font-medium"
            >
              View stock
            </Link>
            <button
              type="button"
              onClick={() => setStep('pick')}
              className="rounded-xl border border-green-600 text-green-800 py-3 font-medium"
            >
              Start another load
            </button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <header className="px-4 py-3 flex justify-between border-b border-slate-800">
        <button
          type="button"
          onClick={async () => {
            if (load) await computeMix(load, loadPens, bufNum)
            setStep('fill')
          }}
          className="text-sm underline text-slate-300"
        >
          ← Fill
        </button>
        <span className="text-sm text-slate-400">
          {penIndex + 1}/{loadPens.length}
        </span>
        <button type="button" onClick={() => setStep('pick')} className="text-sm text-slate-500">
          Exit
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4">
        <h1 className="text-5xl font-bold text-center mb-2">{currentPen?.pen_name}</h1>
        <p className="text-slate-500 text-sm mb-6">
          Planned {Number(currentPen?.planned_kg || 0).toFixed(0)} kg
        </p>
        <div className="text-8xl font-bold tabular-nums mb-10">
          {Number(currentPen?.daily_amount_kg || 0).toFixed(0)}
        </div>
        <div className="flex gap-6 mb-8">
          <button
            type="button"
            disabled={saving}
            onClick={() => adjustCurrentPen(-stepSize)}
            className="h-24 w-24 rounded-full bg-red-600 text-5xl font-bold"
          >
            −
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => adjustCurrentPen(stepSize)}
            className="h-24 w-24 rounded-full bg-green-600 text-5xl font-bold"
          >
            +
          </button>
        </div>
        <div className="flex gap-2">
          {[5, 10, 25, 50].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setStepSize(n)}
              className={`px-4 py-2 rounded-full text-sm ${
                stepSize === n ? 'bg-white text-black' : 'bg-slate-800'
              }`}
            >
              ±{n}
            </button>
          ))}
        </div>
        {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
      </main>

      <div className="p-4 grid grid-cols-2 gap-3 max-w-lg mx-auto w-full">
        <button
          type="button"
          disabled={penIndex === 0}
          onClick={() => setPenIndex((i) => i - 1)}
          className="rounded-2xl bg-slate-800 py-4 font-semibold disabled:opacity-40"
        >
          ← Prev
        </button>
        {penIndex < loadPens.length - 1 ? (
          <button
            type="button"
            onClick={() => setPenIndex((i) => i + 1)}
            className="rounded-2xl bg-green-600 py-4 font-semibold"
          >
            Next →
          </button>
        ) : (
          <button
            type="button"
            disabled={saving}
            onClick={finishRun}
            className="rounded-2xl bg-green-600 py-4 font-semibold disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Finish load'}
          </button>
        )}
      </div>
    </div>
  )
}
