'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getFarmAccess } from '@/lib/farm-access'
import { AppHeader } from '@/components/layout/AppHeader'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'

export default function PhPage() {
  const supabase = createClient()
  const [farmId, setFarmId] = useState<string | null>(null)
  const [fields, setFields] = useState<any[]>([])
  const [rows, setRows] = useState<any[]>([])
  const [fieldId, setFieldId] = useState('')
  const [ph, setPh] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [msg, setMsg] = useState<string | null>(null)

  async function reload(fid: string) {
    const f = await supabase.from('farm_fields').select('id, name').eq('farm_id', fid).order('name')
    const r = await supabase.from('ph_tests').select('*, farm_fields(name)').eq('farm_id', fid).order('tested_on')
    setFields(f.data || [])
    setRows(r.data || [])
  }

  useEffect(() => {
    getFarmAccess().then(async (a) => {
      if (!a.farmId) return
      setFarmId(a.farmId)
      await reload(a.farmId)
    })
  }, [])

  const series = useMemo(() => rows.filter((r) => !fieldId || r.field_id === fieldId), [rows, fieldId])
  const min = 4.5
  const max = 7.5
  const field = 'min-h-[48px] w-full rounded-xl border-2 border-slate-500 bg-white px-3 text-base font-semibold'

  async function save() {
    if (!farmId || !fieldId || !ph) {
      setMsg('Field and pH required')
      return
    }
    const { error } = await supabase.from('ph_tests').insert({
      farm_id: farmId,
      field_id: fieldId,
      tested_on: date,
      ph: Number(ph),
    })
    if (error) setMsg(error.message)
    else {
      setMsg('Saved')
      setPh('')
      await reload(farmId)
    }
  }

  return (
    <div className="min-h-screen bg-slate-200">
      <AppHeader title="pH tracking" extra={<Link href="/jobs" className="font-bold">Jobs</Link>} />
      <main className="mx-auto max-w-3xl space-y-4 p-4">
        <div className="space-y-2 rounded-xl border-2 border-slate-500 bg-white p-4">
          <select className={field} value={fieldId} onChange={(e) => setFieldId(e.target.value)}>
            <option value="">Field…</option>
            {fields.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input className={field} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <input className={field} type="number" step="0.1" min="3" max="10" placeholder="pH" value={ph} onChange={(e) => setPh(e.target.value)} />
          </div>
          <button type="button" className="min-h-[52px] w-full rounded-xl bg-brand-700 text-lg font-bold text-white" onClick={save}>
            Save soil test
          </button>
          {msg && <p className="font-bold">{msg}</p>}
        </div>
        <div className="rounded-xl border-2 border-slate-500 bg-white p-4">
          <h2 className="font-bold">Trend {fieldId ? '(this field)' : '(all tests)'}</h2>
          <div className="mt-3 flex h-40 items-end gap-1 border-b-2 border-l-2 border-slate-600 pb-1 pl-1">
            {series.map((r) => {
              const h = Math.max(8, ((Number(r.ph) - min) / (max - min)) * 140)
              const ok = Number(r.ph) >= 6.2
              return (
                <div key={r.id} className="flex flex-1 flex-col items-center justify-end" title={r.ph}>
                  <span className="text-xs font-bold">{Number(r.ph).toFixed(1)}</span>
                  <div
                    className={'w-full max-w-[28px] rounded-t ' + (ok ? 'bg-brand-700' : 'bg-amber-500')}
                    style={{ height: h }}
                  />
                </div>
              )
            })}
          </div>
          <p className="mt-2 text-sm font-semibold">Green bar = pH 6.2+ (typical grass target). Amber = below 6.2.</p>
        </div>
        <ul className="space-y-2">
          {[...series].reverse().map((r) => (
            <li key={r.id} className="rounded-xl border-2 bg-white p-3 font-bold">
              {formatDate(r.tested_on)} · {r.farm_fields?.name} · pH {Number(r.ph).toFixed(2)}
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}
