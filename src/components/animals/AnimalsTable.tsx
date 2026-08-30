'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { AnimalEnriched, AnimalSort, AnimalSortField } from '@/types/database'
import { formatWeight, formatADG, formatDate, formatCurrency } from '@/lib/utils'

interface Props {
  animals: AnimalEnriched[]
  sort: AnimalSort
  onSort: (field: AnimalSortField) => void
  selected?: Set<string>
  onToggleSelect?: (id: string) => void
  onToggleSelectAll?: () => void
  onToggleFlag?: (id: string, current: boolean) => void
  filterSummary?: string
  withdrawalByAnimal?: Record<string, number>
}

type ColumnId =
  | 'short_tag'
  | 'tag'
  | 'group_name'
  | 'pen_name'
  | 'herd_number'
  | 'purchase_from'
  | 'purchase_date'
  | 'days_on_farm'
  | 'age_months'
  | 'purchase_weight_kg'
  | 'latest_weight_kg'
  | 'adg_kg_per_day'
  | 'purchase_price'
  | 'sale_weight_kg'
  | 'sale_price'
  | 'status'
  | 'withdrawal_days'
  | 'margin_per_day'

interface ColumnDef {
  id: ColumnId
  label: string
  sortField?: AnimalSortField
  defaultVisible: boolean
  footer?: 'sum' | 'avg' | 'both' | 'none'
}

const ALL_COLUMNS: ColumnDef[] = [
  { id: 'short_tag', label: 'Short tag', defaultVisible: true, footer: 'none' },
  { id: 'tag', label: 'Full tag', sortField: 'tag', defaultVisible: false, footer: 'none' },
  { id: 'group_name', label: 'Group', sortField: 'group_name', defaultVisible: true, footer: 'none' },
  { id: 'pen_name', label: 'Pen', sortField: 'pen_name', defaultVisible: true, footer: 'none' },
  { id: 'herd_number', label: 'Herd', defaultVisible: true, footer: 'none' },
  { id: 'purchase_from', label: 'Purchase from', defaultVisible: false, footer: 'none' },
  { id: 'purchase_date', label: 'Purchased', sortField: 'purchase_date', defaultVisible: true, footer: 'none' },
  { id: 'days_on_farm', label: 'Days', sortField: 'days_on_farm', defaultVisible: true, footer: 'both' },
  { id: 'age_months', label: 'Age (m)', defaultVisible: true, footer: 'avg' },
  { id: 'purchase_weight_kg', label: 'Purch wt', sortField: 'purchase_weight_kg', defaultVisible: true, footer: 'both' },
  { id: 'latest_weight_kg', label: 'Last wt', sortField: 'latest_weight_kg', defaultVisible: true, footer: 'both' },
  { id: 'adg_kg_per_day', label: 'ADG', sortField: 'adg_kg_per_day', defaultVisible: true, footer: 'avg' },
  { id: 'purchase_price', label: 'Purch €', sortField: 'purchase_price', defaultVisible: true, footer: 'both' },
  { id: 'sale_weight_kg', label: 'Sale wt', defaultVisible: false, footer: 'both' },
  { id: 'sale_price', label: 'Sale €', defaultVisible: false, footer: 'both' },
  { id: 'margin_per_day', label: '€/day', defaultVisible: false, footer: 'avg' },
  { id: 'withdrawal_days', label: 'W/d days', defaultVisible: true, footer: 'none' },
  { id: 'status', label: 'Status', defaultVisible: true, footer: 'none' },
]

const STORAGE_KEY = 'farm-manager-animal-columns-v2'

function shortTag(tag: string) {
  const c = (tag || '').replace(/\s/g, '')
  return c.length <= 5 ? c : c.slice(-5)
}

function ageMonthsFromAnimal(a: AnimalEnriched): number | null {
  const anyA = a as any
  if (anyA.age_months != null && !Number.isNaN(Number(anyA.age_months))) {
    return Number(anyA.age_months)
  }
  if (a.age_days != null) return Math.floor(Number(a.age_days) / 30.4375)
  return null
}

function marginPerDay(a: AnimalEnriched): number | null {
  const sale = Number((a as any).sale_price)
  const purch = Number(a.purchase_price)
  const days = Number(a.days_on_farm)
  if (!sale || !purch || !days || days <= 0) return null
  return (sale - purch) / days
}

export function AnimalsTable({
  animals,
  sort,
  onSort,
  selected,
  onToggleSelect,
  onToggleSelectAll,
  onToggleFlag,
  filterSummary,
  withdrawalByAnimal = {},
}: Props) {
  const router = useRouter()
  const [visible, setVisible] = useState<Record<string, boolean>>({})
  const [showCols, setShowCols] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setVisible(JSON.parse(raw))
      else {
        const init: Record<string, boolean> = {}
        ALL_COLUMNS.forEach((c) => {
          init[c.id] = c.defaultVisible
        })
        setVisible(init)
      }
    } catch {
      const init: Record<string, boolean> = {}
      ALL_COLUMNS.forEach((c) => {
        init[c.id] = c.defaultVisible
      })
      setVisible(init)
    }
  }, [])

  function persist(next: Record<string, boolean>) {
    setVisible(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }

  const columns = useMemo(
    () => ALL_COLUMNS.filter((c) => visible[c.id] !== false),
    [visible]
  )

  const allSelected = animals.length > 0 && selected && selected.size === animals.length

  function valuesForColumn(id: ColumnId): number[] {
    return animals
      .map((a) => {
        switch (id) {
          case 'days_on_farm':
            return Number(a.days_on_farm)
          case 'age_months': {
            const m = ageMonthsFromAnimal(a)
            return m == null ? NaN : m
          }
          case 'purchase_weight_kg':
            return Number(a.purchase_weight_kg)
          case 'latest_weight_kg':
            return Number(a.latest_weight_kg)
          case 'adg_kg_per_day':
            return Number(a.adg_kg_per_day)
          case 'purchase_price':
            return Number(a.purchase_price)
          case 'sale_weight_kg':
            return Number((a as any).sale_weight_kg ?? (a as any).dead_weight_kg)
          case 'sale_price':
            return Number((a as any).sale_price)
          case 'margin_per_day': {
            const m = marginPerDay(a)
            return m == null ? NaN : m
          }
          default:
            return NaN
        }
      })
      .filter((n) => !Number.isNaN(n) && n != null)
  }

  function sum(vals: number[]) {
    return vals.reduce((s, n) => s + n, 0)
  }

  function avg(vals: number[]) {
    return vals.length ? sum(vals) / vals.length : null
  }

  function formatFooterValue(id: ColumnId, n: number | null) {
    if (n == null || Number.isNaN(n)) return ''
    if (id.includes('price') || id === 'margin_per_day') return formatCurrency(n)
    if (id.includes('weight') || id === 'adg_kg_per_day') return n.toFixed(1)
    if (id === 'age_months') return n.toFixed(1)
    return n.toFixed(0)
  }

  function cellValue(a: AnimalEnriched, id: ColumnId) {
    const anyA = a as any
    switch (id) {
      case 'short_tag':
        return (
          <div className="flex items-center gap-1">
            <span
              className={`font-mono font-semibold ${
                a.is_flagged ? 'text-red-600' : 'text-brand-700'
              }`}
            >
              {shortTag(a.tag)}
            </span>
            {onToggleFlag && (
              <button
                type="button"
                title={a.is_flagged ? 'Unflag' : 'Flag'}
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleFlag(a.id, !!a.is_flagged)
                }}
                className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg leading-none ${
                  a.is_flagged
                    ? 'bg-red-50 text-red-600 hover:bg-red-100'
                    : 'text-slate-400 hover:bg-slate-100 hover:text-red-500'
                }`}
              >
                {a.is_flagged ? '⚑' : '⚐'}
              </button>
            )}
          </div>
        )
      case 'tag':
        return <span className="font-mono text-xs text-slate-600">{a.tag}</span>
      case 'group_name':
        return a.group_name || '—'
      case 'pen_name':
        return a.pen_name || '—'
      case 'herd_number':
        return anyA.herd_number || '—'
      case 'purchase_from':
        return anyA.source || anyA.purchase_from || '—'
      case 'purchase_date':
        return formatDate(a.purchase_date)
      case 'days_on_farm':
        return a.days_on_farm ?? '—'
      case 'age_months': {
        const m = ageMonthsFromAnimal(a)
        return m == null ? '—' : m.toFixed(1)
      }
      case 'purchase_weight_kg':
        return formatWeight(a.purchase_weight_kg)
      case 'latest_weight_kg':
        return formatWeight(a.latest_weight_kg)
      case 'adg_kg_per_day':
        return (
          <span className="font-medium text-brand-800">{formatADG(a.adg_kg_per_day)}</span>
        )
      case 'purchase_price':
        return formatCurrency(a.purchase_price)
      case 'sale_weight_kg':
        return formatWeight(anyA.sale_weight_kg ?? anyA.dead_weight_kg)
      case 'sale_price':
        return formatCurrency(anyA.sale_price)
      case 'margin_per_day': {
        const m = marginPerDay(a)
        return m == null ? '—' : formatCurrency(m)
      }
      case 'withdrawal_days': {
        const d = withdrawalByAnimal[a.id]
        if (d == null || d <= 0) return '—'
        return <span className="font-medium text-amber-800">{d}</span>
      }
      case 'status':
        return (
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
              a.status === 'active'
                ? 'bg-brand-100 text-brand-800'
                : a.status === 'sold'
                ? 'bg-sky-100 text-sky-800'
                : a.status === 'dead'
                ? 'bg-red-100 text-red-800'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            {a.status}
          </span>
        )
      default:
        return '—'
    }
  }

  const firstColId = columns[0]?.id

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <p className="text-xs text-slate-500">{filterSummary || ''}</p>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowCols((s) => !s)}
            className="rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-800 hover:border-brand-300 hover:bg-brand-100"
          >
            Columns
          </button>
          {showCols && (
            <div className="absolute right-0 z-20 mt-1 max-h-64 w-52 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
              {ALL_COLUMNS.map((c) => (
                <label
                  key={c.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={visible[c.id] !== false}
                    onChange={(e) => persist({ ...visible, [c.id]: e.target.checked })}
                    className="rounded border-slate-300"
                  />
                  {c.label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm print:shadow-none">
        <table className="min-w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="w-8 px-2 py-2.5 print:hidden">
                {onToggleSelectAll && (
                  <input
                    type="checkbox"
                    checked={!!allSelected}
                    onChange={onToggleSelectAll}
                    className="rounded border-slate-300"
                  />
                )}
              </th>
              {columns.map((col) => (
                <th
                  key={col.id}
                  className={`whitespace-nowrap px-2 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 ${
                    col.sortField ? 'cursor-pointer select-none hover:bg-slate-100 hover:text-slate-700' : ''
                  }`}
                  onClick={() => col.sortField && onSort(col.sortField)}
                >
                  {col.label}
                  {col.sortField && sort.field === col.sortField && (
                    <span className="ml-0.5 text-brand-700">
                      {sort.direction === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {animals.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="px-3 py-12 text-center text-sm text-slate-500"
                >
                  No animals match the current filters
                </td>
              </tr>
            ) : (
              animals.map((a) => {
                const wd = withdrawalByAnimal[a.id]
                const inWd = wd != null && wd > 0
                return (
                  <tr
                    key={a.id}
                    role="link"
                    tabIndex={0}
                    onClick={() => router.push(`/animals/${a.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        router.push(`/animals/${a.id}`)
                      }
                    }}
                    className={`cursor-pointer transition-colors hover:bg-slate-50 ${
                      inWd ? 'bg-amber-50' : a.is_flagged ? 'bg-red-50/60' : ''
                    }`}
                  >
                    <td
                      className="px-2 py-1.5 print:hidden"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {onToggleSelect && (
                        <input
                          type="checkbox"
                          checked={selected?.has(a.id) || false}
                          onChange={() => onToggleSelect(a.id)}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                      )}
                    </td>
                    {columns.map((col) => (
                      <td key={col.id} className="whitespace-nowrap px-2 py-1.5 text-slate-800">
                        {cellValue(a, col.id)}
                      </td>
                    ))}
                  </tr>
                )
              })
            )}
          </tbody>
          {animals.length > 0 && (
            <tfoot className="border-t-2 border-slate-200 bg-slate-50 text-xs font-medium">
              <tr>
                <td className="print:hidden" />
                {columns.map((col) => {
                  const mode = col.footer || 'none'
                  const show = mode === 'sum' || mode === 'both'
                  const values = valuesForColumn(col.id)
                  const total = show ? sum(values) : null
                  return (
                    <td key={`t-${col.id}`} className="whitespace-nowrap px-2 py-1.5">
                      {col.id === firstColId && !show ? (
                        <span className="text-slate-600">Total</span>
                      ) : show ? (
                        formatFooterValue(col.id, total)
                      ) : (
                        ''
                      )}
                    </td>
                  )
                })}
              </tr>
              <tr>
                <td className="print:hidden" />
                {columns.map((col) => {
                  const mode = col.footer || 'none'
                  const show = mode === 'avg' || mode === 'both'
                  const values = valuesForColumn(col.id)
                  const average = show ? avg(values) : null
                  return (
                    <td key={`a-${col.id}`} className="whitespace-nowrap px-2 py-1.5">
                      {col.id === firstColId && !show ? (
                        <span className="text-slate-600">Average</span>
                      ) : show ? (
                        formatFooterValue(col.id, average)
                      ) : (
                        ''
                      )}
                    </td>
                  )
                })}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}