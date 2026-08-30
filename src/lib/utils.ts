import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { differenceInDays, parseISO, format } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatWeight(kg: number | null | undefined): string {
  if (kg == null) return '—'
  return `${kg.toFixed(1)} kg`
}

export function formatADG(adg: number | null | undefined): string {
  if (adg == null) return '—'
  return `${adg.toFixed(3)} kg/d`
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '—'
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return '—'
  try {
    return format(parseISO(date), 'dd MMM yyyy')
  } catch {
    return date
  }
}

export function calcDaysOnFarm(entryDate: string, exitDate?: string | null): number {
  const end = exitDate ? parseISO(exitDate) : new Date()
  return differenceInDays(end, parseISO(entryDate))
}

export function calcAgeDays(dob: string | null): number | null {
  if (!dob) return null
  return differenceInDays(new Date(), parseISO(dob))
}

export function calcADG(
  purchaseWeight: number | null,
  latestWeight: number | null,
  purchaseDate: string,
  latestWeighDate: string | null
): number | null {
  if (
    purchaseWeight == null ||
    latestWeight == null ||
    !latestWeighDate ||
    purchaseWeight <= 0
  )
    return null

  const days = differenceInDays(parseISO(latestWeighDate), parseISO(purchaseDate))
  if (days <= 0) return null
  return Number(((latestWeight - purchaseWeight) / days).toFixed(3))
}
