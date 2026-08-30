export function programmeDayIndex(startDate: string, asOf: Date = new Date()): number {
  const start = new Date(startDate + 'T00:00:00')
  const today = new Date(asOf)
  today.setHours(0, 0, 0, 0)
  start.setHours(0, 0, 0, 0)
  return Math.floor((today.getTime() - start.getTime()) / 86400000)
}

export type Phase = {
  sort_order: number
  diet_id: string
  steady_days: number
  transition_days: number
}

/**
 * Multi-phase timeline:
 * For each phase: steady_days at 100% that diet, then transition_days
 * blending linearly into the next phase's diet.
 */
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

    // Steady segment
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

    // Transition into next
    if (next && phase.transition_days > 0) {
      if (dayIndex < cursor + phase.transition_days) {
        const t = dayIndex - cursor // 0 .. transition_days-1
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

export function blendIngredientPercents(
  fromDiet: IngredientPercent[],
  toDiet: IngredientPercent[],
  fromShare: number,
  toShare: number
): IngredientPercent[] {
  // Preserve order: from-diet order first, then any extras from to-diet
  const map = new Map<string, IngredientPercent>()
  const order: string[] = []

  const touch = (row: IngredientPercent, share: number) => {
    if (!map.has(row.ingredientId)) {
      order.push(row.ingredientId)
      map.set(row.ingredientId, {
        ...row,
        percent: 0,
      })
    }
    const cur = map.get(row.ingredientId)!
    cur.percent += row.percent * share
    cur.costPerUnit = row.costPerUnit
  }

  const fromSorted = [...fromDiet].sort((a, b) => a.sortOrder - b.sortOrder)
  const toSorted = [...toDiet].sort((a, b) => a.sortOrder - b.sortOrder)
  fromSorted.forEach((r) => touch(r, fromShare))
  toSorted.forEach((r) => touch(r, toShare))

  return order.map((id) => {
    const r = map.get(id)!
    return { ...r, percent: Number(r.percent.toFixed(3)) }
  })
}

export function mixFromTotalKg(
  totalKg: number,
  blended: IngredientPercent[]
) {
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