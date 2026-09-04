'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatADG, formatCurrency, formatDate, formatWeight } from '@/lib/utils'
import { exactAge } from '@/lib/age'

function shortTag(tag: string) {
  const c = (tag || '').replace(/\s/g, '')
  return c.length <= 5 ? c : c.slice(-5)
}

export default function MobileAnimalDetailPage() {
  const { id } = useParams() as { id: string }
  const supabase = createClient()
  const [animal, setAnimal] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [weightKg, setWeightKg] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [wdDays, setWdDays] = useState<number | null>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('animals_enriched')
      .select('*')
      .eq('id', id)
      .single()
    setAnimal(data)

    try {
      const { data: txs } = await supabase
        .from('treatments')
        .select('treated_at, withdrawal_days')
        .eq('animal_id', id)

      let maxLeft = 0
      const today = new Date()
      for (const t of txs || []) {
        if (!t.withdrawal_days || !t.treated_at) continue
        const end = new Date(t.treated_at)
        end.setDate(end.getDate() + Number(t.withdrawal_days))
        const left = Math.ceil((end.getTime() - today.getTime()) / 86400000)
        if (left > maxLeft) maxLeft = left
      }
      setWdDays(maxLeft > 0 ? maxLeft : null)
    } catch {
      setWdDays(null)
    }

    setLoading(false)
  }

  useEffect(() => {
    if (id) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function addWeight(e: React.FormEvent) {
    e.preventDefault()
    const kg = Number(weightKg)
    if (!kg || kg <= 0) return
    setSaving(true)
    setMsg(null)
    const today = new Date().toISOString().slice(0, 10)
    await supabase.from('weights').delete().eq('animal_id', id).eq('weighed_at', today)
    const { error } = await supabase.from('weights').insert({
      animal_id: id,
      weight_kg: kg,
      weighed_at: today,
      notes: 'Mobile weigh',
    })
    if (error) setMsg(error.message)
    else {
      setMsg('Saved ' + kg + ' kg')
      setWeightKg('')
      await load()
    }
    setSaving(false)
  }

  async function toggleFlag() {
    if (!animal) return
    const next = !animal.is_flagged
    const { error } = await supabase
      .from('animals')
      .update({ is_flagged: next })
      .eq('id', id)
    if (error) {
      setMsg(error.message)
      return
    }
    setAnimal({ ...animal, is_flagged: next })
  }

  if (loading) {
    return (
      <p className="p-8 text-center text-base font-bold text-slate-800">Loading…</p>
    )
  }

  if (!animal) {
    return (
      <div className="p-8 text-center">
        <p className="text-base font-bold text-slate-900">Animal not found</p>
        <Link
          href="/m/animals"
          className="mt-4 inline-block min-h-[48px] rounded-xl border-2 border-slate-600 bg-slate-300 px-6 py-3 text-base font-bold text-slate-900"
        >
          Back to list
        </Link>
      </div>
    )
  }

  const age = exactAge(animal.date_of_birth)
  const flagged = !!animal.is_flagged

  return (
    <div className="min-h-screen bg-slate-200 pb-8">
      <header className="sticky top-0 z-10 border-b-4 border-slate-700 bg-white px-4 py-3 phone-header">
        <Link
          href="/m/animals"
          className="inline-flex min-h-[44px] items-center text-base font-bold text-brand-800"
        >
          ← Back
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1
            className={
              'font-mono text-2xl font-bold ' + (flagged ? 'text-red-700' : 'text-slate-900')
            }
          >
            {shortTag(animal.tag)}
          </h1>
          {flagged && (
            <span className="rounded-md bg-red-600 px-2 py-1 text-xs font-bold text-white">
              FLAGGED
            </span>
          )}
          {wdDays != null && (
            <span className="rounded-md bg-amber-700 px-2 py-1 text-xs font-bold text-white">
              W/D {wdDays}d
            </span>
          )}
        </div>
        <p className="mt-1 break-all text-sm font-semibold text-slate-700">{animal.tag}</p>
      </header>

      <div className="space-y-4 p-4">
        {/* Status actions */}
        <button
          type="button"
          onClick={toggleFlag}
          className={
            'min-h-[52px] w-full rounded-xl border-2 text-base font-bold ' +
            (flagged
              ? 'border-red-800 bg-red-600 text-white'
              : 'border-slate-500 bg-white text-slate-900')
          }
        >
          {flagged ? '⚑ Unflag this animal' : '⚐ Flag this animal'}
        </button>

        {/* Key numbers */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border-2 border-slate-500 bg-white p-3">
            <div className="text-sm font-bold text-slate-700">Last weight</div>
            <div className="text-2xl font-bold text-slate-900">
              {formatWeight(animal.latest_weight_kg)}
            </div>
          </div>
          <div className="rounded-xl border-2 border-slate-500 bg-white p-3">
            <div className="text-sm font-bold text-slate-700">ADG</div>
            <div className="text-2xl font-bold text-brand-800">
              {formatADG(animal.adg_kg_per_day)}
            </div>
          </div>
          <div className="rounded-xl border-2 border-slate-500 bg-white p-3">
            <div className="text-sm font-bold text-slate-700">Days on farm</div>
            <div className="text-xl font-bold text-slate-900">
              {animal.days_on_farm ?? '—'}
            </div>
          </div>
          <div className="rounded-xl border-2 border-slate-500 bg-white p-3">
            <div className="text-sm font-bold text-slate-700">Age</div>
            <div className="text-xl font-bold text-slate-900">
              {age ? age.label : '—'}
            </div>
          </div>
        </div>

        {/* Location & purchase */}
        <div className="space-y-2 rounded-xl border-2 border-slate-500 bg-slate-100 p-3">
          <p className="border-b-2 border-slate-400 pb-1 text-base font-bold text-slate-900">
            Details
          </p>
          <Row label="Group" value={animal.group_name || '—'} />
          <Row label="Pen / field" value={animal.pen_name || '—'} />
          <Row label="Herd" value={animal.herd_number || '—'} />
          <Row label="Status" value={animal.status || '—'} />
          <Row label="From" value={animal.source || '—'} />
          <Row label="Joined" value={formatDate(animal.purchase_date || animal.entry_date)} />
          <Row label="Purchase weight" value={formatWeight(animal.purchase_weight_kg)} />
          <Row label="Purchase price" value={formatCurrency(animal.purchase_price)} />
          {animal.sale_date && (
            <Row label="Sale date" value={formatDate(animal.sale_date)} />
          )}
          {animal.sale_price != null && (
            <Row label="Sale price" value={formatCurrency(animal.sale_price)} />
          )}
        </div>

        {/* Quick weigh */}
        <form
          onSubmit={addWeight}
          className="space-y-3 rounded-xl border-2 border-brand-800 bg-brand-50 p-4"
        >
          <h2 className="text-lg font-bold text-slate-900">Quick weigh</h2>
          <input
            type="number"
            step="0.1"
            min="0"
            inputMode="decimal"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
            placeholder="Weight in kg"
            className="min-h-[52px] w-full rounded-xl border-2 border-slate-500 bg-white px-3 py-3 text-lg font-bold text-slate-900"
          />
          <button
            type="submit"
            disabled={saving || !weightKg}
            className="min-h-[52px] w-full rounded-xl border-2 border-brand-900 bg-brand-700 text-lg font-bold text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save weight'}
          </button>
          {msg && (
            <p className="text-base font-bold text-slate-900">{msg}</p>
          )}
        </form>

        <Link
          href={'/animals/' + animal.id}
          className="flex min-h-[52px] items-center justify-center rounded-xl border-2 border-slate-600 bg-slate-300 text-base font-bold text-slate-900"
        >
          Full desktop editor
        </Link>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-slate-300 py-2 last:border-0">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      <span className="text-right text-base font-bold text-slate-900">{value}</span>
    </div>
  )
}