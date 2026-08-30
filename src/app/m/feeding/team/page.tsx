// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { canInviteStaff, getFarmAccess, type FarmRole } from '@/lib/farm-access'

interface Member {
  id: string
  user_id: string
  role: string
  email: string | null
  display_name: string | null
}

interface Invite {
  id: string
  email: string
  role: string
  token: string
  display_name: string | null
  used_at: string | null
}

const ROLES: FarmRole[] = ['basic', 'advanced', 'owner']

export default function TeamAccessPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [farmId, setFarmId] = useState<string | null>(null)
  const [allowed, setAllowed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [staffName, setStaffName] = useState('')
  const [inviteRole, setInviteRole] = useState<FarmRole>('basic')
  const [copied, setCopied] = useState<string | null>(null)
  const supabase = createClient()

  async function load() {
    setLoading(true)
    const access = await getFarmAccess()
    if (!canInviteStaff(access.role) || !access.farmId) {
      setAllowed(false)
      setLoading(false)
      return
    }
    setAllowed(true)
    setFarmId(access.farmId)
    const { data, error } = await supabase
      .from('farm_members')
      .select('id, user_id, role, email, display_name')
      .eq('farm_id', access.farmId)
    let invitesQ = await supabase
      .from('farm_invites')
      .select('id, email, role, token, display_name, used_at')
      .eq('farm_id', access.farmId)
      .is('used_at', null)
      .order('created_at', { ascending: false })
    if (invitesQ.error && /display_name/i.test(invitesQ.error.message)) {
      invitesQ = await supabase
        .from('farm_invites')
        .select('id, email, role, token, used_at')
        .eq('farm_id', access.farmId)
        .is('used_at', null)
        .order('created_at', { ascending: false })
    }
    if (error) setError(error.message)
    else if (invitesQ.error) setError(invitesQ.error.message)
    setMembers((data as Member[]) || [])
    setInvites((invitesQ.data as Invite[]) || [])
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

  function inviteUrl(token: string) {
    if (typeof window === 'undefined') return `/join/${token}`
    return `${window.location.origin}/join/${token}`
  }

  async function copyLink(token: string) {
    const url = inviteUrl(token)
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      /* ignore */
    }
    setCopied(token)
  }

  async function createInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!farmId || !email.trim() || !staffName.trim()) {
      setError('Name and email are required')
      return
    }
    setError(null)
    const access = await getFarmAccess()
    const payload = {
      farm_id: farmId,
      email: email.trim().toLowerCase(),
      role: inviteRole,
      display_name: staffName.trim(),
      invited_by: access.userId,
    }
    let { data, error } = await supabase.from('farm_invites').insert(payload).select('token').single()
    if (error && /display_name/i.test(error.message)) {
      const retry = await supabase
        .from('farm_invites')
        .insert({
          farm_id: farmId,
          email: payload.email,
          role: payload.role,
          invited_by: payload.invited_by,
        })
        .select('token')
        .single()
      data = retry.data
      error = retry.error
      if (!error) {
        setError('Invite created. Run 006_invite_display_name.sql in Supabase so names are stored on the invite.')
      }
    }
    if (error) {
      setError(error.message)
      return
    }
    setEmail('')
    setStaffName('')
    await load()
    if (data?.token) await copyLink(data.token)
  }

  if (loading) {
    return <div className="flex min-h-[40vh] items-center justify-center font-bold">Loading…</div>
  }

  if (!allowed) {
    return (
      <div className="p-6">
        <p className="font-semibold">Advanced or owner access required.</p>
        <Link href="/m/feeding" className="mt-2 inline-block underline">
          Back
        </Link>
      </div>
    )
  }

  return (
    <div>
      <header className="flex items-center justify-between border-b bg-white px-4 py-4">
        <h1 className="text-lg font-bold">Team access</h1>
        <Link href="/m/feeding" className="text-sm font-bold">
          Back
        </Link>
      </header>
      <main className="space-y-6 px-4 py-5">
        <p className="text-sm text-slate-600">
          <strong>Basic (yard)</strong> — feeding run + stock counts. Name appears on the farm only
          after they open the link, tick Stay logged in, and join.
        </p>

        <form onSubmit={createInvite} className="space-y-3 rounded-2xl border-4 border-slate-600 bg-white p-4">
          <h2 className="font-bold">Invite yard staff</h2>
          <input
            required
            value={staffName}
            onChange={(e) => setStaffName(e.target.value)}
            placeholder="Name (e.g. John)"
            className="w-full rounded-xl border-2 border-slate-300 px-3 py-3 text-base"
          />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="worker@email.com"
            className="w-full rounded-xl border-2 border-slate-300 px-3 py-3 text-base"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            className="w-full rounded-xl border-2 border-slate-300 px-3 py-3 text-base"
          >
            <option value="basic">Basic — feed + stock check</option>
            <option value="advanced">Advanced — full feeding setup</option>
            <option value="owner">Owner</option>
          </select>
          <button type="submit" className="w-full min-h-[48px] rounded-xl bg-brand-700 text-base font-bold text-white">
            Create join link
          </button>
        </form>

        {error && <p className="text-sm font-semibold text-red-600">{error}</p>}

        {invites.length > 0 && (
          <div>
            <h2 className="mb-2 font-bold">Waiting to join</h2>
            <ul className="divide-y overflow-hidden rounded-2xl border bg-white">
              {invites.map((i) => (
                <li key={i.id} className="space-y-2 p-4">
                  <div className="font-bold">{i.display_name || 'Staff'}</div>
                  <div className="text-sm">{i.email}</div>
                  <div className="text-xs capitalize text-slate-500">{i.role} · not joined yet</div>
                  <button
                    type="button"
                    onClick={() => copyLink(i.token)}
                    className="rounded-lg border-2 border-slate-700 px-3 py-2 text-sm font-bold"
                  >
                    {copied === i.token ? 'Copied' : 'Copy join link'}
                  </button>
                  {copied === i.token && (
                    <p className="break-all text-xs text-slate-500">{inviteUrl(i.token)}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <ul className="divide-y overflow-hidden rounded-2xl border bg-white">
          {members.map((m) => (
            <li key={m.id} className="space-y-2 p-4">
              <div className="font-bold">{m.display_name || m.email || 'Member'}</div>
              <div className="break-all text-xs text-slate-400">{m.email || m.user_id}</div>
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
