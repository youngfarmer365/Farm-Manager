const KEY = 'fm_feed_run_draft'

export type RunDraft = {
  savedAt: string
  note: string
  payload: Record<string, unknown>
}

export function saveRunDraft(note: string, payload: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(KEY, JSON.stringify({ savedAt: new Date().toISOString(), note, payload } satisfies RunDraft))
}

export function readRunDraft(): RunDraft | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as RunDraft) : null
  } catch {
    return null
  }
}

export function clearRunDraft() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(KEY)
}
