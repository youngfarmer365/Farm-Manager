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

export function loadSuspendedRun(farmId: string): SuspendedFeedingRun | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(FEEDING_RUN_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as SuspendedFeedingRun
    if (!data?.farmId || data.farmId !== farmId) return null
    if (!data.load?.id || !Array.isArray(data.loadPens) || data.loadPens.length === 0) return null
    if (data.step !== 'fill' && data.step !== 'feed') return null
    return data
  } catch {
    return null
  }
}

export function saveSuspendedRun(data: SuspendedFeedingRun) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(
      FEEDING_RUN_KEY,
      JSON.stringify({ ...data, savedAt: new Date().toISOString() })
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
