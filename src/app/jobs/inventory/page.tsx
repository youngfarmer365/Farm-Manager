'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getFarmAccess } from '@/lib/farm-access'
import { AppHeader } from '@/components/layout/AppHeader'
import { searchPcs } from '@/lib/pcs-products'
import Link from 'next/link'

export default function InventoryPage() {
  const supabase = createClient()
  const [farmId, setFarmId] = useState<string | null>(null)
  const [rows, setRows] = useState<any[]>([])
  const [name, setName] = useState('')
  const [qty, setQty] = useState('')
  const [unit, setUnit] = useState('L')
  const [pcs, setPcs] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const hits = searchPcs(name).slice(0, 6)
  const field = 'min-h-[48px] w-full rounded-xl border-2 border-slate-500 bg-white px-3 text-base font-semibold'

  async function reload(fid: string) {
    const { data } = await supabase.from('chemical_stock').select('*').eq('farm_id', fid).order('product_name')
    setRows(data || [])
  }

  useEffect(() => {
    getFarmAccess().then(async (a) => {
      if (!a.farmId) return
      setFarmId(a.farmId)
      await reload(a.farmId)
    })
  }, [])

  async function add() {
    if (!farmId || !name.trim()) return
    const { error } = await supabase.from('chemical_stock').insert({
      farm_id: farmId,
      product_name: name.trim(),
      pcs_number: pcs || null,
      unit,
      quantity: Number(qty) || 0,
    })
    if (error) setMsg(error.message)
    else {
      setName('')
      setQty('')
      setPcs('')
      await reload(farmId)
    }
  }

  async function adjust(id: string, delta: number) {
    const r = rows.find((x) => x.id === id)
    if (!r) return
    await supabase.from('chemical_stock').update({ quantity: Number(r.quantity) + delta }).eq('id', id)
    if (farmId) await reload(farmId)
  }

  return (
    <div className="min-h-screen bg-slate-200">
      <AppHeader
        title="Chemical inventory"
        extra={<Link href="/jobs/spray" className="font-bold">Spray</Link>}
      />
      <main className="mx-auto max-w-3xl space-y-4 p-4">
        <div className="space-y-2 rounded-xl border-2 bg-white p-4 print:hidden">
          <input className={field} placeholder="Product name" value={name} onChange={(e) => setName(e.target.value)} />
          {name &&
            hits.map((h) => (
              <button
                key={h.pcs}
                type="button"
                className="block w-full rounded-lg border px-2 py-2 text-left text-sm font-bold"
                onClick={() => {
                  setName(h.name)
                  setPcs(h.pcs)
                  setUnit(h.unit.startsWith('kg') ? 'kg' : h.unit.startsWith('g') ? 'g' : 'L')
                }}
              >
                {h.name}
              </button>
            ))}
          <div className="grid grid-cols-3 gap-2">
            <input className={field} type="number" placeholder="Qty" value={qty} onChange={(e) => setQty(e.target.value)} />
            <select className={field} value={unit} onChange={(e) => setUnit(e.target.value)}>
              <option>L</option>
              <option>kg</option>
              <option>g</option>
            </select>
            <input className={field} placeholder="PCS no" value={pcs} onChange={(e) => setPcs(e.target.value)} />
          </div>
          <button type="button" className="min-h-[48px] w-full rounded-xl bg-brand-700 font-bold text-white" onClick={add}>
            Add stock
          </button>
          {msg && <p className="font-bold text-red-800">{msg}</p>}
        </div>
        <button type="button" className="min-h-[48px] w-full rounded-xl border-2 font-bold print:hidden" onClick={() => window.print()}>
          Print inventory
        </button>
        <table className="w-full border-2 border-slate-600 bg-white text-left text-sm">
          <thead>
            <tr className="bg-slate-200">
              <th className="border p-2">Product</th>
              <th className="border p-2">PCS</th>
              <th className="border p-2">Qty</th>
              <th className="border p-2 print:hidden">Adj</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={Number(r.quantity) <= 0 ? 'bg-red-100' : ''}>
                <td className="border p-2 font-bold">{r.product_name}</td>
                <td className="border p-2">{r.pcs_number || '—'}</td>
                <td className="border p-2 font-bold">
                  {Number(r.quantity).toFixed(2)} {r.unit}
                </td>
                <td className="border p-2 print:hidden">
                  <button type="button" className="mr-2 font-bold" onClick={() => adjust(r.id, 1)}>
                    +
                  </button>
                  <button type="button" className="font-bold" onClick={() => adjust(r.id, -1)}>
                    −
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </div>
  )
}
