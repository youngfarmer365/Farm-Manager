'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getFarmAccess, homePathForRole } from '@/lib/farm-access'
import { LogoutButton } from '@/components/layout/LogoutButton'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [magic, setMagic] = useState(false)
  const [sessionEmail, setSessionEmail] = useState<string | null>(null)
  const [sessionRole, setSessionRole] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    getFarmAccess().then((a) => {
      if (a.userId) {
        setSessionEmail(a.email)
        setSessionRole(a.role)
      }
    })
  }, [])

  async function afterSession() {
    const access = await getFarmAccess()
    if (!access.farmId) router.push('/onboarding')
    else router.push(homePathForRole(access.role))
    router.refresh()
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    if (magic) {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo:
            typeof window !== 'undefined' ? `${window.location.origin}/m` : undefined,
        },
      })
      setLoading(false)
      if (error) setError(error.message)
      else setMessage('Check your email for a login link. Open it on this phone.')
      return
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    await afterSession()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-slate-200 p-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Log in</h1>
        <p className="text-sm text-slate-500 mb-6">Farm Manager</p>

        {sessionEmail && (
          <div className="mb-6 rounded-xl border-2 border-amber-700 bg-amber-50 p-4">
            <p className="text-sm font-bold text-amber-950">Already signed in</p>
            <p className="mt-1 break-all text-sm font-semibold text-slate-800">{sessionEmail}</p>
            {sessionRole && (
              <p className="mt-1 text-sm capitalize text-slate-700">{sessionRole} access</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => afterSession()}
                className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-bold text-white"
              >
                Continue
              </button>
              <LogoutButton label="Log out and switch account" />
            </div>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-3 text-base"
            />
          </div>
          {!magic && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input
                type="password"
                required={!magic}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-3 text-base"
              />
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {message && <p className="text-sm font-semibold text-brand-800">{message}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-brand-600 text-white py-3 text-base font-medium disabled:opacity-50"
          >
            {loading ? 'Please wait…' : magic ? 'Email me a login link' : 'Log in'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMagic((v) => !v)
            setError(null)
            setMessage(null)
          }}
          className="mt-4 w-full text-sm font-semibold text-brand-800 underline"
        >
          {magic ? 'Use password instead' : 'Yard staff: email me a login link'}
        </button>

        <p className="mt-6 text-center text-sm text-slate-600">
          Don’t have an account?{' '}
          <Link href="/auth/signup" className="text-brand-700 font-medium hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}
