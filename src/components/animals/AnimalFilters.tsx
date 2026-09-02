'use client'

import { useState } from 'react'
import type { AnimalFilters, Group, Pen } from '@/types/database'
import { groupPensByShed, housingPens } from '@/lib/pens'

interface Herd {
  id: string
  herd_number: string
  name: string | null
}

interface Props {
  groups: Group[]
  pens: Pen[]
  herds: Herd[]
  initialFilters?: AnimalFilters
  onApply: (filters: AnimalFilters) => void
}

const section =
  'rounded-xl border-2 border-slate-300 bg-slate-100 p-3 space-y-2'
const sectionTitle =
  'text-sm font-bold text-slate-900 border-b-2 border-slate-300 pb-1.5 mb-1'
const label = 'block text-sm font-bold text-slate-800 mb-1'
const input =
  'w-full min-h-[44px] rounded-lg border-2 border-slate-400 bg-white px-3 py-2.5 text-base text-slate-900 placeholder:text-slate-500 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500'
const select =
  'w-full min-h-[48px] rounded-lg border-2 border-slate-400 bg-white px-3 py-2 text-base text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500'
const chipOff =
  'min-h-[44px] rounded-lg border-2 border-slate-400 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50'
const chipOn =
  'min-h-[44px] rounded-lg border-2 border-brand-800 bg-brand-700 px-3 py-2 text-sm font-semibold text-white'
const chipAmberOn =
  'min-h-[44px] rounded-lg border-2 border-amber-800 bg-amber-600 px-3 py-2 text-sm font-semibold text-white'

export function AnimalFiltersPanel({
  groups,
  pens,
  herds = [],
  initialFilters = {},
  onApply,
}: Props) {
  const [filters, setFilters] = useState<AnimalFilters>(initialFilters)

  function update(key: keyof AnimalFilters, value: any) {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  function toggleArray(
    key: 'group_ids' | 'pen_ids' | 'herd_ids' | 'status' | 'sex',
    id: string
  ) {
    setFilters((prev) => {
      const arr = (prev[key] as string[] | undefined) || []
      const next = arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]
      return { ...prev, [key]: next.length ? next : undefined }
    })
  }

  function onGroupsSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const selected = Array.from(e.target.selectedOptions).map((o) => o.value)
    update('group_ids', selected.length ? selected : undefined)
  }

  function apply() {
    onApply(filters)
  }

  function clearAll() {
    setFilters({})
    onApply({})
  }

  return (
    <div className="space-y-4 rounded-xl border-2 border-slate-400 bg-white p-3 shadow-md">
      <h3 className="text-lg font-bold text-slate-900">Filters</h3>

      {/* Apply / Clear at top — always visible */}
      <div className="sticky top-0 z-10 -mx-1 space-y-2 rounded-xl border-2 border-brand-800 bg-brand-50 p-2">
        <button
          type="button"
          onClick={apply}
          className="min-h-[52px] w-full rounded-xl border-2 border-brand-900 bg-brand-700 text-base font-bold text-white hover:bg-brand-800"
        >
          Apply filters
        </button>
        <button
          type="button"
          onClick={clearAll}
          className="min-h-[48px] w-full rounded-xl border-2 border-slate-500 bg-slate-200 text-base font-bold text-slate-900 hover:bg-slate-300"
        >
          Clear all
        </button>
      </div>

      {/* Search */}
      <div className={section}>
        <p className={sectionTitle}>Search</p>
        <label className={label} htmlFor="filter-search">
          Tag / EID / breed
        </label>
        <input
          id="filter-search"
          type="text"
          className={input}
          value={filters.search || ''}
          onChange={(e) => update('search', e.target.value || undefined)}
          placeholder="e.g. 1234 or Angus"
        />
      </div>

      {/* Quick */}
      <div className={section}>
        <p className={sectionTitle}>Quick filters</p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() =>
              update('in_withdrawal', filters.in_withdrawal ? undefined : true)
            }
            className={filters.in_withdrawal ? chipAmberOn : chipOff}
          >
            {filters.in_withdrawal ? '✓ ' : ''}In withdrawal only
          </button>
          <button
            type="button"
            onClick={() =>
              update('is_flagged', filters.is_flagged ? undefined : true)
            }
            className={filters.is_flagged ? chipOn : chipOff}
          >
            {filters.is_flagged ? '✓ ' : ''}Flagged only
          </button>
        </div>
      </div>

      {/* Groups */}
      {groups.length > 0 && (
        <div className={section}>
          <p className={sectionTitle}>Groups</p>
          <label className={label} htmlFor="filter-groups">
            Hold Ctrl (or Cmd) to select more than one
          </label>
          <select
            id="filter-groups"
            multiple
            size={Math.min(6, Math.max(3, groups.length))}
            className={select}
            value={filters.group_ids || []}
            onChange={onGroupsSelectChange}
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id} className="py-1 text-base">
                {g.name}
              </option>
            ))}
          </select>
          {filters.group_ids && filters.group_ids.length > 0 && (
            <p className="text-sm font-semibold text-brand-800">
              {filters.group_ids.length} group(s) selected
            </p>
          )}
        </div>
      )}

      {/* Herds */}
      {herds.length > 0 && (
        <div className={section}>
          <p className={sectionTitle}>Herd numbers</p>
          <div className="flex flex-col gap-2">
            {herds.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => toggleArray('herd_ids', h.id)}
                className={
                  filters.herd_ids?.includes(h.id) ? chipOn : chipOff
                }
              >
                {filters.herd_ids?.includes(h.id) ? '✓ ' : ''}
                {h.herd_number}
                {h.name ? ` — ${h.name}` : ''}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Pens */}
      {housingPens(pens).length > 0 && (
        <div className={section}>
          <p className={sectionTitle}>Pens</p>
          <p className="text-xs font-semibold text-slate-600">Tap a shed to select every pen in it.</p>
          {groupPensByShed(pens).grouped.map(({ shed, pens: inShed }) => {
            if (inShed.length === 0) return null
            const ids = inShed.map((p) => p.id)
            const allOn = ids.every((id) => filters.pen_ids?.includes(id))
            return (
              <div key={shed.id} className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setFilters((prev) => {
                      const cur = new Set(prev.pen_ids || [])
                      if (allOn) ids.forEach((id) => cur.delete(id))
                      else ids.forEach((id) => cur.add(id))
                      const next = Array.from(cur)
                      return { ...prev, pen_ids: next.length ? next : undefined }
                    })
                  }}
                  className={allOn ? chipOn + ' w-full text-left' : chipOff + ' w-full text-left'}
                >
                  {allOn ? '✓ ' : ''}
                  {shed.name}
                </button>
                <div className="pl-3 flex flex-col gap-1">
                  {inShed.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleArray('pen_ids', p.id)}
                      className={filters.pen_ids?.includes(p.id) ? chipOn : chipOff}
                    >
                      {filters.pen_ids?.includes(p.id) ? '✓ ' : ''}
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
          {groupPensByShed(pens).ungrouped.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-600">No shed</p>
              {groupPensByShed(pens).ungrouped.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleArray('pen_ids', p.id)}
                  className={filters.pen_ids?.includes(p.id) ? chipOn : chipOff}
                >
                  {filters.pen_ids?.includes(p.id) ? '✓ ' : ''}
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Status */}
      <div className={section}>
        <p className={sectionTitle}>Status</p>
        <div className="flex flex-col gap-2">
          {(['active', 'sold', 'dead', 'transferred'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggleArray('status', s)}
              className={`capitalize ${
                filters.status?.includes(s) ? chipOn : chipOff
              }`}
            >
              {filters.status?.includes(s) ? '✓ ' : ''}
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Days on farm */}
      <div className={section}>
        <p className={sectionTitle}>Days on farm</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={label}>Min</label>
            <input
              type="number"
              className={input}
              value={filters.min_days_on_farm ?? ''}
              onChange={(e) =>
                update(
                  'min_days_on_farm',
                  e.target.value ? Number(e.target.value) : undefined
                )
              }
            />
          </div>
          <div>
            <label className={label}>Max</label>
            <input
              type="number"
              className={input}
              value={filters.max_days_on_farm ?? ''}
              onChange={(e) =>
                update(
                  'max_days_on_farm',
                  e.target.value ? Number(e.target.value) : undefined
                )
              }
            />
          </div>
        </div>
      </div>

      {/* Age */}
      <div className={section}>
        <p className={sectionTitle}>Age (months)</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={label}>Min</label>
            <input
              type="number"
              min={0}
              className={input}
              value={filters.min_age_months ?? ''}
              onChange={(e) =>
                update(
                  'min_age_months',
                  e.target.value ? Number(e.target.value) : undefined
                )
              }
            />
          </div>
          <div>
            <label className={label}>Max</label>
            <input
              type="number"
              min={0}
              className={input}
              value={filters.max_age_months ?? ''}
              onChange={(e) =>
                update(
                  'max_age_months',
                  e.target.value ? Number(e.target.value) : undefined
                )
              }
            />
          </div>
        </div>
      </div>

      {/* Purchase dates */}
      <div className={section}>
        <p className={sectionTitle}>Purchased</p>
        <div className="grid grid-cols-1 gap-2">
          <div>
            <label className={label}>From</label>
            <input
              type="date"
              className={input}
              value={filters.purchase_date_from || ''}
              onChange={(e) =>
                update('purchase_date_from', e.target.value || undefined)
              }
            />
          </div>
          <div>
            <label className={label}>To</label>
            <input
              type="date"
              className={input}
              value={filters.purchase_date_to || ''}
              onChange={(e) =>
                update('purchase_date_to', e.target.value || undefined)
              }
            />
          </div>
        </div>
      </div>

      {/* Sale dates */}
      <div className={section}>
        <p className={sectionTitle}>Sale date</p>
        <div className="grid grid-cols-1 gap-2">
          <div>
            <label className={label}>From</label>
            <input
              type="date"
              className={input}
              value={filters.sale_date_from || ''}
              onChange={(e) =>
                update('sale_date_from', e.target.value || undefined)
              }
            />
          </div>
          <div>
            <label className={label}>To</label>
            <input
              type="date"
              className={input}
              value={filters.sale_date_to || ''}
              onChange={(e) =>
                update('sale_date_to', e.target.value || undefined)
              }
            />
          </div>
        </div>
      </div>

      {/* ADG */}
      <div className={section}>
        <p className={sectionTitle}>ADG (kg / day)</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={label}>Min</label>
            <input
              type="number"
              step="0.01"
              className={input}
              value={filters.min_adg ?? ''}
              onChange={(e) =>
                update('min_adg', e.target.value ? Number(e.target.value) : undefined)
              }
            />
          </div>
          <div>
            <label className={label}>Max</label>
            <input
              type="number"
              step="0.01"
              className={input}
              value={filters.max_adg ?? ''}
              onChange={(e) =>
                update('max_adg', e.target.value ? Number(e.target.value) : undefined)
              }
            />
          </div>
        </div>
      </div>
    </div>
  )
}
