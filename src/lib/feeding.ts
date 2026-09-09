export function localISODate(asOf: Date = new Date()): string {
  const y = asOf.getFullYear()
  const m = String(asOf.getMonth() + 1).padStart(2, '0')
  const day = String(asOf.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function programmeDayIndex(startDate: string, asOf: Date = new Date()): number {
  const start = new Date(startDate + 'T00:00:00')
  const today = new Date(asOf)
  today.setHours(0, 0, 0, 0)
  start.setHours(0, 0, 0, 0)
  return Math.floor((today.getTime() - start.getTime()) / 86400000)
}

export type ProgrammeClock = {
  start_date?: string | null
  status?: string | null
  pause_days?: number | null
  paused_on?: string | null
}

/** Calendar days on the programme, with paused days taken out. Day 0 is the start date. */
export function programmeClockDay(prog: ProgrammeClock, asOf: Date = new Date()): number {
  if (!prog.start_date) return 0
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

/**
 * Walk the phase list from day 0:
 *   each phase is `steady_days` at 100% that diet,
 *   then `transition_days` blending linearly into the next diet.
 * Transition day t (0-based) uses toShare = (t + 1) / transition_days,
 * so day 1 of a 7-day change is 1/7 new, and the last transition day is 100% new.
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
 * Mixer fill order follows the diet with more ingredient lines (the full
 * wagon sequence). During a same-size transition it follows the diet you
 * are heading toward. Extra ingredients from the other diet are appended.
 * Percents are a weighted blend of the two diets.
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

  const primary =
    toSorted.length > fromSorted.length
      ? toSorted
      : fromSorted.length > toSorted.length
        ? fromSorted
        : toShare > 0
          ? toSorted
          : fromSorted
  const secondary = primary === toSorted ? fromSorted : toSorted

  const order: string[] = []
  for (const r of primary) {
    if (!order.includes(r.ingredientId)) order.push(r.ingredientId)
  }
  for (const r of secondary) {
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
        percent,
        costPerUnit: (toShare > fromShare && to ? to : src).costPerUnit,
        sortOrder: idx,
      }
    })
    .filter((r) => r.percent > 0.0005)
    .map((r) => ({ ...r, percent: Number(r.percent.toFixed(3)) }))
}

/** Split total kg by percent. Remainder 0.01 kg goes on the largest line so the wagon adds up. */
export function mixFromTotalKg(totalKg: number, blended: IngredientPercent[]) {
  const rows = blended.map((b) => {
    const kg = Number(((totalKg * b.percent) / 100).toFixed(2))
    return { ...b, kg }
  })
  const kgSum = rows.reduce((s, r) => s + r.kg, 0)
  const target = Number(Number(totalKg).toFixed(2))
  const drift = Number((target - kgSum).toFixed(2))
  if (rows.length && Math.abs(drift) >= 0.01) {
    let i = 0
    for (let j = 1; j < rows.length; j++) {
      if (rows[j].kg > rows[i].kg) i = j
    }
    rows[i] = { ...rows[i], kg: Number((rows[i].kg + drift).toFixed(2)) }
  }
  return rows.map((r) => ({
    ...r,
    kg: r.kg,
    cost: Number((r.kg * (r.costPerUnit || 0)).toFixed(2)),
  }))
}
