import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { assertSupabaseEnv } from '@/lib/supabase/env'

export async function createClient() {
  const cookieStore = await cookies()
  const { url, key } = assertSupabaseEnv()

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // Server Component – ignore
        }
      },
    },
  })
}
