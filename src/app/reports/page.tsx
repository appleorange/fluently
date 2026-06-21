import Link from 'next/link'

export default function ReportsPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-slate-800 mb-1">Reports</h1>
        <p className="text-slate-400 mb-12">Past diagnostic reports and assessments.</p>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 flex flex-col items-center text-center max-w-md mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mb-6">
            <svg className="w-8 h-8 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-2">Coming soon</h2>
          <p className="text-sm text-slate-500 leading-relaxed mb-8">
            Full session reports will appear here after each reading. Complete a session to generate your first report.
          </p>
          <Link
            href="/practice"
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-colors"
          >
            Start a Reading Session
          </Link>
        </div>
      </div>
    </main>
  )
}
