'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface GroupRow {
  id: string
  name: string
  type: string | null
  color: string | null
  is_active: boolean
}

interface AnimalRow {
  id: string
  tag: string
  breed: string | null
  status: string
  group_id: string | null
  group_name: string | null
  pen_name: string | null
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<GroupRow[]>([])
  const [farmId, setFarmId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [type, setType] = useState('finishing')
  const [color, setColor] = useState('#3b82f6')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [assignGroup, setAssignGroup] = useState<GroupRow | null>(null)
  const [animals, setAnimals] = useState<AnimalRow[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [assignLoading, setAssignLoading] = useState(false)
  const [assignMessage, setAssignMessage] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const supabase = createClient()

  async function loadGroups() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: membership } = await supabase
      .from('farm_members')
      .select('farm_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (!membership) return
    setFarmId(membership.farm_id)

    const { data } = await supabase
      .from('groups')
      .select('*')
      .eq('farm_id', membership.farm_id)
      .order('name')

    setGroups((data as GroupRow[]) || [])
  }

  useEffect(() => {
    loadGroups()
  }, [])

  async function addGroup(e: React.FormEvent) {
    e.preventDefault()
    if (!farmId || !name.trim()) return
    setLoading(true)
    setError(null)

    const { error } = await supabase.from('groups').insert({
      farm_id: farmId,
      name: name.trim(),
      type: type || null,
      color: color || '#3b82f6',
      is_active: true,
    })

    if (error) {
      setError(error.message)
    } else {
      setName('')
      await loadGroups()
    }
    setLoading(false)
  }

  async function removeGroup(id: string) {
    if (!confirm('Remove this group? Animals in it will be unassigned.')) return
    await supabase.from('groups').delete().eq('id', id)
    await loadGroups()
  }

  async function openAssign(group: GroupRow) {
    if (!farmId) return
    setAssignGroup(group)
    setAssignMessage(null)
    setSearch('')
    setAssignLoading(true)

    const { data } = await supabase
      .from('animals_enriched')
      .select('id, tag, breed, status, group_id, group_name, pen_name')
      .eq('farm_id', farmId)
      .eq('status', 'active')
      .order('tag')

    const rows = (data as AnimalRow[]) || []
    setAnimals(rows)

    const alreadyIn = new Set(rows.filter((a) => a.group_id === group.id).map((a) => a.id))
    setSelected(alreadyIn)
    setAssignLoading(false)
  }

  function toggleAnimal(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAllFiltered(filtered: AnimalRow[]) {
    setSelected((prev) => {
      const next = new Set(prev)
      filtered.forEach((a) => next.add(a.id))
      return next
    })
  }

  function clearFiltered(filtered: AnimalRow[]) {
    setSelected((prev) => {
      const next = new Set(prev)
      filtered.forEach((a) => next.delete(a.id))
      return next
    })
  }

  async function saveAssign() {
    if (!assignGroup || !farmId) return
    setAssignLoading(true)
    setAssignMessage(null)

    const selectedIds = Array.from(selected)
    const currentlyIn = animals.filter((a) => a.group_id === assignGroup.id).map((a) => a.id)

    const toAdd = selectedIds.filter((id) => !currentlyIn.includes(id))
    const toRemove = currentlyIn.filter((id) => !selectedIds.includes(id))

    if (toAdd.length) {
      const { error } = await supabase
        .from('animals')
        .update({ group_id: assignGroup.id })
        .in('id', toAdd)
      if (error) {
        setAssignMessage(error.message)
        setAssignLoading(false)
        return
      }
    }

    if (toRemove.length) {
      const { error } = await supabase
        .from('animals')
        .update({ group_id: null })
        .in('id', toRemove)
      if (error) {
        setAssignMessage(error.message)
        setAssignLoading(false)
        return
      }
    }

    setAssignMessage(
      `Saved: ${toAdd.length} moved into group, ${toRemove.length} removed from group`
    )
    setAssignLoading(false)

    const { data } = await supabase
      .from('animals_enriched')
      .select('id, tag, breed, status, group_id, group_name, pen_name')
      .eq('farm_id', farmId)
      .eq('status', 'active')
      .order('tag')
    setAnimals((data as AnimalRow[]) || [])
  }

  const filteredAnimals = animals.filter((a) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      a.tag.toLowerCase().includes(q) ||
      (a.breed || '').toLowerCase().includes(q) ||
      (a.group_name || '').toLowerCase().includes(q) ||
      (a.pen_name || '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold">Groups / Enterprises</h1>
          <Link href="/animals" className="text-sm text-slate-600 hover:underline">
            Back to animals
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <form onSubmit={addGroup} className="bg-white rounded-xl border p-6 space-y-4 shadow-sm">
          <h2 className="font-semibold">Add group</h2>
          <div>
            <label className="block text-sm font-medium mb-1">Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="e.g. Finishing, Store, Grazing"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="finishing">Finishing</option>
                <option value="store">Store</option>
                <option value="grazing">Grazing</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Colour</label>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-full h-10 rounded-md border border-slate-300"
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? 'Adding…' : 'Add group'}
          </button>
        </form>

        <div className="bg-white rounded-xl border shadow-sm">
          <div className="px-4 py-3 border-b font-medium">Your groups</div>
          {groups.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">No groups yet.</p>
          ) : (
            <ul className="divide-y">
              {groups.map((g) => (
                <li key={g.id} className="px-4 py-3 flex items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: g.color || '#3b82f6' }}
                    />
                    <div>
                      <span className="font-medium">{g.name}</span>
                      {g.type && (
                        <span className="text-slate-500 ml-2 text-xs capitalize">{g.type}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => openAssign(g)}
                      className="text-brand-700 hover:underline text-xs font-medium"
                    >
                      Assign animals
                    </button>
                    <button
                      type="button"
                      onClick={() => removeGroup(g.id)}
                      className="text-red-600 hover:underline text-xs"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {assignGroup && (
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="font-semibold">Assign animals to: {assignGroup.name}</h2>
                <p className="text-xs text-slate-500">
                  Click anywhere on a row to select or deselect.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAssignGroup(null)}
                className="text-sm text-slate-600 hover:underline"
              >
                Close
              </button>
            </div>

            <div className="px-4 py-3 border-b flex flex-wrap gap-2 items-center">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tag, breed, group, pen…"
                className="flex-1 min-w-[12rem] rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              />
              <button
                type="button"
                onClick={() => selectAllFiltered(filteredAnimals)}
                className="text-xs px-2 py-1 border rounded hover:bg-slate-50"
              >
                Select visible
              </button>
              <button
                type="button"
                onClick={() => clearFiltered(filteredAnimals)}
                className="text-xs px-2 py-1 border rounded hover:bg-slate-50"
              >
                Clear visible
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {assignLoading && animals.length === 0 ? (
                <p className="p-4 text-sm text-slate-500">Loading animals…</p>
              ) : filteredAnimals.length === 0 ? (
                <p className="p-4 text-sm text-slate-500">No animals match.</p>
              ) : (
                <ul className="divide-y">
                  {filteredAnimals.map((a) => {
                    const isSelected = selected.has(a.id)
                    return (
                      <li key={a.id}>
                        <button
                          type="button"
                          onClick={() => toggleAnimal(a.id)}
                          className={`w-full px-4 py-2.5 flex items-center gap-3 text-sm text-left transition ${
                            isSelected ? 'bg-brand-50 hover:bg-brand-100' : 'hover:bg-slate-50'
                          }`}
                        >
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                              isSelected
                                ? 'border-brand-600 bg-brand-600 text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isSelected && (
                              <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none">
                                <path
                                  d="M3 7.5L6 10.5L11 3.5"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            )}
                          </span>
                          <div className="flex-1 min-w-0">
                            <span className="font-medium font-mono">{a.tag}</span>
                            {a.breed && <span className="text-slate-500 ml-2">{a.breed}</span>}
                            <div className="text-xs text-slate-400">
                              {a.group_name ? `Currently: ${a.group_name}` : 'No group'}
                              {' · '}
                              {a.pen_name || 'No pen'}
                            </div>
                          </div>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <div className="px-4 py-3 border-t flex items-center justify-between gap-3">
              <div className="text-sm text-slate-600">
                {selected.size} selected
                {assignMessage && (
                  <span className="ml-2 text-green-700">{assignMessage}</span>
                )}
              </div>
              <button
                type="button"
                onClick={saveAssign}
                disabled={assignLoading}
                className="rounded-lg bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
              >
                {assignLoading ? 'Saving…' : 'Save assignments'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}