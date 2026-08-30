// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getFarmAccess } from '@/lib/farm-access'
import { loadFarmFields, type FarmFieldRow } from '@/lib/fields'
import { AppHeader } from '@/components/layout/AppHeader'
import { FieldPicker } from '@/components/fields/FieldPicker'
import { centroid, geojsonToRing } from '@/lib/geo'
import { fetchWeather } from '@/lib/weather'
import Link from 'next/link'

type MixLine = {
  key: string
  stockId?: string
  name: string
  pcs: string
  unit: string
  rate: number
  phiDays: number | null
}

type StockRow = {
  id: string
  product_name: string
  pcs_number: string | null
  unit: string
  quantity: number
  phi_days: number | null
}

function rateUnit(stockUnit: string) {
  const u = (stockUnit || 'L').replace('/ha', '')
  if (u === 'kg') return 'kg/ha'
  if (u === 'g') return 'g/ha'
  return 'L/ha'
}

export default function SprayPage() {
  const supabase = createClient()
  const [farmId, setFarmId] = useState(null)
  const [fields, setFields] = useState([])
  const [sprayers, setSprayers] = useState([])
  const [sprayerName, setSprayerName] = useState('Main sprayer')
  const [tank, setTank] = useState('800')
  const [sprayerId, setSprayerId] = useState('')
  const [water, setWater] = useState('200')
  const [picked, setPicked] = useState(new Set())
  const [stock, setStock] = useState([])
  const [stockQ, setStockQ] = useState('')
  const [mix, setMix] = useState([])
  const [grazeDays, setGrazeDays] = useState('')
  const [msg, setMsg] = useState(null)
  const [saving, setSaving] = useState(false)
  const [landJobId, setLandJobId] = useState(null)
  const [newName, setNewName] = useState('')
  const [newPcs, setNewPcs] = useState('')
  const [newPhi, setNewPhi] = useState('')
  const [showNew, setShowNew] = useState(false)

  async function loadStock(fid) {
    const { data } = await supabase.from('chemical_stock').select('*').eq('farm_id', fid).order('product_name')
    setStock(data || [])
  }

  useEffect(() => {
    getFarmAccess().then(async (a) => {
      if (!a.farmId) return
      setFarmId(a.farmId)
      const loaded = await loadFarmFields(a.farmId)
      setFields(loaded.data)
      await loadStock(a.farmId)
      const s = await supabase.from('sprayers').select('*').eq('farm_id', a.farmId)
      setSprayers(s.data || [])
      if (s.data && s.data[0]) {
        setSprayerId(s.data[0].id)
        setTank(String(s.data[0].tank_litres))
        setWater(String(s.data[0].default_water_l_ha || 200))
        setSprayerName(s.data[0].name)
      }
      const sp = new URLSearchParams(window.location.search)
      const jobQ = sp.get('job')
      const fieldsQ = sp.get('fields')
      const next = new Set()
      if (fieldsQ) fieldsQ.split(',').filter(Boolean).forEach((id) => next.add(id))
      if (jobQ) {
        setLandJobId(jobQ)
        const { data: jf } = await supabase.from('land_job_fields').select('field_id').eq('job_id', jobQ)
        ;(jf || []).forEach((r) => next.add(r.field_id))
      }
      if (next.size) setPicked(next)
    })
  }, [])

  useEffect(() => {
    function refresh() { if (farmId) loadStock(farmId) }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [farmId])

  const selectedFields = fields.filter((f) => picked.has(f.id))
  const totalHa = selectedFields.reduce((s, f) => s + (Number(f.area_ha) || 0), 0)
  const tankL = Number(tank) || 0
  const waterLha = Number(water) || 0
  const waterNeeded = totalHa * waterLha
  const over = tankL > 0 && waterNeeded > tankL + 0.5
  const fills = tankL > 0 ? Math.ceil(waterNeeded / tankL) : 1
  const fieldCls = 'min-h-[48px] w-full rounded-xl border-2 border-slate-500 bg-white px-3 text-base font-semibold'
  const maxPhi = mix.reduce((n, m) => Math.max(n, Number(m.phiDays) || 0), 0)
  const filteredStock = stock.filter((r) => {
    const s = stockQ.trim().toLowerCase()
    if (!s) return true
    return r.product_name.toLowerCase().includes(s) || (r.pcs_number || '').toLowerCase().includes(s)
  })

  async function saveSprayer() {
    if (!farmId) return
    if (sprayerId) {
      await supabase.from('sprayers').update({ name: sprayerName, tank_litres: Number(tank), default_water_l_ha: Number(water) }).eq('id', sprayerId)
      setMsg('Sprayer updated')
      return
    }
    const { data, error } = await supabase.from('sprayers').insert({ farm_id: farmId, name: sprayerName, tank_litres: Number(tank), default_water_l_ha: Number(water) }).select().single()
    if (error) setMsg(error.message)
    else {
      setSprayerId(data.id)
      setSprayers((p) => p.concat([data]))
      setMsg('Sprayer saved')
    }
  }

  function bumpGraze(phi) {
    if (phi == null || Number.isNaN(phi)) return
    setGrazeDays((cur) => {
      const n = Number(cur)
      if (!cur || Number.isNaN(n) || phi > n) return String(phi)
      return cur
    })
  }

  function addFromStock(r) {
    const phi = r.phi_days == null ? null : Number(r.phi_days)
    setMix((m) => m.concat([{
      key: r.id + '-' + Date.now(),
      stockId: r.id,
      name: r.product_name,
      pcs: r.pcs_number || '',
      unit: rateUnit(r.unit),
      rate: 1,
      phiDays: phi,
    }]))
    bumpGraze(phi)
  }

  async function addNewChemical() {
    if (!farmId || !newName.trim()) {
      setMsg('Enter a chemical name')
      return
    }
    const phi = newPhi === '' ? null : Number(newPhi)
    const row = { farm_id: farmId, product_name: newName.trim(), pcs_number: newPcs.trim() || null, unit: 'L', quantity: 0, phi_days: phi }
    let { data, error } = await supabase.from('chemical_stock').insert(row).select('*').single()
    if (error && /phi_days/i.test(error.message)) {
      delete row.phi_days
      const retry = await supabase.from('chemical_stock').insert(row).select('*').single()
      data = retry.data
      error = retry.error
    }
    if (error || !data) {
      setMsg(error ? error.message : 'Could not add chemical')
      return
    }
    setStock((p) => p.concat([data]).sort((a, b) => a.product_name.localeCompare(b.product_name)))
    addFromStock(data)
    setNewName('')
    setNewPcs('')
    setNewPhi('')
    setShowNew(false)
  }

  async function completeJob() {
    if (!farmId || selectedFields.length === 0 || mix.length === 0) {
      setMsg('Pick fields and at least one chemical')
      return
    }
    if (over) {
      const ok = confirm('Tank is too small for ' + totalHa.toFixed(2) + ' ha at ' + waterLha + ' L/ha. Needs about ' + fills + ' fill(s). Continue?')
      if (!ok) return
    }
    setSaving(true)
    const c = centroid(geojsonToRing(selectedFields[0].geojson))
    const weather = c ? await fetchWeather(c.lat, c.lng) : null
    const { data: job, error } = await supabase.from('spray_jobs').insert({
      farm_id: farmId, sprayer_id: sprayerId || null, water_l_ha: waterLha, status: 'completed', weather,
      grazing_interval_days: Number(grazeDays) || maxPhi || 0,
      applied_on: new Date().toISOString().slice(0, 10),
      completed_at: new Date().toISOString(),
    }).select().single()
    if (error || !job) {
      setMsg(error ? error.message : 'Could not save job')
      setSaving(false)
      return
    }
    await supabase.from('spray_job_fields').insert(selectedFields.map((f) => ({ job_id: job.id, field_id: f.id, area_ha: Number(f.area_ha) || 0 })))
    const productRows = mix.map((m, i) => ({
      job_id: job.id, sort_order: i, fill_order: i, product_name: m.name, pcs_number: m.pcs || null,
      unit: m.unit, rate: m.rate, amount_total: m.rate * totalHa, phi_days: m.phiDays,
    }))
    let prodErr = (await supabase.from('spray_job_products').insert(productRows)).error
    if (prodErr && /phi_days/i.test(prodErr.message)) {
      prodErr = (await supabase.from('spray_job_products').insert(productRows.map((row) => {
        const copy = Object.assign({}, row); delete copy.phi_days; return copy
      }))).error
    }
    if (prodErr) {
      setMsg(prodErr.message)
      setSaving(false)
      return
    }
    for (const m of mix) {
      const amount = m.rate * totalHa
      const unit = m.unit.startsWith('g') ? 'g' : m.unit.startsWith('kg') ? 'kg' : 'L'
      if (m.stockId) {
        const row = stock.find((s) => s.id === m.stockId)
        const qty = Number(row && row.quantity || 0) - amount
        await supabase.from('chemical_stock').update({ quantity: qty, updated_at: new Date().toISOString() }).eq('id', m.stockId)
      } else {
        const { data: existing } = await supabase.from('chemical_stock').select('*').eq('farm_id', farmId).eq('product_name', m.name).maybeSingle()
        if (existing) {
          await supabase.from('chemical_stock').update({ quantity: Number(existing.quantity) - amount, updated_at: new Date().toISOString() }).eq('id', existing.id)
        } else {
          await supabase.from('chemical_stock').insert({ farm_id: farmId, product_name: m.name, pcs_number: m.pcs || null, unit, quantity: -amount, phi_days: m.phiDays })
        }
      }
    }
    if (landJobId) {
      await supabase.from('land_jobs').update({ status: 'completed', completed_on: new Date().toISOString().slice(0, 10) }).eq('id', landJobId)
    }
    setSaving(false)
    window.location.href = '/jobs/spray/fill?job=' + job.id
  }

  const fillRows = mix.map((m, i) => Object.assign({ i: i + 1 }, m, { amount: m.rate * totalHa }))

  return (
    <div className="min-h-screen bg-slate-200">
      <AppHeader title="Sprayer" extra={<Link href="/jobs/inventory" className="font-bold">Inventory</Link>} />
      <main className="mx-auto max-w-3xl space-y-4 p-4">
        <section className="space-y-2 rounded-xl border-2 border-slate-500 bg-white p-4">
          <h2 className="text-lg font-bold">1. Sprayer</h2>
          {sprayers.length > 0 && (
            <select className={fieldCls} value={sprayerId} onChange={(e) => {
              const s = sprayers.find((x) => x.id === e.target.value)
              setSprayerId(e.target.value)
              if (s) { setTank(String(s.tank_litres)); setWater(String(s.default_water_l_ha || 200)); setSprayerName(s.name) }
            }}>
              {sprayers.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.tank_litres} L)</option>)}
            </select>
          )}
          <input className={fieldCls} value={sprayerName} onChange={(e) => setSprayerName(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-sm font-bold">Tank litres</label><input className={fieldCls} type="number" value={tank} onChange={(e) => setTank(e.target.value)} /></div>
            <div><label className="text-sm font-bold">Water L/ha</label><input className={fieldCls} type="number" value={water} onChange={(e) => setWater(e.target.value)} /></div>
          </div>
          <button type="button" className="min-h-[48px] w-full rounded-xl border-2 font-bold" onClick={saveSprayer}>Save sprayer</button>
        </section>
        <section className="space-y-2 rounded-xl border-2 border-slate-500 bg-white p-4">
          <h2 className="text-lg font-bold">2. Fields</h2>
          {fields.length === 0 ? (
            <p className="font-semibold">Draw fields on the <Link className="underline" href="/fields/map">field map</Link> first.</p>
          ) : (
            <FieldPicker farmId={farmId} fields={fields} selected={picked} onChange={setPicked} />
          )}
          <p className="text-lg font-bold">{totalHa.toFixed(2)} ha · {waterNeeded.toFixed(0)} L water</p>
          {over && <p className="rounded-xl border-4 border-red-800 bg-red-100 p-3 text-base font-bold text-red-950">Warning: {waterNeeded.toFixed(0)} L needed but tank is {tankL} L. About {fills} fill(s) required.</p>}
        </section>
        <section className="space-y-2 rounded-xl border-2 border-slate-500 bg-white p-4">
          <h2 className="text-lg font-bold">3. Chemicals from your inventory</h2>
          <p className="text-sm font-semibold">Choose a chemical you added under Inventory. <Link className="underline" href="/jobs/inventory">Open inventory</Link></p>
          <label className="block">
            <span className="text-sm font-bold">Choose chemical</span>
            <select className={fieldCls} defaultValue="" onChange={(e) => {
              const r = stock.find((s) => s.id === e.target.value)
              if (r) addFromStock(r)
              e.target.value = ''
            }}>
              <option value="">{stock.length ? 'Select from inventory…' : 'No chemicals yet — add one in Inventory'}</option>
              {stock.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.product_name}{r.pcs_number ? ' · PCS ' + r.pcs_number : ''}{r.phi_days != null ? ' · PHI ' + r.phi_days + 'd' : ''} · {Number(r.quantity).toFixed(2)} {r.unit}
                </option>
              ))}
            </select>
          </label>
          <input className={fieldCls} placeholder="Or type to filter the list below…" value={stockQ} onChange={(e) => setStockQ(e.target.value)} />
          <div className="max-h-56 space-y-1 overflow-y-auto">
            {filteredStock.map((r) => (
              <button key={r.id} type="button" className="min-h-[44px] w-full rounded-lg border-2 border-slate-400 bg-slate-50 px-2 text-left text-sm font-bold" onClick={() => addFromStock(r)}>
                + {r.product_name}{r.pcs_number ? ' · PCS ' + r.pcs_number : ''}{r.phi_days != null ? ' · PHI ' + r.phi_days + 'd' : ''} · {Number(r.quantity).toFixed(2)} {r.unit}
              </button>
            ))}
            {filteredStock.length === 0 && <p className="font-semibold text-slate-600">{stock.length === 0 ? 'No chemicals in inventory yet.' : 'No match in your inventory.'}</p>}
          </div>
          <button type="button" className="min-h-[44px] w-full rounded-xl border-2 font-bold" onClick={() => setShowNew((v) => !v)}>{showNew ? 'Cancel new chemical' : 'Add new chemical to inventory'}</button>
          {showNew && (
            <div className="space-y-2 rounded-xl border-2 border-brand-800 bg-brand-50 p-3">
              <label className="block"><span className="text-sm font-bold">Name</span><input className={fieldCls} value={newName} onChange={(e) => setNewName(e.target.value)} /></label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="block"><span className="text-sm font-bold">PCS No</span><input className={fieldCls} value={newPcs} onChange={(e) => setNewPcs(e.target.value)} /></label>
                <label className="block"><span className="text-sm font-bold">Pre Harvest Interval (Days)</span><input className={fieldCls} type="number" min="0" value={newPhi} onChange={(e) => setNewPhi(e.target.value)} /></label>
              </div>
              <button type="button" className="min-h-[44px] w-full rounded-xl bg-brand-700 font-bold text-white" onClick={addNewChemical}>Save chemical and add to mix</button>
            </div>
          )}
          <ul className="space-y-2">
            {mix.map((m, idx) => (
              <li key={m.key} className="rounded-xl border-2 bg-slate-100 p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold">{idx + 1}. {m.name}{m.pcs ? ' · PCS ' + m.pcs : ''}</span>
                  <button type="button" className="font-bold text-red-800" onClick={() => setMix((x) => x.filter((y) => y.key !== m.key))}>Remove</button>
                </div>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <input className={fieldCls} type="number" step="0.001" value={m.rate} onChange={(e) => setMix((x) => x.map((y) => y.key === m.key ? Object.assign({}, y, { rate: Number(e.target.value) }) : y))} />
                  <select className={fieldCls} value={m.unit} onChange={(e) => setMix((x) => x.map((y) => y.key === m.key ? Object.assign({}, y, { unit: e.target.value }) : y))}>
                    <option>L/ha</option><option>kg/ha</option><option>g/ha</option>
                  </select>
                </div>
                <p className="mt-1 font-semibold">Tank need: {(m.rate * totalHa).toFixed(2)} {m.unit.replace('/ha', '')} for {totalHa.toFixed(2)} ha{m.phiDays != null ? ' · PHI ' + m.phiDays + ' days' : ''}</p>
              </li>
            ))}
          </ul>
        </section>
        <section className="space-y-2 rounded-xl border-4 border-brand-800 bg-brand-50 p-4 print:border-black">
          <h2 className="text-xl font-bold">4. Fill sheet</h2>
          <p className="font-semibold">Water {waterNeeded.toFixed(0)} L at {waterLha} L/ha · {totalHa.toFixed(2)} ha</p>
          <ol className="list-decimal space-y-2 pl-6 text-lg font-bold">
            <li>Add {waterNeeded.toFixed(0)} L water (or fill tank and repeat {fills} times if over capacity)</li>
            {fillRows.map((r) => <li key={r.key}>{r.name}: {r.amount.toFixed(2)} {r.unit.replace('/ha', '')} ({r.rate} {r.unit}{r.phiDays != null ? ' · PHI ' + r.phiDays + 'd' : ''})</li>)}
          </ol>
          <label className="block text-sm font-bold">Pre Harvest Interval / do not graze (days)</label>
          <input className={fieldCls} type="number" min="0" value={grazeDays} onChange={(e) => setGrazeDays(e.target.value)} placeholder={maxPhi ? String(maxPhi) : '0'} />
          {maxPhi > 0 && <p className="text-sm font-semibold">Longest PHI in this mix: {maxPhi} days</p>}
          {msg && <p className="font-bold">{msg}</p>}
          <button type="button" disabled={saving} className="min-h-[56px] w-full rounded-xl border-2 border-brand-900 bg-brand-700 text-lg font-bold text-white" onClick={completeJob}>{saving ? 'Saving…' : 'Complete fill — update inventory'}</button>
          <button type="button" className="min-h-[48px] w-full rounded-xl border-2 font-bold" onClick={() => window.print()}>Print fill sheet</button>
        </section>
      </main>
    </div>
  )
}
