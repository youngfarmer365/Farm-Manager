'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getFarmAccess } from '@/lib/farm-access'
import { AppHeader } from '@/components/layout/AppHeader'
import { JOB_TYPES } from '@/lib/crops'

interface Field {
  id: string
  name: string
}

export default function NewJobPage() {
  const router = useRouter()
  const [fields, setFields] = useState<Field[]>([])
  const [farmId, setFarmId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [jobType, setJobType] = useState('spray')
  const [scheduled, setScheduled] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getFarmAccess().then(async (a) => {
      if (!a.farmId) return
      setFarmId(a.farmId)
      setUserId(a.userId)
      const supabase = createClient()
      const { data } = await supabase
        .from('farm_fields')
        .select('id, name')
        .eq('farm_id', a.farmId)
        .order('name')
      setFields((data as Field[]) || [])
    })
  }, [])

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!farmId) return
    if (selected.size === 0) {
      setError('Pick at least one field')
      return
    }
    setSaving(true)
    setError(null)
    const supabase = createClient()
    const { data: job, error: jErr } = await supabase
      .from('land_jobs')
      .insert({
        farm_id: farmId,
        title: title.trim() || JOB_TYPES.find((t) => t.id === jobType)?.label || 'Job',
        job_type: jobType,
        status: 'pending',
        scheduled_on: scheduled || null,
        notes: notes.trim() || null,
        created_by: userId,
      })
      .select('id')
      .single()
    if (jErr || !job) {
      setSaving(false)
      setError(jErr?.message || 'Could not save job')
      return
    }
    const rows = [...selected].map((field_id) => ({ job_id: job.id, field_id }))
    const { error: fErr } = await supabase.from('land_job_fields').insert(rows)
    setSaving(false)
    if (fErr) setError(fErr.message)
    else router.replace(`/jobs/${job.id}`)
  }

  return (
    <div className="min-h-screen bg-slate-200">
      <AppHeader title="New job" />
      <form onSubmit={save} className="mx-auto max-w-3xl space-y-4 p-4">
        <label className="block">
          <span className="text-sm font-bold">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Spray docks — silage ground"
            className="mt-1 w-full rounded-xl border-2 border-slate-400 px-3 py-3 text-base"
          />
        </label>
        <label className="block">
          <span className="text-sm font-bold">Type</span>
          <select
            value={jobType}
            onChange={(e) => setJobType(e.target.value)}
            className="mt-1 w-full rounded-xl border-2 border-slate-400 px-3 py-3 text-base"
          >
            {JOB_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-bold">Scheduled</span>
          <input
            type="date"
            value={scheduled}
            onChange={(e) => setScheduled(e.target.value)}
            className="mt-1 w-full rounded-xl border-2 border-slate-400 px-3 py-3 text-base"
          />
        </label>
        <div>
          <p className="text-sm font-bold">Fields ({selected.size} selected)</p>
          <ul className="mt-2 divide-y overflow-hidden rounded-2xl border-4 border-slate-500 bg-white">
            {fields.length === 0 && (
              <li className="p-4 font-semibold text-slate-600">
                No fields yet. Draw them under Fields → Map first.
              </li>
            )}
            {fields.map((f) => (
              <li key={f.id}>
                <label className="flex min-h-[52px] items-center gap-3 px-4 py-2">
                  <input
                    type="checkbox"
                    checked={selected.has(f.id)}
                    onChange={() => toggle(f.id)}
                    className="h-5 w-5"
                  />
                  <span className="text-base font-bold">{f.name}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
        <label className="block">
          <span className="text-sm font-bold">Notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-xl border-2 border-slate-400 px-3 py-3 text-base"
          />
        </label>
        {error && <p className="font-semibold text-red-700">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="w-full min-h-[52px] rounded-2xl bg-brand-700 text-lg font-bold text-white disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save as pending'}
        </button>
      </form>
    </div>
  )
}
