export function isPhoneDevice(): boolean {
  if (typeof window === 'undefined') return false
  const ua = navigator.userAgent || ''
  if (/iPad|Tablet|PlayBook/i.test(ua)) return false
  if (/Android.+Mobile|iPhone|iPod|Windows Phone|IEMobile|webOS|BlackBerry/i.test(ua)) {
    return true
  }
  return window.matchMedia('(max-width: 700px)').matches && 'ontouchstart' in window
}
