export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type MemberRole = 'owner' | 'manager' | 'worker' | 'viewer' | 'basic' | 'advanced'
export type AnimalStatus = 'active' | 'sold' | 'dead' | 'transferred'
export type AnimalSex = 'male' | 'female' | 'steer' | 'heifer' | 'bull' | 'cow' | 'unknown'
export type GroupType = 'grazing' | 'finishing' | 'custom'

export interface Farm {
  id: string
  name: string
  location: string | null
  timezone: string
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  email: string | null
  full_name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface FarmMember {
  id: string
  farm_id: string
  user_id: string
  role: MemberRole
  created_at: string
}

export interface Pen {
  id: string
  farm_id: string
  name: string
  type?: string | null
  description: string | null
  capacity: number | null
  area_ha: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Group {
  id: string
  farm_id: string
  name: string
  type: GroupType | string
  description: string | null
  color: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Animal {
  id: string
  farm_id: string
  tag: string
  eid: string | null
  breed: string | null
  sex: AnimalSex
  date_of_birth: string | null
  purchase_date: string
  purchase_weight_kg: number | null
  purchase_price: number | null
  source: string | null
  entry_date: string
  exit_date: string | null
  status: AnimalStatus
  pen_id: string | null
  group_id: string | null
  notes: string | null
  photo_url: string | null
  expected_finish_weight_kg: number | null
  herd_id: string | null
  sale_date: string | null
  sale_price: number | null
  dead_weight_kg: number | null
  kill_out_percent: number | null
  slaughter_grade: string | null
  sale_notes: string | null
  is_flagged?: boolean
  created_at: string
  updated_at: string
  created_by: string | null
}

export interface Weight {
  id: string
  animal_id: string
  weight_kg: number
  weighed_at: string
  notes: string | null
  recorded_by: string | null
  created_at: string
}

export interface AnimalEnriched extends Animal {
  pen_name: string | null
  group_name: string | null
  group_type: string | null
  group_color: string | null
  herd_number: string | null
  herd_label: string | null
  latest_weight_kg: number | null
  latest_weigh_date: string | null
  days_on_farm: number
  age_days: number | null
  adg_kg_per_day: number | null
}

export interface Herd {
  id: string
  farm_id: string
  herd_number: string
  name: string | null
  is_active: boolean
  created_at: string
}

// Filter / sort types used by the UI
export interface AnimalFilters {
  status?: AnimalStatus[]
  group_ids?: string[]
  pen_ids?: string[]
  sex?: AnimalSex[]
  min_days_on_farm?: number
  max_days_on_farm?: number
  min_age_days?: number
  max_age_days?: number
  purchase_date_from?: string
  purchase_date_to?: string
  exit_date_from?: string
  exit_date_to?: string
  search?: string // tag / eid / breed
  min_adg?: number
  max_adg?: number
  min_weight?: number
  max_weight?: number
  herd_ids?: string[]
  sale_date_from?: string
  sale_date_to?: string
  min_age_months?: number
  max_age_months?: number
  in_withdrawal?: boolean
  is_flagged?: boolean
}

export type AnimalSortField =
  | 'tag'
  | 'purchase_date'
  | 'entry_date'
  | 'exit_date'
  | 'days_on_farm'
  | 'age_days'
  | 'latest_weight_kg'
  | 'adg_kg_per_day'
  | 'purchase_weight_kg'
  | 'purchase_price'
  | 'group_name'
  | 'pen_name'

export interface AnimalSort {
  field: AnimalSortField
  direction: 'asc' | 'desc'
}