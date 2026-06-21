import Link from 'next/link'

export default function ResourcesPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-slate-800 mb-1">Resources</h1>
        <p className="text-slate-400 mb-12">Guides and materials for students, parents, and teachers.</p>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 flex flex-col items-center text-center max-w-md mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mb-6">
            <svg className="w-8 h-8 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-2">Coming soon</h2>
          <p className="text-sm text-slate-500 leading-relaxed mb-8">
            Reading tips, fluency benchmarks, and parent guides are on the way.
          </p>
          <Link
            href="/"
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </main>
  )
}
