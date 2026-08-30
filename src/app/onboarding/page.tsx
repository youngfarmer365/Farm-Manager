'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function OnboardingPage() {
  const [farmName, setFarmName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Not logged in')
      setLoading(false)
      return
    }

    // 1. Create farm
    const { data: farm, error: farmError } = await supabase
      .from('farms')
      .insert({ name: farmName, timezone: 'Europe/Dublin' })
      .select()
      .single()

    if (farmError) {
      setError(farmError.message)
      setLoading(false)
      return
    }

    // 2. Make current user the owner
    const { error: memberError } = await supabase
      .from('farm_members')
      .insert({ farm_id: farm.id, user_id: user.id, role: 'owner' })

    if (memberError) {
      setError(memberError.message)
      setLoading(false)
      return
    }

    // 3. Create default groups (Irish terms)
    await supabase.from('groups').insert([
      { farm_id: farm.id, name: 'Store', type: 'store', color: '#3b82f6' },
      { farm_id: farm.id, name: 'Finisher', type: 'finishing', color: '#16a34a' },
      { farm_id: farm.id, name: 'Grazing', type: 'grazing', color: '#ca8a04' },
    ])

    router.push('/home')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border p-8">
        <h1 className="text-2xl font-bold mb-2">Create your farm</h1>
        <p className="text-sm text-slate-500 mb-6">This is a one-time setup</p>

        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Farm / Herd name</label>
            <input
              type="text"
              required
              value={farmName}
              onChange={(e) => setFarmName(e.target.value)}
              placeholder="e.g. Woods Farm"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-brand-600 text-white py-2.5 text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? 'Creating…' : 'Create farm & continue'}
          </button>
        </form>
      </div>
    </div>
  )
}