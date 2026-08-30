/**
 * Shared Farm Manager Supabase env helpers.
 * Cattle Manager setups often pasted the REST URL (.../rest/v1/) instead of
 * the project URL. supabase-js then calls /rest/v1/auth/v1 and auth breaks.
 */
export function getSupabaseUrl() {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  return raw
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/rest\/v1$/i, '')
    .replace(/\/auth\/v1$/i, '')
}

export function getSupabaseAnonKey() {
  return (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim()
}

export function assertSupabaseEnv() {
  const url = getSupabaseUrl()
  const key = getSupabaseAnonKey()
  if (!url || !key) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env.local.'
    )
  }
  if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/i.test(url)) {
    console.warn(
      `[supabase] Unexpected project URL "${url}". Expected https://<ref>.supabase.co with no /rest/v1 path.`
    )
  }
  return { url, key }
}
