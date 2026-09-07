'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { groupPensByShed, penLabel, type PenRow } from '@/lib/pens'
import { moveAnimalsOffField, moveAnimalsToField } from '@/lib/grazing'

export function MobileMoveBar({
  farmId,
  selected,
  pens,
  fields,
  onDone,
}: {
  farmId: string
  selected: string[]
  pens: PenRow[]
  fields: { id: string; name: string }[]
  onDone: () => void
}) {
  const [penId, setPenId] = useState('')
  const [fieldId, setFieldId] = useState('')
  const [busy, setBusy] = useState(false)
  const sheds = groupPensByShed(pens)

  async function movePen() {
    if (!penId || selected.length === 0) return
    if (!confirm('Move ' + selected.length + ' animal(s) to ' + (pens.find((p) => p.id === penId) ? penLabel(pens.find((p) => p.id === penId) as PenRow, pens) : 'pen') + '?')) return
    setBusy(true)
    const supabase = createClient()
    if (penId === '__none__') {
      await supabase.from('animals').update({ pen_id: null }).in('id', selected)
    } else {
      const off = await moveAnimalsOffField({ farmId, animalIds: selected, toPenId: penId })
      if (off.error) {
        const { error } = await supabase.from('animals').update({ pen_id: penId }).in('id', selected)
        if (error) alert(error.message)
      }
    }
    setBusy(false)
    onDone()
  }

  async function moveField() {
    if (!fieldId || selected.length === 0) return
    const name = fields.find((f) => f.id === fieldId)?.name || 'field'
    if (!confirm('Move ' + selected.length + ' animal(s) to field ' + name + '? Pen stays on the record until they come in.')) return
    setBusy(true)
    const res = await moveAnimalsToField({ farmId, animalIds: selected, fieldId })
    setBusy(false)
    if (res.error) alert(res.error)
    else onDone()
  }

  if (selected.length === 0) return null

  return (
    <div className="space-y-2 rounded-2xl border-4 border-amber-700 bg-amber-50 p-3">
      <p className="font-bold">{selected.length} selected</p>
      <select value={penId} onChange={(e) => setPenId(e.target.value)} className="min-h-[48px] w-full rounded-xl border-2 bg-white px-2 text-base font-bold">
        <option value="">Move to pen…</option>
        <option value="__none__">No pen</option>
        {sheds.grouped.map(({ shed, pens: inShed }) => (
          <optgroup key={shed.id} label={shed.name}>
            {inShed.map((p) => (
              <option key={p.id} value={p.id}>
                {shed.name} · {p.name}
              </option>
            ))}
          </optgroup>
        ))}
        {sheds.ungrouped.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <button type="button" disabled={busy || !penId} onClick={movePen} className="min-h-[48px] w-full rounded-xl bg-brand-700 font-bold text-white disabled:opacity-40">
        Move to pen
      </button>
      <select value={fieldId} onChange={(e) => setFieldId(e.target.value)} className="min-h-[48px] w-full rounded-xl border-2 bg-white px-2 text-base font-bold">
        <option value="">Move to field…</option>
        {fields.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>
      <button type="button" disabled={busy || !fieldId} onClick={moveField} className="min-h-[48px] w-full rounded-xl bg-amber-700 font-bold text-white disabled:opacity-40">
        Move to field
      </button>
    </div>
  )
}
