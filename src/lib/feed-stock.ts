import { createClient } from '@/lib/supabase/client'

export async function adjustStock(farmId: string, ingredientId: string, deltaKg: number) {
  const supabase = createClient()
  const { data } = await supabase
    .from('feed_stock')
    .select('id, quantity_kg')
    .eq('farm_id', farmId)
    .eq('ingredient_id', ingredientId)
    .maybeSingle()

  const next = Math.max(0, Number(data?.quantity_kg || 0) + deltaKg)
  if (data?.id) {
    const { error } = await supabase
      .from('feed_stock')
      .update({ quantity_kg: next, updated_at: new Date().toISOString() })
      .eq('id', data.id)
    return { error: error?.message || null, quantity_kg: next }
  }
  const { error } = await supabase.from('feed_stock').insert({
    farm_id: farmId,
    ingredient_id: ingredientId,
    quantity_kg: next,
    updated_at: new Date().toISOString(),
  })
  return { error: error?.message || null, quantity_kg: next }
}

/** One fetch, then parallel updates. Groups the same ingredient. Returns first error or null. */
export async function deductStockMany(
  farmId: string,
  lines: { ingredientId: string; kg: number }[],
): Promise<string | null> {
  const byIng = new Map<string, number>()
  for (const line of lines) {
    if (!line.ingredientId || !(line.kg > 0)) continue
    byIng.set(line.ingredientId, (byIng.get(line.ingredientId) || 0) + line.kg)
  }
  if (!byIng.size) return null
  const supabase = createClient()
  const ids = Array.from(byIng.keys())
  const { data, error } = await supabase
    .from('feed_stock')
    .select('id, ingredient_id, quantity_kg')
    .eq('farm_id', farmId)
    .in('ingredient_id', ids)
  if (error) return error.message
  const rowByIng = new Map((data || []).map((s) => [s.ingredient_id as string, s]))
  const now = new Date().toISOString()
  const jobs = ids.map((id) => {
    const used = byIng.get(id) || 0
    const row = rowByIng.get(id)
    if (row) {
      return supabase
        .from('feed_stock')
        .update({ quantity_kg: Math.max(0, Number(row.quantity_kg) - used), updated_at: now })
        .eq('id', row.id)
    }
    return supabase.from('feed_stock').insert({
      farm_id: farmId,
      ingredient_id: id,
      quantity_kg: 0,
      updated_at: now,
    })
  })
  const results = await Promise.all(jobs)
  const first = results.find((r) => r.error)
  return first?.error?.message || null
}
