'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface AimRow {
  tag: string
  gender: string
  dob: string | null
  breed: string
  movedIn: string | null
  tbTest: string | null
  bvd: string | null
}

interface MatchRow extends AimRow {
  status: 'matched' | 'aim_only'
  systemId: string | null
  systemStatus: string | null
}

function parseIrishDate(d: string | null | undefined): string | null {
  if (!d || !d.trim()) return null
  const m = d.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const [, day, month, year] = m
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

function parseHerdFromFilename(name: string): string | null {
  // e.g. "E2100910 Herd Profile on 050826 (278 animals).csv"
  const m = name.match(/^([A-Za-z]?\d{5,})\b/)
  return m ? m[1].toUpperCase() : null
}

function parseAimCsv(text: string): AimRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length < 2) return []

  // Header: Tag Number,Gender,Date of Birth,Breed,Date Moved In,TB Test Date,Negative BVD
  const rows: AimRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim())
    const tag = cols[0]
    if (!tag || tag.toLowerCase().includes('tag')) continue
    rows.push({
      tag,
      gender: cols[1] || '',
      dob: parseIrishDate(cols[2]),
      breed: cols[3] || '',
      movedIn: parseIrishDate(cols[4]),
      tbTest: parseIrishDate(cols[5]),
      bvd: parseIrishDate(cols[6]),
    })
  }
  return rows
}

export default function AimCrosscheckPage() {
  const [rows, setRows] = useState<MatchRow[]>([])
  const [systemOnly, setSystemOnly] = useState<{ id: string; tag: string; status: string }[]>([])
  const [herdFromFile, setHerdFromFile] = useState<string | null>(null)
  const [farmId, setFarmId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'matched' | 'aim_only' | 'system_only'>('matched')
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
    setRows([])
    setSystemOnly([])

    const file = e.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const herd = parseHerdFromFilename(file.name)
      setHerdFromFile(herd)

      const parsed = parseAimCsv(text)
      if (!parsed.length) {
        setError('No animal rows found in CSV')
        return
      }

      if (!farmId) {
        setError('No farm found — log in first')
        return
      }

      const tags = parsed.map((r) => r.tag)
      const { data: existing } = await supabase
        .from('animals')
        .select('id, tag, status')
        .eq('farm_id', farmId)

      const byTag = new Map((existing || []).map((a: any) => [a.tag, a]))

      const matchedRows: MatchRow[] = parsed.map((r) => {
        const sys = byTag.get(r.tag)
        return {
          ...r,
          status: sys ? 'matched' : 'aim_only',
          systemId: sys?.id || null,
          systemStatus: sys?.status || null,
        }
      })

      setRows(matchedRows)

      // Active animals on system not in AIM file
      const aimTags = new Set(parsed.map((r) => r.tag))
      setSystemOnly(
        (existing || [])
          .filter((a: any) => a.status === 'active' && !aimTags.has(a.tag))
          .map((a: any) => ({ id: a.id, tag: a.tag, status: a.status }))
      )
    } catch (err: any) {
      setError(err.message || 'Failed to parse CSV')
    }
  }

  const matched = rows.filter((r) => r.status === 'matched')
  const aimOnly = rows.filter((r) => r.status === 'aim_only')

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">AIM herd profile cross-check</h1>
            <p className="text-sm text-slate-500">
              Compare Agfoods / AIM CSV with animals on this system
            </p>
          </div>
          <Link href="/import" className="text-sm text-slate-600 hover:underline">
            Back to import
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-white rounded-xl border p-6 shadow-sm space-y-3">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleFile}
            className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-brand-50 file:text-brand-700"
          />
          <p className="text-xs text-slate-500">
            Expected columns: Tag Number, Gender, Date of Birth, Breed, Date Moved In, TB Test
            Date, Negative BVD. Herd number is read from the filename when possible.
          </p>
          {herdFromFile && (
            <p className="text-sm text-slate-700">
              Herd from filename: <strong>{herdFromFile}</strong>
            </p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        {rows.length > 0 && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setTab('matched')}
                className={`rounded-xl border p-4 text-left ${
                  tab === 'matched' ? 'border-green-500 bg-green-50' : 'bg-white'
                }`}
              >
                <div className="text-2xl font-bold text-green-700">{matched.length}</div>
                <div className="text-sm text-slate-600">On AIM and on system</div>
              </button>
              <button
                type="button"
                onClick={() => setTab('aim_only')}
                className={`rounded-xl border p-4 text-left ${
                  tab === 'aim_only' ? 'border-amber-500 bg-amber-50' : 'bg-white'
                }`}
              >
                <div className="text-2xl font-bold text-amber-700">{aimOnly.length}</div>
                <div className="text-sm text-slate-600">On AIM only (missing here)</div>
              </button>
              <button
                type="button"
                onClick={() => setTab('system_only')}
                className={`rounded-xl border p-4 text-left ${
                  tab === 'system_only' ? 'border-red-500 bg-red-50' : 'bg-white'
                }`}
              >
                <div className="text-2xl font-bold text-red-700">{systemOnly.length}</div>
                <div className="text-sm text-slate-600">Active here, not on AIM</div>
              </button>
            </div>

            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="overflow-x-auto max-h-[32rem]">
                {tab === 'matched' && (
                  <table className="min-w-full text-xs">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="px-2 py-2 text-left">Tag</th>
                        <th className="px-2 py-2 text-left">Sex</th>
                        <th className="px-2 py-2 text-left">DOB</th>
                        <th className="px-2 py-2 text-left">Breed</th>
                        <th className="px-2 py-2 text-left">Moved in</th>
                        <th className="px-2 py-2 text-left">TB test</th>
                        <th className="px-2 py-2 text-left">System</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matched.map((r) => (
                        <tr key={r.tag} className="border-t">
                          <td className="px-2 py-1.5 font-mono">
                            {r.systemId ? (
                              <Link href={`/animals/${r.systemId}`} className="text-brand-700 hover:underline">
                                {r.tag}
                              </Link>
                            ) : (
                              r.tag
                            )}
                          </td>
                          <td className="px-2 py-1.5">{r.gender}</td>
                          <td className="px-2 py-1.5">{r.dob || '—'}</td>
                          <td className="px-2 py-1.5">{r.breed}</td>
                          <td className="px-2 py-1.5">{r.movedIn || '—'}</td>
                          <td className="px-2 py-1.5">{r.tbTest || '—'}</td>
                          <td className="px-2 py-1.5 capitalize">{r.systemStatus}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {tab === 'aim_only' && (
                  <table className="min-w-full text-xs">
                    <thead className="bg-amber-50 sticky top-0">
                      <tr>
                        <th className="px-2 py-2 text-left">Tag</th>
                        <th className="px-2 py-2 text-left">Sex</th>
                        <th className="px-2 py-2 text-left">DOB</th>
                        <th className="px-2 py-2 text-left">Breed</th>
                        <th className="px-2 py-2 text-left">Moved in</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aimOnly.map((r) => (
                        <tr key={r.tag} className="border-t bg-amber-50/50">
                          <td className="px-2 py-1.5 font-mono">{r.tag}</td>
                          <td className="px-2 py-1.5">{r.gender}</td>
                          <td className="px-2 py-1.5">{r.dob || '—'}</td>
                          <td className="px-2 py-1.5">{r.breed}</td>
                          <td className="px-2 py-1.5">{r.movedIn || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {tab === 'system_only' && (
                  <table className="min-w-full text-xs">
                    <thead className="bg-red-50 sticky top-0">
                      <tr>
                        <th className="px-2 py-2 text-left">Tag</th>
                        <th className="px-2 py-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {systemOnly.map((r) => (
                        <tr key={r.id} className="border-t bg-red-50/50">
                          <td className="px-2 py-1.5 font-mono">
                            <Link href={`/animals/${r.id}`} className="text-brand-700 hover:underline">
                              {r.tag}
                            </Link>
                          </td>
                          <td className="px-2 py-1.5 capitalize">{r.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}