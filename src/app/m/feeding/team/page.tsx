'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { canManageFeedingSetup, getFarmAccess, type FarmRole } from '@/lib/farm-access'

interface Member {
  id: string
  user_id: string
  role: string
}

const ROLES: FarmRole[] = ['basic', 'advanced', 'owner']

export default function TeamAccessPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [allowed, setAllowed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  async function load() {
    setLoading(true)
    const access = await getFarmAccess()
    if (!canManageFeedingSetup(access.role) || !access.farmId) {
      setAllowed(false)
      setLoading(false)
      return
    }
    setAllowed(true)
    const { data, error } = await supabase
      .from('farm_members')
      .select('id, user_id, role')
      .eq('farm_id', access.farmId)
    if (error) setError(error.message)
    setMembers((data as Member[]) || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function setRole(memberId: string, role: FarmRole) {
    setError(null)
    const { error } = await supabase.from('farm_members').update({ role }).eq('id', memberId)
    if (error) setError(error.message)
    else await load()
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">
        Loading…
      </div>
    )
  }

  if (!allowed) {
    return (
      <div className="p-6">
        <p className="text-sm text-slate-600">Advanced or owner access required.</p>
        <Link href="/m/feeding" className="mt-2 inline-block text-sm text-green-700 underline">
          Back
        </Link>
      </div>
    )
  }

  return (
    <div>
      <header className="flex items-center justify-between border-b bg-white px-4 py-4">
        <h1 className="text-lg font-bold">Team access</h1>
        <Link href="/m/feeding" className="text-sm text-slate-600">
          Back
        </Link>
      </header>
      <main className="space-y-3 px-4 py-5">
        <p className="text-sm text-slate-600">
          <strong>Basic</strong> — run only.
          <br />
          <strong>Advanced / Owner</strong> — full feeding setup.
        </p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <ul className="divide-y overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {members.map((m) => (
            <li key={m.id} className="space-y-2 p-4">
              <div className="break-all font-mono text-[11px] text-slate-400">{m.user_id}</div>
              <div className="flex flex-wrap gap-2">
                {ROLES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(m.id, r)}
                    className={`rounded-full border px-3 py-1.5 text-xs capitalize ${
                      m.role === r
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}