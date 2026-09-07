'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getFarmAccess, isYardStaff } from '@/lib/farm-access'
import { LogoutButton } from '@/components/layout/LogoutButton'
import { applyMobilePrefs, readMobilePrefs, writeMobilePrefs, type MobilePrefs } from '@/lib/mobile-prefs'

export default function AccountPage() {
  const [email, setEmail] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [prefs, setPrefs] = useState<MobilePrefs>({ largeText: false, highContrast: false })

  useEffect(() => {
    applyMobilePrefs()
    setPrefs(readMobilePrefs())
    getFarmAccess().then((a) => {
      setEmail(a.email)
      setRole(a.role)
    })
  }, [])

  function toggle(key: keyof MobilePrefs) {
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    writeMobilePrefs(next)
  }

  const yard = isYardStaff(role)

  return (
    <div className="min-h-screen bg-slate-200">
      <header className="border-b-4 border-slate-700 bg-white px-5 py-6 phone-header">
        <p className="text-sm font-bold uppercase tracking-wide text-brand-800">Farm Manager</p>
        <h1 className="text-2xl font-bold">Account</h1>
      </header>
      <main className="space-y-4 p-4">
        <div className="rounded-2xl border-4 border-slate-600 bg-white p-5">
          <p className="text-sm font-bold text-slate-500">Signed in as</p>
          <p className="mt-1 break-all text-lg font-bold">{email || '…'}</p>
          <p className="mt-2 text-base font-semibold capitalize text-slate-700">
            {role === 'basic' ? 'Yard access (basic)' : role ? role + ' access' : ''}
          </p>
        </div>

        <div className="rounded-2xl border-4 border-slate-600 bg-white p-4 space-y-2">
          <p className="text-sm font-bold uppercase text-slate-500">Yard display</p>
          <button type="button" onClick={() => toggle('largeText')} className="min-h-[52px] w-full rounded-xl border-2 border-slate-500 bg-slate-100 text-base font-bold">
            Large text: {prefs.largeText ? 'On' : 'Off'}
          </button>
          <button type="button" onClick={() => toggle('highContrast')} className="min-h-[52px] w-full rounded-xl border-2 border-slate-500 bg-slate-100 text-base font-bold">
            High contrast: {prefs.highContrast ? 'On' : 'Off'}
          </button>
        </div>

        {!yard && (
          <Link href="/home?stay=1" className="flex min-h-[72px] flex-col justify-center rounded-2xl border-4 border-slate-800 bg-slate-800 p-5 text-white">
            <span className="text-xl font-bold">Computer app</span>
          </Link>
        )}
        <LogoutButton className="flex w-full min-h-[56px] items-center justify-center rounded-2xl border-4 border-red-800 bg-red-600 text-lg font-bold text-white" />
      </main>
    </div>
  )
}
