'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { LogoutButton } from '@/components/layout/LogoutButton'

const nav =
  'inline-flex min-h-[44px] items-center rounded-xl border-2 border-brand-800 bg-brand-50 px-3 text-sm font-bold text-brand-900'

export function AppHeader({
  title,
  extra,
}: {
  title: string
  extra?: ReactNode
}) {
  const router = useRouter()
  return (
    <header className="border-b-4 border-slate-600 bg-white px-4 py-3 print:hidden">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/home" className="text-sm font-bold uppercase tracking-wide text-brand-800">
            Farm Manager
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => router.back()} className={nav}>
            ← Back
          </button>
          <Link href="/home" className={nav}>
            Home
          </Link>
          {extra}
          <LogoutButton />
        </div>
      </div>
    </header>
  )
}
