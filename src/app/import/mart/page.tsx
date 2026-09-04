'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import type { Group } from '@/types/database'
import { groupPensByShed, type PenRow } from '@/lib/pens'

interface ParsedAnimal {
  tag: string
  sex: string
  breed: string
  dob: string | null
  eventDate: string
  weight: number | null
  price: number | null
  lotNumber: string
  tbTestDate: string | null
  selected: boolean
  isDuplicate: boolean
  existingId: string | null
}

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

function parseIrishDate(d: string | null | undefined): string | null {
  if (!d || !d.trim()) return null
  const m = d.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const [, day, month, year] = m
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

function parseMartXml(xmlText: string): {
  sourceName: string
  herdFromFile: string | null
  animals: Omit<ParsedAnimal, 'selected' | 'isDuplicate' | 'existingId'>[]
} {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlText, 'text/xml')
  const sourceName = doc.querySelector('SourceName')?.textContent?.trim() || 'Mart'

  const herdCandidates = [
    doc.querySelector('ClientHerdNum')?.textContent,
    doc.querySelector('HerdNumber')?.textContent,
    doc.querySelector('HerdNum')?.textContent,
  ]
  const herdFromFile =
    herdCandidates.map((h) => h?.trim()).find((h) => h && h.length > 0) || null

  const animalNodes = Array.from(doc.querySelectorAll('Animal'))
  const animals = animalNodes
    .map((node) => {
      const get = (tag: string) => node.querySelector(tag)?.textContent?.trim() || ''
      const sexRaw = get('Sex').toUpperCase()
      let sex = 'unknown'
      if (sexRaw === 'M' || sexRaw === 'MALE') sex = 'male'
      if (sexRaw === 'F' || sexRaw === 'FEMALE') sex = 'female'

      const tagRaw = get('Tag') || get('TagNo') || get('OfficialTag') || get('AnimalId') || get('EID')
      let tag = tagRaw.replace(/\s/g, '')
      if (tag && !tag.startsWith('372') && /^\d{12}$/.test(tag)) tag = '372' + tag
      const weightRaw = get('Weight') || get('LiveWeight')
      const priceRaw = get('Price') || get('Amount')

      return {
        tag,
        sex,
        breed: get('Breed') || get('BreedCode') || '',
        dob: parseIrishDate(get('DOB') || get('DateOfBirth')),
        eventDate:
          parseIrishDate(get('EventDate') || get('SaleDate') || get('MovementDate')) ||
          new Date().toISOString().slice(0, 10),
        weight: weightRaw ? Number(weightRaw) : null,
        price: priceRaw ? Number(priceRaw) : null,
        lotNumber: get('LotNumber') || get('Lot') || '',
        tbTestDate: parseIrishDate(get('TBTestDate') || get('TbTestDate')),
      }
    })
    .filter((a) => a.tag)

  return { sourceName, herdFromFile, animals }
}

const LAST_HERD_KEY = 'farm-manager-last-herd'

export default function MartImportPage() {
  const [animals, setAnimals] = useState<ParsedAnimal[]>([])
  const [sourceName, setSourceName] = useState('')
  const [herdFromFile, setHerdFromFile] = useState<string | null>(null)
  const [groups, setGroups] = useState<Group[]>([])
  const [pens, setPens] = useState<Pen[]>([])
  const [herds, setHerds] = useState<Herd[]>([])
  const [farmId, setFarmId] = useState<string | null>(null)
  const [groupId, setGroupId] = useState('')
  const [penId, setPenId] = useState('')
  const [herdId, setHerdId] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ ok: number; updated: number; skipped: number; failed: number } | null>(
    null
  )
  const [error, setError] = useState<string | null>(null)
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

      const [{ data: g }, { data: p }, { data: h }] = await Promise.all([
        supabase.from('groups').select('*').eq('farm_id', membership.farm_id).eq('is_active', true),
        supabase.from('pens').select('id, name, type, parent_id').eq('farm_id', membership.farm_id).eq('is_active', true),
        supabase
          .from('herds')
          .select('id, herd_number, name')
          .eq('farm_id', membership.farm_id)
          .eq('is_active', true)
          .order('herd_number'),
      ])
      setGroups((g as Group[]) || [])
      setPens((p as Pen[]) || [])
      setHerds((h as Herd[]) || [])

      try {
        const last = localStorage.getItem(LAST_HERD_KEY)
        if (last) setHerdId(last)
      } catch {
        // ignore
      }
    }
    load()
  }, [])

  function pickDefaultHerdId(fileHerd: string | null, list: Herd[]): string {
    if (fileHerd) {
      const match = list.find(
        (h) => h.herd_number.replace(/\s/g, '').toUpperCase() === fileHerd.replace(/\s/g, '').toUpperCase()
      )
      if (match) return match.id
    }
    if (list.length === 1) return list[0].id
    try {
      const last = localStorage.getItem(LAST_HERD_KEY)
      if (last && list.some((h) => h.id === last)) return last
    } catch {
      // ignore
    }
    return ''
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null)
    setResult(null)
    const file = e.target.files?.[0]
    if (!file || !farmId) return

    try {
      const text = await file.text()
      const parsed = parseMartXml(text)
      setSourceName(parsed.sourceName)
      setHerdFromFile(parsed.herdFromFile)

      const defaultHerd = pickDefaultHerdId(parsed.herdFromFile, herds)
      if (defaultHerd) setHerdId(defaultHerd)

      const tags = parsed.animals.map((a) => a.tag)
      const { data: existing } = await supabase
        .from('animals')
        .select('id, tag')
        .eq('farm_id', farmId)
        .in('tag', tags.length ? tags : ['__none__'])

      const byTag = new Map((existing || []).map((a: any) => [a.tag, a.id]))

      setAnimals(
        parsed.animals.map((a) => ({
          ...a,
          selected: true,
          isDuplicate: byTag.has(a.tag),
          existingId: byTag.get(a.tag) || null,
        }))
      )
    } catch (err: any) {
      setError(err.message || 'Failed to parse XML')
    }
  }

  function toggle(i: number) {
    setAnimals((prev) => prev.map((a, idx) => (idx === i ? { ...a, selected: !a.selected } : a)))
  }

  function toggleAll(selected: boolean) {
    setAnimals((prev) => prev.map((a) => ({ ...a, selected })))
  }

  async function doImport() {
    if (!farmId) return
    setImporting(true)
    setResult(null)
    setError(null)

    if (herdId) {
      try {
        localStorage.setItem(LAST_HERD_KEY, herdId)
      } catch {
        // ignore
      }
    }

    let ok = 0
    let updated = 0
    let skipped = 0
    let failed = 0

    const selected = animals.filter((a) => a.selected)

    for (const a of selected) {
      if (a.isDuplicate && a.existingId) {
        // Enrich intake / existing animal with mart details (only fill blanks where useful)
        const { data: current } = await supabase
          .from('animals')
          .select('*')
          .eq('id', a.existingId)
          .single()

        if (!current) {
          failed++
          continue
        }

        const patch: Record<string, any> = {
          source: sourceName || current.source,
        }
        if (a.dob) patch.date_of_birth = a.dob
        if (a.breed) patch.breed = a.breed
        if (a.sex && a.sex !== 'unknown') patch.sex = a.sex
        if (a.eventDate) {
          // Prefer mart event date as purchase/entry if still intake placeholder
          if (!current.purchase_date || current.source === 'EID intake') {
            patch.purchase_date = a.eventDate
            patch.entry_date = a.eventDate
          }
        }
        if (a.weight != null) {
          patch.purchase_weight_kg = a.weight
        }
        if (a.price != null) {
          patch.purchase_price = a.price
        }
        if (herdId) patch.herd_id = herdId
        if (groupId) patch.group_id = groupId
        if (penId) patch.pen_id = penId
        if (current.notes?.includes('awaiting mart') || current.source === 'EID intake') {
          patch.notes = null
        }

        const { error } = await supabase.from('animals').update(patch).eq('id', a.existingId)
        if (error) {
          failed++
        } else {
          // Record purchase weight as a weight row if provided
          if (a.weight != null && a.eventDate) {
            await supabase.from('weights').delete().eq('animal_id', a.existingId).eq('weighed_at', a.eventDate)
            await supabase.from('weights').insert({
              animal_id: a.existingId,
              weight_kg: a.weight,
              weighed_at: a.eventDate,
              notes: 'Mart purchase weight',
            })
          }
          updated++
        }
        continue
      }

      if (a.isDuplicate) {
        skipped++
        continue
      }

      const { data: inserted, error } = await supabase
        .from('animals')
        .insert({
          farm_id: farmId,
          tag: a.tag,
          eid: a.tag,
          sex: a.sex === 'unknown' ? null : a.sex,
          breed: a.breed || null,
          date_of_birth: a.dob,
          purchase_date: a.eventDate,
          entry_date: a.eventDate,
          purchase_weight_kg: a.weight,
          purchase_price: a.price,
          herd_id: herdId || null,
          group_id: groupId || null,
          pen_id: penId || null,
          source: sourceName,
          status: 'active',
        })
        .select('id')
        .single()

      if (error) {
        failed++
      } else {
        if (a.weight != null && a.eventDate && inserted?.id) {
          await supabase.from('weights').insert({
            animal_id: inserted.id,
            weight_kg: a.weight,
            weighed_at: a.eventDate,
            notes: 'Mart purchase weight',
          })
        }
        ok++
      }
    }

    setResult({ ok, updated, skipped, failed })
    setImporting(false)
  }

  const selectedCount = animals.filter((a) => a.selected).length
  const enrichCount = animals.filter((a) => a.selected && a.isDuplicate).length
  const newCount = animals.filter((a) => a.selected && !a.isDuplicate).length

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Mart import</h1>
            <p className="text-sm text-slate-500">
              New animals are added. Tags already on the system (e.g. EID intake) are updated with
              mart details.
            </p>
          </div>
          <Link href="/import" className="text-sm text-slate-600 hover:underline">
            Back
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-white rounded-xl border p-6 shadow-sm space-y-3">
          <input
            type="file"
            accept=".xml,text/xml"
            onChange={handleFile}
            className="block w-full text-sm"
          />
          {sourceName && (
            <p className="text-sm text-slate-600">
              Source: <strong>{sourceName}</strong>
              {herdFromFile && (
                <>
                  {' '}
                  · Herd in file: <strong>{herdFromFile}</strong>
                </>
              )}
            </p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        {animals.length > 0 && (
          <>
            <div className="bg-white rounded-xl border p-4 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Herd</label>
                <select
                  value={herdId}
                  onChange={(e) => setHerdId(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">—</option>
                  {herds.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.herd_number}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Group (optional apply)</label>
                <select
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Leave as-is / none</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Pen (optional apply)</label>
                <select
                  value={penId}
                  onChange={(e) => setPenId(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Leave as-is / none</option>
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
            </div>

            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="px-4 py-2 border-b flex gap-2 text-xs">
                <button type="button" onClick={() => toggleAll(true)} className="underline">
                  Select all
                </button>
                <button type="button" onClick={() => toggleAll(false)} className="underline">
                  Clear all
                </button>
                <span className="text-slate-500 ml-auto">
                  {newCount} new · {enrichCount} to update from mart
                </span>
              </div>
              <div className="overflow-x-auto max-h-96">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="px-2 py-2" />
                      <th className="px-2 py-2 text-left">Tag</th>
                      <th className="px-2 py-2 text-left">Sex</th>
                      <th className="px-2 py-2 text-left">Breed</th>
                      <th className="px-2 py-2 text-left">DOB</th>
                      <th className="px-2 py-2 text-left">Wt</th>
                      <th className="px-2 py-2 text-left">Price</th>
                      <th className="px-2 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {animals.map((a, i) => (
                      <tr
                        key={a.tag + i}
                        className={`border-t ${a.isDuplicate ? 'bg-amber-50' : ''}`}
                      >
                        <td className="px-2 py-1">
                          <input type="checkbox" checked={a.selected} onChange={() => toggle(i)} />
                        </td>
                        <td className="px-2 py-1 font-mono">{a.tag}</td>
                        <td className="px-2 py-1">{a.sex}</td>
                        <td className="px-2 py-1">{a.breed}</td>
                        <td className="px-2 py-1">{a.dob || '—'}</td>
                        <td className="px-2 py-1">{a.weight ?? '—'}</td>
                        <td className="px-2 py-1">{a.price ?? '—'}</td>
                        <td className="px-2 py-1">
                          {a.isDuplicate ? (
                            <span className="text-amber-800 font-medium">Update existing</span>
                          ) : (
                            <span className="text-green-700">New</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 border-t flex items-center justify-between">
                <div className="text-sm text-slate-600">
                  {result && (
                    <span>
                      New <strong className="text-green-700">{result.ok}</strong>
                      {', '}
                      updated <strong className="text-amber-800">{result.updated}</strong>
                      {result.failed > 0 && (
                        <>, failed <strong className="text-red-600">{result.failed}</strong></>
                      )}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={doImport}
                  disabled={importing || selectedCount === 0}
                  className="rounded-lg bg-brand-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {importing
                    ? 'Importing…'
                    : `Import / update ${selectedCount} animals`}
                </button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
