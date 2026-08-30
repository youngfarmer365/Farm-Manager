import { createClient } from '@/lib/supabase/client'

export type FarmRole = 'basic' | 'advanced' | 'owner' | string

const ROLE_RANK: Record<string, number> = {
  owner: 5,
  advanced: 4,
  manager: 3,
  worker: 1,
  viewer: 0,
  basic: 0,
}

export function canManageFeedingSetup(role: FarmRole | null | undefined) {
  return role === 'advanced' || role === 'owner' || role === 'manager'
}

export function canRunFeeding(role: FarmRole | null | undefined) {
  return role === 'basic' || role === 'advanced' || role === 'owner' || role === 'manager' || role === 'worker'
}

export function canInviteStaff(role: FarmRole | null | undefined) {
  return role === 'advanced' || role === 'owner' || role === 'manager'
}

export function isYardStaff(role: FarmRole | null | undefined) {
  return role === 'basic' || role === 'worker' || role === 'viewer'
}

export function homePathForRole(role: FarmRole | null | undefined) {
  return isYardStaff(role) ? '/m' : '/home'
}

export function isYardAllowedPath(pathname: string) {
  if (pathname.startsWith('/auth')) return true
  if (pathname.startsWith('/join')) return true
  if (pathname.startsWith('/m/feeding/team')) return false
  if (pathname === '/m' || pathname.startsWith('/m/account')) return true
  if (pathname === '/m/feeding') return true
  if (pathname.startsWith('/m/feeding/run')) return true
  if (pathname.startsWith('/feeding/run')) return true
  if (pathname.startsWith('/m/stock')) return true
  return false
}

function pickMembership(
  rows: { farm_id: string; role: string }[] | null
): { farm_id: string; role: string } | null {
  if (!rows?.length) return null
  return [...rows].sort(
    (a, b) => (ROLE_RANK[b.role] ?? 0) - (ROLE_RANK[a.role] ?? 0)
  )[0]
}

export async function getFarmAccess(): Promise<{
  farmId: string | null
  role: FarmRole | null
  userId: string | null
  email: string | null
}> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { farmId: null, role: null, userId: null, email: null }

  const { data: memberships } = await supabase
    .from('farm_members')
    .select('farm_id, role')
    .eq('user_id', user.id)

  const membership = pickMembership(memberships as { farm_id: string; role: string }[] | null)

  if (!membership) {
    return { farmId: null, role: null, userId: user.id, email: user.email ?? null }
  }

  let role = (membership.role as FarmRole) || 'owner'

  if (isYardStaff(role)) {
    const { count } = await supabase
      .from('farm_members')
      .select('id', { count: 'exact', head: true })
      .eq('farm_id', membership.farm_id)
    if ((count ?? 0) <= 1) {
      await supabase
        .from('farm_members')
        .update({ role: 'owner' })
        .eq('farm_id', membership.farm_id)
        .eq('user_id', user.id)
      role = 'owner'
    }
  }

  return {
    farmId: membership.farm_id,
    role,
    userId: user.id,
    email: user.email ?? null,
  }
}