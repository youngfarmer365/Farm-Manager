'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Pen {
  id: string
  name: string
}

interface AnimalRow {
  id: string
  tag: string
  breed: string | null
  status: string
  pen_id: string | null
  pen_name?: string | null
  latest_weight_kg: number | null
  adg_kg_per_day: number | null
  days_on_farm: number | null
  purchase_price: number | null
  sale_price: number | null
  sale_date: string | null
}

interface FeedPenRow {
  id: string
  pen_id: string
  pen_name: string | null
  planned_kg: number
  actual_kg: number
  animal_count: number | null
  kg_per_head: number | null
  cost_allocated: number | null
  cost_per_head: number | null
  run: {
    id: string
    finished_at: string | null
    started_at: string
    load_name: string | null
  } | null
}

interface TreatmentRow {
  id: string
  animal_id: string
  medicine_name: string | null
  treated_at: string
  cost: number | null
  ml_used: number | null
  withdrawal_days: number | null
  tag?: string
  pen_name?: string
}

function daysAgoIso(n: number) {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function shortTag(tag: string) {
  const c = tag.replace(/\s/g, '')
  return c.length <= 5 ? c : c.slice(-5)
}

export default function PenDashboardPage() {
  const [pens, setPens] = useState<Pen[]>([])
  const [selectedPenIds, setSelectedPenIds] = useState<Set<string>>(new Set())
  const [dateFrom, setDateFrom] = useState(daysAgoIso(30))
  const [dateTo, setDateTo] = useState(todayIso())
  const [animals, setAnimals] = useState<AnimalRow[]>([])
  const [feedRows, setFeedRows] = useState<FeedPenRow[]>([])
  const [treatments, setTreatments] = useState<TreatmentRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [includePurchase, setIncludePurchase] = useState(false)
  const [includeSale, setIncludeSale] = useState(false)
  const [includeSold, setIncludeSold] = useState(true)

  const supabase = createClient()

  useEffect(() => {
    async function init() {
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
      const { data } = await supabase
        .from('pens')
        .select('id, name')
        .eq('farm_id', membership.farm_id)
        .eq('is_active', true)
        .order('name')
      setPens((data as Pen[]) || [])
    }
    init()
  }, [])

  function togglePen(id: string) {
    setSelectedPenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAllPens() {
    setSelectedPenIds(new Set(pens.map((p) => p.id)))
  }

  function clearPens() {
    setSelectedPenIds(new Set())
  }

  async function loadDashboard() {
    const penIds = Array.from(selectedPenIds)
    if (!penIds.length) {
      setError('Select at least one pen')
      return
    }
    setLoading(true)
    setError(null)

    const fromTs = dateFrom + 'T00:00:00'
    const toTs = dateTo + 'T23:59:59'
    const nameByPen = new Map(pens.map((p) => [p.id, p.name]))

    const cols =
      'id, tag, breed, status, pen_id, pen_name, latest_weight_kg, adg_kg_per_day, days_on_farm, purchase_price, sale_price, sale_date'

    // Active animals still in selected pens
    const { data: activeAnim, error: aErr } = await supabase
      .from('animals_enriched')
      .select(cols)
      .in('pen_id', penIds)
      .eq('status', 'active')
      .order('tag')

    let list: AnimalRow[] = []

    if (aErr) {
      const { data: active2 } = await supabase
        .from('animals')
        .select('id, tag, breed, status, pen_id, purchase_price, sale_price, sale_date')
        .in('pen_id', penIds)
        .eq('status', 'active')
        .order('tag')
      list = ((active2 || []) as any[]).map((a) => ({
        ...a,
        pen_name: nameByPen.get(a.pen_id) || null,
        latest_weight_kg: null,
        adg_kg_per_day: null,
        days_on_farm: null,
      }))
    } else {
      list = (activeAnim as AnimalRow[]) || []
    }

    // Sold animals: still linked to these pens, and/or sold in date range with pen_id
    if (includeSold) {
      // 1) status sold (or similar) and pen_id still set
      const { data: soldInPen } = await supabase
        .from('animals_enriched')
        .select(cols)
        .in('pen_id', penIds)
        .neq('status', 'active')

      // 2) sold in date range — may still have pen_id
      const { data: soldByDate } = await supabase
        .from('animals_enriched')
        .select(cols)
        .not('sale_price', 'is', null)
        .gte('sale_date', dateFrom)
        .lte('sale_date', dateTo)

      const extra = [...(soldInPen || []), ...(soldByDate || [])] as AnimalRow[]

      // Keep if pen is selected OR (sale in range and pen in selection)
      const byId = new Map(list.map((a) => [a.id, a]))
      for (const a of extra) {
        const inSelectedPen = a.pen_id && penIds.includes(a.pen_id)
        const saleInRange =
          a.sale_date && a.sale_date >= dateFrom && a.sale_date <= dateTo
        if (!inSelectedPen && !(saleInRange && inSelectedPen)) {
          // If pen was cleared on sale, we cannot attribute to shed — skip unless pen still set
          if (!inSelectedPen) continue
        }
        if (!inSelectedPen) continue
        if (!byId.has(a.id)) {
          byId.set(a.id, {
            ...a,
            pen_name: a.pen_name || nameByPen.get(a.pen_id || '') || null,
          })
        }
      }
      list = Array.from(byId.values()).sort((a, b) => a.tag.localeCompare(b.tag))
    }

    setAnimals(list)

    // Feed
    const { data: runs } = await supabase
      .from('feed_runs')
      .select('id, finished_at, started_at, load_name')
      .gte('finished_at', fromTs)
      .lte('finished_at', toTs)
      .order('finished_at', { ascending: false })

    const runIds = (runs || []).map((r) => r.id)
    const runById = new Map((runs || []).map((r) => [r.id, r]))

    let feed: FeedPenRow[] = []
    if (runIds.length) {
      const { data: fp, error: fErr } = await supabase
        .from('feed_run_pens')
        .select(
          'id, pen_id, pen_name, planned_kg, actual_kg, animal_count, kg_per_head, cost_allocated, cost_per_head, run_id'
        )
        .in('pen_id', penIds)
        .in('run_id', runIds)

      if (fErr) setError(fErr.message)
      feed = ((fp || []) as any[]).map((row) => ({
        ...row,
        run: runById.get(row.run_id)
          ? {
              id: row.run_id,
              finished_at: runById.get(row.run_id)!.finished_at,
              started_at: runById.get(row.run_id)!.started_at,
              load_name: runById.get(row.run_id)!.load_name,
            }
          : null,
      }))
      feed.sort((a, b) => (b.run?.finished_at || '').localeCompare(a.run?.finished_at || ''))
    }
    setFeedRows(feed)

    // Treatments for all animals in list (active + sold)
    const animalIds = list.map((a) => a.id)
    if (animalIds.length) {
      const { data: tx } = await supabase
        .from('treatments')
        .select('id, animal_id, medicine_name, treated_at, cost, ml_used, withdrawal_days')
        .in('animal_id', animalIds)
        .gte('treated_at', dateFrom)
        .lte('treated_at', dateTo)
        .order('treated_at', { ascending: false })

      const tagById = new Map(list.map((a) => [a.id, a.tag]))
      const penByAnimal = new Map(
        list.map((a) => [a.id, a.pen_name || nameByPen.get(a.pen_id || '') || ''])
      )
      setTreatments(
        ((tx || []) as any[]).map((t) => ({
          ...t,
          tag: tagById.get(t.animal_id) || '',
          pen_name: penByAnimal.get(t.animal_id) || '',
        }))
      )
    } else {
      setTreatments([])
    }

    setLoading(false)
  }

  const selectedNames = pens.filter((p) => selectedPenIds.has(p.id)).map((p) => p.name)

  const stats = useMemo(() => {
    const activeAnimals = animals.filter((a) => a.status === 'active')
    const soldAnimals = animals.filter((a) => a.status !== 'active')
    const headActive = activeAnimals.length
    const headSold = soldAnimals.length
    const head = animals.length

    const totalLive = activeAnimals.reduce(
      (s, a) => s + (Number(a.latest_weight_kg) || 0),
      0
    )
    const purchaseValue = animals.reduce((s, a) => s + (Number(a.purchase_price) || 0), 0)
    // Revenue: sale prices on animals that have them (mainly sold; active with sale also counts)
    const saleValue = animals.reduce((s, a) => s + (Number(a.sale_price) || 0), 0)
    const withSale = animals.filter((a) => a.sale_price != null && Number(a.sale_price) > 0)

    const adgs = activeAnimals
      .map((a) => Number(a.adg_kg_per_day))
      .filter((n) => n != null && !Number.isNaN(n))
    const avgAdg = adgs.length ? adgs.reduce((s, n) => s + n, 0) / adgs.length : null

    const feedCost = feedRows.reduce((s, r) => s + Number(r.cost_allocated || 0), 0)
    const feedKg = feedRows.reduce((s, r) => s + Number(r.actual_kg || 0), 0)
    const medicineCost = treatments.reduce((s, t) => s + Number(t.cost || 0), 0)

    const periodVariableCost = feedCost + medicineCost
    const totalCosts = periodVariableCost + (includePurchase ? purchaseValue : 0)
    const revenue = includeSale ? saleValue : 0
    const profit = revenue - totalCosts
    const showPl = includeSale

    const kgHeads = feedRows.filter((r) => r.kg_per_head != null)
    const costHeads = feedRows.filter((r) => r.cost_per_head != null)
    const avgKgHead = kgHeads.length
      ? kgHeads.reduce((s, r) => s + Number(r.kg_per_head), 0) / kgHeads.length
      : null
    const avgCostHead = costHeads.length
      ? costHeads.reduce((s, r) => s + Number(r.cost_per_head), 0) / costHeads.length
      : null

    const byPen = new Map<
      string,
      {
        name: string
        feed: number
        kg: number
        headsActive: number
        headsSold: number
        purchase: number
        sale: number
      }
    >()
    for (const p of selectedPenIds) {
      const inPen = animals.filter((a) => a.pen_id === p)
      byPen.set(p, {
        name: pens.find((x) => x.id === p)?.name || p,
        feed: 0,
        kg: 0,
        headsActive: inPen.filter((a) => a.status === 'active').length,
        headsSold: inPen.filter((a) => a.status !== 'active').length,
        purchase: inPen.reduce((s, a) => s + (Number(a.purchase_price) || 0), 0),
        sale: inPen.reduce((s, a) => s + (Number(a.sale_price) || 0), 0),
      })
    }
    for (const r of feedRows) {
      const cur = byPen.get(r.pen_id)
      if (!cur) continue
      cur.feed += Number(r.cost_allocated || 0)
      cur.kg += Number(r.actual_kg || 0)
    }
    const medByPen = new Map<string, number>()
    for (const t of treatments) {
      const animal = animals.find((a) => a.id === t.animal_id)
      const pid = animal?.pen_id
      if (!pid) continue
      medByPen.set(pid, (medByPen.get(pid) || 0) + Number(t.cost || 0))
    }

    const penBreakdown = Array.from(byPen.entries()).map(([id, v]) => {
      const med = medByPen.get(id) || 0
      const period = v.feed + med
      const costs = period + (includePurchase ? v.purchase : 0)
      const rev = includeSale ? v.sale : 0
      return {
        id,
        name: v.name,
        headsActive: v.headsActive,
        headsSold: v.headsSold,
        feedKg: v.kg,
        feedCost: v.feed,
        medicineCost: med,
        purchase: v.purchase,
        sale: v.sale,
        costs,
        profit: rev - costs,
      }
    })

    const byDay = new Map<string, { kg: number; cost: number; loads: number }>()
    for (const r of feedRows) {
      const day = (r.run?.finished_at || '').slice(0, 10)
      if (!day) continue
      const cur = byDay.get(day) || { kg: 0, cost: 0, loads: 0 }
      cur.kg += Number(r.actual_kg || 0)
      cur.cost += Number(r.cost_allocated || 0)
      cur.loads += 1
      byDay.set(day, cur)
    }
    const daily = Array.from(byDay.entries())
      .map(([day, v]) => ({ day, ...v }))
      .sort((a, b) => b.day.localeCompare(a.day))

    return {
      head,
      headActive,
      headSold,
      totalLive,
      purchaseValue,
      saleValue,
      soldWithPrice: withSale.length,
      avgAdg,
      feedCost,
      feedKg,
      medicineCost,
      periodVariableCost,
      totalCosts,
      revenue,
      profit,
      showPl,
      avgKgHead,
      avgCostHead,
      penBreakdown,
      daily,
      medicineCount: treatments.length,
    }
  }, [animals, feedRows, treatments, selectedPenIds, pens, includePurchase, includeSale])

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b px-4 py-3">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">Pen dashboard</h1>
          <Link href="/feeding" className="text-sm text-slate-600 hover:underline">
            Feeding
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-white rounded-xl border p-4 shadow-sm space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-500">Pens / fields</label>
              <div className="flex gap-2 text-xs">
                <button type="button" onClick={selectAllPens} className="underline text-slate-600">
                  All
                </button>
                <button type="button" onClick={clearPens} className="underline text-slate-600">
                  Clear
                </button>
              </div>
            </div>
            <ul className="border rounded-lg divide-y max-h-40 overflow-y-auto">
              {pens.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => togglePen(p.id)}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${
                      selectedPenIds.has(p.id) ? 'bg-green-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className={`h-4 w-4 rounded border flex items-center justify-center text-[10px] ${
                        selectedPenIds.has(p.id)
                          ? 'bg-green-600 border-green-600 text-white'
                          : 'border-slate-300'
                      }`}
                    >
                      {selectedPenIds.has(p.id) ? '✓' : ''}
                    </span>
                    {p.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs text-slate-500 mb-1">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="button"
              disabled={!selectedPenIds.size || loading}
              onClick={loadDashboard}
              className="rounded-lg bg-brand-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {loading ? 'Loading…' : 'Apply'}
            </button>
          </div>

          <div className="flex flex-wrap gap-4 text-xs text-slate-600">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={includeSold}
                onChange={(e) => setIncludeSold(e.target.checked)}
              />
              Include sold animals (for revenue)
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={includePurchase}
                onChange={(e) => setIncludePurchase(e.target.checked)}
              />
              Include purchase price
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={includeSale}
                onChange={(e) => setIncludeSale(e.target.checked)}
              />
              Include sale price if available
            </label>
          </div>
          <p className="text-[11px] text-slate-400">
            Sold animals are included when they still have the pen assigned. On sale, leave{' '}
            <strong>pen</strong> set (or set it to the finishing pen) so revenue stays on the shed.
          </p>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {!selectedPenIds.size ? (
          <p className="text-sm text-slate-500">Select one or more pens.</p>
        ) : (
          <>
            <div className="rounded-xl border-2 border-slate-800 bg-slate-900 text-white p-5 shadow-sm">
              <div className="text-xs uppercase tracking-wide text-slate-400">
                {stats.showPl ? 'Profit & loss' : 'Costs'} · {selectedNames.join(', ')} · {dateFrom}{' '}
                → {dateTo}
              </div>

              {stats.showPl ? (
                <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase">Revenue</div>
                    <div className="text-xl font-bold text-green-400">
                      €{stats.revenue.toFixed(0)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase">Costs</div>
                    <div className="text-xl font-bold text-red-300">
                      €{stats.totalCosts.toFixed(0)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase">Profit</div>
                    <div
                      className={`text-2xl font-bold ${
                        stats.profit >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      €{stats.profit.toFixed(0)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-4xl font-bold mt-1">€{stats.totalCosts.toFixed(2)}</div>
              )}

              <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-300">
                <span>
                  Active <strong className="text-white">{stats.headActive}</strong>
                </span>
                <span>
                  Sold in view <strong className="text-white">{stats.headSold}</strong>
                </span>
                <span>
                  With sale € <strong className="text-white">{stats.soldWithPrice}</strong>
                </span>
                <span>
                  Feed €{stats.feedCost.toFixed(0)} · Med €{stats.medicineCost.toFixed(0)}
                </span>
              </div>
            </div>

            <section className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b font-semibold text-sm">By pen</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Pen</th>
                      <th className="px-3 py-2">Active</th>
                      <th className="px-3 py-2">Sold</th>
                      <th className="px-3 py-2">Feed €</th>
                      <th className="px-3 py-2">Med €</th>
                      {includePurchase && <th className="px-3 py-2">Purchase</th>}
                      {includeSale && <th className="px-3 py-2">Sales</th>}
                      <th className="px-3 py-2">Costs</th>
                      {includeSale && <th className="px-3 py-2">Profit</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {stats.penBreakdown.map((p) => (
                      <tr key={p.id} className="border-t">
                        <td className="px-3 py-2 font-medium">{p.name}</td>
                        <td className="px-3 py-2">{p.headsActive}</td>
                        <td className="px-3 py-2">{p.headsSold}</td>
                        <td className="px-3 py-2">€{p.feedCost.toFixed(0)}</td>
                        <td className="px-3 py-2">€{p.medicineCost.toFixed(0)}</td>
                        {includePurchase && (
                          <td className="px-3 py-2">€{p.purchase.toFixed(0)}</td>
                        )}
                        {includeSale && (
                          <td className="px-3 py-2">€{p.sale.toFixed(0)}</td>
                        )}
                        <td className="px-3 py-2 font-medium">€{p.costs.toFixed(0)}</td>
                        {includeSale && (
                          <td
                            className={`px-3 py-2 font-semibold ${
                              p.profit >= 0 ? 'text-green-700' : 'text-red-600'
                            }`}
                          >
                            €{p.profit.toFixed(0)}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b font-semibold text-sm">Animals</div>
              <div className="overflow-x-auto max-h-72 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs text-slate-500 sticky top-0">
                    <tr>
                      <th className="px-3 py-2">Tag</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Pen</th>
                      <th className="px-3 py-2">Purchase</th>
                      <th className="px-3 py-2">Sale</th>
                      <th className="px-3 py-2">Sale date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {animals.map((a) => (
                      <tr
                        key={a.id}
                        className={`border-t ${a.status !== 'active' ? 'bg-slate-50' : ''}`}
                      >
                        <td className="px-3 py-2">
                          <Link
                            href={`/animals/${a.id}`}
                            className="font-mono text-brand-800 hover:underline"
                          >
                            {shortTag(a.tag)}
                          </Link>
                        </td>
                        <td className="px-3 py-2 capitalize text-xs">{a.status}</td>
                        <td className="px-3 py-2 text-xs">{a.pen_name || '—'}</td>
                        <td className="px-3 py-2">
                          {a.purchase_price != null
                            ? `€${Number(a.purchase_price).toFixed(0)}`
                            : '—'}
                        </td>
                        <td className="px-3 py-2">
                          {a.sale_price != null ? `€${Number(a.sale_price).toFixed(0)}` : '—'}
                        </td>
                        <td className="px-3 py-2 text-xs">{a.sale_date || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b font-semibold text-sm">
                Medicines · €{stats.medicineCost.toFixed(2)}
              </div>
              {treatments.length === 0 ? (
                <p className="p-4 text-sm text-slate-500">None in range.</p>
              ) : (
                <div className="overflow-x-auto max-h-40 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Tag</th>
                        <th className="px-3 py-2">Medicine</th>
                        <th className="px-3 py-2">€</th>
                      </tr>
                    </thead>
                    <tbody>
                      {treatments.map((t) => (
                        <tr key={t.id} className="border-t">
                          <td className="px-3 py-2">{t.treated_at}</td>
                          <td className="px-3 py-2 font-mono">
                            {t.tag ? shortTag(t.tag) : '—'}
                          </td>
                          <td className="px-3 py-2">{t.medicine_name || '—'}</td>
                          <td className="px-3 py-2">
                            {t.cost != null ? `€${Number(t.cost).toFixed(2)}` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  )
}