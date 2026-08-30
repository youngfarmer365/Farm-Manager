'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getFarmAccess } from '@/lib/farm-access'
import { AppHeader } from '@/components/layout/AppHeader'
import { grassBand, grassClasses } from '@/lib/grass'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'

export default function GrassPage() {
  const supabase = createClient()
  const [farmId, setFarmId] = useState<string | null>(null)
  const [fields, setFields] = useState<any[]>([])
  const [rows, setRows] = useState<any[]>([])
  const [fieldId, setFieldId] = useState('')
  const [dm, setDm] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [low, setLow] = useState('1500')
  const [ready, setReady] = useState('2500')
  const [msg, setMsg] = useState<string | null>(null)

  async function reload(fid: string) {
    const f = await supabase.from('farm_fields').select('id, name, area_ha').eq('farm_id', fid).order('name')
    const r = await supabase
      .from('grass_covers')
      .select('*, farm_fields(name)')
      .eq('farm_id', fid)
      .order('measured_on', { ascending: false })
      .limit(300)
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

  const latestByField: Record<string, any> = {}
  for (const r of rows) {
    if (!latestByField[r.field_id]) latestByField[r.field_id] = r
  }

  const field = 'min-h-[48px] w-full rounded-xl border-2 border-slate-500 bg-white px-3 text-base font-semibold'

  async function save() {
    if (!farmId || !fieldId || !dm) {
      setMsg('Field and kg DM/ha required')
      return
    }
    const { error } = await supabase.from('grass_covers').insert({
      farm_id: farmId,
      field_id: fieldId,
      measured_on: date,
      dm_kg_ha: Number(dm),
    })
    if (error) setMsg(error.message)
    else {
      setMsg('Saved')
      setDm('')
      await reload(farmId)
    }
  }

  return (
    <div className="min-h-screen bg-slate-200">
      <AppHeader title="Grass covers" extra={<Link href="/jobs" className="font-bold">Jobs</Link>} />
      <main className="mx-auto max-w-3xl space-y-4 p-4">
        <div className="space-y-2 rounded-xl border-2 border-slate-500 bg-white p-4">
          <p className="text-sm font-bold">
            Red below {low} kg DM/ha · Amber up to {ready} · Green ready to graze
          </p>
          <div className="grid grid-cols-2 gap-2">
            <input className={field} type="number" value={low} onChange={(e) => setLow(e.target.value)} />
            <input className={field} type="number" value={ready} onChange={(e) => setReady(e.target.value)} />
          </div>
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
            <input className={field} type="number" placeholder="kg DM/ha" value={dm} onChange={(e) => setDm(e.target.value)} />
          </div>
          <button type="button" className="min-h-[52px] w-full rounded-xl bg-brand-700 text-lg font-bold text-white" onClick={save}>
            Save cover
          </button>
          {msg && <p className="font-bold">{msg}</p>}
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {fields.map((f) => {
            const r = latestByField[f.id]
            const band = r ? grassBand(Number(r.dm_kg_ha), Number(low), Number(ready)) : null
            return (
              <div
                key={f.id}
                className={
                  'rounded-xl border-4 p-4 ' +
                  (band ? grassClasses(band.color) : 'border-slate-500 bg-white text-slate-900')
                }
              >
                <div className="text-lg font-bold">{f.name}</div>
                {r ? (
                  <>
                    <div className="text-2xl font-bold">{Number(r.dm_kg_ha).toFixed(0)} kg DM/ha</div>
                    <div className="font-semibold">
                      {band?.label} · {formatDate(r.measured_on)}
                    </div>
                  </>
                ) : (
                  <div className="font-semibold">No cover yet</div>
                )}
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}
