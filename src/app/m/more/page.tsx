'use client'

import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function MobileMorePage() {
  const router = useRouter()
  const supabase = createClient()

  async function logout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <div>
      <header className="bg-white border-b px-4 py-3">
        <h1 className="text-lg font-bold">More</h1>
      </header>
      <div className="p-4 space-y-2">
        {[
          { href: '/animals', label: 'Desktop animals list' },
          { href: '/medicines', label: 'Medicines' },
          { href: '/import', label: 'Upload files' },
          { href: '/groups', label: 'Groups' },
          { href: '/herds', label: 'Herd numbers' },
        ].map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="block rounded-xl border bg-white px-4 py-3 text-sm font-medium"
          >
            {l.label}
          </Link>
        ))}
        <button
          type="button"
          onClick={logout}
          className="w-full rounded-xl border border-red-200 text-red-700 px-4 py-3 text-sm font-medium mt-4"
        >
          Log out
        </button>
      </div>
    </div>
  )
}