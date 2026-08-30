'use client'

import { createClient } from '@/lib/supabase/client'

export function LogoutButton({
  className,
  label = 'Log out',
}: {
  className?: string
  label?: string
}) {
  async function out() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/auth/login'
  }

  return (
    <button
      type="button"
      onClick={out}
      className={
        className ||
        'inline-flex min-h-[44px] items-center rounded-xl border-2 border-red-800 bg-red-50 px-4 text-sm font-bold text-red-800'
      }
    >
      {label}
    </button>
  )
}
