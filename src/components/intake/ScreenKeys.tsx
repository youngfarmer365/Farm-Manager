'use client'

const key =
  'min-h-[56px] rounded-xl border-2 border-slate-800 bg-white text-2xl font-bold text-slate-900 active:bg-brand-200'

export function ScreenKeys({
  value,
  onChange,
  onSubmit,
  submitLabel = 'Add',
  decimal = false,
  show372 = false,
}: {
  value: string
  onChange: (v: string) => void
  onSubmit?: () => void
  submitLabel?: string
  decimal?: boolean
  show372?: boolean
}) {
  function press(ch: string) {
    onChange(value + ch)
  }

  return (
    <div className="space-y-2 rounded-2xl border-4 border-slate-800 bg-slate-100 p-2">
      <div className="grid grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
          <button type="button" key={k} className={key} onClick={() => press(k)}>
            {k}
          </button>
        ))}
        {decimal ? (
          <button
            type="button"
            className={key}
            onClick={() => {
              if (!value.includes('.')) press('.')
            }}
          >
            .
          </button>
        ) : show372 ? (
          <button
            type="button"
            className={key + ' text-lg'}
            onClick={() => onChange(value.startsWith('372') ? value : '372' + value)}
          >
            372
          </button>
        ) : (
          <span />
        )}
        <button type="button" className={key} onClick={() => press('0')}>
          0
        </button>
        <button type="button" className={key} onClick={() => onChange(value.slice(0, -1))}>
          ⌫
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className="min-h-[52px] rounded-xl border-2 border-slate-600 bg-slate-200 text-base font-bold"
          onClick={() => onChange('')}
        >
          Clear
        </button>
        {onSubmit ? (
          <button
            type="button"
            className="min-h-[52px] rounded-xl bg-slate-900 text-base font-bold text-white"
            onClick={onSubmit}
          >
            {submitLabel}
          </button>
        ) : (
          <span />
        )}
      </div>
    </div>
  )
}
