'use client'

import { useState } from 'react'
import { moveAnimalsOffField, moveAnimalsToField } from '@/lib/grazing'

type FieldOpt = { id: string; name: string }

export function GrazingMoveBar({
  farmId,
  selectedIds,
  fields,
  currentPenId,
  busy,
  setBusy,
  onDone,
}: {
  farmId: string | null
  selectedIds: string[]
  fields: FieldOpt[]
  currentPenId?: string | null
  busy: boolean
  setBusy: (v: boolean) => void
  onDone: () => void
}) {
  const [fieldId, setFieldId] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))

  if (!farmId || selectedIds.length === 0) return null

  async function toField() {
    if (!fieldId) return
    const name = fields.find((f) => f.id === fieldId)?.name || 'field'
    if (!confirm(`Move ${selectedIds.length} animal(s) out to ${name}?`)) return
    setBusy(true)
    const res = await moveAnimalsToField({
      farmId: farmId!,
      animalIds: selectedIds,
      fieldId,
      fromPenId: currentPenId || null,
      startedOn: date,
    })
    setBusy(false)
    if (res.error) {
      alert(res.error + (res.error.includes('grazing_stays') ? ' — run 007_grazing.sql in Supabase.' : ''))
      return
    }
    setFieldId('')
    onDone()
  }

  async function offField() {
    if (!confirm(`Bring ${selectedIds.length} animal(s) in off the field?`)) return
    setBusy(true)
    const res = await moveAnimalsOffField({
      farmId: farmId!,
      animalIds: selectedIds,
      toPenId: currentPenId || null,
      endedOn: date,
    })
    setBusy(false)
    if (res.error) {
      alert(res.error)
      return
    }
    onDone()
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="min-h-[36px] rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs"
      />
      <select
        value={fieldId}
        onChange={(e) => setFieldId(e.target.value)}
        className="min-h-[36px] rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs"
      >
        <option value="">Move to field…</option>
        {fields.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={busy || !fieldId}
        onClick={toField}
        className="rounded-lg border border-emerald-700 bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white disabled:opacity-50"
      >
        Send to field
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={offField}
        className="rounded-lg border border-slate-400 bg-white px-2.5 py-1 text-xs font-bold disabled:opacity-50"
      >
        Bring in
      </button>
    </div>
  )
}
