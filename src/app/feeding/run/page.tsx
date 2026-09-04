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
