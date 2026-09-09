'use client'

export function LoadProgramEditor({
  name,
  programId,
  startDate,
  programs,
  onName,
  onProgram,
  onStartDate,
  onSave,
}: {
  name: string
  programId: string
  startDate: string
  programs: { id: string; name: string }[]
  onName: (v: string) => void
  onProgram: (v: string) => void
  onStartDate: (v: string) => void
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
          </option>
        ))}
      </select>
      {programId ? (
        <>
          <label className="block text-xs font-semibold text-slate-600">
            Started on (this load only)
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => onStartDate(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <p className="text-xs text-slate-500">
            The same programme can sit on other loads with a different start date. Pause on this
            row only stops this load.
          </p>
        </>
      ) : null}
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
