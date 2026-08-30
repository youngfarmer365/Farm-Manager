'use client'

import Link from 'next/link'

export default function ImportHubPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold">Import</h1>
          <Link href="/animals" className="text-sm text-slate-600 hover:underline">
            Back to animals
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-10">
        <p className="text-slate-600 text-sm mb-6 text-center">
          Choose the type of file you want to upload
        </p>

        <div className="grid gap-4">
          <Link
            href="/import/mart"
            className="block rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:border-brand-500 hover:bg-brand-50 transition"
          >
            <h2 className="font-semibold text-lg text-slate-900">Mart purchase</h2>
            <p className="text-sm text-slate-500 mt-2">
              AIM / mart XML — add animals to the system.
            </p>
          </Link>

          <Link
            href="/import/factory"
            className="block rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:border-brand-500 hover:bg-brand-50 transition"
          >
            <h2 className="font-semibold text-lg text-slate-900">Factory sale</h2>
            <p className="text-sm text-slate-500 mt-2">
              Factory docket CSV — record sales, grades and dead weights.
            </p>
          </Link>

          <Link
            href="/import/aim"
            className="block rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:border-brand-500 hover:bg-brand-50 transition"
          >
            <h2 className="font-semibold text-lg text-slate-900">AIM herd profile</h2>
            <p className="text-sm text-slate-500 mt-2">
              Agfoods CSV — cross-check tags against animals on this system.
            </p>
          </Link>
        </div>
      </main>
    </div>
  )
}