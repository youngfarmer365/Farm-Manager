'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getFarmAccess } from '@/lib/farm-access'
import { AppHeader } from '@/components/layout/AppHeader'
import { currentYear, yearOptions } from '@/lib/crops'

interface Field {
  id: string
  name: string
  area_ha: number | null
  color: string | null
  current_crop: string | null
}

interface Crop {
  field_id: string
  crop: string
  color: string | null
  status: string
  year: number
}

export default function FieldsHubPage() {
  const [fields, setFields] = useState<Field[]>([])
  const [crops, setCrops] = useState<Crop[]>([])
  const [year, setYear] = useState(currentYear())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getFarmAccess().then(async (a) => {
      if (!a.farmId) return
      const supabase = createClient()
      const [{ data: f, error: fErr }, { data: c }] = await Promise.all([
        supabase
          .from('farm_fields')
          .select('id, name, area_ha, color, current_crop')
          .eq('farm_id', a.farmId)
          .order('name'),
        supabase
          .from('field_crops')
          .select('field_id, crop, color, status, year')
          .eq('farm_id', a.farmId),
      ])
      if (fErr) setError(fErr.message)
      setFields((f as Field[]) || [])
      setCrops((c as Crop[]) || [])
    })
  }, [])

  const years = useMemo(() => yearOptions(crops.map((c) => c.year)), [crops])

  function cropFor(fieldId: string) {
    return crops.find((c) => c.field_id === fieldId && c.year === year)
  }

  return (
    <div className="min-h-screen bg-slate-200">
      <AppHeader title="Fields" />
      <main className="mx-auto max-w-4xl space-y-4 p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Link href="/fields/map" className="rounded-2xl border-4 border-brand-800 bg-brand-700 p-4 text-white">
            <div className="text-lg font-bold">Map</div>
            <div className="text-sm font-semibold text-brand-50">Draw and colour</div>
          </Link>
          <Link href="/fields/soil" className="rounded-2xl border-4 border-slate-600 bg-white p-4">
            <div className="text-lg font-bold">Soil samples</div>
            <div className="text-sm font-semibold text-slate-600">Full lab panel</div>
          </Link>
          <Link href="/fields/grass" className="rounded-2xl border-4 border-slate-600 bg-white p-4">
            <div className="text-lg font-bold">Grass</div>
            <div className="text-sm font-semibold text-slate-600">Covers / monitoring</div>
          </Link>
          <Link href="/fields/plan" className="rounded-2xl border-4 border-slate-600 bg-white p-4">
            <div className="text-lg font-bold">Planning</div>
            <div className="text-sm font-semibold text-slate-600">Future crops</div>
          </Link>
        </div>

        <label className="flex items-center gap-3 rounded-2xl border-4 border-slate-500 bg-white px-4 py-3">
          <span className="text-sm font-bold">Year</span>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="flex-1 rounded-xl border-2 border-slate-400 px-3 py-2 text-base font-bold"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>

        {error && (
          <p className="font-semibold text-red-700">
            {error}. If tables are missing, run 005_jobs_fields_planning.sql in Supabase.
          </p>
        )}

        <ul className="space-y-2">
          {fields.length === 0 && (
            <li className="rounded-2xl border-4 border-slate-500 bg-white p-5 font-semibold text-slate-600">
              No fields yet. Open Map and draw or name them.
            </li>
          )}
          {fields.map((f) => {
            const crop = cropFor(f.id)
            const colour = crop?.color || f.color || '#15803d'
            return (
              <li key={f.id}>
                <Link
                  href={`/fields/${f.id}?year=${year}`}
                  className="flex items-center gap-3 rounded-2xl border-4 border-slate-600 bg-white p-4"
                >
                  <span
                    className="h-12 w-12 shrink-0 rounded-xl border-2 border-slate-700"
                    style={{ background: colour }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xl font-bold">{f.name}</div>
                    <div className="text-sm font-semibold text-slate-600">
                      {crop?.crop || f.current_crop || 'No crop set for this year'}
                      {f.area_ha != null ? ` · ${f.area_ha} ha` : ''}
                    </div>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      </main>
    </div>
  )
}
