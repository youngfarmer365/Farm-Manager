'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getFarmAccess } from '@/lib/farm-access'
import { AppHeader } from '@/components/layout/AppHeader'
import { centroid, geojsonToRing } from '@/lib/geo'
import { fetchWeather, formatWeather } from '@/lib/weather'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'

export default function FertiliserPage() {
  const supabase = createClient()
  const [farmId, setFarmId] = useState<string | null>(null)
  const [fields, setFields] = useState<any[]>([])
  const [rows, setRows] = useState<any[]>([])
  const [fieldId, setFieldId] = useState('')
  const [kind, setKind] = useState('chemical')
  const [product, setProduct] = useState('')
  const [rate, setRate] = useState('')
  const [n, setN] = useState('')
  const [p, setP] = useState('')
  const [k, setK] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    getFarmAccess().then(async (a) => {
      if (!a.farmId) return
      setFarmId(a.farmId)
      const f = await supabase.from('farm_fields').select('*').eq('farm_id', a.farmId).order('name')
      const r = await supabase
        .from('fertiliser_applications')
        .select('*, farm_fields(name)')
        .eq('farm_id', a.farmId)
        .order('applied_on', { ascending: false })
        .limit(200)
      setFields(f.data || [])
      setRows(r.data || [])
    })
  }, [])

  const field = 'min-h-[48px] w-full rounded-xl border-2 border-slate-500 bg-white px-3 text-base font-semibold'

  async function save() {
    if (!farmId || !fieldId || !product.trim()) {
      setMsg('Pick a field and product')
      return
    }
    const f = fields.find((x) => x.id === fieldId)
    const area = Number(f?.area_ha) || 0
    const rateN = rate ? Number(rate) : null
    const total = rateN != null && area ? rateN * area : null
    const c = centroid(geojsonToRing(f?.geojson))
    let weather = null
    if (c) weather = await fetchWeather(c.lat, c.lng)
    const { error } = await supabase.from('fertiliser_applications').insert({
      farm_id: farmId,
      field_id: fieldId,
      applied_on: date,
      kind,
      product: product.trim(),
      rate_kg_ha: rateN,
      total_kg: total,
      n_kg_ha: n ? Number(n) : null,
      p_kg_ha: p ? Number(p) : null,
      k_kg_ha: k ? Number(k) : null,
      weather,
    })
    if (error) setMsg(error.message)
    else {
      setMsg('Saved' + (weather ? ' · ' + formatWeather(weather) : ''))
      setProduct('')
      const r = await supabase
        .from('fertiliser_applications')
        .select('*, farm_fields(name)')
        .eq('farm_id', farmId)
        .order('applied_on', { ascending: false })
        .limit(200)
      setRows(r.data || [])
    }
  }

  return (
    <div className="min-h-screen bg-slate-200">
      <AppHeader title="Fertiliser" extra={<Link href="/jobs" className="font-bold">Jobs</Link>} />
      <main className="mx-auto max-w-3xl space-y-4 p-4">
        <div className="space-y-2 rounded-xl border-2 border-slate-500 bg-white p-4">
          <select className={field} value={fieldId} onChange={(e) => setFieldId(e.target.value)}>
            <option value="">Field…</option>
            {fields.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.area_ha != null ? Number(f.area_ha).toFixed(2) : '—'} ha)
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={kind === 'chemical' ? 'min-h-[48px] rounded-xl bg-brand-700 font-bold text-white' : 'min-h-[48px] rounded-xl border-2 font-bold'} onClick={() => setKind('chemical')}>
              Chemical
            </button>
            <button type="button" className={kind === 'organic' ? 'min-h-[48px] rounded-xl bg-brand-700 font-bold text-white' : 'min-h-[48px] rounded-xl border-2 font-bold'} onClick={() => setKind('organic')}>
              Organic
            </button>
          </div>
          <input className={field} placeholder="Product (e.g. CAN, slurry, 18-6-12)" value={product} onChange={(e) => setProduct(e.target.value)} />
          <input className={field} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <input className={field} type="number" placeholder="Rate kg/ha (or m³/ha for slurry)" value={rate} onChange={(e) => setRate(e.target.value)} />
          <div className="grid grid-cols-3 gap-2">
            <input className={field} placeholder="N kg/ha" value={n} onChange={(e) => setN(e.target.value)} />
            <input className={field} placeholder="P kg/ha" value={p} onChange={(e) => setP(e.target.value)} />
            <input className={field} placeholder="K kg/ha" value={k} onChange={(e) => setK(e.target.value)} />
          </div>
          <button type="button" className="min-h-[52px] w-full rounded-xl border-2 border-brand-900 bg-brand-700 text-lg font-bold text-white" onClick={save}>
            Save application
          </button>
          {msg && <p className="font-bold">{msg}</p>}
        </div>
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="rounded-xl border-2 border-slate-500 bg-white p-3 font-semibold">
              {formatDate(r.applied_on)} · {r.farm_fields?.name || 'Field'} · {r.kind} · {r.product}
              {r.rate_kg_ha != null ? ' · ' + r.rate_kg_ha + '/ha' : ''}
              {r.total_kg != null ? ' · ' + Number(r.total_kg).toFixed(0) + ' total' : ''}
              <div className="text-sm">{formatWeather(r.weather)}</div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}
