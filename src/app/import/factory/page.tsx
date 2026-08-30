'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface ParsedCarcass {
  tag: string
  killNo: string
  grade: string
  hotHalf1: number | null
  hotHalf2: number | null
  deadWeight: number | null
  pricePerKg: number | null
  salePrice: number | null
  selected: boolean
  matchId: string | null
  matchStatus: 'matched' | 'missing'
}

function parseIrishDate(d: string): string | null {
  const m = d.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const [, day, month, year] = m
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

function parseFoyleCsv(text: string): {
  factory: string
  saleDate: string | null
  herdRef: string
  rows: Omit<ParsedCarcass, 'selected' | 'matchId' | 'matchStatus'>[]
} {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  let factory = 'Factory'
  let saleDate: string | null = null
  let herdRef = ''

  const rows: Omit<ParsedCarcass, 'selected' | 'matchId' | 'matchStatus'>[] = []

  for (const line of lines) {
    const cols = line.split(',').map((c) => c.trim())
    const type = cols[0]?.toUpperCase()

    if (type === 'HDR') {
      // HDR,...,factory,...,ref,date,...
      factory = cols[2] || factory
      herdRef = cols[7] || ''
      saleDate = cols[8] ? parseIrishDate(cols[8]) : null
      continue
    }

    if (type !== 'CAR') continue

    const tag = cols[1] || ''
    if (!tag) continue

    // Col 6 & 7 = hot weights of each half
    // Col 9 = combined cold weight (dead weight)
    const hotHalf1 = cols[5] ? Number(cols[5]) : null
    const hotHalf2 = cols[6] ? Number(cols[6]) : null
    const deadWeight = cols[8] ? Number(cols[8]) : null

    rows.push({
      tag,
      killNo: cols[2] || '',
      grade: cols[4] || '',
      hotHalf1,
      hotHalf2,
      deadWeight,
      pricePerKg: cols[9] ? Number(cols[9]) : null,
      salePrice: cols[10] ? Number(cols[10]) : null,
    })
  }

  return { factory, saleDate, herdRef, rows }
}

export default function FactoryImportPage() {
  const [rows, setRows] = useState<ParsedCarcass[]>([])
  const [factory, setFactory] = useState('')
  const [saleDate, setSaleDate] = useState('')
  const [herdRef, setHerdRef] = useState('')
  const [killOut, setKillOut] = useState('55')
  const [farmId, setFarmId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: membership } = await supabase
        .from('farm_members')
        .select('farm_id')
        .eq('user_id', user.id)
        .limit(1)
        .single()
      if (membership) setFarmId(membership.farm_id)
    }
    init()
  }, [])

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null)
    setResult(null)
    setRows([])

    const file = e.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const parsed = parseFoyleCsv(text)
      setFactory(parsed.factory)
      setHerdRef(parsed.herdRef)
      if (parsed.saleDate) setSaleDate(parsed.saleDate)

      if (!farmId) {
        setError('No farm found — log in and complete onboarding first')
        return
      }

      const tags = parsed.rows.map((r) => r.tag)
      const { data: existing } = await supabase
        .from('animals')
        .select('id, tag')
        .eq('farm_id', farmId)
        .in('tag', tags)

      const byTag = new Map((existing || []).map((a: any) => [a.tag, a.id as string]))

      setRows(
        parsed.rows.map((r) => {
          const matchId = byTag.get(r.tag) || null
          return {
            ...r,
            selected: !!matchId,
            matchId,
            matchStatus: matchId ? 'matched' : 'missing',
          }
        })
      )
    } catch (err: any) {
      setError(err.message || 'Failed to parse CSV')
    }
  }

  function toggle(i: number) {
    setRows((prev) =>
      prev.map((r, idx) =>
        idx === i && r.matchStatus === 'matched' ? { ...r, selected: !r.selected } : r
      )
    )
  }

  function selectAllMatched(on: boolean) {
    setRows((prev) =>
      prev.map((r) => (r.matchStatus === 'matched' ? { ...r, selected: on } : r))
    )
  }

  async function doImport() {
    if (!farmId || !saleDate) {
      setError('Sale date is required')
      return
    }

    const toImport = rows.filter((r) => r.selected && r.matchId)
    if (!toImport.length) {
      setError('No matched animals selected')
      return
    }

    const ko = Number(killOut)
    if (!ko || ko <= 0 || ko > 100) {
      setError('Enter a valid kill-out % for the batch (e.g. 55)')
      return
    }

    setImporting(true)
    setError(null)
    setResult(null)

    let ok = 0
    let failed = 0

    for (const r of toImport) {
      const estLive =
        r.deadWeight != null ? Number((r.deadWeight / (ko / 100)).toFixed(1)) : null

      const notesParts = [
        factory,
        r.killNo ? `Kill #${r.killNo}` : '',
        r.hotHalf1 != null && r.hotHalf2 != null
          ? `Hot halves ${r.hotHalf1}+${r.hotHalf2}`
          : '',
        r.pricePerKg != null ? `@ €${r.pricePerKg}/kg` : '',
        herdRef ? `Ref ${herdRef}` : '',
      ].filter(Boolean)

      const { error: animalError } = await supabase
        .from('animals')
        .update({
          sale_date: saleDate,
          dead_weight_kg: r.deadWeight,
          kill_out_percent: ko,
          slaughter_grade: r.grade || null,
          sale_price: r.salePrice,
          sale_notes: notesParts.join(' · ') || null,
          status: 'sold',
          exit_date: saleDate,
        })
        .eq('id', r.matchId!)

      if (animalError) {
        console.error(animalError)
        failed++
        continue
      }

      if (estLive != null && estLive > 0) {
        const { error: weightError } = await supabase.from('weights').upsert(
          {
            animal_id: r.matchId!,
            weight_kg: estLive,
            weighed_at: saleDate,
            notes: 'Sale / estimated liveweight from factory docket',
          },
          { onConflict: 'animal_id,weighed_at' }
        )
        if (weightError) console.error(weightError)
      }

      ok++
    }

    setResult(`Updated ${ok} animals${failed ? `, ${failed} failed` : ''}`)
    setImporting(false)
  }

  const matched = rows.filter((r) => r.matchStatus === 'matched').length
  const missing = rows.filter((r) => r.matchStatus === 'missing').length
  const selectedCount = rows.filter((r) => r.selected).length

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Import factory sale docket</h1>
            <p className="text-sm text-slate-500">Foyle Food Group CSV (HDR / CAR format)</p>
          </div>
          <Link href="/animals" className="text-sm text-slate-600 hover:underline">
            Back to animals
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-white rounded-xl border p-6 shadow-sm space-y-4">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleFile}
            className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-brand-50 file:text-brand-700"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        {rows.length > 0 && (
          <>
            <div className="bg-white rounded-xl border p-6 shadow-sm space-y-4">
              <h2 className="font-semibold">
                Batch settings
                {factory && <span className="text-slate-500 font-normal"> · {factory}</span>}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Sale / kill date *</label>
                  <input
                    type="date"
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Kill-out % (batch) *</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="100"
                    value={killOut}
                    onChange={(e) => setKillOut(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Est. liveweight = cold weight ÷ (kill-out % / 100)
                  </p>
                </div>
                <div className="text-sm text-slate-600 flex flex-col justify-end pb-1">
                  <div>{rows.length} lines in file</div>
                  <div className="text-green-700">{matched} matched on farm</div>
                  {missing > 0 && <div className="text-amber-700">{missing} not found</div>}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm">{selectedCount} selected for update</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => selectAllMatched(true)}
                    className="text-xs px-2 py-1 border rounded hover:bg-slate-50"
                  >
                    Select all matched
                  </button>
                  <button
                    type="button"
                    onClick={() => selectAllMatched(false)}
                    className="text-xs px-2 py-1 border rounded hover:bg-slate-50"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto max-h-[28rem]">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="px-2 py-2 text-left">Update</th>
                      <th className="px-2 py-2 text-left">Tag</th>
                      <th className="px-2 py-2 text-left">Grade</th>
                      <th className="px-2 py-2 text-left">Hot halves</th>
                      <th className="px-2 py-2 text-left">Cold wt</th>
                      <th className="px-2 py-2 text-left">Est. live</th>
                      <th className="px-2 py-2 text-left">Price €</th>
                      <th className="px-2 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => {
                      const ko = Number(killOut) || 0
                      const est =
                        r.deadWeight != null && ko > 0
                          ? (r.deadWeight / (ko / 100)).toFixed(1)
                          : '—'
                      return (
                        <tr
                          key={r.tag + i}
                          className={`border-t ${
                            r.matchStatus === 'missing' ? 'bg-amber-50' : ''
                          }`}
                        >
                          <td className="px-2 py-1.5">
                            <input
                              type="checkbox"
                              checked={r.selected}
                              disabled={r.matchStatus !== 'matched'}
                              onChange={() => toggle(i)}
                            />
                          </td>
                          <td className="px-2 py-1.5 font-mono">{r.tag}</td>
                          <td className="px-2 py-1.5">{r.grade || '—'}</td>
                          <td className="px-2 py-1.5">
                            {r.hotHalf1 != null && r.hotHalf2 != null
                              ? `${r.hotHalf1} + ${r.hotHalf2}`
                              : '—'}
                          </td>
                          <td className="px-2 py-1.5 font-medium">{r.deadWeight ?? '—'}</td>
                          <td className="px-2 py-1.5">{est}</td>
                          <td className="px-2 py-1.5">{r.salePrice ?? '—'}</td>
                          <td className="px-2 py-1.5">
                            {r.matchStatus === 'matched' ? (
                              <span className="text-green-700">Matched</span>
                            ) : (
                              <span className="text-amber-700">Not on system</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="px-4 py-3 border-t flex items-center justify-between">
                <div className="text-sm text-slate-600">{result}</div>
                <button
                  type="button"
                  onClick={doImport}
                  disabled={importing || selectedCount === 0}
                  className="rounded-lg bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
                >
                  {importing ? 'Updating…' : `Apply sale to ${selectedCount} animals`}
                </button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}