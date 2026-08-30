'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getFarmAccess } from '@/lib/farm-access'
import { AppHeader } from '@/components/layout/AppHeader'
import { CROP_COLOURS, colourForCrop, currentYear } from '@/lib/crops'

interface Field {
  id: string
  name: string
  color: string | null
}

interface Crop {
  id: string
  field_id: string
  year: number
  crop: string
  status: string
  color: string | null
  notes: string | null
}

export default function FieldPlanPage() {
  const [farmId, setFarmId] = useState<string | null>(null)
  const [fields, setFields] = useState<Field[]>([])
  const [crops, setCrops] = useState<Crop[]>([])
  const [year, setYear] = useState(currentYear() + 1)
  const [fieldId, setFieldId] = useState('')
  const [crop, setCrop] = useState('Grass')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const a = await getFarmAccess()
    if (!a.farmId) return
    setFarmId(a.farmId)
    const supabase = createClient()
    const [{ data: f }, { data: c }] = await Promise.all([
      supabase.from('farm_fields').select('id, name, color').eq('farm_id', a.farmId).order('name'),
      supabase.from('field_crops').select('*').eq('farm_id', a.farmId).order('year', { ascending: false }),
    ])
    setFields((f as Field[]) || [])
    setCrops((c as Crop[]) || [])
    if (!fieldId && f && f[0]) setFieldId(f[0].id)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const planYear = useMemo(() => crops.filter((c) => c.year === year), [crops, year])

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!farmId || !fieldId) return
    setError(null)
    const supabase = createClient()
    const existing = crops.find((c) => c.field_id === fieldId && c.year === year)
    const payload = {
      farm_id: farmId,
      field_id: fieldId,
      year,
      crop,
      status: 'planned',
      color: colourForCrop(crop),
      notes: notes.trim() || null,
      season: 'full',
    }
    const { error } = existing
      ? await supabase.from('field_crops').update(payload).eq('id', existing.id)
      : await supabase.from('field_crops').insert(payload)
    if (error) setError(error.message)
    else {
      setNotes('')
      await load()
    }
  }

  return (
    <div className="min-h-screen bg-slate-200">
      <AppHeader title="Field planning" />
      <main className="mx-auto max-w-3xl space-y-4 p-4">
        <p className="font-semibold text-slate-700">
          Set possible future crops. Switch the year to look at next season without changing what is
          in the ground now.
        </p>
        <form onSubmit={add} className="space-y-3 rounded-2xl border-4 border-slate-600 bg-white p-4">
          <label className="block font-bold">
            Plan year
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border-2 border-slate-400 px-3 py-2"
            >
              {[currentYear() + 2, currentYear() + 1, currentYear()].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <label className="block font-bold">
            Field
            <select
              value={fieldId}
              onChange={(e) => setFieldId(e.target.value)}
              className="mt-1 w-full rounded-xl border-2 border-slate-400 px-3 py-2"
            >
              {fields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block font-bold">
            Crop
            <select
              value={crop}
              onChange={(e) => setCrop(e.target.value)}
              className="mt-1 w-full rounded-xl border-2 border-slate-400 px-3 py-2"
            >
              {CROP_COLOURS.map((c) => (
                <option key={c.crop} value={c.crop}>
                  {c.crop}
                </option>
              ))}
            </select>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Why this crop / rotation notes"
            className="w-full rounded-xl border-2 border-slate-400 px-3 py-2"
          />
          {error && <p className="font-semibold text-red-700">{error}</p>}
          <button type="submit" className="w-full min-h-[48px] rounded-xl bg-brand-700 font-bold text-white">
            Save plan for {year}
          </button>
        </form>

        <h2 className="text-lg font-bold">{year} plan</h2>
        <ul className="space-y-2">
          {fields.map((f) => {
            const plan = planYear.find((c) => c.field_id === f.id)
            return (
              <li key={f.id} className="flex items-center gap-3 rounded-2xl border-4 border-slate-500 bg-white p-4">
                <span
                  className="h-10 w-10 rounded-lg border-2 border-slate-700"
                  style={{ background: plan?.color || f.color || '#94a3b8' }}
                />
                <div className="flex-1">
                  <div className="font-bold">{f.name}</div>
                  <div className="text-sm font-semibold text-slate-600">{plan?.crop || 'Not planned'}</div>
                </div>
                <Link href={`/fields/${f.id}?year=${year}`} className="text-sm font-bold underline">
                  Edit
                </Link>
              </li>
            )
          })}
        </ul>
      </main>
    </div>
  )
}
