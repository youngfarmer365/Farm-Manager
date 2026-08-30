import { createBrowserClient } from '@supabase/ssr'
import { assertSupabaseEnv } from '@/lib/supabase/env'
import { getStayLoggedIn } from '@/lib/session-pref'

export function createClient() {
  const { url, key } = assertSupabaseEnv()
  const stay = getStayLoggedIn()
  return createBrowserClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: stay,
      storage: typeof window !== 'undefined' && !stay ? window.sessionStorage : undefined,
    },
  })
}
