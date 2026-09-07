'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getFarmAccess, isYardStaff } from '@/lib/farm-access'
import { LogoutButton } from '@/components/layout/LogoutButton'

export default function AccountPage() {
  const [email, setEmail] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    getFarmAccess().then((a) => {
      setEmail(a.email)
      setRole(a.role)
    })
  }, [])

  const yard = isYardStaff(role)

  return (
    <div className="min-h-screen bg-slate-200">
      <header className="border-b-4 border-slate-700 bg-white px-5 py-6">
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
        {!yard && (
          <Link
            href="/home?stay=1"
            className="flex min-h-[72px] flex-col justify-center rounded-2xl border-4 border-slate-800 bg-slate-800 p-5 text-white"
          >
            <span className="text-xl font-bold">Computer app</span>
            <span className="mt-1 font-semibold text-slate-200">Full home — animals, fields, jobs</span>
          </Link>
        )}
        <LogoutButton className="flex w-full min-h-[56px] items-center justify-center rounded-2xl border-4 border-red-800 bg-red-600 text-lg font-bold text-white" />
        <p className="text-sm font-semibold text-slate-600">
          Log out here to switch back to the owner login.
        </p>
      </main>
    </div>
  )
}
