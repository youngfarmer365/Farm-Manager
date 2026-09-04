'use client'

import { usePathname, useRouter } from 'next/navigation'

export function BackBar() {
  const pathname = usePathname() || '/'
  const router = useRouter()
  const hide =
    pathname === '/' ||
    pathname.startsWith('/auth') ||
    pathname.includes('/feeding/run')

  if (hide) return null

  function back() {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back()
    else router.push(pathname.startsWith('/m') ? '/m' : '/home')
  }

  return (
    <div className="print:hidden sticky top-0 z-[60] border-b-2 border-slate-600 bg-white/95 phone-header">
      <div className="mx-auto flex max-w-6xl items-center px-3 py-2">
        <button
          type="button"
          onClick={back}
          className="inline-flex min-h-[44px] items-center rounded-xl border-2 border-slate-700 bg-slate-50 px-4 text-sm font-bold text-slate-900"
        >
          ← Back
        </button>
      </div>
    </div>
  )
}
