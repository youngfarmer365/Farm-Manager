'use client'

import Link from 'next/link'

export default function MobilePensPage() {
  return (
    <div>
      <header className="bg-white border-b px-4 py-3">
        <h1 className="text-lg font-bold">Pens</h1>
      </header>
      <div className="p-4 space-y-3">
        <p className="text-sm text-slate-600">
          Assign animals and barcode/EID sessions use the full pens screen.
        </p>
        <Link
          href="/pens"
          className="block rounded-xl bg-brand-600 text-white text-center py-3 font-medium"
        >
          Open pens / fields
        </Link>
      </div>
    </div>
  )
}