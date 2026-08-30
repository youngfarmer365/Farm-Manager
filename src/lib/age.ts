/** Exact age from date of birth to a reference date (default: today). */
export function exactAge(
  dateOfBirth: string | null | undefined,
  asOf: Date = new Date()
): { months: number; days: number; label: string } | null {
  if (!dateOfBirth) return null

  const dob = new Date(dateOfBirth + 'T00:00:00')
  if (Number.isNaN(dob.getTime())) return null

  const end = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate())

  if (end < dob) return { months: 0, days: 0, label: '0m 0d' }

  let months =
    (end.getFullYear() - dob.getFullYear()) * 12 + (end.getMonth() - dob.getMonth())

  // If we haven't reached the birth day-of-month yet, the current month isn't complete
  if (end.getDate() < dob.getDate()) {
    months -= 1
  }

  if (months < 0) months = 0

  // Days since the last completed-month anniversary
  const anchor = new Date(dob)
  anchor.setMonth(dob.getMonth() + months)
  const ms = end.getTime() - anchor.getTime()
  const days = Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)))

  return {
    months,
    days,
    label: `${months}m ${days}d`,
  }
}

/** Cut-off DOB: animals born on or before this date are at least `months` months old. */
export function dobOnOrBeforeMonthsAgo(months: number, asOf: Date = new Date()): string {
  const d = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate())
  d.setMonth(d.getMonth() - months)
  return d.toISOString().slice(0, 10)
}