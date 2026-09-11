type Sb = { from: (table: string) => any }

export const FEEDING_RUN_KEY = 'farm-manager-feeding-run'

export type SuspendedStep = 'fill' | 'feed'

export interface SuspendedLoad {
  id: string
  name: string
  program_id: string | null
}

export interface SuspendedLoadPen {
  id: string
  pen_id: string
  daily_amount_kg: number
  sort_order: number
  pen_name: string
  planned_kg: number
}

export interface SuspendedMixRow {
  ingredientId: string
  name: string
  percent: number
  kg: number
  cost: number
  cumulativeKg: number
}

export interface SuspendedFeedingRun {
  farmId: string
  load: SuspendedLoad
  loadPens: SuspendedLoadPen[]
  step: SuspendedStep
  penIndex: number
  fillIndex: number
  mixerView: boolean
  mixRows: SuspendedMixRow[]
  phaseLabel: string
  pensTotalKg: number
  bufferKg: string
  totalKg: number
  totalCost: number
  stepSize: number
  startedAt: string | null
  hidePrices: boolean
  paused: boolean
  savedAt: string
}

function validRun(data: SuspendedFeedingRun | null, farmId: string): SuspendedFeedingRun | null {
  if (!data?.farmId || data.farmId !== farmId) return null
  if (!data.load?.id || !Array.isArray(data.loadPens) || data.loadPens.length === 0) return null
  if (data.step !== 'fill' && data.step !== 'feed') return null
  return {
    ...data,
    fillIndex: Math.max(0, Number(data.fillIndex) || 0),
    mixerView: data.mixerView !== false,
  }
}

export function loadSuspendedRun(farmId: string): SuspendedFeedingRun | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(FEEDING_RUN_KEY)
    if (!raw) return null
    return validRun(JSON.parse(raw) as SuspendedFeedingRun, farmId)
  } catch {
    return null
  }
}

export function saveSuspendedRun(data: SuspendedFeedingRun) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(
      FEEDING_RUN_KEY,
      JSON.stringify({ ...data, savedAt: data.savedAt || new Date().toISOString() })
    )
  } catch {
    // quota / private mode — run still works in memory
  }
}

export function clearSuspendedRun() {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(FEEDING_RUN_KEY)
  } catch {
    // ignore
  }
}

export function newerRun(
  a: SuspendedFeedingRun | null,
  b: SuspendedFeedingRun | null
): SuspendedFeedingRun | null {
  if (!a) return b
  if (!b) return a
  return (a.savedAt || '') >= (b.savedAt || '') ? a : b
}

export async function pullOpenRun(
  supabase: Sb,
  farmId: string
): Promise<SuspendedFeedingRun | null> {
  const { data, error } = await supabase
    .from('open_feeding_runs')
    .select('payload')
    .eq('farm_id', farmId)
    .maybeSingle()
  if (error || !data?.payload) return null
  return validRun(data.payload as SuspendedFeedingRun, farmId)
}

let pushTimer: ReturnType<typeof setTimeout> | null = null

export function pushOpenRun(supabase: Sb, data: SuspendedFeedingRun) {
  saveSuspendedRun(data)
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    void supabase.from('open_feeding_runs').upsert({
      farm_id: data.farmId,
      payload: data,
      updated_at: new Date().toISOString(),
    })
  }, 400)
}

export async function dropOpenRun(supabase: Sb, farmId?: string | null) {
  clearSuspendedRun()
  if (pushTimer) {
    clearTimeout(pushTimer)
    pushTimer = null
  }
  if (!farmId) return
  await supabase.from('open_feeding_runs').delete().eq('farm_id', farmId)
}
