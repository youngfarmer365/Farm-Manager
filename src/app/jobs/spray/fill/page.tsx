'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AppHeader } from '@/components/layout/AppHeader'
import { formatWeather } from '@/lib/weather'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'
import { Suspense } from 'react'

function FillInner() {
  const params = useSearchParams()
  const jobId = params.get('job')
  const supabase = createClient()
  const [job, setJob] = useState<any>(null)
  const [fields, setFields] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])

  useEffect(() => {
    if (!jobId) return
    supabase.from('spray_jobs').select('*').eq('id', jobId).maybeSingle().then(({ data }) => setJob(data))
    supabase
      .from('spray_job_fields')
      .select('*, farm_fields(name, area_ha)')
      .eq('job_id', jobId)
      .then(({ data }) => setFields(data || []))
    supabase
      .from('spray_job_products')
      .select('*')
      .eq('job_id', jobId)
      .order('fill_order')
      .then(({ data }) => setProducts(data || []))
  }, [jobId])

  const ha = fields.reduce((s, f) => s + Number(f.area_ha || 0), 0)
  const water = ha * Number(job?.water_l_ha || 0)

  if (!jobId) return <p className="p-6 font-bold">No job selected. Make a tank fill first.</p>
  if (!job) return <p className="p-6 font-bold">Loading…</p>

  return (
    <div className="min-h-screen bg-slate-200">
      <AppHeader title="Fill sheet" extra={<Link href="/jobs/spray" className="font-bold">New spray</Link>} />
      <main className="mx-auto max-w-xl space-y-4 p-4">
        <div className="rounded-xl border-4 border-slate-700 bg-white p-4">
          <p className="text-lg font-bold">{formatDate(job.applied_on)}</p>
          <p className="font-semibold">{formatWeather(job.weather)}</p>
          <p className="font-semibold">
            {ha.toFixed(2)} ha · {job.water_l_ha} L/ha · {water.toFixed(0)} L water
          </p>
          {job.grazing_interval_days ? (
            <p className="mt-2 rounded-lg bg-amber-200 p-2 font-bold">
              Do not graze for {job.grazing_interval_days} days
            </p>
          ) : null}
          <h2 className="mt-4 text-xl font-bold">Fields</h2>
          <ul className="font-semibold">
            {fields.map((f) => (
              <li key={f.id}>
                {f.farm_fields?.name} · {Number(f.area_ha).toFixed(2)} ha
              </li>
            ))}
          </ul>
          <h2 className="mt-4 text-xl font-bold">Fill order</h2>
          <ol className="list-decimal space-y-2 pl-6 text-lg font-bold">
            <li>Water {water.toFixed(0)} L</li>
            {products.map((p) => (
              <li key={p.id}>
                {p.product_name}: {Number(p.amount_total).toFixed(2)} {String(p.unit).replace('/ha', '')}{' '}
                <span className="text-base font-semibold">
                  ({p.rate} {p.unit}
                  {p.pcs_number ? ' · PCS ' + p.pcs_number : ''})
                </span>
              </li>
            ))}
          </ol>
        </div>
        <button type="button" className="min-h-[52px] w-full rounded-xl border-2 font-bold" onClick={() => window.print()}>
          Print
        </button>
      </main>
    </div>
  )
}

export default function FillPage() {
  return (
    <Suspense fallback={<p className="p-6 font-bold">Loading…</p>}>
      <FillInner />
    </Suspense>
  )
}
