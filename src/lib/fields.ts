import { createClient } from '@/lib/supabase/client'

export type FarmFieldRow = {
  id: string
  name: string
  area_ha: number | null
  color?: string | null
  current_crop?: string | null
  geojson: unknown
}

export async function loadFarmFields(farmId: string): Promise<{
  data: FarmFieldRow[]
  error: string | null
}> {
  const supabase = createClient()
  const full = await supabase
    .from('farm_fields')
    .select('id, name, area_ha, color, current_crop, geojson')
    .eq('farm_id', farmId)
    .order('name')
  if (!full.error) {
    return { data: (full.data as FarmFieldRow[]) || [], error: null }
  }

  const fallback = await supabase
    .from('farm_fields')
    .select('id, name, area_ha, geojson')
    .eq('farm_id', farmId)
    .order('name')
  if (fallback.error) {
    return { data: [], error: fallback.error.message }
  }
  return {
    data: ((fallback.data || []) as FarmFieldRow[]).map((f) => ({
      ...f,
      color: '#15803d',
      current_crop: null,
    })),
    error: null,
  }
}
