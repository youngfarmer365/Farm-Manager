'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Group } from '@/types/database'
import { ScreenKeys } from '@/components/intake/ScreenKeys'

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

const section =
  'rounded-xl border-2 border-slate-500 bg-white p-4 space-y-3'
const sectionTitle = 'text-base font-bold text-slate-900'
const label = 'block text-sm font-bold text-slate-800 mb-1'
const field =
  'w-full min-h-[48px] rounded-xl border-2 border-slate-500 bg-white px-3 py-3 text-base font-semibold text-slate-900'
const btnPrimary =
  'min-h-[52px] w-full rounded-xl border-2 border-brand-900 bg-brand-700 text-base font-bold text-white disabled:opacity-50'
const btnDark =
  'min-h-[52px] w-full rounded-xl border-2 border-slate-800 bg-slate-900 text-base font-bold text-white disabled:opacity-50'
const btnSecondary =
  'min-h-[48px] w-full rounded-xl border-2 border-slate-600 bg-slate-200 text-base font-bold text-slate-900'

export default function MobileIntakePage() {
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
  const [appliedKeys, setAppliedKeys] = useState<Record<string, string[]>>({})
  const [pad, setPad] = useState<null | 'tag' | 'ml' | 'wd' | 'cost' | 'batch'>(null)

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
        .maybeSingle()
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
    if (!sessionOn || pad) return
    const id = window.setInterval(() => {
      const active = document.activeElement
      if (active === manualRef.current) return
      if (active === scanRef.current) return
      if (
        active?.tagName === 'INPUT' ||
        active?.tagName === 'SELECT' ||
        active?.tagName === 'TEXTAREA' ||
        active?.tagName === 'BUTTON'
      ) {
        return
      }
      scanRef.current?.focus()
    }, 1000)
    return () => window.clearInterval(id)
  }, [sessionOn, pad])

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
      setFeedback('Enter ml used')
      setFeedbackOk(false)
      return
    }
    setSessionTreatments((prev) => [
      ...prev,
      {
        key: med.id + '-' + Date.now(),
        medicineId: med.id,
        medicineName: med.name,
        treatedAt,
        withdrawalDays: Number(withdrawal) || 0,
        costPerMl: rate,
        mlUsed: ml,
        costPerAnimal: Number((rate * ml).toFixed(2)),
        batchRef: batchRef.trim(),
        notes: txNotes.trim(),
      },
    ])
    setMlUsed('')
    setTxNotes('')
    setFeedback('Queued: ' + med.name)
    setFeedbackOk(true)
  }

  async function writeMissingTreatments(animalId: string, already: string[]) {
    if (!farmId || sessionTreatments.length === 0) return already
    const have = new Set(already)
    const todo = sessionTreatments.filter((t) => !have.has(t.key))
    if (!todo.length) return already
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const rows = todo.map((t) => ({
      farm_id: farmId,
      animal_id: animalId,
      medicine_id: t.medicineId,
      medicine_name: t.medicineName,
      treated_at: t.treatedAt,
      withdrawal_days: t.withdrawalDays,
      cost: t.costPerAnimal,
      ml_used: t.mlUsed,
      dose: t.mlUsed + ' ml',
      batch_ref: t.batchRef || null,
      notes: t.notes || null,
      created_by: user?.id || null,
    }))
    const { error } = await supabase.from('treatments').insert(rows)
    if (error) throw error
    return already.concat(todo.map((t) => t.key))
  }

  async function applyTreatmentsToSession() {
    if (!sessionTreatments.length || !sessionAnimals.length) return
    setApplyingTx(true)
    try {
      const next = { ...appliedKeys }
      let n = 0
      for (const a of sessionAnimals) {
        const before = next[a.id] || []
        const after = await writeMissingTreatments(a.id, before)
        if (after.length > before.length) n += 1
        next[a.id] = after
      }
      setAppliedKeys(next)
      setFeedback(
        n
          ? 'Treatments added to ' + n + ' animal(s) that did not already have them'
          : 'Already on every animal in this session — nothing extra written'
      )
      setFeedbackOk(true)
    } catch (err: any) {
      setFeedback(err.message || 'Failed')
      setFeedbackOk(false)
    }
    setApplyingTx(false)
  }

  async function addTag(raw: string) {
    if (!farmId) {
      setFeedback('No farm')
      setFeedbackOk(false)
      return
    }
    if (!groupId) {
      setFeedback('Choose a group first')
      setFeedbackOk(false)
      return
    }
    const tag = normaliseTag(raw)
    if (!tag) return
    setSaving(true)
    setFeedback(null)
    if (sessionAnimals.some((a) => a.tag === tag)) {
      setFeedback('Already in session: ' + tag)
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
      setFeedback('Already on system: ' + tag)
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
    if (sessionTreatments.length) {
      const keys = await writeMissingTreatments(inserted.id, [])
      setAppliedKeys((prev) => ({ ...prev, [inserted.id]: keys }))
    }
    setSessionAnimals((prev) => [
      { id: inserted.id, tag: inserted.tag, created_at: inserted.created_at },
      ...prev,
    ])
    setFeedback(
      sessionTreatments.length
        ? 'Added ' + tag.slice(-5) + ' + treatments'
        : 'Added ' + tag.slice(-5)
    )
    setFeedbackOk(true)
    setSaving(false)
  }

  async function removeFromSession(animal: SessionAnimal) {
    if (!confirm('Delete ' + animal.tag + '?')) return
    setDeletingId(animal.id)
    const { error } = await supabase.from('animals').delete().eq('id', animal.id)
    if (error) {
      setFeedback(error.message)
      setFeedbackOk(false)
    } else {
      setSessionAnimals((prev) => prev.filter((a) => a.id !== animal.id))
      setFeedback('Deleted ' + animal.tag.slice(-5))
      setFeedbackOk(true)
    }
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
    <div className="min-h-screen bg-slate-200 pb-8">
      <header className="sticky top-0 z-10 border-b-4 border-slate-700 bg-white px-4 py-4">
        <p className="text-sm font-bold uppercase tracking-wide text-brand-800">
          Farm Manager
        </p>
        <h1 className="text-2xl font-bold text-slate-900">EID intake</h1>
        <p className="mt-1 text-sm font-semibold text-slate-700">
          Pair XRS2 as Bluetooth keyboard · same data as desktop
        </p>
      </header>

      <div className="space-y-4 p-3">
        <section className={section}>
          <h2 className={sectionTitle}>Session settings</h2>

          <div>
            <label className={label}>Group *</label>
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className={field}
              disabled={sessionOn}
            >
              <option value="">Select group…</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={label}>Pen / field</label>
            <select
              value={penId}
              onChange={(e) => setPenId(e.target.value)}
              className={field}
              disabled={sessionOn}
            >
              <option value="">None</option>
              {pens.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={label}>Herd</label>
            <select
              value={herdId}
              onChange={(e) => setHerdId(e.target.value)}
              className={field}
              disabled={sessionOn}
            >
              <option value="">None</option>
              {herds.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.herd_number}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            disabled={!groupId}
            onClick={() => {
              setSessionOn((v) => !v)
              setFeedback(null)
              setTimeout(() => scanRef.current?.focus(), 100)
            }}
            className={sessionOn ? btnPrimary : btnDark}
          >
            {sessionOn ? 'Session ON — tap to stop' : 'Start intake session'}
          </button>
        </section>

        <section className={section}>
          <h2 className={sectionTitle}>Treatments for this intake</h2>
          <form onSubmit={addSessionTreatment} className="space-y-2">
            <select
              required
              value={medId}
              onChange={(e) => onMedicinePick(e.target.value)}
              className={field}
            >
              <option value="">Medicine…</option>
              {medicines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                required
                value={treatedAt}
                onChange={(e) => setTreatedAt(e.target.value)}
                className={field}
              />
              <button type="button" className={field + ' text-left'} onClick={() => { scanRef.current?.blur(); setPad('ml') }}>
                {mlUsed || 'Ml each *'}
              </button>
              <button type="button" className={field + ' text-left'} onClick={() => { scanRef.current?.blur(); setPad('wd') }}>
                {withdrawal ? withdrawal + ' d w/d' : 'W/d days'}
              </button>
              <button type="button" className={field + ' text-left'} onClick={() => { scanRef.current?.blur(); setPad('batch') }}>
                {batchRef || 'Batch ref'}
              </button>
            </div>
            {pad === 'ml' && (
              <ScreenKeys value={mlUsed} onChange={setMlUsed} decimal onSubmit={() => setPad(null)} submitLabel="Done" />
            )}
            {pad === 'wd' && (
              <ScreenKeys value={withdrawal} onChange={setWithdrawal} onSubmit={() => setPad(null)} submitLabel="Done" />
            )}
            {pad === 'batch' && (
              <ScreenKeys value={batchRef} onChange={setBatchRef} onSubmit={() => setPad(null)} submitLabel="Done" />
            )}
            <button type="submit" className={btnSecondary}>
              Add treatment to queue
            </button>
          </form>

          {sessionTreatments.map((t) => (
            <div
              key={t.key}
              className="flex items-center justify-between gap-2 rounded-xl border-2 border-slate-400 bg-slate-100 px-3 py-3"
            >
              <span className="text-sm font-bold text-slate-900">
                {t.medicineName} · {t.mlUsed} ml · €{t.costPerAnimal.toFixed(2)}
              </span>
              <button
                type="button"
                className="min-h-[40px] rounded-lg border-2 border-red-700 bg-red-600 px-3 text-sm font-bold text-white"
                onClick={() =>
                  setSessionTreatments((prev) => prev.filter((x) => x.key !== t.key))
                }
              >
                Remove
              </button>
            </div>
          ))}

      {sessionTreatments.length > 0 && (
            <p className="text-sm font-semibold text-slate-700">
              Goes on each animal as you scan. Only use Apply for animals scanned before you queued the medicine.
            </p>
          )}
        </section>

        {sessionOn && (
          <section className="space-y-3 rounded-xl border-4 border-brand-800 bg-brand-50 p-4">
            <h2 className="text-lg font-bold text-brand-950">Scanning</h2>
            <input
              ref={scanRef}
              type="text"
              inputMode="none"
              value={scanBuffer}
              onChange={(e) => setScanBuffer(e.target.value)}
              onKeyDown={onScanKeyDown}
              className="w-full min-h-[56px] rounded-xl border-4 border-brand-700 bg-white px-3 py-4 font-mono text-lg font-bold text-slate-900"
              placeholder="Tap here, then scan EID…"
              autoComplete="off"
              autoCorrect="off"
              disabled={saving}
            />
             <p className="text-sm font-semibold text-slate-800">
              Scan into the box above. If a tag misses, use Type tag on screen — the iPhone keyboard will not open while the reader is connected.
            </p>
            <button
              type="button"
              className={btnDark}
              onClick={() => {
                scanRef.current?.blur()
                setPad(pad === 'tag' ? null : 'tag')
              }}
            >
              {pad === 'tag' ? 'Hide tag keys' : 'Type tag on screen'}
            </button>
            {pad === 'tag' && (
              <div className="space-y-2">
                <div className="rounded-xl border-2 border-slate-700 bg-white px-3 py-3 font-mono text-xl font-bold">
                  {manualTag || '—'}
                </div>
                <ScreenKeys
                  value={manualTag}
                  onChange={setManualTag}
                  show372
                  onSubmit={async () => {
                    await addTag(manualTag)
                    setManualTag('')
                    setPad(null)
                  }}
                  submitLabel="Add tag"
                />
              </div>
            )}
            {feedback && (
              <p
                className={
                  'rounded-xl border-2 px-3 py-3 text-center text-base font-bold ' +
                  (feedbackOk
                    ? 'border-brand-800 bg-brand-100 text-brand-950'
                    : 'border-red-800 bg-red-100 text-red-900')
                }
              >
                {feedback}
              </p>
            )}
          </section>
        )}

        <section className="overflow-hidden rounded-xl border-2 border-slate-500 bg-white">
          <div className="border-b-2 border-slate-400 bg-slate-100 px-4 py-3 text-base font-bold text-slate-900">
            This session: {sessionAnimals.length}
          </div>
          {sessionAnimals.length === 0 ? (
            <p className="p-4 text-base font-semibold text-slate-800">No animals yet.</p>
          ) : (
            <ul className="max-h-72 divide-y-2 divide-slate-200 overflow-y-auto">
              {sessionAnimals.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-2 px-4 py-3"
                >
                  <span className="font-mono text-base font-bold text-slate-900">
                    {a.tag}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFromSession(a)}
                    disabled={deletingId === a.id}
                    className="min-h-[44px] rounded-lg border-2 border-red-700 bg-red-600 px-3 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {deletingId === a.id ? '…' : 'Delete'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="px-1 text-sm font-semibold text-slate-800">
          iPhone: Settings → Bluetooth → pair XRS2. In reader settings use{' '}
          <strong>keyboard / HID</strong> mode so each read types into the scan box and
          presses Enter.
        </p>
      </div>
    </div>
  )
}
