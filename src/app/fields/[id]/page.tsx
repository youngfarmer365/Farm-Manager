'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getFarmAccess } from '@/lib/farm-access'
import { AppHeader } from '@/components/layout/AppHeader'
import { CROP_COLOURS, colourForCrop, currentYear, yearOptions } from '@/lib/crops'

interface Field {
  id: string
  name: string
  area_ha: number | null
  color: string | null
  notes: string | null
}

interface CropRow {
  id: string
  year: number
  season: string
  crop: string
  variety: string | null
  status: string
  color: string | null
  notes: string | null
}

interface Sample {
  id: string
  sampled_on: string
  ph: number | null
  p_index: number | null
  k_index: number | null
}

interface Cover {
  id: string
  measured_on: string
  dm_kg_ha: number
}

export default function FieldDetailPage() {
  const params = useParams<{ id: string }>()
  const search = useSearchParams()
  const [farmId, setFarmId] = useState<string | null>(null)
  const [field, setField] = useState<Field | null>(null)
  const [crops, setCrops] = useState<CropRow[]>([])
  const [samples, setSamples] = useState<Sample[]>([])
  const [covers, setCovers] = useState<Cover[]>([])
  const [year, setYear] = useState(Number(search.get('year')) || currentYear())
  const [name, setName] = useState('')
  const [color, setColor] = useState('#15803d')
  const [areaHa, setAreaHa] = useState('')
  const [crop, setCrop] = useState('Grass')
  const [variety, setVariety] = useState('')
  const [status, setStatus] = useState('current')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function load() {
    const a = await getFarmAccess()
    if (!a.farmId) return
    setFarmId(a.farmId)
    const supabase = createClient()
    const [{ data: f }, { data: c }, { data: s }, { data: g }] = await Promise.all([
      supabase.from('farm_fields').select('*').eq('id', params.id).maybeSingle(),
      supabase.from('field_crops').select('*').eq('field_id', params.id).order('year', { ascending: false }),
      supabase
        .from('soil_samples')
        .select('id, sampled_on, ph, p_index, k_index')
        .eq('field_id', params.id)
        .order('sampled_on', { ascending: false })
        .limit(8),
      supabase
        .from('grass_covers')
        .select('id, measured_on, dm_kg_ha')
        .eq('field_id', params.id)
        .order('measured_on', { ascending: false })
        .limit(8),
    ])
    setField(f as Field)
    if (f) {
      setName(f.name)
      setColor(f.color || '#15803d')
      setAreaHa(f.area_ha != null ? String(f.area_ha) : '')
    }
    const cropRows = (c as CropRow[]) || []
    setCrops(cropRows)
    setSamples((s as Sample[]) || [])
    setCovers((g as Cover[]) || [])
    const forYear = cropRows.find((r) => r.year === year)
    if (forYear) {
      setCrop(forYear.crop)
      setVariety(forYear.variety || '')
      setStatus(forYear.status)
      setNotes(forYear.notes || '')
      setColor(forYear.color || f?.color || '#15803d')
    }
  }

  useEffect(() => {
    if (params.id) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id])

  const years = useMemo(() => yearOptions(crops.map((c) => c.year)), [crops])

  useEffect(() => {
    const forYear = crops.find((r) => r.year === year)
    if (forYear) {
      setCrop(forYear.crop)
      setVariety(forYear.variety || '')
      setStatus(forYear.status)
      setNotes(forYear.notes || '')
      setColor(forYear.color || field?.color || '#15803d')
    } else {
      setStatus(year > currentYear() ? 'planned' : year < currentYear() ? 'historic' : 'current')
      setNotes('')
      setVariety('')
    }
  }, [year, crops, field])

  async function saveFieldMeta() {
    if (!field) return
    setError(null)
    const supabase = createClient()
    const { error } = await supabase
      .from('farm_fields')
      .update({         
        name: name.trim(),         
        color,         
        current_crop: crop,         
        area_ha: areaHa === '' ? null : Number(areaHa),       
      })
      .eq('id', field.id)
    if (error) setError(error.message)
  }

  async function saveCrop(e: React.FormEvent) {
    e.preventDefault()
    if (!field || !farmId) return
    setError(null)
    setSaved(false)
    await saveFieldMeta()
    const supabase = createClient()
    const existing = crops.find((c) => c.year === year)
    const payload = {
      farm_id: farmId,
      field_id: field.id,
      year,
      season: 'full',
      crop,
      variety: variety.trim() || null,
      status,
      color,
      notes: notes.trim() || null,
    }
    const { error } = existing
      ? await supabase.from('field_crops').update(payload).eq('id', existing.id)
      : await supabase.from('field_crops').insert(payload)
    if (error) setError(error.message)
    else {
      setSaved(true)
      await load()
    }
  }

  if (!field) return <p className="p-10 text-center font-bold">Loading…</p>

  return (
    <div className="min-h-screen bg-slate-200">
      <AppHeader title={field.name} />
      <main className="mx-auto max-w-3xl space-y-4 p-4">
        <form onSubmit={saveCrop} className="space-y-3 rounded-2xl border-4 border-slate-600 bg-white p-4">
          <label className="block">
            <span className="text-sm font-bold">Field name</span>
                      <label className="block">
            <span className="text-sm font-bold">Area used for spraying (ha)</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={areaHa}
              onChange={(e) => setAreaHa(e.target.value)}
              className="mt-1 w-full rounded-xl border-2 border-slate-400 px-3 py-2"
            />
          </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border-2 border-slate-400 px-3 py-2"
            />
          </label>
          <label className="flex items-center gap-3">
            <span className="text-sm font-bold">Year</span>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="flex-1 rounded-xl border-2 border-slate-400 px-3 py-2 font-bold"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                  {y > currentYear() ? ' (plan)' : y < currentYear() ? ' (history)' : ' (this year)'}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-bold">Crop</span>
            <select
              value={crop}
              onChange={(e) => {
                setCrop(e.target.value)
                setColor(colourForCrop(e.target.value))
              }}
              className="mt-1 w-full rounded-xl border-2 border-slate-400 px-3 py-2"
            >
              {CROP_COLOURS.map((c) => (
                <option key={c.crop} value={c.crop}>
                  {c.crop}
                </option>
              ))}
            </select>
          </label>
          <div>
            <span className="text-sm font-bold">Colour (for map / crop)</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {CROP_COLOURS.map((c) => (
                <button
                  key={c.color + c.crop}
                  type="button"
                  onClick={() => {
                    setCrop(c.crop)
                    setColor(c.color)
                  }}
                  className={`h-10 w-10 rounded-lg border-2 ${
                    color === c.color ? 'border-slate-900 ring-2 ring-brand-600' : 'border-slate-400'
                  }`}
                  style={{ background: c.color }}
                  title={c.crop}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 w-14 cursor-pointer rounded-lg border-2 border-slate-400"
              />
            </div>
          </div>
          <label className="block">
            <span className="text-sm font-bold">Variety (optional)</span>
            <input
              value={variety}
              onChange={(e) => setVariety(e.target.value)}
              className="mt-1 w-full rounded-xl border-2 border-slate-400 px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="text-sm font-bold">Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1 w-full rounded-xl border-2 border-slate-400 px-3 py-2"
            >
              <option value="planned">Planned</option>
              <option value="current">In the field now</option>
              <option value="harvested">Harvested</option>
              <option value="historic">Historic</option>
            </select>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Notes for this year"
            className="w-full rounded-xl border-2 border-slate-400 px-3 py-2"
          />
          {error && <p className="font-semibold text-red-700">{error}</p>}
          {saved && <p className="font-semibold text-brand-800">Saved.</p>}
          <button type="submit" className="w-full min-h-[48px] rounded-xl bg-brand-700 font-bold text-white">
            Save {year} crop & colour
          </button>
        </form>

        <section className="rounded-2xl border-4 border-slate-600 bg-white p-4">
          <h2 className="font-bold">History</h2>
          <ul className="mt-2 divide-y">
            {crops.length === 0 && <li className="py-2 text-slate-600">No crop years stored yet.</li>}
            {crops.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2">
                <span className="h-6 w-6 rounded border" style={{ background: c.color || '#15803d' }} />
                <span className="font-bold">{c.year}</span>
                <span>{c.crop}</span>
                <span className="ml-auto text-xs uppercase text-slate-500">{c.status}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border-4 border-slate-600 bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Soil samples</h2>
            <Link href={`/fields/soil?field=${field.id}`} className="text-sm font-bold text-brand-800 underline">
              Record sample
            </Link>
          </div>
          <ul className="mt-2 text-sm">
            {samples.length === 0 && <li className="text-slate-600">None yet.</li>}
            {samples.map((s) => (
              <li key={s.id}>
                {s.sampled_on} · pH {s.ph ?? '—'} · P idx {s.p_index ?? '—'} · K idx {s.k_index ?? '—'}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border-4 border-slate-600 bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Grass covers</h2>
            <Link href={`/fields/grass?field=${field.id}`} className="text-sm font-bold text-brand-800 underline">
              Record cover
            </Link>
          </div>
          <ul className="mt-2 text-sm">
            {covers.length === 0 && <li className="text-slate-600">None yet.</li>}
            {covers.map((g) => (
              <li key={g.id}>
                {g.measured_on} · {g.dm_kg_ha} kg DM/ha
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  )
}
