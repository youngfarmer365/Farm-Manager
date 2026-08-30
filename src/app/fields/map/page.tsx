'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { AppHeader } from '@/components/layout/AppHeader'
import { getFarmAccess } from '@/lib/farm-access'
import { createClient } from '@/lib/supabase/client'
import { loadFarmFields, type FarmFieldRow } from '@/lib/fields'

const FarmMap = dynamic(() => import('@/components/map/FarmMap').then((m) => m.FarmMap), {
  ssr: false,
})

export default function FieldsMapPage() {
  const [farmId, setFarmId] = useState<string | null>(null)
  const [fields, setFields] = useState<FarmFieldRow[]>([])
  const [name, setName] = useState('')
  const [color, setColor] = useState('#15803d')
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const a = await getFarmAccess()
    if (!a.farmId) return
    setFarmId(a.farmId)
    const loaded = await loadFarmFields(a.farmId)
    if (loaded.error) setError(loaded.error)
    else setError(null)
    setFields(loaded.data)
  }

  useEffect(() => {
    load()
  }, [])

  async function addNamed(e: React.FormEvent) {
    e.preventDefault()
    if (!farmId || !name.trim()) return
    const supabase = createClient()
    const { error } = await supabase.from('farm_fields').insert({
      farm_id: farmId,
      name: name.trim(),
      color,
    })
    if (error) setError(error.message)
    else {
      setName('')
      await load()
    }
  }

  return (
    <div className="min-h-screen bg-slate-200">
      <AppHeader title="Field map" />
      <main className="mx-auto max-w-5xl space-y-4 p-4">
        <form onSubmit={addNamed} className="flex flex-wrap gap-2 rounded-2xl border-4 border-slate-600 bg-white p-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New field name"
            className="min-w-[10rem] flex-1 rounded-xl border-2 border-slate-400 px-3 py-2"
          />
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-11 w-14 rounded-lg" />
          <button type="submit" className="rounded-xl bg-brand-700 px-4 font-bold text-white">
            Add field
          </button>
        </form>
        {error && <p className="font-semibold text-red-700">{error}</p>}
        <FarmMap fields={fields} onSaved={load} farmId={farmId} />
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {fields.map((f) => (
            <li key={f.id}>
              <Link
                href={`/fields/${f.id}`}
                className="flex items-center gap-3 rounded-2xl border-4 border-slate-500 bg-white p-3"
              >
                <span className="h-8 w-8 rounded-md border" style={{ background: f.color || '#15803d' }} />
                <span className="font-bold">{f.name}</span>
                {f.area_ha != null && (
                  <span className="ml-auto text-sm font-semibold text-slate-600">
                    {Number(f.area_ha).toFixed(2)} ha
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}
