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
  notes: string | null
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
      .select('id, title, job_type, status, scheduled_on, completed_on, notes')
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

  return (
    <div className="min-h-screen bg-slate-200">
      <AppHeader
        title="Jobs"
        extra={
          <Link
            href="/jobs/new"
            className="inline-flex min-h-[44px] items-center rounded-xl bg-brand-700 px-4 text-sm font-bold text-white"
          >
            New job
          </Link>
        }
      />
      <main className="mx-auto max-w-3xl space-y-4 p-4">
        <p className="text-base font-semibold text-slate-700">
          A job can cover several fields. It stays pending until you mark it complete.
        </p>
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
            {error}. Run SQL file 005_jobs_fields_planning.sql in Supabase if the jobs table is missing.
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
              <Link
                href={`/jobs/${j.id}`}
                className="block rounded-2xl border-4 border-slate-600 bg-white p-4"
              >
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
