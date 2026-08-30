'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AppHeader } from '@/components/layout/AppHeader'
import { formatDate } from '@/lib/utils'
import { formatWeather } from '@/lib/weather'
import Link from 'next/link'

export default function FieldDossierPage() {
  const { id } = useParams() as { id: string }
  const supabase = createClient()
  const [field, setField] = useState<any>(null)
  const [fert, setFert] = useState<any[]>([])
  const [ph, setPh] = useState<any[]>([])
  const [grass, setGrass] = useState<any[]>([])
  const [stints, setStints] = useState<any[]>([])
  const [doses, setDoses] = useState<any[]>([])
  const [sprays, setSprays] = useState<any[]>([])

  useEffect(() => {
    if (!id) return
    supabase.from('farm_fields').select('*').eq('id', id).maybeSingle().then(({ data }) => setField(data))
    supabase.from('fertiliser_applications').select('*').eq('field_id', id).order('applied_on', { ascending: false }).then(({ data }) => setFert(data || []))
    supabase.from('ph_tests').select('*').eq('field_id', id).order('tested_on').then(({ data }) => setPh(data || []))
    supabase.from('grass_covers').select('*').eq('field_id', id).order('measured_on', { ascending: false }).then(({ data }) => setGrass(data || []))
    supabase.from('grazing_stints').select('*').eq('field_id', id).order('started_on', { ascending: false }).then(({ data }) => setStints(data || []))
    supabase.from('field_doses').select('*').eq('field_id', id).order('treated_on', { ascending: false }).then(({ data }) => setDoses(data || []))
    supabase
      .from('spray_job_fields')
      .select('*, spray_jobs(*)')
      .eq('field_id', id)
      .then(({ data }) => setSprays(data || []))
  }, [id])

  if (!field) return <p className="p-6 font-bold">Loading…</p>

  return (
    <div className="min-h-screen bg-white">
      <AppHeader title={field.name} extra={<Link href="/map" className="font-bold">Map</Link>} />
      <main className="mx-auto max-w-3xl space-y-4 p-4">
        <button type="button" className="min-h-[48px] rounded-xl border-2 px-4 font-bold print:hidden" onClick={() => window.print()}>
          Print field record
        </button>
        <p className="text-lg font-bold">
          {field.area_ha != null ? Number(field.area_ha).toFixed(2) : '—'} ha
        </p>
        <Section title="Grazing">
          {stints.map((s) => (
            <p key={s.id}>
              {s.group_name} · {s.head_count ?? '—'} hd · {formatDate(s.started_on)} – {s.ended_on ? formatDate(s.ended_on) : 'now'}
            </p>
          ))}
        </Section>
        <Section title="Dosing">
          {doses.map((d) => (
            <p key={d.id}>
              {formatDate(d.treated_on)} · {d.product} {d.dose_notes ? '· ' + d.dose_notes : ''}
            </p>
          ))}
        </Section>
        <Section title="Fertiliser">
          {fert.map((r) => (
            <p key={r.id}>
              {formatDate(r.applied_on)} · {r.kind} · {r.product} {r.rate_kg_ha != null ? '· ' + r.rate_kg_ha + '/ha' : ''} · {formatWeather(r.weather)}
            </p>
          ))}
        </Section>
        <Section title="Spray">
          {sprays.map((s) => (
            <p key={s.id}>
              {formatDate(s.spray_jobs?.applied_on)} · {formatWeather(s.spray_jobs?.weather)}
              {s.spray_jobs?.grazing_interval_days ? ' · no graze ' + s.spray_jobs.grazing_interval_days + 'd' : ''}
            </p>
          ))}
        </Section>
        <Section title="pH">
          {ph.map((r) => (
            <p key={r.id}>
              {formatDate(r.tested_on)} · pH {Number(r.ph).toFixed(2)}
            </p>
          ))}
        </Section>
        <Section title="Grass covers">
          {grass.map((r) => (
            <p key={r.id}>
              {formatDate(r.measured_on)} · {Number(r.dm_kg_ha)} kg DM/ha
            </p>
          ))}
        </Section>
      </main>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t-2 border-slate-400 pt-2">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="mt-1 space-y-1 font-semibold">{children}</div>
    </section>
  )
}
