export const STAY_KEY = 'farm_stay_logged_in'

export function getStayLoggedIn() {
  if (typeof window === 'undefined') return true
  return localStorage.getItem(STAY_KEY) !== '0'
}

export function setStayLoggedIn(value: boolean) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STAY_KEY, value ? '1' : '0')
}
