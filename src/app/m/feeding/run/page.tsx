'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { canRunFeeding, getFarmAccess } from '@/lib/farm-access'
import FeedingRunPage from '@/app/feeding/run/page'
import { saveRunDraft } from '@/lib/run-draft'

export default function MobileFeedingRunPage() {
  const [ok, setOk] = useState<boolean | null>(null)

  useEffect(() => {
    getFarmAccess().then((a) => setOk(canRunFeeding(a.role)))
    saveRunDraft('Feeding run opened on this phone', { path: '/m/feeding/run' })
  }, [])

  if (ok === null) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Loading…
      </div>
    )
  }

  if (!ok) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-slate-600">No feeding access on this account.</p>
        <Link href="/m" className="mt-3 inline-block text-sm text-green-700 underline">
          Home
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <FeedingRunPage />
    </div>
  )
}
