'use client'

import Link from 'next/link'

export default function IntakeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 border-b-4 border-slate-700 bg-slate-900 px-3 py-2 phone-header">
        <p className="text-sm font-bold text-white">EID intake</p>
        <Link
          href="/m/animals"
          className="min-h-[48px] rounded-xl bg-brand-600 px-4 text-base font-bold leading-[48px] text-white"
        >
          Done
        </Link>
      </div>
      {children}
    </div>
  )
}
