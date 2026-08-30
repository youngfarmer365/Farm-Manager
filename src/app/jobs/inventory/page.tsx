// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getFarmAccess } from '@/lib/farm-access'
import { AppHeader } from '@/components/layout/AppHeader'
import Link from 'next/link'

type StockRow = {
  id: string
  product_name: string
  pcs_number: string | null
  unit: string
  quantity: number
  phi_days: number | null
}

const field = 'min-h-[48px] w-full rounded-xl border-2 border-slate-500 bg-white px-3 text-base font-semibold'
const btn = 'min-h-[44px] rounded-xl border-2 px-3 text-sm font-bold'

function emptyForm() {
  return { name: '', pcs: '', phi: '', qty: '', unit: 'L' }
}

export default function InventoryPage() {
  const supabase = createClient()
  const [farmId, setFarmId] = useState<string | null>(null)
  const [rows, setRows] = useState<StockRow[]>([])
  const [form, setForm] = useState(emptyForm())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function reload(fid: string) {
    const { data, error } = await supabase
      .from('chemical_stock')
      .select('*')
      .eq('farm_id', fid)
      .order('product_name')
    if (error) setMsg(error.message)
    setRows((data as StockRow[]) || [])
  }

  useEffect(() => {
    getFarmAccess().then(async (a) => {
      if (!a.farmId) return
      setFarmId(a.farmId)
      await reload(a.farmId)
    })
  }, [])

  function startEdit(r: StockRow) {
    setEditingId(r.id)
    setForm({
      name: r.product_name,
      pcs: r.pcs_number || '',
      phi: r.phi_days == null ? '' : String(r.phi_days),
      qty: String(r.quantity ?? ''),
      unit: r.unit || 'L',
    })
    setMsg(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(emptyForm())
    setMsg(null)
  }

  async function save(e) {
    e.preventDefault()
    if (!farmId || !form.name.trim()) {
      setMsg('Enter a chemical name')
      return
    }
    setSaving(true)
    const payload = {
      product_name: form.name.trim(),
      pcs_number: form.pcs.trim() || null,
      unit: form.unit,
      quantity: Number(form.qty) || 0,
      phi_days: form.phi === '' ? null : Number(form.phi),
      updated_at: new Date().toISOString(),
    }
    let error
    if (editingId) {
      const res = await supabase.from('chemical_stock').update(payload).eq('id', editingId)
      error = res.error
    } else {
      const res = await supabase.from('chemical_stock').insert({ ...payload, farm_id: farmId })
      error = res.error
    }
    if (error && /phi_days/i.test(error.message)) {
      delete payload.phi_days
      const retry = editingId
        ? await supabase.from('chemical_stock').update(payload).eq('id', editingId)
        : await supabase.from('chemical_stock').insert({ ...payload, farm_id: farmId })
      error = retry.error
      if (!error) setMsg('Saved. Paste PASTE_IN_SUPABASE.sql in Supabase so PHI days is stored.')
    }
    setSaving(false)
    if (error) {
      setMsg(error.message)
      return
    }
    setEditingId(null)
    setForm(emptyForm())
    setMsg(editingId ? 'Updated' : 'Added')
    await reload(farmId)
  }

  async function adjust(id, delta) {
    const r = rows.find((x) => x.id === id)
    if (!r) return
    await supabase.from('chemical_stock').update({ quantity: Number(r.quantity) + delta, updated_at: new Date().toISOString() }).eq('id', id)
    if (farmId) await reload(farmId)
  }

  async function remove(r) {
    const ok = confirm('Delete ' + r.product_name + ' from inventory?')
    if (!ok) return
    const { error } = await supabase.from('chemical_stock').delete().eq('id', r.id)
    if (error) {
      setMsg(error.message)
      return
    }
    if (editingId === r.id) cancelEdit()
    setMsg('Deleted ' + r.product_name)
    if (farmId) await reload(farmId)
  }

  return (
    <div className="min-h-screen bg-slate-200">
      <AppHeader title="Chemical inventory" extra={<Link href="/jobs/spray" className="font-bold">Spray</Link>} />
      <main className="mx-auto max-w-3xl space-y-4 p-4">
        <form className="space-y-3 rounded-xl border-2 border-slate-500 bg-white p-4 print:hidden" onSubmit={save}>
          <h2 className="text-lg font-bold">{editingId ? 'Edit chemical' : 'Add chemical'}</h2>
          <label className="block"><span className="text-sm font-bold">Name</span><input className={field} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required /></label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="block"><span className="text-sm font-bold">PCS No</span><input className={field} value={form.pcs} onChange={(e) => setForm((f) => ({ ...f, pcs: e.target.value }))} /></label>
            <label className="block"><span className="text-sm font-bold">Pre Harvest Interval (Days)</span><input className={field} type="number" min="0" value={form.phi} onChange={(e) => setForm((f) => ({ ...f, phi: e.target.value }))} /></label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block"><span className="text-sm font-bold">Quantity on hand</span><input className={field} type="number" step="0.001" value={form.qty} onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))} /></label>
            <label className="block"><span className="text-sm font-bold">Unit</span><select className={field} value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}><option>L</option><option>kg</option><option>g</option></select></label>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="min-h-[48px] flex-1 rounded-xl bg-brand-700 font-bold text-white">{saving ? 'Saving…' : editingId ? 'Save changes' : 'Add to inventory'}</button>
            {editingId && (<button type="button" className={btn + ' border-slate-600 bg-white'} onClick={cancelEdit}>Cancel</button>)}
          </div>
          {msg && <p className="font-bold text-red-800">{msg}</p>}
        </form>
        <button type="button" className="min-h-[48px] w-full rounded-xl border-2 font-bold print:hidden" onClick={() => window.print()}>Print inventory</button>
        <ul className="space-y-2 print:hidden">
          {rows.map((r) => (
            <li key={r.id} className={'rounded-2xl border-4 bg-white p-3 ' + (Number(r.quantity) <= 0 ? 'border-red-700 ' : 'border-slate-500 ') + (editingId === r.id ? 'border-brand-800' : '')}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-bold">{r.product_name}</p>
                  <p className="text-sm font-semibold text-slate-700">PCS {r.pcs_number || '—'} · PHI {r.phi_days == null ? '—' : r.phi_days + ' days'}</p>
                  <p className="text-base font-bold">{Number(r.quantity).toFixed(2)} {r.unit}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={btn + ' border-slate-600 bg-slate-50'} onClick={() => adjust(r.id, 1)}>+</button>
                  <button type="button" className={btn + ' border-slate-600 bg-slate-50'} onClick={() => adjust(r.id, -1)}>−</button>
                  <button type="button" className={btn + ' border-brand-800 bg-brand-50'} onClick={() => startEdit(r)}>Edit</button>
                  <button type="button" className={btn + ' border-red-800 bg-red-50 text-red-900'} onClick={() => remove(r)}>Delete</button>
                </div>
              </div>
            </li>
          ))}
          {rows.length === 0 && (<li className="rounded-2xl border-4 border-slate-400 bg-white p-4 font-semibold text-slate-600">No chemicals yet. Add them above — they will appear on the spray page.</li>)}
        </ul>
      </main>
    </div>
  )
}
