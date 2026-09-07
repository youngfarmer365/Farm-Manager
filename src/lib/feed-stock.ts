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
