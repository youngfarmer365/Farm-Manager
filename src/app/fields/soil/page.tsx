'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getFarmAccess } from '@/lib/farm-access'
import { AppHeader } from '@/components/layout/AppHeader'

interface Field {
  id: string
  name: string
}

interface Sample {
  id: string
  field_id: string
  sampled_on: string
  lab_name: string | null
  report_no: string | null
  ph: number | null
  lime_t_ha: number | null
  p_mg_l: number | null
  p_index: number | null
  k_mg_l: number | null
  k_index: number | null
  mg_mg_l: number | null
  mg_index: number | null
  om_percent: number | null
  farm_fields?: { name: string } | { name: string }[] | null
}

function num(v: string) {
  if (v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export default function SoilSamplesPage() {
  const search = useSearchParams()
  const [farmId, setFarmId] = useState<string | null>(null)
  const [fields, setFields] = useState<Field[]>([])
  const [rows, setRows] = useState<Sample[]>([])
  const [fieldId, setFieldId] = useState(search.get('field') || '')
  const [sampledOn, setSampledOn] = useState(new Date().toISOString().slice(0, 10))
  const [lab, setLab] = useState('')
  const [reportNo, setReportNo] = useState('')
  const [ph, setPh] = useState('')
  const [lime, setLime] = useState('')
  const [p, setP] = useState('')
  const [pIdx, setPIdx] = useState('')
  const [k, setK] = useState('')
  const [kIdx, setKIdx] = useState('')
  const [mg, setMg] = useState('')
  const [mgIdx, setMgIdx] = useState('')
  const [om, setOm] = useState('')
  const [cu, setCu] = useState('')
  const [zn, setZn] = useState('')
  const [mn, setMn] = useState('')
  const [b, setB] = useState('')
  const [texture, setTexture] = useState('')
  const [rec, setRec] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  async function load() {
    const a = await getFarmAccess()
    if (!a.farmId) return
    setFarmId(a.farmId)
    const supabase = createClient()
    const [{ data: f }, { data: s, error }] = await Promise.all([
      supabase.from('farm_fields').select('id, name').eq('farm_id', a.farmId).order('name'),
      supabase
        .from('soil_samples')
        .select('*, farm_fields(name)')
        .eq('farm_id', a.farmId)
        .order('sampled_on', { ascending: false }),
    ])
    if (error) setError(error.message)
    setFields((f as Field[]) || [])
    setRows((s as Sample[]) || [])
    if (!fieldId && f && f[0]) setFieldId(f[0].id)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!farmId || !fieldId) return
    setError(null)
    setOk(false)
    const supabase = createClient()
    const { error } = await supabase.from('soil_samples').insert({
      farm_id: farmId,
      field_id: fieldId,
      sampled_on: sampledOn,
      lab_name: lab.trim() || null,
      report_no: reportNo.trim() || null,
      ph: num(ph),
      lime_t_ha: num(lime),
      p_mg_l: num(p),
      p_index: num(pIdx),
      k_mg_l: num(k),
      k_index: num(kIdx),
      mg_mg_l: num(mg),
      mg_index: num(mgIdx),
      om_percent: num(om),
      cu_mg_l: num(cu),
      zn_mg_l: num(zn),
      mn_mg_l: num(mn),
      b_mg_l: num(b),
      texture: texture.trim() || null,
      recommendation: rec.trim() || null,
      notes: notes.trim() || null,
    })
    if (error) setError(error.message)
    else {
      setOk(true)
      setPh('')
      setLime('')
      setP('')
      setPIdx('')
      setK('')
      setKIdx('')
      setMg('')
      setMgIdx('')
      setOm('')
      setCu('')
      setZn('')
      setMn('')
      setB('')
      setRec('')
      setNotes('')
      await load()
    }
  }

  const inp = 'w-full rounded-xl border-2 border-slate-400 px-3 py-2 text-base'

  return (
    <div className="min-h-screen bg-slate-200">
      <AppHeader title="Soil samples" />
      <main className="mx-auto max-w-3xl space-y-6 p-4">
        <p className="text-sm font-semibold text-slate-700">
          Enter the full lab report: pH, lime requirement, P / K / Mg (mg/L and index), organic
          matter and traces. You can still send a sample PDF later and we will match extra columns
          if needed.
        </p>
        <form onSubmit={save} className="space-y-3 rounded-2xl border-4 border-slate-600 bg-white p-4">
          <label className="block">
            <span className="text-sm font-bold">Field</span>
            <select value={fieldId} onChange={(e) => setFieldId(e.target.value)} className={inp + ' mt-1'} required>
              <option value="">Select…</option>
              {fields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm font-bold">Sample date</span>
              <input type="date" value={sampledOn} onChange={(e) => setSampledOn(e.target.value)} className={inp + ' mt-1'} />
            </label>
            <label className="block">
              <span className="text-sm font-bold">Lab</span>
              <input value={lab} onChange={(e) => setLab(e.target.value)} className={inp + ' mt-1'} placeholder="IAS / Teagasc / other" />
            </label>
          </div>
          <label className="block">
            <span className="text-sm font-bold">Report no.</span>
            <input value={reportNo} onChange={(e) => setReportNo(e.target.value)} className={inp + ' mt-1'} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label>
              pH
              <input value={ph} onChange={(e) => setPh(e.target.value)} type="number" step="0.01" className={inp} />
            </label>
            <label>
              Lime t/ha
              <input value={lime} onChange={(e) => setLime(e.target.value)} type="number" step="0.1" className={inp} />
            </label>
            <label>
              P mg/L
              <input value={p} onChange={(e) => setP(e.target.value)} type="number" step="0.1" className={inp} />
            </label>
            <label>
              P index
              <input value={pIdx} onChange={(e) => setPIdx(e.target.value)} type="number" className={inp} />
            </label>
            <label>
              K mg/L
              <input value={k} onChange={(e) => setK(e.target.value)} type="number" step="0.1" className={inp} />
            </label>
            <label>
              K index
              <input value={kIdx} onChange={(e) => setKIdx(e.target.value)} type="number" className={inp} />
            </label>
            <label>
              Mg mg/L
              <input value={mg} onChange={(e) => setMg(e.target.value)} type="number" step="0.1" className={inp} />
            </label>
            <label>
              Mg index
              <input value={mgIdx} onChange={(e) => setMgIdx(e.target.value)} type="number" className={inp} />
            </label>
            <label>
              OM %
              <input value={om} onChange={(e) => setOm(e.target.value)} type="number" step="0.1" className={inp} />
            </label>
            <label>
              Texture
              <input value={texture} onChange={(e) => setTexture(e.target.value)} className={inp} />
            </label>
            <label>
              Cu
              <input value={cu} onChange={(e) => setCu(e.target.value)} type="number" step="0.01" className={inp} />
            </label>
            <label>
              Zn
              <input value={zn} onChange={(e) => setZn(e.target.value)} type="number" step="0.01" className={inp} />
            </label>
            <label>
              Mn
              <input value={mn} onChange={(e) => setMn(e.target.value)} type="number" step="0.01" className={inp} />
            </label>
            <label>
              B
              <input value={b} onChange={(e) => setB(e.target.value)} type="number" step="0.01" className={inp} />
            </label>
          </div>
          <textarea value={rec} onChange={(e) => setRec(e.target.value)} rows={2} placeholder="Recommendation" className={inp} />
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Notes" className={inp} />
          {error && <p className="font-semibold text-red-700">{error}</p>}
          {ok && <p className="font-semibold text-brand-800">Sample saved.</p>}
          <button type="submit" className="w-full min-h-[48px] rounded-xl bg-brand-700 font-bold text-white">
            Save soil sample
          </button>
        </form>

        <ul className="space-y-2">
          {rows.map((r) => {
            const fname = Array.isArray(r.farm_fields) ? r.farm_fields[0]?.name : r.farm_fields?.name
            return (
              <li key={r.id} className="rounded-2xl border-4 border-slate-500 bg-white p-4">
                <div className="font-bold">{fname || 'Field'}</div>
                <div className="text-sm font-semibold text-slate-600">
                  {r.sampled_on}
                  {r.lab_name ? ` · ${r.lab_name}` : ''}
                  {r.report_no ? ` · #${r.report_no}` : ''}
                </div>
                <div className="mt-1 text-sm">
                  pH {r.ph ?? '—'} · lime {r.lime_t_ha ?? '—'} t/ha · P idx {r.p_index ?? '—'} · K idx{' '}
                  {r.k_index ?? '—'} · Mg idx {r.mg_index ?? '—'}
                </div>
                <Link href={`/fields/${r.field_id}`} className="text-sm font-bold text-brand-800 underline">
                  Open field
                </Link>
              </li>
            )
          })}
        </ul>
      </main>
    </div>
  )
}
