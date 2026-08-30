'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getFarmAccess } from '@/lib/farm-access'
import { loadFarmFields, type FarmFieldRow } from '@/lib/fields'
import { AppHeader } from '@/components/layout/AppHeader'
import { FieldPicker } from '@/components/fields/FieldPicker'
import { JOB_TYPES } from '@/lib/crops'

export default function NewJobPage() {
  const router = useRouter()
  const [fields, setFields] = useState<FarmFieldRow[]>([])
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
      const loaded = await loadFarmFields(a.farmId)
      if (loaded.error) setError(loaded.error)
      setFields(loaded.data)
    })
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!farmId) return
    if (selected.size === 0) {
      setError('Pick at least one field from the list or the map')
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
    if (fErr) {
      setError(fErr.message)
      return
    }
    if (jobType === 'spray') {
      router.replace(`/jobs/spray?job=${job.id}&fields=${[...selected].join(',')}`)
    } else {
      router.replace(`/jobs/${job.id}`)
    }
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
        {jobType === 'spray' && (
          <p className="rounded-xl border-2 border-brand-800 bg-brand-50 p-3 text-sm font-semibold">
            After save you go to the spray worksheet (tank, PCS mix, fill sheet, inventory).
          </p>
        )}
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
          <p className="text-sm font-bold">Fields</p>
          <p className="mb-2 text-sm font-semibold text-slate-600">
            Search the list or tap fields on the map.
          </p>
          {fields.length === 0 ? (
            <p className="rounded-2xl border-4 border-slate-500 bg-white p-4 font-semibold text-slate-600">
              No fields yet. Draw them under Fields → Map first.
            </p>
          ) : (
            <FieldPicker farmId={farmId} fields={fields} selected={selected} onChange={setSelected} />
          )}
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
          {saving ? 'Saving…' : jobType === 'spray' ? 'Save and open spray worksheet' : 'Save as pending'}
        </button>
      </form>
    </div>
  )
}
