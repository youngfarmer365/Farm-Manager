'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Run {
  id: string
  load_name: string | null
  buffer_kg: number
  pens_planned_kg: number
  pens_actual_kg: number
  fill_total_kg: number
  started_at: string
  finished_at: string | null
}

export default function FeedHistoryPage() {
  const [runs, setRuns] = useState<Run[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [pens, setPens] = useState<any[]>([])
  const [ings, setIngs] = useState<any[]>([])
  const supabase = createClient()

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    const { data: membership } = await supabase
      .from('farm_members')
      .select('farm_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()
    if (!membership) return
    const { data } = await supabase
      .from('feed_runs')
      .select('*')
      .eq('farm_id', membership.farm_id)
      .order('started_at', { ascending: false })
    setRuns((data as Run[]) || [])
  }

  useEffect(() => {
    load()
  }, [])

  async function openRun(id: string) {
    setOpenId(id)
    const [{ data: p }, { data: i }] = await Promise.all([
      supabase.from('feed_run_pens').select('*').eq('run_id', id).order('sort_order'),
      supabase.from('feed_run_ingredients').select('*').eq('run_id', id).order('sort_order'),
    ])
    setPens(p || [])
    setIngs(i || [])
  }

  async function deleteRun(id: string) {
    if (!confirm('Delete this completed load record? Stock will not be put back automatically.')) return
    await supabase.from('feed_runs').delete().eq('id', id)
    setOpenId(null)
    await load()
  }

  function fmt(dt: string | null) {
    if (!dt) return '—'
    return new Date(dt).toLocaleString('en-IE')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b px-4 py-3">
        <div className="max-w-3xl mx-auto flex justify-between">
          <h1 className="text-xl font-bold">Completed loads</h1>
          <Link href="/feeding" className="text-sm text-slate-600 hover:underline">
            Feeding
          </Link>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        {runs.length === 0 && <p className="text-sm text-slate-500">No completed runs yet.</p>}
        {runs.map((r) => (
          <div key={r.id} className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="px-4 py-3 flex flex-wrap gap-2 items-center justify-between">
              <button type="button" onClick={() => openRun(r.id)} className="text-left flex-1">
                <div className="font-semibold">{r.load_name || 'Load'}</div>
                <div className="text-xs text-slate-500">
                  {fmt(r.started_at)} → {fmt(r.finished_at)} · fill {Number(r.fill_total_kg).toFixed(0)}{' '}
                  kg
                </div>
              </button>
              <button
                type="button"
                onClick={() => deleteRun(r.id)}
                className="text-xs text-red-600 border border-red-200 rounded-md px-2 py-1"
              >
                Delete
              </button>
            </div>
            {openId === r.id && (
              <div className="border-t px-4 py-3 text-sm space-y-3 bg-slate-50">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>Buffer: {Number(r.buffer_kg).toFixed(0)} kg</div>
                  <div>
                    Pens planned {Number(r.pens_planned_kg).toFixed(0)} → actual{' '}
                    {Number(r.pens_actual_kg).toFixed(0)}
                  </div>
                </div>
                <div>
                  <h3 className="font-medium mb-1">Pens</h3>
                  <ul className="space-y-1">
                    {pens.map((p) => {
                      const diff = Number(p.actual_kg) - Number(p.planned_kg)
                      return (
                        <li key={p.id} className="flex justify-between text-xs">
                          <span>{p.pen_name}</span>
                          <span>
                            {Number(p.planned_kg).toFixed(0)} → {Number(p.actual_kg).toFixed(0)}
                            {diff !== 0 && (
                              <span className={diff > 0 ? ' text-green-700' : ' text-red-600'}>
                                {' '}
                                ({diff > 0 ? '+' : ''}
                                {diff.toFixed(0)})
                              </span>
                            )}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
                <div>
                  <h3 className="font-medium mb-1">Ingredients used</h3>
                  <ul className="space-y-1">
                    {ings.map((i) => (
                      <li key={i.id} className="flex justify-between text-xs">
                        <span>{i.ingredient_name}</span>
                        <span>{Number(i.kg).toFixed(1)} kg</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        ))}
      </main>
    </div>
  )
}