'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Group } from '@/types/database'
import { exactAge } from '@/lib/age'
import { groupPensByShed, type PenRow } from '@/lib/pens'

interface Herd {
  id: string
  herd_number: string
  name: string | null
}

interface Pen {
  id: string
  name: string
  type?: string | null
  parent_id?: string | null
}

export default function NewAnimalPage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [herds, setHerds] = useState<Herd[]>([])
  const [pens, setPens] = useState<Pen[]>([])
  const [farmId, setFarmId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const [tag, setTag] = useState('')
  const [herdId, setHerdId] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [purchaseWeight, setPurchaseWeight] = useState('')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10))
  const [groupId, setGroupId] = useState('')
  const [penId, setPenId] = useState('')
  const [notes, setNotes] = useState('')

  const ageLabel = dateOfBirth ? exactAge(dateOfBirth)?.label : null

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

      if (!membership) {
        router.push('/onboarding')
        return
      }

      setFarmId(membership.farm_id)

      const [{ data: g }, { data: h }, { data: p }] = await Promise.all([
        supabase
          .from('groups')
          .select('*')
          .eq('farm_id', membership.farm_id)
          .eq('is_active', true),
        supabase
          .from('herds')
          .select('id, herd_number, name')
          .eq('farm_id', membership.farm_id)
          .eq('is_active', true),
        supabase
          .from('pens')
          .select('id, name, type, parent_id')
          .eq('farm_id', membership.farm_id)
          .eq('is_active', true),
      ])

      setGroups((g as Group[]) || [])
      setHerds((h as Herd[]) || [])
      setPens((p as Pen[]) || [])
    }
    load()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!farmId) return
    setLoading(true)
    setError(null)

    const { error } = await supabase.from('animals').insert({
      farm_id: farmId,
      tag: tag.trim(),
      eid: tag.trim(),
      date_of_birth: dateOfBirth || null,
      purchase_date: purchaseDate,
      entry_date: purchaseDate,
      purchase_weight_kg: purchaseWeight ? Number(purchaseWeight) : null,
      purchase_price: purchasePrice ? Number(purchasePrice) : null,
      herd_id: herdId || null,
      group_id: groupId || null,
      pen_id: penId || null,
      notes: notes.trim() || null,
      status: 'active',
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/animals')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold">Add animal</h1>
          <Link href="/animals" className="text-sm text-slate-600 hover:underline">
            Cancel
          </Link>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border p-6 space-y-4 shadow-sm">
          <div>
            <label className="block text-sm font-medium mb-1">Tag number *</label>
            <input
              type="text"
              required
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
              placeholder="e.g. 372212015940310"
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
            <label className="block text-sm font-medium mb-1">Date of birth</label>
            <input
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            {ageLabel && (
              <p className="text-xs text-slate-500 mt-1">
                Age today: <span className="font-medium text-slate-700">{ageLabel}</span>
              </p>
            )}
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
            <label className="block text-sm font-medium mb-1">Purchase date *</label>
            <input
              type="date"
              required
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Group / Enterprise</label>
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

          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-brand-600 text-white py-2.5 text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? 'Saving…' : 'Add Animal'}
          </button>
        </form>
      </main>
    </div>
  )
}
