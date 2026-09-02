'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { groupPensByShed, isShed } from '@/lib/pens'

interface Pen {
  id: string
  name: string
  type: string | null
  capacity: number | null
  area_ha: number | null
  is_active: boolean
  parent_id: string | null
}

interface AnimalRow {
  id: string
  tag: string
  breed: string | null
  status: string
  pen_id: string | null
  pen_name: string | null
  group_name: string | null
}

export default function PensPage() {
  const [pens, setPens] = useState<Pen[]>([])
  const [farmId, setFarmId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [shedName, setShedName] = useState('')
  const [parentId, setParentId] = useState('')
  const [capacity, setCapacity] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [assignPen, setAssignPen] = useState<Pen | null>(null)
  const [animals, setAnimals] = useState<AnimalRow[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [assignLoading, setAssignLoading] = useState(false)
  const [assignMessage, setAssignMessage] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [scanMode, setScanMode] = useState(false)
  const [scanBuffer, setScanBuffer] = useState('')
  const [lastScan, setLastScan] = useState<string | null>(null)
  const [scanFeedback, setScanFeedback] = useState<string | null>(null)
  const scanInputRef = useRef<HTMLInputElement>(null)

  const supabase = createClient()

  async function loadPens() {
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

    const { data } = await supabase
      .from('pens')
      .select('*')
      .eq('farm_id', membership.farm_id)
      .order('name')

    setPens((data as Pen[]) || [])
  }

  useEffect(() => {
    loadPens()
  }, [])

  useEffect(() => {
    if (!scanMode || !assignPen) return
    const focus = () => scanInputRef.current?.focus()
    focus()
    const id = window.setInterval(focus, 800)
    return () => window.clearInterval(id)
  }, [scanMode, assignPen])

  async function addShed(e: React.FormEvent) {
    e.preventDefault()
    if (!farmId || !shedName.trim()) return
    setLoading(true)
    setError(null)
    const { error } = await supabase.from('pens').insert({
      farm_id: farmId,
      name: shedName.trim(),
      type: 'shed',
      is_active: true,
    })
    if (error) setError(error.message)
    else {
      setShedName('')
      await loadPens()
    }
    setLoading(false)
  }

  async function addPen(e: React.FormEvent) {
    e.preventDefault()
    if (!farmId || !name.trim()) return
    setLoading(true)
    setError(null)
    const row: Record<string, unknown> = {
      farm_id: farmId,
      name: name.trim(),
      type: 'pen',
      parent_id: parentId || null,
      capacity: capacity ? Number(capacity) : null,
      is_active: true,
    }
    const { error } = await supabase.from('pens').insert(row)
    if (error) setError(error.message)
    else {
      setName('')
      setCapacity('')
      await loadPens()
    }
    setLoading(false)
  }

  async function removePen(p: Pen) {
    const msg = isShed(p)
      ? 'Remove this shed? Pens inside stay, ungrouped.'
      : 'Remove this pen? Animals keep their tags — they are only taken out of the pen.'
    if (!confirm(msg)) return
    await supabase.from('pens').delete().eq('id', p.id)
    await loadPens()
  }

  async function moveToShed(penId: string, shedId: string) {
    const { error } = await supabase.from('pens').update({ parent_id: shedId || null }).eq('id', penId)
    if (error) setError(error.message)
    else await loadPens()
  }

  async function openAssign(pen: Pen) {
    if (!farmId) return
    setAssignPen(pen)
    setTimeout(() => {
      document.getElementById('assign-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
    setAssignMessage(null)
    setSearch('')
    setScanMode(false)
    setScanBuffer('')
    setLastScan(null)
    setScanFeedback(null)
    setAssignLoading(true)

    const { data } = await supabase
      .from('animals_enriched')
      .select('id, tag, breed, status, pen_id, pen_name, group_name')
      .eq('farm_id', farmId)
      .eq('status', 'active')
      .order('tag')

    const rows = (data as AnimalRow[]) || []
    setAnimals(rows)
    setSelected(new Set(rows.filter((a) => a.pen_id === pen.id).map((a) => a.id)))
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

  function applyScan(raw: string) {
    const code = raw.replace(/\s/g, '').trim()
    if (!code) return

    setLastScan(code)

    const candidates = new Set<string>()
    candidates.add(code)
    if (!code.startsWith('372')) {
      candidates.add('372' + code)
    }
    if (code.length >= 12 && !code.startsWith('372')) {
      candidates.add('372' + code.slice(-12))
    }

    let found: AnimalRow | undefined

    for (const c of candidates) {
      found =
        animals.find((a) => a.tag.replace(/\s/g, '') === c) ||
        animals.find((a) => a.tag.replace(/\s/g, '').endsWith(c)) ||
        animals.find((a) => c.endsWith(a.tag.replace(/\s/g, '')))
      if (found) break
    }

    if (!found && code.length >= 5) {
      const short = code.slice(-5)
      const matches = animals.filter((a) => a.tag.replace(/\s/g, '').endsWith(short))
      if (matches.length === 1) found = matches[0]
    }

    if (!found) {
      setScanFeedback(
        `Not found: ${code}${!code.startsWith('372') ? ` (also tried 372${code})` : ''}`
      )
      return
    }

    setSelected((prev) => {
      const next = new Set(prev)
      next.add(found!.id)
      return next
    })
    setScanFeedback(`Selected ${found.tag}`)
  }

  function onScanKeyDown(e: { key: string; preventDefault: () => void }) {
    if (e.key === 'Enter') {
      e.preventDefault()
      applyScan(scanBuffer)
      setScanBuffer('')
    }
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
    if (!assignPen || !farmId) return
    setAssignLoading(true)
    setAssignMessage(null)

    const selectedIds = Array.from(selected)
    const currentlyIn = animals.filter((a) => a.pen_id === assignPen.id).map((a) => a.id)
    const toAdd = selectedIds.filter((id) => !currentlyIn.includes(id))
    const toRemove = currentlyIn.filter((id) => !selectedIds.includes(id))

    if (toAdd.length) {
      const { error } = await supabase.from('animals').update({ pen_id: assignPen.id }).in('id', toAdd)
      if (error) {
        setAssignMessage(error.message)
        setAssignLoading(false)
        return
      }
    }
    if (toRemove.length) {
      const { error } = await supabase.from('animals').update({ pen_id: null }).in('id', toRemove)
      if (error) {
        setAssignMessage(error.message)
        setAssignLoading(false)
        return
      }
    }

    setAssignMessage(`Saved: ${toAdd.length} added, ${toRemove.length} removed`)
    setAssignLoading(false)

    const { data } = await supabase
      .from('animals_enriched')
      .select('id, tag, breed, status, pen_id, pen_name, group_name')
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
          <h1 className="text-xl font-bold">Sheds & Pens</h1>
          <Link href="/animals" className="text-sm text-slate-600 hover:underline">
            Back to animals
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
                <form onSubmit={addShed} className="bg-white rounded-xl border p-6 space-y-3 shadow-sm">
          <h2 className="font-semibold">1. Add a shed</h2>
          <p className="text-sm text-slate-600">Animals live in pens inside the shed, not in the shed itself.</p>
          <input
            type="text"
            required
            value={shedName}
            onChange={(e) => setShedName(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="e.g. Finishing shed"
          />
          <button type="submit" disabled={loading} className="rounded-lg bg-slate-800 text-white px-4 py-2 text-sm font-medium disabled:opacity-50">
            {loading ? 'Adding…' : 'Add shed'}
          </button>
        </form>

        <form onSubmit={addPen} className="bg-white rounded-xl border p-6 space-y-4 shadow-sm">
          <h2 className="font-semibold">2. Add a pen in a shed</h2>
          <div>
            <label className="block text-sm font-medium mb-1">Shed</label>
            <select value={parentId} onChange={(e) => setParentId(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="">— No shed yet —</option>
              {pens.filter(isShed).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Pen name *</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="e.g. Pen 1" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Capacity (optional)</label>
            <input type="number" min="0" value={capacity} onChange={(e) => setCapacity(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={loading} className="rounded-lg bg-brand-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50">
            {loading ? 'Adding…' : 'Add pen'}
          </button>
        </form>

        <div className="bg-white rounded-xl border shadow-sm">
          <div className="px-4 py-3 border-b font-medium">Your sheds</div>
          {pens.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">None yet. Add a shed, then pens inside it.</p>
          ) : (
            <div className="divide-y">
              {groupPensByShed(pens).grouped.map(({ shed, pens: inShed }) => (
                <div key={shed.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold">{shed.name}</span>
                    <button type="button" onClick={() => removePen(shed)} className="text-red-600 hover:underline text-xs">Remove shed</button>
                  </div>
                  {inShed.length === 0 ? (
                    <p className="text-sm text-slate-500 mt-1">No pens in this shed yet.</p>
                  ) : (
                    <ul className="mt-2 space-y-1">
                      {inShed.map((p) => (
                        <li key={p.id} className="flex items-center justify-between gap-2 text-sm pl-3">
                          <span>{p.name}{p.capacity ? ` · ${p.capacity} hd` : ''}</span>
                          <span className="flex gap-2 shrink-0">
                            <button type="button" onClick={() => openAssign(p)} className="text-brand-700 hover:underline text-xs font-medium">Assign animals</button>
                            <button type="button" onClick={() => removePen(p)} className="text-red-600 hover:underline text-xs">Remove</button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
              {groupPensByShed(pens).ungrouped.length > 0 && (
                <div className="px-4 py-3">
                  <p className="font-bold">Pens with no shed</p>
                  <ul className="mt-2 space-y-1">
                    {groupPensByShed(pens).ungrouped.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                        <span>{p.name}</span>
                        <span className="flex gap-2 shrink-0 items-center">
                          <select className="rounded border px-1 py-0.5 text-xs" defaultValue="" onChange={(e) => { if (e.target.value) moveToShed(p.id, e.target.value) }}>
                            <option value="">Move to shed…</option>
                            {pens.filter(isShed).map((s) => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                          <button type="button" onClick={() => openAssign(p)} className="text-brand-700 hover:underline text-xs font-medium">Assign animals</button>
                          <button type="button" onClick={() => removePen(p)} className="text-red-600 hover:underline text-xs">Remove</button>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {assignPen && (
          <div id="assign-panel" className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="font-semibold">Assign animals to: {assignPen.name}</h2>
                <p className="text-xs text-slate-500">
                  Click a row to tick, or start a barcode scan session.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAssignPen(null)
                  setScanMode(false)
                }}
                className="text-sm text-slate-600 hover:underline"
              >
                Close
              </button>
            </div>

            <div className="px-4 py-3 border-b bg-slate-50 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setScanMode((v) => !v)
                    setScanFeedback(null)
                    setTimeout(() => scanInputRef.current?.focus(), 50)
                  }}
                  className={`text-sm px-3 py-1.5 rounded-md font-medium ${
                    scanMode
                      ? 'bg-brand-600 text-white'
                      : 'border border-slate-300 bg-white hover:bg-slate-50'
                  }`}
                >
                  {scanMode ? 'Scan session ON — click to stop' : 'Start barcode scan session'}
                </button>
                {scanMode && (
                  <span className="text-xs text-green-700 font-medium">
                    Ready — scan passport barcodes now
                  </span>
                )}
              </div>
              {scanMode && (
                <>
                  <input
                    ref={scanInputRef}
                    type="text"
                    value={scanBuffer}
                    onChange={(e) => setScanBuffer(e.target.value)}
                    onKeyDown={onScanKeyDown}
                    className="w-full rounded-md border border-brand-400 px-3 py-2 text-sm font-mono"
                    placeholder="Scanner types here automatically…"
                    autoComplete="off"
                  />
                  {scanFeedback && (
                    <p
                      className={`text-sm ${
                        scanFeedback.startsWith('Not found') ? 'text-red-600' : 'text-green-700'
                      }`}
                    >
                      {scanFeedback}
                      {lastScan && scanFeedback.startsWith('Not found') && (
                        <span className="text-slate-400"> ({lastScan})</span>
                      )}
                    </p>
                  )}
                  <p className="text-[10px] text-slate-500">
                    Keep this box focused. Scanner should send the tag then Enter. Matched animals
                    are ticked; click Save assignments when finished.
                  </p>
                </>
              )}
            </div>

            <div className="px-4 py-3 border-b flex flex-wrap gap-2 items-center">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tag, breed, group…"
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
                <p className="p-4 text-sm text-slate-500">Loading…</p>
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
                              {a.pen_name ? `Currently: ${a.pen_name}` : 'No pen'}
                              {' · '}
                              {a.group_name || 'No group'}
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
                {assignMessage && <span className="ml-2 text-green-700">{assignMessage}</span>}
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
