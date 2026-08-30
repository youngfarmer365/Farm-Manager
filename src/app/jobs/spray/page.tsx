'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getFarmAccess } from '@/lib/farm-access'
import { AppHeader } from '@/components/layout/AppHeader'
import { searchPcs, type PcsProduct } from '@/lib/pcs-products'
import { centroid, geojsonToRing } from '@/lib/geo'
import { fetchWeather, formatWeather } from '@/lib/weather'
import Link from 'next/link'

type Field = { id: string; name: string; area_ha: number | null; geojson: any }
type MixLine = {
  key: string
  name: string
  pcs: string
  unit: string
  rate: number
}

export default function SprayPage() {
  const supabase = createClient()
  const [farmId, setFarmId] = useState<string | null>(null)
  const [fields, setFields] = useState<Field[]>([])
  const [sprayers, setSprayers] = useState<any[]>([])
  const [sprayerName, setSprayerName] = useState('Main sprayer')
  const [tank, setTank] = useState('800')
  const [sprayerId, setSprayerId] = useState('')
  const [water, setWater] = useState('200')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [q, setQ] = useState('')
  const [mix, setMix] = useState<MixLine[]>([])
  const [grazeDays, setGrazeDays] = useState('7')
  const [msg, setMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getFarmAccess().then(async (a) => {
      if (!a.farmId) return
      setFarmId(a.farmId)
      const f = await supabase.from('farm_fields').select('id, name, area_ha, geojson').eq('farm_id', a.farmId).order('name')
      const s = await supabase.from('sprayers').select('*').eq('farm_id', a.farmId)
      setFields((f.data as Field[]) || [])
      setSprayers(s.data || [])
      if (s.data?.[0]) {
        setSprayerId(s.data[0].id)
        setTank(String(s.data[0].tank_litres))
        setWater(String(s.data[0].default_water_l_ha || 200))
        setSprayerName(s.data[0].name)
      }
    })
  }, [])

  const selectedFields = fields.filter((f) => picked.has(f.id))
  const totalHa = selectedFields.reduce((s, f) => s + (Number(f.area_ha) || 0), 0)
  const tankL = Number(tank) || 0
  const waterLha = Number(water) || 0
  const waterNeeded = totalHa * waterLha
  const over = tankL > 0 && waterNeeded > tankL + 0.5
  const fills = tankL > 0 ? Math.ceil(waterNeeded / tankL) : 1
  const hits = searchPcs(q).slice(0, 12)

  const fieldCls = 'min-h-[48px] w-full rounded-xl border-2 border-slate-500 bg-white px-3 text-base font-semibold'

  async function saveSprayer() {
    if (!farmId) return
    if (sprayerId) {
      await supabase.from('sprayers').update({ name: sprayerName, tank_litres: Number(tank), default_water_l_ha: Number(water) }).eq('id', sprayerId)
      setMsg('Sprayer updated')
      return
    }
    const { data, error } = await supabase
      .from('sprayers')
      .insert({ farm_id: farmId, name: sprayerName, tank_litres: Number(tank), default_water_l_ha: Number(water) })
      .select()
      .single()
    if (error) setMsg(error.message)
    else {
      setSprayerId(data.id)
      setSprayers((p) => [...p, data])
      setMsg('Sprayer saved')
    }
  }

  function addProduct(p: PcsProduct) {
    setMix((m) => [
      ...m,
      {
        key: p.pcs + '-' + Date.now(),
        name: p.name,
        pcs: p.pcs,
        unit: p.unit,
        rate: p.typicalRate,
      },
    ])
  }

  function addCustom() {
    const name = q.trim()
    if (!name) return
    setMix((m) => [
      ...m,
      { key: 'c-' + Date.now(), name, pcs: '', unit: 'L/ha', rate: 1 },
    ])
    setQ('')
  }

  async function completeJob() {
    if (!farmId || selectedFields.length === 0 || mix.length === 0) {
      setMsg('Pick fields and at least one chemical')
      return
    }
    if (over) {
      const ok = confirm(
        'Tank is too small for ' +
          totalHa.toFixed(2) +
          ' ha at ' +
          waterLha +
          ' L/ha. Needs about ' +
          fills +
          ' fill(s). Continue?'
      )
      if (!ok) return
    }
    setSaving(true)
    const c = centroid(geojsonToRing(selectedFields[0].geojson))
    const weather = c ? await fetchWeather(c.lat, c.lng) : null
    const { data: job, error } = await supabase
      .from('spray_jobs')
      .insert({
        farm_id: farmId,
        sprayer_id: sprayerId || null,
        water_l_ha: waterLha,
        status: 'completed',
        weather,
        grazing_interval_days: Number(grazeDays) || 0,
        applied_on: new Date().toISOString().slice(0, 10),
        completed_at: new Date().toISOString(),
      })
      .select()
      .single()
    if (error || !job) {
      setMsg(error?.message || 'Could not save job')
      setSaving(false)
      return
    }
    await supabase.from('spray_job_fields').insert(
      selectedFields.map((f) => ({
        job_id: job.id,
        field_id: f.id,
        area_ha: Number(f.area_ha) || 0,
      }))
    )
    await supabase.from('spray_job_products').insert(
      mix.map((m, i) => ({
        job_id: job.id,
        sort_order: i,
        fill_order: i,
        product_name: m.name,
        pcs_number: m.pcs || null,
        unit: m.unit,
        rate: m.rate,
        amount_total: m.rate * totalHa,
      }))
    )
    for (const m of mix) {
      const amount = m.rate * totalHa
      const unit = m.unit.startsWith('g') ? 'g' : m.unit.startsWith('kg') ? 'kg' : 'L'
      const { data: stock } = await supabase
        .from('chemical_stock')
        .select('*')
        .eq('farm_id', farmId)
        .eq('product_name', m.name)
        .maybeSingle()
      if (stock) {
        await supabase
          .from('chemical_stock')
          .update({ quantity: Number(stock.quantity) - amount, updated_at: new Date().toISOString() })
          .eq('id', stock.id)
      } else {
        await supabase.from('chemical_stock').insert({
          farm_id: farmId,
          product_name: m.name,
          pcs_number: m.pcs || null,
          unit,
          quantity: -amount,
        })
      }
    }
    setSaving(false)
    window.location.href = '/jobs/spray/fill?job=' + job.id
  }

  const fillRows = mix.map((m, i) => ({
    i: i + 1,
    ...m,
    amount: m.rate * totalHa,
  }))

  return (
    <div className="min-h-screen bg-slate-200">
      <AppHeader
        title="Sprayer"
        extra={<Link href="/jobs/inventory" className="font-bold">Inventory</Link>}
      />
      <main className="mx-auto max-w-3xl space-y-4 p-4">
        <section className="space-y-2 rounded-xl border-2 border-slate-500 bg-white p-4">
          <h2 className="text-lg font-bold">1. Sprayer</h2>
          {sprayers.length > 0 && (
            <select
              className={fieldCls}
              value={sprayerId}
              onChange={(e) => {
                const s = sprayers.find((x) => x.id === e.target.value)
                setSprayerId(e.target.value)
                if (s) {
                  setTank(String(s.tank_litres))
                  setWater(String(s.default_water_l_ha || 200))
                  setSprayerName(s.name)
                }
              }}
            >
              {sprayers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.tank_litres} L)
                </option>
              ))}
            </select>
          )}
          <input className={fieldCls} value={sprayerName} onChange={(e) => setSprayerName(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-sm font-bold">Tank litres</label>
              <input className={fieldCls} type="number" value={tank} onChange={(e) => setTank(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-bold">Water L/ha</label>
              <input className={fieldCls} type="number" value={water} onChange={(e) => setWater(e.target.value)} />
            </div>
          </div>
          <button type="button" className="min-h-[48px] w-full rounded-xl border-2 font-bold" onClick={saveSprayer}>
            Save sprayer
          </button>
        </section>

        <section className="space-y-2 rounded-xl border-2 border-slate-500 bg-white p-4">
          <h2 className="text-lg font-bold">2. Fields</h2>
          {fields.length === 0 && (
            <p className="font-semibold">
              Draw fields on the <Link className="underline" href="/map">farm map</Link> first.
            </p>
          )}
          {fields.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() =>
                setPicked((prev) => {
                  const n = new Set(prev)
                  if (n.has(f.id)) n.delete(f.id)
                  else n.add(f.id)
                  return n
                })
              }
              className={
                'min-h-[48px] w-full rounded-xl border-2 text-left px-3 font-bold ' +
                (picked.has(f.id) ? 'border-brand-900 bg-brand-700 text-white' : 'border-slate-400 bg-white')
              }
            >
              {picked.has(f.id) ? '✓ ' : ''}
              {f.name} · {f.area_ha != null ? Number(f.area_ha).toFixed(2) : '0.00'} ha
            </button>
          ))}
          <p className="text-lg font-bold">
            {totalHa.toFixed(2)} ha · {waterNeeded.toFixed(0)} L water
          </p>
          {over && (
            <p className="rounded-xl border-4 border-red-800 bg-red-100 p-3 text-base font-bold text-red-950">
              Warning: {waterNeeded.toFixed(0)} L needed but tank is {tankL} L. About {fills} fill(s) required, or
              drop hectares / water rate.
            </p>
          )}
        </section>

        <section className="space-y-2 rounded-xl border-2 border-slate-500 bg-white p-4">
          <h2 className="text-lg font-bold">3. Chemicals (PCS search)</h2>
          <p className="text-sm font-semibold">
            Irish product list for grassland and tillage. Check the current label on{' '}
            <a className="underline" href="https://www.pcs.agriculture.gov.ie/products/" target="_blank" rel="noreferrer">
              pcs.agriculture.gov.ie
            </a>
            . Order you add them = fill order.
          </p>
          <input
            className={fieldCls}
            placeholder="Search name, active, PCS no…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="max-h-48 space-y-1 overflow-y-auto">
            {hits.map((p) => (
              <button
                key={p.pcs + p.name}
                type="button"
                className="min-h-[44px] w-full rounded-lg border-2 border-slate-400 bg-slate-50 px-2 text-left text-sm font-bold"
                onClick={() => addProduct(p)}
              >
                + {p.name} · {p.active} · {p.typicalRate} {p.unit}
              </button>
            ))}
          </div>
          <button type="button" className="min-h-[44px] w-full rounded-xl border-2 font-bold" onClick={addCustom}>
            Add typed name as custom product
          </button>
          <ul className="space-y-2">
            {mix.map((m, idx) => (
              <li key={m.key} className="rounded-xl border-2 bg-slate-100 p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold">
                    {idx + 1}. {m.name}
                  </span>
                  <button
                    type="button"
                    className="font-bold text-red-800"
                    onClick={() => setMix((x) => x.filter((y) => y.key !== m.key))}
                  >
                    Remove
                  </button>
                </div>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <input
                    className={fieldCls}
                    type="number"
                    step="0.001"
                    value={m.rate}
                    onChange={(e) =>
                      setMix((x) =>
                        x.map((y) => (y.key === m.key ? { ...y, rate: Number(e.target.value) } : y))
                      )
                    }
                  />
                  <select
                    className={fieldCls}
                    value={m.unit}
                    onChange={(e) =>
                      setMix((x) => x.map((y) => (y.key === m.key ? { ...y, unit: e.target.value } : y)))
                    }
                  >
                    <option>L/ha</option>
                    <option>kg/ha</option>
                    <option>g/ha</option>
                  </select>
                </div>
                <p className="mt-1 font-semibold">
                  Tank need: {(m.rate * totalHa).toFixed(2)} {m.unit.replace('/ha', '')} for {totalHa.toFixed(2)} ha
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-2 rounded-xl border-4 border-brand-800 bg-brand-50 p-4 print:border-black">
          <h2 className="text-xl font-bold">4. Fill sheet</h2>
          <p className="font-semibold">
            Water {waterNeeded.toFixed(0)} L at {waterLha} L/ha · {totalHa.toFixed(2)} ha
          </p>
          <ol className="list-decimal space-y-2 pl-6 text-lg font-bold">
            <li>Add {waterNeeded.toFixed(0)} L water (or fill tank and repeat {fills} times if over capacity)</li>
            {fillRows.map((r) => (
              <li key={r.key}>
                {r.name}: {r.amount.toFixed(2)} {r.unit.replace('/ha', '')} ({r.rate} {r.unit})
              </li>
            ))}
          </ol>
          <label className="block text-sm font-bold">Do not graze for (days)</label>
          <input className={fieldCls} type="number" value={grazeDays} onChange={(e) => setGrazeDays(e.target.value)} />
          {msg && <p className="font-bold">{msg}</p>}
          <button
            type="button"
            disabled={saving}
            className="min-h-[56px] w-full rounded-xl border-2 border-brand-900 bg-brand-700 text-lg font-bold text-white"
            onClick={completeJob}
          >
            {saving ? 'Saving…' : 'Complete fill — update inventory'}
          </button>
          <button type="button" className="min-h-[48px] w-full rounded-xl border-2 font-bold" onClick={() => window.print()}>
            Print fill sheet
          </button>
        </section>
      </main>
    </div>
  )
}
