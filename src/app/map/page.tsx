'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function MapRedirectPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/fields/map')
  }, [router])
  return <p className="p-10 text-center font-bold">Opening Fields map…</p>
}
