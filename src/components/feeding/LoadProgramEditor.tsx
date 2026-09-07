'use client'

export function LoadProgramEditor({
  name,
  programId,
  programs,
  onName,
  onProgram,
  onSave,
}: {
  name: string
  programId: string
  programs: { id: string; name: string; status?: string | null; paused_on?: string | null }[]
  onName: (v: string) => void
  onProgram: (v: string) => void
  onSave: () => void
}) {
  return (
    <div className="space-y-2">
      <h2 className="font-semibold">Edit load</h2>
      <label className="block text-xs font-semibold text-slate-600">Name</label>
      <input
        value={name}
        onChange={(e) => onName(e.target.value)}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
      <label className="block text-xs font-semibold text-slate-600">Programme on this load</label>
      <select
        value={programId}
        onChange={(e) => onProgram(e.target.value)}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      >
        <option value="">No programme</option>
        {programs.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {p.status === 'paused' || p.paused_on ? ' (paused)' : ''}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onSave}
        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
      >
        Save name / programme
      </button>
    </div>
  )
}
