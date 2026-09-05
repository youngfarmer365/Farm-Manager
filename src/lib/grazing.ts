import { createClient } from '@/lib/supabase/client'

export const GRAZE_COLORS = {
  ready: '#16a34a',
  grazing: '#eab308',
  move: '#dc2626',
  rest: '#2563eb',
} as const

export type GrazeStatus = keyof typeof GRAZE_COLORS

export function daysBetween(from: string, to = new Date()): number {
  const a = new Date(from + 'T00:00:00')
  const b = new Date(to)
  b.setHours(0, 0, 0, 0)
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

export function fieldGrazeStatus(args: {
  headcount: number
  grazeDays: number
  restDays: number
  oldestOpenStart: string | null
  lastEndedOn: string | null
}): GrazeStatus {
  if (args.headcount > 0) {
    if (args.oldestOpenStart && daysBetween(args.oldestOpenStart) >= args.grazeDays) return 'move'
    return 'grazing'
  }
  if (args.lastEndedOn) {
    const rested = daysBetween(args.lastEndedOn)
    if (rested < args.restDays) return 'rest'
  }
  return 'ready'
}

export async function moveAnimalsToField(opts: {
  farmId: string
  animalIds: string[]
  fieldId: string
  fromPenId?: string | null
  startedOn?: string
}) {
  const supabase = createClient()
  const startedOn = opts.startedOn || new Date().toISOString().slice(0, 10)
  const ids = opts.animalIds
  if (!ids.length) return { error: 'No animals selected' }

  await supabase
    .from('grazing_stays')
    .update({ ended_on: startedOn })
    .in('animal_id', ids)
    .is('ended_on', null)

  const rows = ids.map((animal_id) => ({
    farm_id: opts.farmId,
    animal_id,
    field_id: opts.fieldId,
    from_pen_id: opts.fromPenId || null,
    started_on: startedOn,
  }))
  const { error: stayErr } = await supabase.from('grazing_stays').insert(rows)
  if (stayErr) return { error: stayErr.message }

  const { error } = await supabase.from('animals').update({ field_id: opts.fieldId }).in('id', ids)
  return { error: error?.message || null }
}

export async function moveAnimalsOffField(opts: {
  farmId: string
  animalIds: string[]
  toPenId: string | null
  endedOn?: string
}) {
  const supabase = createClient()
  const endedOn = opts.endedOn || new Date().toISOString().slice(0, 10)
  const ids = opts.animalIds
  if (!ids.length) return { error: 'No animals selected' }

  await supabase
    .from('grazing_stays')
    .update({ ended_on: endedOn, to_pen_id: opts.toPenId })
    .in('animal_id', ids)
    .is('ended_on', null)

  const { error } = await supabase
    .from('animals')
    .update({ field_id: null, pen_id: opts.toPenId })
    .in('id', ids)
  return { error: error?.message || null }
}
