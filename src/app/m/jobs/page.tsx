'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getFarmAccess } from '@/lib/farm-access'
import { JOB_TYPES } from '@/lib/crops'

interface Job {
  id: string
  title: string
  job_type: string
  status: string
  scheduled_on: string | null
}

export default function MobileJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [tab, setTab] = useState<'pending' | 'completed'>('pending')
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load() {
    const a = await getFarmAccess()
    if (!a.farmId) return
    const supabase = createClient()
    const { data } = await supabase
      .from('land_jobs')
      .select('id, title, job_type, status, scheduled_on')
      .eq('farm_id', a.farmId)
      .order('scheduled_on', { ascending: true, nullsFirst: false })
    setJobs((data as Job[]) || [])
  }

  useEffect(() => {
    load()
  }, [])

  async function complete(id: string) {
    if (!confirm('Mark this job completed?')) return
    setBusyId(id)
    const supabase = createClient()
    await supabase
      .from('land_jobs')
      .update({ status: 'completed', completed_on: new Date().toISOString().slice(0, 10) })
      .eq('id', id)
    setBusyId(null)
    await load()
  }

  const shown = jobs.filter((j) =>
    tab === 'pending' ? j.status !== 'completed' && j.status !== 'cancelled' : j.status === 'completed'
  )

  return (
    <div className="min-h-screen bg-slate-200">
      <header className="border-b-4 border-slate-600 bg-white px-4 py-4 phone-header">
        <h1 className="text-2xl font-bold">Jobs</h1>
      </header>
      <main className="space-y-3 p-4">
        <Link href="/jobs/new" className="block min-h-[56px] rounded-2xl border-4 border-brand-900 bg-brand-700 px-4 py-3 text-center text-lg font-bold text-white">
          New job
        </Link>
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
        {shown.map((j) => (
          <div key={j.id} className="rounded-2xl border-4 border-slate-600 bg-white p-4">
            <Link href={j.job_type === 'spray' ? '/jobs/spray?job=' + j.id : '/jobs/' + j.id} className="block">
              <div className="text-xl font-bold">{j.title}</div>
              <div className="mt-1 text-sm font-semibold text-slate-600">
                {JOB_TYPES.find((t) => t.id === j.job_type)?.label || j.job_type}
                {j.scheduled_on ? ' · ' + j.scheduled_on : ''}
              </div>
            </Link>
            {tab === 'pending' && (
              <button
                type="button"
                disabled={busyId === j.id}
                onClick={() => complete(j.id)}
                className="mt-3 min-h-[48px] w-full rounded-xl bg-brand-700 text-base font-bold text-white disabled:opacity-50"
              >
                {busyId === j.id ? 'Saving…' : 'Complete'}
              </button>
            )}
          </div>
        ))}
        {shown.length === 0 && <p className="font-semibold text-slate-600">No {tab} jobs.</p>}
      </main>
    </div>
  )
}
