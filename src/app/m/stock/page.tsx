'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getFarmAccess } from '@/lib/farm-access'

interface PenCount {
  id: string
  name: string
  type: string | null
  count: number
}

interface FieldCount {
  id: string
  name: string
  groupName: string | null
  count: number
}

export default function StockCheckPage() {
  const [pens, setPens] = useState<PenCount[]>([])
  const [fields, setFields] = useState<FieldCount[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [at, setAt] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const access = await getFarmAccess()
    if (!access.farmId) {
      setLoading(false)
      return
    }
    const supabase = createClient()

    const [{ data: penRows, error: pErr }, { data: animals, error: aErr }, { data: fieldRows }, { data: stints }] =
      await Promise.all([
        supabase
          .from('pens')
          .select('id, name, type')
          .eq('farm_id', access.farmId)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('animals')
          .select('id, pen_id, group_id')
          .eq('farm_id', access.farmId)
          .eq('status', 'active'),
        supabase
          .from('farm_fields')
          .select('id, name')
          .eq('farm_id', access.farmId)
          .order('name'),
        supabase
          .from('grazing_stints')
          .select('id, field_id, group_id, group_name, head_count, ended_on')
          .eq('farm_id', access.farmId)
          .is('ended_on', null),
      ])

    if (pErr || aErr) {
      setError(pErr?.message || aErr?.message || 'Could not load counts')
      setLoading(false)
      return
    }

    const byPen = new Map<string, number>()
    const byGroup = new Map<string, number>()
    for (const a of animals || []) {
      if (a.pen_id) byPen.set(a.pen_id, (byPen.get(a.pen_id) || 0) + 1)
      if (a.group_id) byGroup.set(a.group_id, (byGroup.get(a.group_id) || 0) + 1)
    }

    const pList: PenCount[] = (penRows || []).map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      count: byPen.get(p.id) || 0,
    }))
    setPens(pList)
    setTotal((animals || []).length)

    const fieldName = new Map((fieldRows || []).map((f) => [f.id, f.name]))
    const fList: FieldCount[] = (stints || []).map((s) => {
      const live = s.group_id ? byGroup.get(s.group_id) : undefined
      return {
        id: s.id,
        name: fieldName.get(s.field_id) || 'Field',
        groupName: s.group_name,
        count: live ?? s.head_count ?? 0,
      }
    })
    setFields(fList)
    setAt(new Date().toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' }))
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="min-h-screen bg-slate-200">
      <header className="border-b-4 border-brand-900 bg-brand-800 px-5 pb-5 pt-10 text-white">
        <p className="text-sm font-bold uppercase tracking-wide text-brand-100">Yard</p>
        <h1 className="mt-1 text-3xl font-bold">Stock check</h1>
        <p className="mt-2 text-base font-semibold text-brand-50">
          {loading ? 'Loading…' : `${total} head on farm`}
          {at ? ` · ${at}` : ''}
        </p>
      </header>

      <main className="space-y-6 p-4">
        <button
          type="button"
          onClick={load}
          className="w-full min-h-[52px] rounded-2xl border-4 border-slate-700 bg-white text-lg font-bold"
        >
          Refresh counts
        </button>

        {error && <p className="text-base font-semibold text-red-700">{error}</p>}

        <section>
          <h2 className="mb-2 text-lg font-bold uppercase tracking-wide text-slate-800">Pens</h2>
          <ul className="overflow-hidden rounded-2xl border-4 border-slate-600 bg-white divide-y-2 divide-slate-200">
            {pens.length === 0 && !loading && (
              <li className="p-4 font-semibold text-slate-600">No pens yet</li>
            )}
            {pens.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-4">
                <div>
                  <div className="text-xl font-bold">{p.name}</div>
                  {p.type && p.type !== 'pen' && (
                    <div className="text-sm font-semibold capitalize text-slate-600">{p.type}</div>
                  )}
                </div>
                <div className="min-w-[4.5rem] rounded-2xl bg-brand-700 px-3 py-2 text-center text-3xl font-bold text-white">
                  {p.count}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-bold uppercase tracking-wide text-slate-800">
            Fields (grazing now)
          </h2>
          <ul className="overflow-hidden rounded-2xl border-4 border-slate-600 bg-white divide-y-2 divide-slate-200">
            {fields.length === 0 && !loading && (
              <li className="p-4 font-semibold text-slate-600">
                No groups currently marked on a field
              </li>
            )}
            {fields.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 px-4 py-4">
                <div>
                  <div className="text-xl font-bold">{f.name}</div>
                  {f.groupName && (
                    <div className="text-sm font-semibold text-slate-600">{f.groupName}</div>
                  )}
                </div>
                <div className="min-w-[4.5rem] rounded-2xl bg-amber-600 px-3 py-2 text-center text-3xl font-bold text-white">
                  {f.count}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  )
}
