'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getFarmAccess } from '@/lib/farm-access'
import { AppHeader } from '@/components/layout/AppHeader'

interface Field {
  id: string
  name: string
}

interface Cover {
  id: string
  field_id: string
  measured_on: string
  dm_kg_ha: number
  notes: string | null
  farm_fields?: { name: string } | { name: string }[] | null
}

export default function GrassPage() {
  const search = useSearchParams()
  const [farmId, setFarmId] = useState<string | null>(null)
  const [fields, setFields] = useState<Field[]>([])
  const [rows, setRows] = useState<Cover[]>([])
  const [fieldId, setFieldId] = useState(search.get('field') || '')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [dm, setDm] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const a = await getFarmAccess()
    if (!a.farmId) return
    setFarmId(a.farmId)
    const supabase = createClient()
    const [{ data: f }, { data: c, error }] = await Promise.all([
      supabase.from('farm_fields').select('id, name').eq('farm_id', a.farmId).order('name'),
      supabase
        .from('grass_covers')
        .select('id, field_id, measured_on, dm_kg_ha, notes, farm_fields(name)')
        .eq('farm_id', a.farmId)
        .order('measured_on', { ascending: false }),
    ])
    if (error) setError(error.message)
    setFields((f as Field[]) || [])
    setRows((c as Cover[]) || [])
    if (!fieldId && f && f[0]) setFieldId(f[0].id)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!farmId || !fieldId) return
    const supabase = createClient()
    const { error } = await supabase.from('grass_covers').insert({
      farm_id: farmId,
      field_id: fieldId,
      measured_on: date,
      dm_kg_ha: Number(dm),
      notes: notes.trim() || null,
    })
    if (error) setError(error.message)
    else {
      setDm('')
      setNotes('')
      await load()
    }
  }

  return (
    <div className="min-h-screen bg-slate-200">
      <AppHeader title="Grass monitoring" />
      <main className="mx-auto max-w-3xl space-y-4 p-4">
        <form onSubmit={save} className="space-y-3 rounded-2xl border-4 border-slate-600 bg-white p-4">
          <label className="block font-bold">
            Field
            <select
              required
              value={fieldId}
              onChange={(e) => setFieldId(e.target.value)}
              className="mt-1 w-full rounded-xl border-2 border-slate-400 px-3 py-2 font-semibold"
            >
              <option value="">Select…</option>
              {fields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block font-bold">
            Date
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full rounded-xl border-2 border-slate-400 px-3 py-2"
            />
          </label>
          <label className="block font-bold">
            Cover (kg DM/ha)
            <input
              required
              type="number"
              min="0"
              value={dm}
              onChange={(e) => setDm(e.target.value)}
              className="mt-1 w-full rounded-xl border-2 border-slate-400 px-3 py-2"
            />
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes"
            className="w-full rounded-xl border-2 border-slate-400 px-3 py-2"
          />
          {error && <p className="font-semibold text-red-700">{error}</p>}
          <button type="submit" className="w-full min-h-[48px] rounded-xl bg-brand-700 font-bold text-white">
            Save cover
          </button>
        </form>
        <ul className="space-y-2">
          {rows.map((r) => {
            const fname = Array.isArray(r.farm_fields) ? r.farm_fields[0]?.name : r.farm_fields?.name
            return (
              <li key={r.id} className="rounded-2xl border-4 border-slate-500 bg-white p-4">
                <div className="flex items-center justify-between">
                  <span className="font-bold">{fname}</span>
                  <span className="text-2xl font-bold">{r.dm_kg_ha}</span>
                </div>
                <div className="text-sm font-semibold text-slate-600">{r.measured_on} · kg DM/ha</div>
                <Link href={`/fields/${r.field_id}`} className="text-sm font-bold text-brand-800 underline">
                  Open field
                </Link>
              </li>
            )
          })}
        </ul>
      </main>
    </div>
  )
}
