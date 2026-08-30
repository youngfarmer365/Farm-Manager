import * as XLSX from 'xlsx'
import type { AnimalSex } from '@/types/database'

export interface ParsedAnimalRow {
  tag: string
  eid?: string
  breed?: string
  sex?: AnimalSex
  date_of_birth?: string
  purchase_date: string
  purchase_weight_kg?: number
  purchase_price?: number
  source?: string
  group_name?: string
  pen_name?: string
}

const TAG_KEYS = ['tag', 'visual id', 'nlis', 'id', 'visual_id', 'animal id']
const EID_KEYS = ['eid', 'electronic id', 'electronic_id', 'rfid']
const BREED_KEYS = ['breed']
const SEX_KEYS = ['sex', 'gender']
const DOB_KEYS = ['dob', 'date of birth', 'date_of_birth', 'birth date']
const PURCHASE_DATE_KEYS = ['purchase date', 'purchase_date', 'sale date', 'date']
const WEIGHT_KEYS = ['purchase weight', 'purchase_weight', 'weight', 'weight kg', 'liveweight']
const PRICE_KEYS = ['purchase price', 'purchase_price', 'price', 'cost', 'value']
const SOURCE_KEYS = ['source', 'vendor', 'market', 'seller']
const GROUP_KEYS = ['group', 'lot', 'mob']
const PEN_KEYS = ['pen', 'paddock', 'field', 'location']

function findKey(row: Record<string, any>, candidates: string[]): string | null {
  const keys = Object.keys(row).map((k) => k.toLowerCase().trim())
  for (const c of candidates) {
    const idx = keys.indexOf(c)
    if (idx !== -1) return Object.keys(row)[idx]
  }
  return null
}

function parseDate(val: any): string | undefined {
  if (!val) return undefined
  if (val instanceof Date) return val.toISOString().slice(0, 10)
  const s = String(val).trim()
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  // DD/MM/YYYY or DD-MM-YYYY
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (m) {
    const [, d, mo, y] = m
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  // Excel serial
  if (typeof val === 'number') {
    const date = XLSX.SSF.parse_date_code(val)
    if (date) {
      return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`
    }
  }
  return undefined
}

function parseSex(val: any): AnimalSex | undefined {
  if (!val) return undefined
  const s = String(val).toLowerCase().trim()
  if (['steer', 'st'].includes(s)) return 'steer'
  if (['heifer', 'hfr'].includes(s)) return 'heifer'
  if (['bull', 'b'].includes(s)) return 'bull'
  if (['cow', 'c'].includes(s)) return 'cow'
  if (['male', 'm'].includes(s)) return 'male'
  if (['female', 'f'].includes(s)) return 'female'
  return 'unknown'
}

export function parseXlsFile(buffer: ArrayBuffer): ParsedAnimalRow[] {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: null })

  if (rows.length === 0) return []

  const sample = rows[0]
  const tagKey = findKey(sample, TAG_KEYS)
  if (!tagKey) throw new Error('Could not find a Tag / NLIS / Visual ID column')

  const eidKey = findKey(sample, EID_KEYS)
  const breedKey = findKey(sample, BREED_KEYS)
  const sexKey = findKey(sample, SEX_KEYS)
  const dobKey = findKey(sample, DOB_KEYS)
  const purchaseDateKey = findKey(sample, PURCHASE_DATE_KEYS)
  const weightKey = findKey(sample, WEIGHT_KEYS)
  const priceKey = findKey(sample, PRICE_KEYS)
  const sourceKey = findKey(sample, SOURCE_KEYS)
  const groupKey = findKey(sample, GROUP_KEYS)
  const penKey = findKey(sample, PEN_KEYS)

  return rows
    .map((row) => {
      const tag = String(row[tagKey!] ?? '').trim()
      if (!tag) return null

      const purchase_date =
        (purchaseDateKey && parseDate(row[purchaseDateKey])) ||
        new Date().toISOString().slice(0, 10)

      return {
        tag,
        eid: eidKey ? String(row[eidKey] ?? '').trim() || undefined : undefined,
        breed: breedKey ? String(row[breedKey] ?? '').trim() || undefined : undefined,
        sex: sexKey ? parseSex(row[sexKey]) : undefined,
        date_of_birth: dobKey ? parseDate(row[dobKey]) : undefined,
        purchase_date,
        purchase_weight_kg: weightKey && row[weightKey] != null ? Number(row[weightKey]) : undefined,
        purchase_price: priceKey && row[priceKey] != null ? Number(row[priceKey]) : undefined,
        source: sourceKey ? String(row[sourceKey] ?? '').trim() || undefined : undefined,
        group_name: groupKey ? String(row[groupKey] ?? '').trim() || undefined : undefined,
        pen_name: penKey ? String(row[penKey] ?? '').trim() || undefined : undefined,
      } as ParsedAnimalRow
    })
    .filter(Boolean) as ParsedAnimalRow[]
}
