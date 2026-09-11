'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getFarmAccess } from '@/lib/farm-access'
import {
  loadSuspendedRun,
  pullOpenRun,
  newerRun,
  type SuspendedFeedingRun,
} from '@/lib/feeding-run-store'

export default function FeedingRunPage() {
  const [msg, setMsg] = useState('Loading…')
  const [paused, setPaused] = useState<SuspendedFeedingRun | null>(null)

  useEffect(() => {
    const supabase = createClient()
    getFarmAccess().then(async (access) => {
      if (!access.farmId) {
        setMsg('Sign in to run a load.')
        return
      }
      const local = loadSuspendedRun(access.farmId)
      const cloud = await pullOpenRun(supabase, access.farmId)
      setPaused(newerRun(local, cloud))
      setMsg('')
    })
  }, [])

  return (
    <div className="min-h-screen bg-slate-100 p-6 space-y-4">
      <h1 className="text-2xl font-bold">Feeding run</h1>
      {msg && <p className="text-slate-600">{msg}</p>}
      {paused && (
        <div className="rounded-xl border-2 border-amber-700 bg-amber-50 p-4">
          <p className="font-bold">Unfinished load on this farm</p>
          <p className="text-sm mt-1">{paused.load.name}</p>
          <p className="text-sm text-amber-900 mt-2">
            This page is being restored. Keep the iPad on the load if it is still open.
            Refresh this screen in a couple of minutes.
          </p>
        </div>
      )}
      {!paused && !msg && (
        <p className="text-slate-700">
          An unfinished load only lives on the device that started it until we finish wiring
          farm-wide resume. Open Feeding run on the iPad to keep that load.
        </p>
      )}
      <Link href="/m" className="inline-block text-green-800 underline font-semibold">Home</Link>
    </div>
  )
}
