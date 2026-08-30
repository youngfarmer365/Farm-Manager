'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import type { Group } from '@/types/database'

interface Herd {
  id: string
  herd_number: string
  name: string | null
}

interface Pen {
  id: string
  name: string
}

interface Medicine {
  id: string
  name: string
  default_withdrawal_days: number
  default_cost: number | null
}

interface SessionAnimal {
  id: string
  tag: string
  created_at: string
}

interface SessionTreatment {
  key: string
  medicineId: string
  medicineName: string
  treatedAt: string
  withdrawalDays: number
  costPerMl: number
  mlUsed: number
  costPerAnimal: number
  batchRef: string
  notes: string
}

function normaliseTag(raw: string): string {
  let code = raw.replace(/\s/g, '').trim()
  if (!code) return ''
  if (!code.startsWith('372') && /^\d{12,}$/.test(code)) {
    code = '372' + code
  }
  return code
}

export default function IntakePage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [pens, setPens] = useState<Pen[]>([])
  const [herds, setHerds] = useState<Herd[]>([])
  const [medicines, setMedicines] = useState<Medicine[]>([])
  const [farmId, setFarmId] = useState<string | null>(null)

  const [groupId, setGroupId] = useState('')
  const [penId, setPenId] = useState('')
  const [herdId, setHerdId] = useState('')

  const [sessionOn, setSessionOn] = useState(false)
  const [scanBuffer, setScanBuffer] = useState('')
  const [manualTag, setManualTag] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [feedbackOk, setFeedbackOk] = useState(true)
  const [sessionAnimals, setSessionAnimals] = useState<SessionAnimal[]>([])
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Session treatments (applied to each new animal, and bulk-apply to list)
  const [sessionTreatments, setSessionTreatments] = useState<SessionTreatment[]>([])
  const [medId, setMedId] = useState('')
  const [treatedAt, setTreatedAt] = useState(new Date().toISOString().slice(0, 10))
  const [withdrawal, setWithdrawal] = useState('0')
  const [costPerMl, setCostPerMl] = useState('')
  const [mlUsed, setMlUsed] = useState('')
  const [batchRef, setBatchRef] = useState('')
  const [txNotes, setTxNotes] = useState('')
  const [applyingTx, setApplyingTx] = useState(false)

  const scanRef = useRef<HTMLInputElement>(null)
  const manualRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  useEffect(() => {
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
        .single()

      if (!membership) return
      setFarmId(membership.farm_id)

      const [{ data: g }, { data: p }, { data: h }, { data: m }] = await Promise.all([
        supabase
          .from('groups')
          .select('*')
          .eq('farm_id', membership.farm_id)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('pens')
          .select('id, name')
          .eq('farm_id', membership.farm_id)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('herds')
          .select('id, herd_number, name')
          .eq('farm_id', membership.farm_id)
          .eq('is_active', true)
          .order('herd_number'),
        supabase
          .from('medicines')
          .select('id, name, default_withdrawal_days, default_cost')
          .eq('farm_id', membership.farm_id)
          .eq('is_active', true)
          .order('name'),
      ])

      setGroups((g as Group[]) || [])
      setPens((p as Pen[]) || [])
      setHerds((h as Herd[]) || [])
      setMedicines((m as Medicine[]) || [])
    }
    load()
  }, [])

  useEffect(() => {
    if (!sessionOn) return
    const id = window.setInterval(() => {
      const active = document.activeElement
      if (active === manualRef.current) return
      if (active === scanRef.current) return
      // Don't steal focus from treatment form inputs
      if (active?.tagName === 'INPUT' || active?.tagName === 'SELECT' || active?.tagName === 'TEXTAREA') {
        return
      }
      scanRef.current?.focus()
    }, 800)
    return () => window.clearInterval(id)
  }, [sessionOn])

  function onMedicinePick(id: string) {
    setMedId(id)
    const m = medicines.find((x) => x.id === id)
    if (m) {
      setWithdrawal(String(m.default_withdrawal_days ?? 0))
      setCostPerMl(m.default_cost != null ? String(m.default_cost) : '')
    }
  }

  function addSessionTreatment(e: React.FormEvent) {
    e.preventDefault()
    const med = medicines.find((m) => m.id === medId)
    if (!med) return
    const ml = Number(mlUsed)
    const rate = Number(costPerMl) || 0
    if (!ml || ml <= 0) {
      setFeedback('Enter ml used for the treatment')
      setFeedbackOk(false)
      return
    }

    const row: SessionTreatment = {
      key: `${med.id}-${Date.now()}`,
      medicineId: med.id,
      medicineName: med.name,
      treatedAt,
      withdrawalDays: Number(withdrawal) || 0,
      costPerMl: rate,
      mlUsed: ml,
      costPerAnimal: Number((rate * ml).toFixed(2)),
      batchRef: batchRef.trim(),
      notes: txNotes.trim(),
    }
    setSessionTreatments((prev) => [...prev, row])
    setMlUsed('')
    setTxNotes('')
    setFeedback(`Treatment queued: ${med.name}`)
    setFeedbackOk(true)
  }

  function removeSessionTreatment(key: string) {
    setSessionTreatments((prev) => prev.filter((t) => t.key !== key))
  }

  async function writeTreatmentsForAnimal(animalId: string) {
    if (!farmId || sessionTreatments.length === 0) return

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const rows = sessionTreatments.map((t) => ({
      farm_id: farmId,
      animal_id: animalId,
      medicine_id: t.medicineId,
      medicine_name: t.medicineName,
      treated_at: t.treatedAt,
      withdrawal_days: t.withdrawalDays,
      cost: t.costPerAnimal,
      ml_used: t.mlUsed,
      dose: `${t.mlUsed} ml`,
      batch_ref: t.batchRef || null,
      notes: t.notes || null,
      created_by: user?.id || null,
    }))

    await supabase.from('treatments').insert(rows)
  }

  async function applyTreatmentsToSession() {
    if (!sessionTreatments.length || !sessionAnimals.length) return
    setApplyingTx(true)
    setFeedback(null)
    try {
      for (const a of sessionAnimals) {
        await writeTreatmentsForAnimal(a.id)
      }
      setFeedback(
        `Applied ${sessionTreatments.length} treatment(s) to ${sessionAnimals.length} animal(s)`
      )
      setFeedbackOk(true)
    } catch (err: any) {
      setFeedback(err.message || 'Failed to apply treatments')
      setFeedbackOk(false)
    }
    setApplyingTx(false)
  }

  async function addTag(raw: string) {
    if (!farmId) {
      setFeedback('No farm loaded')
      setFeedbackOk(false)
      return
    }
    if (!groupId) {
      setFeedback('Choose a group before scanning')
      setFeedbackOk(false)
      return
    }

    const tag = normaliseTag(raw)
    if (!tag) return

    setSaving(true)
    setFeedback(null)

    if (sessionAnimals.some((a) => a.tag === tag)) {
      setFeedback(`Already in this session: ${tag}`)
      setFeedbackOk(false)
      setSaving(false)
      return
    }

    const { data: existing } = await supabase
      .from('animals')
      .select('id, tag, status')
      .eq('farm_id', farmId)
      .eq('tag', tag)
      .maybeSingle()

    if (existing) {
      setFeedback(`Already on system: ${tag} (${existing.status})`)
      setFeedbackOk(false)
      setSaving(false)
      return
    }

    const today = new Date().toISOString().slice(0, 10)

    const { data: inserted, error } = await supabase
      .from('animals')
      .insert({
        farm_id: farmId,
        tag,
        eid: tag,
        group_id: groupId,
        pen_id: penId || null,
        herd_id: herdId || null,
        purchase_date: today,
        entry_date: today,
        status: 'active',
        source: 'EID intake',
        notes: 'Added via intake scan — awaiting mart file details',
      })
      .select('id, tag, created_at')
      .single()

    if (error) {
      setFeedback(error.message)
      setFeedbackOk(false)
      setSaving(false)
      return
    }

    // Attach queued treatments to this animal
    if (sessionTreatments.length) {
      await writeTreatmentsForAnimal(inserted.id)
    }

    setSessionAnimals((prev) => [
      { id: inserted.id, tag: inserted.tag, created_at: inserted.created_at },
      ...prev,
    ])
    setFeedback(
      sessionTreatments.length
        ? `Added ${tag} + ${sessionTreatments.length} treatment(s)`
        : `Added ${tag}`
    )
    setFeedbackOk(true)
    setSaving(false)
  }

  async function removeFromSession(animal: SessionAnimal) {
    if (!confirm(`Delete ${animal.tag} from the system?`)) return
    setDeletingId(animal.id)
    setFeedback(null)

    const { error } = await supabase.from('animals').delete().eq('id', animal.id)

    if (error) {
      setFeedback(error.message)
      setFeedbackOk(false)
      setDeletingId(null)
      return
    }

    setSessionAnimals((prev) => prev.filter((a) => a.id !== animal.id))
    setFeedback(`Deleted ${animal.tag}`)
    setFeedbackOk(true)
    setDeletingId(null)
    setTimeout(() => scanRef.current?.focus(), 50)
  }

  function onScanKeyDown(e: { key: string; preventDefault: () => void }) {
    if (e.key === 'Enter') {
      e.preventDefault()
      const value = scanBuffer
      setScanBuffer('')
      addTag(value)
    }
  }

  async function handleManual(e: React.FormEvent) {
    e.preventDefault()
    await addTag(manualTag)
    setManualTag('')
    setTimeout(() => scanRef.current?.focus(), 50)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">EID intake</h1>
            <p className="text-sm text-slate-500">
              Scan into group / pen / herd · optional treatments on intake
            </p>
          </div>
          <Link href="/animals" className="text-sm text-slate-600 hover:underline">
            Animals
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Settings */}
        <div className="bg-white rounded-xl border p-6 shadow-sm space-y-4">
          <h2 className="font-semibold">Session settings</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Group *</label>
              <select
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                disabled={sessionOn}
              >
                <option value="">Select…</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Pen / Field</label>
              <select
                value={penId}
                onChange={(e) => setPenId(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                disabled={sessionOn}
              >
                <option value="">— None —</option>
                {pens.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Herd</label>
              <select
                value={herdId}
                onChange={(e) => setHerdId(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                disabled={sessionOn}
              >
                <option value="">— None —</option>
                {herds.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.herd_number}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            disabled={!groupId}
            onClick={() => {
              setSessionOn((v) => !v)
              setFeedback(null)
              setTimeout(() => scanRef.current?.focus(), 50)
            }}
            className={`rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-50 ${
              sessionOn
                ? 'bg-brand-600 text-white'
                : 'bg-white border border-slate-300 hover:bg-slate-50'
            }`}
          >
            {sessionOn ? 'Session ON — click to stop' : 'Start intake session'}
          </button>
        </div>

        {/* Treatments for this intake batch */}
        <div className="bg-white rounded-xl border p-6 shadow-sm space-y-4">
          <h2 className="font-semibold">Treatments for this intake</h2>
          <p className="text-xs text-slate-500">
            Queue one or more medicines. Each newly scanned animal gets them automatically. Use
            “Apply to all in session” if animals were scanned before you added a treatment.
          </p>

          <form onSubmit={addSessionTreatment} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Medicine *</label>
                <select
                  required
                  value={medId}
                  onChange={(e) => onMedicinePick(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Select…</option>
                  {medicines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                      {m.default_cost != null ? ` · €${Number(m.default_cost).toFixed(4)}/ml` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Treatment date *</label>
                <input
                  type="date"
                  required
                  value={treatedAt}
                  onChange={(e) => setTreatedAt(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Withdrawal (days)</label>
                <input
                  type="number"
                  min="0"
                  value={withdrawal}
                  onChange={(e) => setWithdrawal(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">€ / ml</label>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={costPerMl}
                  onChange={(e) => setCostPerMl(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Ml per animal *</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  required
                  value={mlUsed}
                  onChange={(e) => setMlUsed(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Batch / bottle ref</label>
                <input
                  type="text"
                  value={batchRef}
                  onChange={(e) => setBatchRef(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Notes</label>
              <input
                type="text"
                value={txNotes}
                onChange={(e) => setTxNotes(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
            >
              Add treatment to queue
            </button>
          </form>

          {sessionTreatments.length === 0 ? (
            <p className="text-sm text-slate-500">No treatments queued.</p>
          ) : (
            <ul className="divide-y border rounded-lg">
              {sessionTreatments.map((t) => (
                <li key={t.key} className="px-3 py-2 flex justify-between gap-3 text-sm">
                  <div>
                    <span className="font-medium">{t.medicineName}</span>
                    <span className="text-slate-500 ml-2">
                      {t.mlUsed} ml · €{t.costPerAnimal.toFixed(2)} · {t.withdrawalDays}d w/d ·{' '}
                      {t.treatedAt}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeSessionTreatment(t.key)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          {sessionTreatments.length > 0 && sessionAnimals.length > 0 && (
            <button
              type="button"
              onClick={applyTreatmentsToSession}
              disabled={applyingTx}
              className="rounded-lg bg-amber-600 text-white px-4 py-2 text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
            >
              {applyingTx
                ? 'Applying…'
                : `Apply ${sessionTreatments.length} treatment(s) to all ${sessionAnimals.length} in session`}
            </button>
          )}
        </div>

        {/* Scanning */}
        {sessionOn && (
          <div className="bg-white rounded-xl border p-6 shadow-sm space-y-4">
            <h2 className="font-semibold text-green-800">Scanning</h2>
            <input
              ref={scanRef}
              type="text"
              value={scanBuffer}
              onChange={(e) => setScanBuffer(e.target.value)}
              onKeyDown={onScanKeyDown}
              className="w-full rounded-md border border-brand-400 px-3 py-3 text-sm font-mono"
              placeholder="EID reader types here automatically…"
              autoComplete="off"
              disabled={saving}
            />

            <form onSubmit={handleManual} className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Manual tag</label>
                <input
                  ref={manualRef}
                  type="text"
                  value={manualTag}
                  onChange={(e) => setManualTag(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
                />
              </div>
              <button
                type="submit"
                disabled={saving || !manualTag.trim()}
                className="rounded-lg bg-slate-800 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                Add
              </button>
            </form>

            {feedback && (
              <p className={`text-sm font-medium ${feedbackOk ? 'text-green-700' : 'text-red-600'}`}>
                {feedback}
              </p>
            )}
          </div>
        )}

        {/* Session list */}
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <span className="font-medium">This session: {sessionAnimals.length} animals</span>
            <Link href="/import/mart" className="text-xs text-brand-700 hover:underline">
              Upload mart file later
            </Link>
          </div>
          {sessionAnimals.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">No animals scanned yet.</p>
          ) : (
            <ul className="divide-y max-h-80 overflow-y-auto">
              {sessionAnimals.map((a) => (
                <li key={a.id} className="px-4 py-2 flex items-center justify-between gap-3 text-sm">
                  <div>
                    <span className="font-mono font-medium">{a.tag}</span>
                    <span className="text-xs text-slate-400 ml-2">
                      {new Date(a.created_at).toLocaleTimeString('en-IE')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFromSession(a)}
                    disabled={deletingId === a.id}
                    className="text-xs text-red-600 hover:underline disabled:opacity-50"
                  >
                    {deletingId === a.id ? 'Deleting…' : 'Delete'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  )
}