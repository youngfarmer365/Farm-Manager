export function programmeDayIndex(startDate: string, asOf: Date = new Date()): number {
  const start = new Date(startDate + 'T00:00:00')
  const today = new Date(asOf)
  today.setHours(0, 0, 0, 0)
  start.setHours(0, 0, 0, 0)
  return Math.floor((today.getTime() - start.getTime()) / 86400000)
}

export type ProgrammeClock = {
  start_date: string
  status?: string | null
  pause_days?: number | null
  paused_on?: string | null
}

/** Calendar days on the programme, with paused days taken out. */
export function programmeClockDay(prog: ProgrammeClock, asOf: Date = new Date()): number {
  const raw = programmeDayIndex(prog.start_date, asOf)
  const stored = Number(prog.pause_days || 0)
  const extra = prog.paused_on ? Math.max(0, programmeDayIndex(prog.paused_on, asOf)) : 0
  return Math.max(0, raw - stored - extra)
}

export type Phase = {
  sort_order: number
  diet_id: string
  steady_days: number
  transition_days: number
}

export function resolvePhaseBlend(
  dayIndex: number,
  phases: Phase[]
): {
  fromDietId: string | null
  toDietId: string | null
  fromShare: number
  toShare: number
  label: string
} {
  const sorted = [...phases].sort((a, b) => a.sort_order - b.sort_order)
  if (!sorted.length || dayIndex < 0) {
    return { fromDietId: null, toDietId: null, fromShare: 1, toShare: 0, label: 'before start' }
  }

  let cursor = 0
  for (let i = 0; i < sorted.length; i++) {
    const phase = sorted[i]
    const next = sorted[i + 1]

    if (dayIndex < cursor + phase.steady_days) {
      return {
        fromDietId: phase.diet_id,
        toDietId: phase.diet_id,
        fromShare: 1,
        toShare: 0,
        label: `Phase ${i + 1} steady`,
      }
    }
    cursor += phase.steady_days

    if (next && phase.transition_days > 0) {
      if (dayIndex < cursor + phase.transition_days) {
        const t = dayIndex - cursor
        const toShare = (t + 1) / phase.transition_days
        return {
          fromDietId: phase.diet_id,
          toDietId: next.diet_id,
          fromShare: 1 - toShare,
          toShare,
          label: `Transition ${i + 1}→${i + 2}`,
        }
      }
      cursor += phase.transition_days
    }
  }

  const last = sorted[sorted.length - 1]
  return {
    fromDietId: last.diet_id,
    toDietId: last.diet_id,
    fromShare: 1,
    toShare: 0,
    label: 'Final phase',
  }
}

export type IngredientPercent = {
  ingredientId: string
  name: string
  percent: number
  costPerUnit: number
  sortOrder: number
}

function sortedLines(rows: IngredientPercent[]) {
  return [...rows].sort((a, b) => {
    const d = (a.sortOrder || 0) - (b.sortOrder || 0)
    if (d !== 0) return d
    return a.name.localeCompare(b.name)
  })
}

/**
 * Mixer order follows the current (from) diet line order, then any extra
 * ingredients that only exist on the next diet. Percents are a weighted blend.
 */
export function blendIngredientPercents(
  fromDiet: IngredientPercent[],
  toDiet: IngredientPercent[],
  fromShare: number,
  toShare: number
): IngredientPercent[] {
  const fromSorted = sortedLines(fromDiet)
  const toSorted = sortedLines(toDiet)
  const fromMap = new Map(fromSorted.map((r) => [r.ingredientId, r]))
  const toMap = new Map(toSorted.map((r) => [r.ingredientId, r]))

  const order: string[] = []
  for (const r of fromSorted) {
    if (!order.includes(r.ingredientId)) order.push(r.ingredientId)
  }
  for (const r of toSorted) {
    if (!order.includes(r.ingredientId)) order.push(r.ingredientId)
  }

  return order
    .map((id, idx) => {
      const from = fromMap.get(id)
      const to = toMap.get(id)
      const percent = (from ? from.percent * fromShare : 0) + (to ? to.percent * toShare : 0)
      const src = from || to!
      return {
        ingredientId: id,
        name: src.name,
        percent: Number(percent.toFixed(3)),
        costPerUnit: (toShare > fromShare && to ? to : src).costPerUnit,
        sortOrder: idx,
      }
    })
    .filter((r) => r.percent > 0.0005)
}

export function mixFromTotalKg(totalKg: number, blended: IngredientPercent[]) {
  return blended.map((b) => {
    const kg = (totalKg * b.percent) / 100
    const cost = kg * (b.costPerUnit || 0)
    return {
      ...b,
      kg: Number(kg.toFixed(2)),
      cost: Number(cost.toFixed(2)),
    }
  })
}
