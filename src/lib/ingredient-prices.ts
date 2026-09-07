import { createClient } from '@/lib/supabase/client'

export type PriceRow = {
  id: string
  ingredient_id: string
  cost_per_unit: number
  effective_on: string
  notes: string | null
}

export function priceOnDate(history: PriceRow[], ingredientId: string, onDate: string): number {
  const rows = history
    .filter((p) => p.ingredient_id === ingredientId && p.effective_on <= onDate)
    .sort((a, b) => (a.effective_on < b.effective_on ? 1 : -1))
  return Number(rows[0]?.cost_per_unit || 0)
}

export async function recordIngredientPrice(opts: {
  farmId: string
  ingredientId: string
  costPerUnit: number
  effectiveOn: string
  notes?: string
}) {
  const supabase = createClient()
  const { error: histErr } = await supabase.from('ingredient_prices').insert({
    farm_id: opts.farmId,
    ingredient_id: opts.ingredientId,
    cost_per_unit: opts.costPerUnit,
    effective_on: opts.effectiveOn,
    notes: opts.notes || null,
  })
  if (histErr) return { error: histErr.message }

  const { data: latest } = await supabase
    .from('ingredient_prices')
    .select('cost_per_unit, effective_on')
    .eq('ingredient_id', opts.ingredientId)
    .order('effective_on', { ascending: false })
    .limit(1)
    .maybeSingle()

  const current = latest ? Number(latest.cost_per_unit) : opts.costPerUnit
  const { error } = await supabase
    .from('ingredients')
    .update({ cost_per_unit: current })
    .eq('id', opts.ingredientId)
  return { error: error?.message || null }
}
