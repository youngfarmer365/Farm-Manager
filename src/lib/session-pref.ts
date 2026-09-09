export const STAY_KEY = 'farm_stay_logged_in'

export function getStayLoggedIn() {
  if (typeof window === 'undefined') return true
  return localStorage.getItem(STAY_KEY) !== '0'
}

export function setStayLoggedIn(value: boolean) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STAY_KEY, value ? '1' : '0')
}

const ANIMAL_LIST_KEY = 'farm-manager-animal-list-v1'

export type SavedAnimalList = {
  filters: Record<string, unknown>
  sort: { field: string; direction: 'asc' | 'desc' }
  shedId: string
  penId: string
}

export function loadAnimalListPrefs(): SavedAnimalList | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(ANIMAL_LIST_KEY)
    if (!raw) return null
    const s = JSON.parse(raw)
    if (!s || typeof s !== 'object') return null
    return {
      filters: s.filters && typeof s.filters === 'object' ? s.filters : {},
      sort:
        s.sort && typeof s.sort.field === 'string'
          ? { field: s.sort.field, direction: s.sort.direction === 'desc' ? 'desc' : 'asc' }
          : { field: 'short_tag', direction: 'asc' },
      shedId: typeof s.shedId === 'string' ? s.shedId : '',
      penId: typeof s.penId === 'string' ? s.penId : '',
    }
  } catch {
    return null
  }
}

export function saveAnimalListPrefs(value: SavedAnimalList) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(ANIMAL_LIST_KEY, JSON.stringify(value))
  } catch {
    /* ignore */
  }
}
