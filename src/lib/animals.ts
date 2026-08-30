import { createClient } from '@/lib/supabase/server'
import type { AnimalEnriched, AnimalFilters, AnimalSort } from '@/types/database'

export async function getAnimals(
  farmId: string,
  filters: AnimalFilters = {},
  sort: AnimalSort = { field: 'tag', direction: 'asc' },
  page = 1,
  pageSize = 50
): Promise<{ data: AnimalEnriched[]; count: number }> {
  const supabase = await createClient()

  // Start from the enriched view
  let query = supabase
    .from('animals_enriched')
    .select('*', { count: 'exact' })
    .eq('farm_id', farmId)

  // Status filter
  if (filters.status?.length) {
    query = query.in('status', filters.status)
  } else {
    // default to active only unless specified
    query = query.eq('status', 'active')
  }

  // Groups
  if (filters.group_ids?.length) {
    query = query.in('group_id', filters.group_ids)
  }

  // Pens
  if (filters.pen_ids?.length) {
    query = query.in('pen_id', filters.pen_ids)
  }

  // Sex
  if (filters.sex?.length) {
    query = query.in('sex', filters.sex)
  }

  // Days on farm
  if (filters.min_days_on_farm != null) {
    query = query.gte('days_on_farm', filters.min_days_on_farm)
  }
  if (filters.max_days_on_farm != null) {
    query = query.lte('days_on_farm', filters.max_days_on_farm)
  }

  // Age
  if (filters.min_age_days != null) {
    query = query.gte('age_days', filters.min_age_days)
  }
  if (filters.max_age_days != null) {
    query = query.lte('age_days', filters.max_age_days)
  }

  // Purchase date range
  if (filters.purchase_date_from) {
    query = query.gte('purchase_date', filters.purchase_date_from)
  }
  if (filters.purchase_date_to) {
    query = query.lte('purchase_date', filters.purchase_date_to)
  }

  // Exit date range
  if (filters.exit_date_from) {
    query = query.gte('exit_date', filters.exit_date_from)
  }
  if (filters.exit_date_to) {
    query = query.lte('exit_date', filters.exit_date_to)
  }

  // ADG
  if (filters.min_adg != null) {
    query = query.gte('adg_kg_per_day', filters.min_adg)
  }
  if (filters.max_adg != null) {
    query = query.lte('adg_kg_per_day', filters.max_adg)
  }

  // Weight
  if (filters.min_weight != null) {
    query = query.gte('latest_weight_kg', filters.min_weight)
  }
  if (filters.max_weight != null) {
    query = query.lte('latest_weight_kg', filters.max_weight)
  }

  // Text search (tag, eid, breed)
  if (filters.search) {
    const term = `%${filters.search}%`
    query = query.or(`tag.ilike.${term},eid.ilike.${term},breed.ilike.${term}`)
  }

  // Sorting
  const ascending = sort.direction === 'asc'
  query = query.order(sort.field, { ascending, nullsFirst: false })

  // Pagination
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to)

  const { data, error, count } = await query

  if (error) {
    console.error('getAnimals error:', error)
    throw error
  }

  return { data: (data as AnimalEnriched[]) || [], count: count || 0 }
}

export async function getAnimalById(id: string): Promise<AnimalEnriched | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('animals_enriched')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return null
  return data as AnimalEnriched
}

export async function getAnimalWeights(animalId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('weights')
    .select('*')
    .eq('animal_id', animalId)
    .order('weighed_at', { ascending: true })

  if (error) throw error
  return data
}
