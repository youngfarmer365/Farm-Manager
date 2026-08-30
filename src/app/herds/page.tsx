'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Herd {
  id: string
  herd_number: string
  name: string | null
  is_active: boolean
}

export default function HerdsPage() {
  const [herds, setHerds] = useState<Herd[]>([])
  const [farmId, setFarmId] = useState<string | null>(null)
  const [herdNumber, setHerdNumber] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: membership } = await supabase
      .from('farm_members')
      .select('farm_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (!membership) return
    setFarmId(membership.farm_id)

    const { data } = await supabase
      .from('herds')
      .select('*')
      .eq('farm_id', membership.farm_id)
      .order('herd_number')

    setHerds((data as Herd[]) || [])
  }

  useEffect(() => {
    load()
  }, [])

  async function addHerd(e: React.FormEvent) {
    e.preventDefault()
    if (!farmId || !herdNumber.trim()) return
    setLoading(true)
    setError(null)

    const { error } = await supabase.from('herds').insert({
      farm_id: farmId,
      herd_number: herdNumber.trim(),
      name: name.trim() || null,
    })

    if (error) {
      setError(error.message)
    } else {
      setHerdNumber('')
      setName('')
      await load()
    }
    setLoading(false)
  }

  async function removeHerd(id: string) {
    if (!confirm('Remove this herd number?')) return
    await supabase.from('herds').delete().eq('id', id)
    await load()
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold">Herd Numbers</h1>
          <Link href="/animals" className="text-sm text-slate-600 hover:underline">
            Back to animals
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Add form */}
        <form onSubmit={addHerd} className="bg-white rounded-xl border p-6 space-y-4 shadow-sm">
          <h2 className="font-semibold">Add herd number</h2>
          <div>
            <label className="block text-sm font-medium mb-1">Herd number *</label>
            <input
              type="text"
              required
              value={herdNumber}
              onChange={(e) => setHerdNumber(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="e.g. A1234567"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Name (optional)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="e.g. Main herd"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? 'Adding…' : 'Add herd'}
          </button>
        </form>

        {/* List */}
        <div className="bg-white rounded-xl border shadow-sm">
          <div className="px-4 py-3 border-b font-medium">Available herd numbers</div>
          {herds.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">No herd numbers added yet.</p>
          ) : (
            <ul className="divide-y">
              {herds.map((h) => (
                <li key={h.id} className="px-4 py-3 flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium">{h.herd_number}</span>
                    {h.name && <span className="text-slate-500 ml-2">({h.name})</span>}
                  </div>
                  <button
                    onClick={() => removeHerd(h.id)}
                    className="text-red-600 hover:underline text-xs"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  )
}