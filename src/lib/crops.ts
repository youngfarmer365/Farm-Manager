export const CROP_COLOURS: { crop: string; color: string }[] = [
  { crop: 'Grass', color: '#15803d' },
  { crop: 'Barley', color: '#ca8a04' },
  { crop: 'Winter barley', color: '#a16207' },
  { crop: 'Wheat', color: '#d97706' },
  { crop: 'Winter wheat', color: '#b45309' },
  { crop: 'Oats', color: '#92400e' },
  { crop: 'Maize', color: '#65a30d' },
  { crop: 'Beet', color: '#be123c' },
  { crop: 'Kale / forage', color: '#166534' },
  { crop: 'Catch crop', color: '#0f766e' },
  { crop: 'Fallow', color: '#64748b' },
  { crop: 'Other', color: '#334155' },
]

export const JOB_TYPES = [
  { id: 'spray', label: 'Spray' },
  { id: 'fertiliser', label: 'Fertiliser' },
  { id: 'slurry', label: 'Slurry / FYM' },
  { id: 'lime', label: 'Lime' },
  { id: 'cultivation', label: 'Cultivation' },
  { id: 'sowing', label: 'Sowing' },
  { id: 'harvest', label: 'Harvest' },
  { id: 'fencing', label: 'Fencing' },
  { id: 'other', label: 'Other' },
] as const

export function colourForCrop(crop: string | null | undefined) {
  if (!crop) return '#15803d'
  const hit = CROP_COLOURS.find((c) => c.crop.toLowerCase() === crop.toLowerCase())
  return hit?.color || '#15803d'
}

export function currentYear() {
  return new Date().getFullYear()
}

export function yearOptions(extra: number[] = []) {
  const y = currentYear()
  const set = new Set<number>([y + 1, y, y - 1, y - 2, y - 3, y - 4, y - 5, ...extra])
  return [...set].sort((a, b) => b - a)
}
