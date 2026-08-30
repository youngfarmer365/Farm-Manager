'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { getFarmAccess, isYardAllowedPath, isYardStaff } from '@/lib/farm-access'

export function AppGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/'
  const router = useRouter()

  useEffect(() => {
    let alive = true
    getFarmAccess().then((a) => {
      if (!alive) return
      if (!a.userId) {
        if (
          pathname.startsWith('/m') ||
          pathname.startsWith('/home') ||
          pathname.startsWith('/jobs') ||
          pathname.startsWith('/fields')
        ) {
          router.replace('/auth/login')
        }
        return
      }
      if (isYardStaff(a.role) && !isYardAllowedPath(pathname)) {
        router.replace('/m')
      }
    })
    return () => {
      alive = false
    }
  }, [pathname, router])

  return <>{children}</>
}
