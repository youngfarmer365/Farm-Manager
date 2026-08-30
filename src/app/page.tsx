import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-brand-50 via-white to-slate-50 px-4">
      <div className="w-full max-w-lg text-center space-y-8">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-700">
            Ireland
          </p>
          <h1 className="text-4xl md:text-5xl font-bold text-brand-900 tracking-tight">
            Farm Manager
          </h1>
          <p className="text-base md:text-lg text-slate-600 leading-relaxed">
            Animals, feeding, intake and performance in one place. Built for the
            yard — multi-farm, multi-user, pens, groups, ADG, and mart / factory
            imports.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/auth/login"
            className="inline-flex items-center justify-center rounded-xl bg-brand-600 px-8 py-3.5 text-white font-medium shadow-sm hover:bg-brand-700 transition"
          >
            Log in
          </Link>
          <Link
            href="/auth/signup"
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-8 py-3.5 text-slate-800 font-medium hover:border-brand-600 hover:text-brand-800 transition"
          >
            Sign up
          </Link>
        </div>

        <p className="text-sm text-slate-500">Weights in kg · Prices in €</p>
      </div>
    </div>
  )
}