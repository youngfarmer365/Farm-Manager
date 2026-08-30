/** Irish paddock cover traffic lights (kg DM/ha). Tune on the grass page. */
export function grassBand(dm: number, low = 1500, ready = 2500) {
  if (dm < low) return { label: 'Low / residual', color: 'red' as const }
  if (dm < ready) return { label: 'Building', color: 'amber' as const }
  return { label: 'Ready to graze', color: 'green' as const }
}

export function grassClasses(color: 'red' | 'amber' | 'green') {
  if (color === 'red')
    return 'border-red-800 bg-red-600 text-white'
  if (color === 'amber')
    return 'border-amber-800 bg-amber-500 text-black'
  return 'border-green-900 bg-green-700 text-white'
}
