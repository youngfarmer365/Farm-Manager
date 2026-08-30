'use client'

import Link from 'next/link'

const card =
  'block min-h-[72px] rounded-xl border-2 border-slate-500 bg-white p-5 hover:bg-slate-50'
const cardTitle = 'text-lg font-bold text-slate-900'
const cardSub = 'mt-1 text-base font-semibold text-slate-700'
const sectionLabel =
  'text-base font-bold uppercase tracking-wide text-slate-800 border-b-2 border-slate-400 pb-1'

export default function FeedingHubPage() {
  return (
    <div className="min-h-screen bg-slate-200">
      <header className="border-b-4 border-slate-600 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-brand-800">
              Farm Manager
            </p>
            <h1 className="text-2xl font-bold text-slate-900">Feeding</h1>
          </div>
          <Link
            href="/home"
            className="inline-flex min-h-[48px] items-center rounded-xl border-2 border-brand-800 bg-brand-50 px-4 text-base font-bold text-brand-900"
          >
            Home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-8 px-4 py-6">
        <section className="space-y-3">
          <h2 className={sectionLabel}>Operate</h2>

          <Link
            href="/feeding/run"
            className="block min-h-[88px] rounded-xl border-4 border-brand-900 bg-brand-700 p-5 text-white hover:bg-brand-800"
          >
            <h3 className="text-xl font-bold">Start feeding run</h3>
            <p className="mt-1 text-base font-semibold text-brand-50">
              Buffer → fill → feed pens → summary
            </p>
          </Link>

          <Link href="/feeding/pen-dashboard" className={card}>
            <h3 className={cardTitle}>Pen dashboard</h3>
            <p className={cardSub}>
              Animals, kg/head, cost, medicines, date range
            </p>
          </Link>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Link href="/feeding/history" className={card}>
              <h3 className={cardTitle}>Completed loads</h3>
              <p className={cardSub}>History and delete</p>
            </Link>
            <Link href="/feeding/stock" className={card}>
              <h3 className={cardTitle}>Stock</h3>
              <p className={cardSub}>On hand and days left</p>
            </Link>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className={sectionLabel}>Setup</h2>

          <Link href="/feeding/diets" className={card}>
            <h3 className={cardTitle}>Diets</h3>
            <p className={cardSub}>Diets, ingredients and premixes</p>
          </Link>

          <Link href="/feeding/programs" className={card}>
            <h3 className={cardTitle}>Programmes</h3>
            <p className={cardSub}>Phases and transitions</p>
          </Link>

          <Link href="/feeding/loads" className={card}>
            <h3 className={cardTitle}>Loads</h3>
            <p className={cardSub}>Pens in feed-out order</p>
          </Link>
        </section>
      </main>
    </div>
  )
}