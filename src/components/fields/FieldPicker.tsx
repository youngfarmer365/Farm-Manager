'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import type { MapField } from '@/components/map/FarmMap'
import type { FarmFieldRow } from '@/lib/fields'

const FarmMap = dynamic(() => import('@/components/map/FarmMap').then((m) => m.FarmMap), {
  ssr: false,
})

export function FieldPicker({
  farmId,
  fields,
  selected,
  onChange,
}: {
  farmId: string | null
  fields: MapField[] | FarmFieldRow[]
  selected: Set<string>
  onChange: (next: Set<string>) => void
}) {
  const [q, setQ] = useState('')
  const [showMap, setShowMap] = useState(true)

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return fields
    return fields.filter((f) => f.name.toLowerCase().includes(s))
  }, [fields, q])

  function toggle(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(next)
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setShowMap(false)}
          className={`min-h-[44px] flex-1 rounded-xl border-2 font-bold ${
            !showMap ? 'border-brand-800 bg-brand-700 text-white' : 'border-slate-500 bg-white'
          }`}
        >
          Search list
        </button>
        <button
          type="button"
          onClick={() => setShowMap(true)}
          className={`min-h-[44px] flex-1 rounded-xl border-2 font-bold ${
            showMap ? 'border-brand-800 bg-brand-700 text-white' : 'border-slate-500 bg-white'
          }`}
        >
          Map
        </button>
      </div>
      <p className="text-sm font-bold">{selected.size} field(s) selected</p>
      {showMap ? (
        <FarmMap
          fields={fields}
          farmId={farmId}
          selectable
          selectedIds={selected}
          onToggleSelect={toggle}
        />
      ) : (
        <>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search field name"
            className="w-full rounded-xl border-2 border-slate-400 px-3 py-3 text-base"
          />
          <ul className="max-h-72 divide-y overflow-auto rounded-2xl border-4 border-slate-500 bg-white">
            {filtered.map((f) => (
              <li key={f.id}>
                <label className="flex min-h-[52px] items-center gap-3 px-4 py-2">
                  <input
                    type="checkbox"
                    checked={selected.has(f.id)}
                    onChange={() => toggle(f.id)}
                    className="h-5 w-5"
                  />
                  <span className="text-base font-bold">{f.name}</span>
                  {f.area_ha != null && (
                    <span className="ml-auto text-sm font-semibold text-slate-600">
                      {Number(f.area_ha).toFixed(2)} ha
                    </span>
                  )}
                </label>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="p-4 font-semibold text-slate-600">No fields match</li>
            )}
          </ul>
        </>
      )}
    </div>
  )
}
