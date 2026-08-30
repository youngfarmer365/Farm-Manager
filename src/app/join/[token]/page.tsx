'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Invite {
  farm_name: string
  role: string
  email: string
  expires_at: string
}

export default function JoinPage() {
  const params = useParams<{ token: string }>()
  const token = params?.token
  const router = useRouter()
  const supabase = createClient()

  const [invite, setInvite] = useState<Invite | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'password' | 'link'>('password')

  useEffect(() => {
    if (!token) return
    async function boot() {
      const { data, error } = await supabase.rpc('get_farm_invite', {
        invite_token: token,
      })
      if (error) {
        setLoadError(error.message)
        return
      }
      const row = Array.isArray(data) ? data[0] : data
      if (!row) {
        setLoadError('This invite is invalid or has expired.')
        return
      }
      setInvite(row as Invite)

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        await accept()
      }
    }
    boot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  async function accept() {
    if (!token) return
    setBusy(true)
    setError(null)
    const { data, error } = await supabase.rpc('accept_farm_invite', {
      invite_token: token,
    })
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    const result = data as { ok?: boolean; error?: string }
    if (!result?.ok) {
      setError(result?.error || 'Could not join farm')
      return
    }
    router.replace('/m')
    router.refresh()
  }

  async function createAndJoin(e: React.FormEvent) {
    e.preventDefault()
    if (!invite || !token) return
    setBusy(true)
    setError(null)
    const { error: signErr } = await supabase.auth.signUp({
      email: invite.email,
      password,
      options: {
        emailRedirectTo: typeof window !== 'undefined' ? window.location.href : undefined,
      },
    })
    if (signErr) {
      setBusy(false)
      setError(signErr.message)
      return
    }
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setBusy(false)
      setMessage('Check your email to confirm the account, then open this link again.')
      return
    }
    await accept()
  }

  async function sendMagic() {
    if (!invite) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: invite.email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: typeof window !== 'undefined' ? window.location.href : undefined,
      },
    })
    setBusy(false)
    if (error) setError(error.message)
    else setMessage(`Login email sent to ${invite.email}. Open it on this phone.`)
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-slate-100 px-4 py-16">
        <div className="mx-auto max-w-md rounded-2xl border bg-white p-6">
          <h1 className="text-xl font-bold">Invite</h1>
          <p className="mt-3 font-semibold text-red-700">{loadError}</p>
        </div>
      </div>
    )
  }

  if (!invite) {
    return <p className="p-10 text-center text-lg font-bold">Loading invite…</p>
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-12">
      <div className="mx-auto max-w-md rounded-2xl border-4 border-slate-600 bg-white p-6">
        <p className="text-sm font-bold uppercase tracking-wide text-brand-800">Farm Manager</p>
        <h1 className="mt-1 text-2xl font-bold">Join {invite.farm_name}</h1>
        <p className="mt-2 text-base font-semibold text-slate-700">
          You are invited as <span className="capitalize">{invite.role}</span>.
          {invite.role === 'basic'
            ? ' You will only see feeding runs and stock counts.'
            : ''}
        </p>
        <p className="mt-1 text-sm font-semibold text-slate-500">{invite.email}</p>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={() => setMode('password')}
            className={`flex-1 rounded-xl border-2 px-3 py-2 text-sm font-bold ${
              mode === 'password' ? 'border-brand-800 bg-brand-50' : 'border-slate-300'
            }`}
          >
            Set password
          </button>
          <button
            type="button"
            onClick={() => setMode('link')}
            className={`flex-1 rounded-xl border-2 px-3 py-2 text-sm font-bold ${
              mode === 'link' ? 'border-brand-800 bg-brand-50' : 'border-slate-300'
            }`}
          >
            Email login link
          </button>
        </div>

        {mode === 'password' ? (
          <form onSubmit={createAndJoin} className="mt-4 space-y-3">
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Choose a password"
              className="w-full rounded-xl border-2 border-slate-400 px-3 py-3 text-base"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full min-h-[52px] rounded-xl bg-brand-700 text-lg font-bold text-white disabled:opacity-50"
            >
              {busy ? 'Joining…' : 'Join farm'}
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={sendMagic}
            disabled={busy}
            className="mt-4 w-full min-h-[52px] rounded-xl bg-brand-700 text-lg font-bold text-white disabled:opacity-50"
          >
            {busy ? 'Sending…' : 'Email me a login link'}
          </button>
        )}

        {error && <p className="mt-3 font-semibold text-red-700">{error}</p>}
        {message && <p className="mt-3 font-semibold text-brand-800">{message}</p>}
      </div>
    </div>
  )
}
