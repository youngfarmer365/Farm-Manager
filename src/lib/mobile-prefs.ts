const KEY = 'fm_mobile_prefs'

export type MobilePrefs = {
  largeText: boolean
  highContrast: boolean
}

const defaults: MobilePrefs = { largeText: false, highContrast: false }

export function readMobilePrefs(): MobilePrefs {
  if (typeof window === 'undefined') return defaults
  try {
    return { ...defaults, ...JSON.parse(window.localStorage.getItem(KEY) || '{}') }
  } catch {
    return defaults
  }
}

export function writeMobilePrefs(next: MobilePrefs) {
  window.localStorage.setItem(KEY, JSON.stringify(next))
  applyMobilePrefs(next)
}

export function applyMobilePrefs(p: MobilePrefs = readMobilePrefs()) {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('fm-large', p.largeText)
  document.documentElement.classList.toggle('fm-contrast', p.highContrast)
}
