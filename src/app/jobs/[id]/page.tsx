'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
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

export default function JobDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [job, setJob] = useState<Job | null>(null)
  const [fields, setFields] = useState<{ id: string; name: string }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    const supabase = createClient()
    const { data, error } = await supabase.from('land_jobs').select('*').eq('id', params.id).maybeSingle()
    if (error) setError(error.message)
    setJob(data as Job)
    const { data: jf } = await supabase
      .from('land_job_fields')
      .select('field_id, farm_fields(name)')
      .eq('job_id', params.id)
    setFields(
      (jf || []).map((r: { field_id: string; farm_fields: { name: string } | { name: string }[] | null }) => ({
        id: r.field_id,
        name: Array.isArray(r.farm_fields) ? r.farm_fields[0]?.name : r.farm_fields?.name || 'Field',
      }))
    )
  }

  useEffect(() => {
    if (params.id) load()
  }, [params.id])

  async function complete() {
    if (!job) return
    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('land_jobs')
      .update({
        status: 'completed',
        completed_on: new Date().toISOString().slice(0, 10),
      })
      .eq('id', job.id)
    setBusy(false)
    if (error) setError(error.message)
    else await load()
  }

  async function reopen() {
    if (!job) return
    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('land_jobs')
      .update({ status: 'pending', completed_on: null })
      .eq('id', job.id)
    setBusy(false)
    if (error) setError(error.message)
    else await load()
  }

  async function remove() {
    if (!job || !confirm('Delete this job?')) return
    const supabase = createClient()
    await supabase.from('land_jobs').delete().eq('id', job.id)
    router.replace('/jobs')
  }

  if (!job) {
    return <p className="p-10 text-center font-bold">Loading…</p>
  }

  const typeLabel = JOB_TYPES.find((t) => t.id === job.job_type)?.label || job.job_type

  return (
    <div className="min-h-screen bg-slate-200">
      <AppHeader title={job.title} />
      <main className="mx-auto max-w-3xl space-y-4 p-4">
        <div className="rounded-2xl border-4 border-slate-600 bg-white p-5">
          <p className="text-sm font-bold uppercase text-slate-500">{typeLabel}</p>
          <p className="mt-2 text-lg font-bold capitalize">{job.status}</p>
          {job.scheduled_on && <p className="mt-1 font-semibold">Scheduled {job.scheduled_on}</p>}
          {job.completed_on && <p className="mt-1 font-semibold">Completed {job.completed_on}</p>}
          {job.notes && <p className="mt-3 whitespace-pre-wrap text-slate-800">{job.notes}</p>}
        </div>
        <div className="rounded-2xl border-4 border-slate-600 bg-white p-5">
          <h2 className="font-bold">Fields</h2>
          <ul className="mt-2 space-y-1">
            {fields.map((f) => (
              <li key={f.id}>
                <Link href={`/fields/${f.id}`} className="font-semibold text-brand-800 underline">
                  {f.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        {error && <p className="font-semibold text-red-700">{error}</p>}
        {job.status !== 'completed' ? (
          <button
            type="button"
            disabled={busy}
            onClick={complete}
            className="w-full min-h-[52px] rounded-2xl bg-brand-700 text-lg font-bold text-white"
          >
            Mark completed
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={reopen}
            className="w-full min-h-[52px] rounded-2xl border-4 border-slate-700 bg-white text-lg font-bold"
          >
            Reopen as pending
          </button>
        )}
        <button type="button" onClick={remove} className="w-full text-sm font-bold text-red-700 underline">
          Delete job
        </button>
      </main>
    </div>
  )
}
