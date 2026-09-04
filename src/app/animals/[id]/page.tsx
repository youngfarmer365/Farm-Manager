'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatWeight, formatCurrency, formatDate, formatADG } from '@/lib/utils'
import { exactAge } from '@/lib/age'
import { groupPensByShed, type PenRow } from '@/lib/pens'

interface Option {
  id: string
  name: string
  type?: string | null
  parent_id?: string | null
}

interface HerdOption {
  id: string
  herd_number: string
  name: string | null
}

interface Treatment {
  id: string
  medicine_name: string
  treated_at: string
  withdrawal_days: number
  cost: number | null
  ml_used: number | null
  dose: string | null
  notes: string | null
}

function withdrawalStatus(treatedAt: string, withdrawalDays: number) {
  const start = new Date(treatedAt + 'T00:00:00')
  const clear = new Date(start)
  clear.setDate(clear.getDate() + (withdrawalDays || 0))
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  clear.setHours(0, 0, 0, 0)
  const daysLeft = Math.ceil((clear.getTime() - today.getTime()) / 86400000)
  return {
    daysLeft,
    clearDate: clear.toISOString().slice(0, 10),
    inWithdrawal: daysLeft >= 0,
  }
}

export default function AnimalDetailPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const supabase = createClient()

  const [animal, setAnimal] = useState<any>(null)
  const [weights, setWeights] = useState<any[]>([])
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [groups, setGroups] = useState<Option[]>([])
  const [pens, setPens] = useState<Option[]>([])
  const [herds, setHerds] = useState<HerdOption[]>([])
  const [loading, setLoading] = useState(true)

  const [savingDetails, setSavingDetails] = useState(false)
  const [savingSale, setSavingSale] = useState(false)
  const [savingWeight, setSavingWeight] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detailsMessage, setDetailsMessage] = useState<string | null>(null)
  const [saleMessage, setSaleMessage] = useState<string | null>(null)
  const [weightMessage, setWeightMessage] = useState<string | null>(null)

  // Editable core fields
  const [tag, setTag] = useState('')
  const [sex, setSex] = useState('')
  const [breed, setBreed] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [purchaseDate, setPurchaseDate] = useState('')
  const [purchaseWeight, setPurchaseWeight] = useState('')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [source, setSource] = useState('')
  const [groupId, setGroupId] = useState('')
  const [penId, setPenId] = useState('')
  const [herdId, setHerdId] = useState('')
  const [status, setStatus] = useState('active')
  const [notes, setNotes] = useState('')

  // Sale
  const [saleDate, setSaleDate] = useState('')
  const [deadWeight, setDeadWeight] = useState('')
  const [killOut, setKillOut] = useState('')
  const [grade, setGrade] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const [saleNotes, setSaleNotes] = useState('')

  // New weight
  const [weighDate, setWeighDate] = useState(new Date().toISOString().slice(0, 10))
  const [weightKg, setWeightKg] = useState('')
  const [weightNotes, setWeightNotes] = useState('')

  async function load() {
    setLoading(true)
    const { data: a } = await supabase
      .from('animals_enriched')
      .select('*')
      .eq('id', id)
      .single()

    if (!a) {
      setLoading(false)
      return
    }

    setAnimal(a)
    setTag(a.tag || '')
    setSex(a.sex || '')
    setBreed(a.breed || '')
    setDateOfBirth(a.date_of_birth || '')
    setPurchaseDate(a.purchase_date || '')
    setPurchaseWeight(a.purchase_weight_kg?.toString() || '')
    setPurchasePrice(a.purchase_price?.toString() || '')
    setSource(a.source || '')
    setGroupId(a.group_id || '')
    setPenId(a.pen_id || '')
    setHerdId(a.herd_id || '')
    setStatus(a.status || 'active')
    setNotes(a.notes || '')
    setSaleDate(a.sale_date || '')
    setDeadWeight(a.dead_weight_kg?.toString() || '')
    setKillOut(a.kill_out_percent?.toString() || '')
    setGrade(a.slaughter_grade || '')
    setSalePrice(a.sale_price?.toString() || '')
    setSaleNotes(a.sale_notes || '')

    const [{ data: w }, { data: tr }, { data: g }, { data: p }, { data: h }] = await Promise.all([
      supabase.from('weights').select('*').eq('animal_id', id).order('weighed_at', { ascending: true }),
      supabase.from('treatments').select('*').eq('animal_id', id).order('treated_at', { ascending: false }),
      supabase.from('groups').select('id, name').eq('farm_id', a.farm_id).eq('is_active', true).order('name'),
      supabase.from('pens').select('id, name, type, parent_id').eq('farm_id', a.farm_id).eq('is_active', true).order('name'),
      supabase
        .from('herds')
        .select('id, herd_number, name')
        .eq('farm_id', a.farm_id)
        .eq('is_active', true)
        .order('herd_number'),
    ])

    setWeights(w || [])
    setTreatments((tr as Treatment[]) || [])
    setGroups((g as Option[]) || [])
    setPens((p as Option[]) || [])
    setHerds((h as HerdOption[]) || [])
    setLoading(false)
  }

  useEffect(() => {
    if (id) load()
  }, [id])

  const estimatedLiveWeight =
    deadWeight && killOut && Number(killOut) > 0
      ? Number((Number(deadWeight) / (Number(killOut) / 100)).toFixed(1))
      : null

  const age = dateOfBirth ? exactAge(dateOfBirth) : null

  const activeWithdrawal = treatments
    .map((t) => ({ t, ...withdrawalStatus(t.treated_at, t.withdrawal_days) }))
    .filter((x) => x.inWithdrawal)
    .sort((a, b) => b.daysLeft - a.daysLeft)[0]

  async function saveDetails(e: React.FormEvent) {
    e.preventDefault()
    setSavingDetails(true)
    setError(null)
    setDetailsMessage(null)

    const { error } = await supabase
      .from('animals')
      .update({
        tag: tag.trim(),
        eid: tag.trim(),
        sex: sex || null,
        breed: breed.trim() || null,
        date_of_birth: dateOfBirth || null,
        purchase_date: purchaseDate || null,
        entry_date: purchaseDate || null,
        purchase_weight_kg: purchaseWeight ? Number(purchaseWeight) : null,
        purchase_price: purchasePrice ? Number(purchasePrice) : null,
        source: source.trim() || null,
        group_id: groupId || null,
        pen_id: penId || null,
        herd_id: herdId || null,
        status: status || 'active',
        notes: notes.trim() || null,
        exit_date: status === 'sold' ? saleDate || animal?.exit_date : status === 'active' ? null : animal?.exit_date,
      })
      .eq('id', id)

    if (error) setError(error.message)
    else {
      setDetailsMessage('Details saved')
      await load()
    }
    setSavingDetails(false)
  }

  async function saveWeight(e: React.FormEvent) {
    e.preventDefault()
    setSavingWeight(true)
    setError(null)
    setWeightMessage(null)

    const kg = Number(weightKg)
    if (!weighDate || !kg || kg <= 0) {
      setError('Enter a valid date and weight')
      setSavingWeight(false)
      return
    }

    await supabase.from('weights').delete().eq('animal_id', id).eq('weighed_at', weighDate)
    const { error } = await supabase.from('weights').insert({
      animal_id: id,
      weight_kg: kg,
      weighed_at: weighDate,
      notes: weightNotes.trim() || null,
    })

    if (error) setError(error.message)
    else {
      setWeightMessage(`Saved ${kg} kg on ${weighDate}`)
      setWeightKg('')
      setWeightNotes('')
      await load()
    }
    setSavingWeight(false)
  }

  async function deleteWeight(weightId: string) {
    if (!confirm('Delete this weight?')) return
    const { error } = await supabase.from('weights').delete().eq('id', weightId)
    if (error) setError(error.message)
    else await load()
  }

  async function saveSale(e: React.FormEvent) {
    e.preventDefault()
    setSavingSale(true)
    setError(null)
    setSaleMessage(null)

    const estLive = estimatedLiveWeight
    const killDate = saleDate || null

    const { error: animalError } = await supabase
      .from('animals')
      .update({
        sale_date: killDate,
        dead_weight_kg: deadWeight ? Number(deadWeight) : null,
        kill_out_percent: killOut ? Number(killOut) : null,
        slaughter_grade: grade.trim() || null,
        sale_price: salePrice ? Number(salePrice) : null,
        sale_notes: saleNotes.trim() || null,
        status: killDate ? 'sold' : status,
        exit_date: killDate,
      })
      .eq('id', id)

    if (animalError) {
      setError(animalError.message)
      setSavingSale(false)
      return
    }

    if (killDate && estLive != null && estLive > 0) {
      await supabase.from('weights').delete().eq('animal_id', id).eq('weighed_at', killDate)
      const { error: weightError } = await supabase.from('weights').insert({
        animal_id: id,
        weight_kg: estLive,
        weighed_at: killDate,
        notes: 'Sale estimated liveweight (dead wt ÷ kill-out %)',
      })
      if (weightError) {
        setError('Sale saved, but liveweight not recorded: ' + weightError.message)
        setSavingSale(false)
        await load()
        return
      }
      setSaleMessage(`Sold. Final liveweight ${estLive} kg saved. ADG uses this weight.`)
    } else {
      setSaleMessage('Sale details saved.')
    }

    await load()
    setSavingSale(false)
  }

  async function deleteAnimal() {
    if (!confirm('Permanently delete this animal and its weights/treatments?')) return
    const { error } = await supabase.from('animals').delete().eq('id', id)
    if (error) setError(error.message)
    else router.push('/animals')
  }

  if (loading) return <div className="p-8 text-center text-slate-500">Loading…</div>
  if (!animal) {
    return (
      <div className="p-8 text-center">
        <p>Animal not found</p>
        <Link href="/animals" className="text-brand-700 underline">
          Back
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Tag {animal.tag}</h1>
            <p className="text-sm text-slate-500">
              Last wt {formatWeight(animal.latest_weight_kg)} · ADG {formatADG(animal.adg_kg_per_day)} ·{' '}
              {animal.days_on_farm ?? '—'} days
              {activeWithdrawal && (
                <span className="ml-2 text-amber-700 font-medium">
                  · Withdrawal {activeWithdrawal.daysLeft === 0 ? 'clear today' : `${activeWithdrawal.daysLeft}d`}
                </span>
              )}
            </p>
          </div>
          <Link href="/animals" className="text-sm text-slate-600 hover:underline">
            Back to list
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {activeWithdrawal && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <strong>Do not slaughter.</strong> {activeWithdrawal.t.medicine_name} —{' '}
            {activeWithdrawal.daysLeft === 0 ? 'clears today' : `${activeWithdrawal.daysLeft} days left`}
          </div>
        )}

        {/* All core details editable */}
        <form onSubmit={saveDetails} className="bg-white rounded-xl border p-5 shadow-sm space-y-4">
          <h2 className="font-semibold">Animal details (all editable)</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">Tag number *</label>
              <input
                type="text"
                required
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Sex</label>
              <select
                value={sex}
                onChange={(e) => setSex(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">—</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Breed</label>
              <input
                type="text"
                value={breed}
                onChange={(e) => setBreed(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Date of birth</label>
              <input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              {age && <p className="text-xs text-slate-500 mt-1">Age: {age.label}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="active">Active</option>
                <option value="sold">Sold</option>
                <option value="dead">Dead</option>
                <option value="transferred">Transferred</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Purchase date</label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Purchase weight (kg)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={purchaseWeight}
                onChange={(e) => setPurchaseWeight(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Purchase price (€)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Purchase from / source</label>
              <input
                type="text"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Herd number</label>
              <select
                value={herdId}
                onChange={(e) => setHerdId(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">— None —</option>
                {herds.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.herd_number}
                    {h.name ? ` – ${h.name}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Group</label>
              <select
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">— None —</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Pen</label>
              <select
                value={penId}
                onChange={(e) => setPenId(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">— None —</option>
                {groupPensByShed(pens as PenRow[]).grouped.map(({ shed, pens: inShed }) => (
                  <optgroup key={shed.id} label={shed.name}>
                    {inShed.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
                {groupPensByShed(pens as PenRow[]).ungrouped.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          {detailsMessage && <p className="text-sm text-green-700">{detailsMessage}</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={savingDetails}
              className="rounded-lg bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
            >
              {savingDetails ? 'Saving…' : 'Save details'}
            </button>
            <button
              type="button"
              onClick={deleteAnimal}
              className="rounded-lg border border-red-300 text-red-700 px-4 py-2 text-sm hover:bg-red-50"
            >
              Delete animal
            </button>
          </div>
        </form>

        {/* Treatments */}
        <section className="bg-white rounded-xl border p-5 shadow-sm space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold">Treatments</h2>
            <Link href="/medicines/treat" className="text-xs text-brand-700 hover:underline">
              Record treatment
            </Link>
          </div>
          {treatments.length === 0 ? (
            <p className="text-sm text-slate-500">None recorded.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-1">Date</th>
                  <th className="py-1">Medicine</th>
                  <th className="py-1">Ml</th>
                  <th className="py-1">Cost</th>
                  <th className="py-1">W/d</th>
                </tr>
              </thead>
              <tbody>
                {treatments.map((t) => {
                  const w = withdrawalStatus(t.treated_at, t.withdrawal_days)
                  return (
                    <tr key={t.id} className={`border-b ${w.inWithdrawal ? 'bg-amber-50' : ''}`}>
                      <td className="py-1.5">{formatDate(t.treated_at)}</td>
                      <td className="py-1.5 font-medium">{t.medicine_name}</td>
                      <td className="py-1.5">{t.ml_used ?? t.dose ?? '—'}</td>
                      <td className="py-1.5">{t.cost != null ? formatCurrency(t.cost) : '—'}</td>
                      <td className="py-1.5">
                        {w.inWithdrawal ? (
                          <span className="text-amber-800 font-medium">
                            {w.daysLeft === 0 ? 'Clear today' : `${w.daysLeft}d`}
                          </span>
                        ) : (
                          <span className="text-green-700">Clear</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </section>

        {/* Weights */}
        <section className="bg-white rounded-xl border p-5 shadow-sm space-y-4">
          <h2 className="font-semibold">Liveweights</h2>
          <form onSubmit={saveWeight} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div>
              <label className="block text-sm font-medium mb-1">Date *</label>
              <input
                type="date"
                required
                value={weighDate}
                onChange={(e) => setWeighDate(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Weight (kg) *</label>
              <input
                type="number"
                required
                step="0.1"
                min="0"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Notes</label>
              <input
                type="text"
                value={weightNotes}
                onChange={(e) => setWeightNotes(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={savingWeight}
              className="rounded-lg bg-brand-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {savingWeight ? 'Saving…' : 'Add weight'}
            </button>
          </form>
          {weightMessage && <p className="text-sm text-green-700">{weightMessage}</p>}
          {weights.length === 0 ? (
            <p className="text-sm text-slate-500">No weights yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-1">Date</th>
                  <th className="py-1">kg</th>
                  <th className="py-1">Notes</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {weights.map((w) => (
                  <tr key={w.id} className="border-b">
                    <td className="py-1.5">{formatDate(w.weighed_at)}</td>
                    <td className="py-1.5 font-medium">{w.weight_kg}</td>
                    <td className="py-1.5 text-slate-500">{w.notes || '—'}</td>
                    <td className="py-1.5 text-right">
                      <button type="button" onClick={() => deleteWeight(w.id)} className="text-xs text-red-600">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Sale */}
        <section className="bg-white rounded-xl border p-5 shadow-sm">
          <h2 className="font-semibold mb-1">Sale / slaughter</h2>
          <p className="text-xs text-slate-500 mb-4">
            Dead weight ÷ kill-out % = estimated liveweight → last weight and ADG across the app.
          </p>
          <form onSubmit={saveSale} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Sale / kill date</label>
                <input
                  type="date"
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Grade</label>
                <input
                  type="text"
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Dead weight (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={deadWeight}
                  onChange={(e) => setDeadWeight(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Kill-out %</label>
                <input
                  type="number"
                  step="0.1"
                  value={killOut}
                  onChange={(e) => setKillOut(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Est. liveweight</label>
                <div className="rounded-md border bg-slate-50 px-3 py-2 text-sm font-medium">
                  {estimatedLiveWeight != null ? `${estimatedLiveWeight} kg` : '—'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Sale price (€)</label>
                <input
                  type="number"
                  step="0.01"
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Sale notes</label>
              <textarea
                value={saleNotes}
                onChange={(e) => setSaleNotes(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            {saleMessage && <p className="text-sm text-green-700">{saleMessage}</p>}
            <button
              type="submit"
              disabled={savingSale}
              className="rounded-lg bg-brand-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {savingSale ? 'Saving…' : 'Save sale information'}
            </button>
          </form>
        </section>
      </main>
    </div>
  )
}
