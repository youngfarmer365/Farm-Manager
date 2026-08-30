'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getFarmAccess } from '@/lib/farm-access'
import { AppHeader } from '@/components/layout/AppHeader'
import { JOB_TYPES } from '@/lib/crops'

interface Job {
  id: string
  title: string
  job_type: string
  status: string
  scheduled_on: string | null
  completed_on: string | null
}

function typeLabel(id: string) {
  return JOB_TYPES.find((t) => t.id === id)?.label || id
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [tab, setTab] = useState<'pending' | 'completed'>('pending')
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const a = await getFarmAccess()
    if (!a.farmId) return
    const supabase = createClient()
    const { data, error } = await supabase
      .from('land_jobs')
      .select('id, title, job_type, status, scheduled_on, completed_on')
      .eq('farm_id', a.farmId)
      .order('scheduled_on', { ascending: true, nullsFirst: false })
    if (error) setError(error.message)
    setJobs((data as Job[]) || [])
  }

  useEffect(() => {
    load()
  }, [])

  const shown = jobs.filter((j) =>
    tab === 'pending' ? j.status !== 'completed' && j.status !== 'cancelled' : j.status === 'completed'
  )

  const tile = 'rounded-2xl border-4 p-4 text-left'
  return (
    <div className="min-h-screen bg-slate-200">
      <AppHeader title="Jobs" />
      <main className="mx-auto max-w-3xl space-y-4 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Link href="/jobs/new" className={tile + ' border-brand-900 bg-brand-700 text-white'}>
            <div className="text-lg font-bold">New job</div>
            <div className="text-sm font-semibold text-brand-50">Several fields, pending until done</div>
          </Link>
          <Link href="/jobs/spray" className={tile + ' border-slate-700 bg-white'}>
            <div className="text-lg font-bold">Spray</div>
            <div className="text-sm font-semibold text-slate-600">Tank, mix, fill sheet, inventory</div>
          </Link>
          <Link href="/jobs/inventory" className={tile + ' border-slate-700 bg-white'}>
            <div className="text-lg font-bold">Chemical inventory</div>
            <div className="text-sm font-semibold text-slate-600">Live stock on hand</div>
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {(['pending', 'completed'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`min-h-[48px] rounded-xl border-4 text-base font-bold capitalize ${
                tab === t ? 'border-brand-800 bg-brand-700 text-white' : 'border-slate-500 bg-white'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        {error && (
          <p className="rounded-xl border-2 border-red-700 bg-red-50 p-3 font-semibold text-red-800">
            {error}
          </p>
        )}
        <ul className="space-y-3">
          {shown.length === 0 && (
            <li className="rounded-2xl border-4 border-slate-500 bg-white p-5 font-semibold text-slate-600">
              No {tab} jobs.
            </li>
          )}
          {shown.map((j) => (
            <li key={j.id}>
              <Link href={j.job_type === 'spray' ? `/jobs/spray?job=${j.id}` : `/jobs/${j.id}`} className="block rounded-2xl border-4 border-slate-600 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xl font-bold">{j.title}</div>
                    <div className="mt-1 text-sm font-semibold text-slate-600">
                      {typeLabel(j.job_type)}
                      {j.scheduled_on ? ` · ${j.scheduled_on}` : ''}
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${
                      j.status === 'completed' ? 'bg-brand-100 text-brand-800' : 'bg-amber-100 text-amber-900'
                    }`}
                  >
                    {j.status}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}
