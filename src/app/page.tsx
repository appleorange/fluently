'use client'

import Link from 'next/link'
import { useEffect, useState, type ReactNode } from 'react'

const READER_ID_KEY = 'fluently-reader-id'

type TimeFilter = 'This Hour' | 'This Week' | 'This Month' | 'Last 3'

interface SessionSummary {
  sessionId: string
  timestamp: number
  passageId: string
  passageTitle?: string
  passageGrade: number
  metrics: {
    wcpm: number
    accuracy: number
    durationSeconds: number
  }
}

// ─── Hero illustration ──────────────────────────────────────────────────────

function HeroIllustration() {
  const barHeights = [6, 12, 20, 14, 24, 16, 28, 10, 22, 14, 30, 10, 18, 8, 14, 22, 16, 10, 20, 26, 12, 18, 10, 16]
  return (
    <div className="relative flex items-center justify-center h-72 select-none">
      <div className="absolute w-64 h-64 rounded-full bg-blue-50" />
      <div className="relative bg-white rounded-2xl shadow-lg px-8 py-7 w-56 z-10">
        <div className="flex justify-center mb-5 relative">
          <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center">
            <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M6 2a2 2 0 00-2 2v16l8-2.5L20 20V4a2 2 0 00-2-2H6zm6 13.5L6 17.5V4h12v13.5l-6-2z" />
            </svg>
          </div>
          <div className="absolute -top-1 -right-3 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow">
            <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-1.5 bg-slate-100 rounded-full w-full" />
          <div className="h-1.5 bg-slate-100 rounded-full w-4/5" />
          <div className="h-1.5 bg-slate-100 rounded-full w-3/4" />
        </div>
      </div>
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-60 bg-white rounded-xl shadow px-5 py-3 z-10">
        <div className="flex items-center justify-center gap-0.5 h-8">
          {barHeights.map((h, i) => (
            <div key={i} className="w-1.5 bg-blue-400 rounded-full" style={{ height: h }} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Feature card ────────────────────────────────────────────────────────────

interface FeatureCardProps {
  icon: ReactNode
  iconBg: string
  title: string
  description: string
}

function FeatureCard({ icon, iconBg, title, description }: FeatureCardProps) {
  return (
    <div className="flex flex-col items-start gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">{description}</p>
      </div>
    </div>
  )
}

// ─── Progress chart ──────────────────────────────────────────────────────────

function ProgressChart({ sessions }: { sessions: SessionSummary[] }) {
  const values = sessions.map(s => s.metrics.wcpm)
  const maxVal = Math.max(...values, 1)
  const W = 320, H = 110
  const padL = 10, padR = 10, padT = 10, padB = 24
  const chartW = W - padL - padR
  const chartH = H - padT - padB

  const pts = values.map((v, i) => ({
    x: padL + (i / Math.max(values.length - 1, 1)) * chartW,
    y: padT + (1 - v / maxVal) * chartH,
  }))

  const dx = (chartW / Math.max(values.length - 1, 1)) / 3
  let smoothPath = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`
  for (let i = 1; i < pts.length; i++) {
    smoothPath += ` C ${(pts[i-1].x + dx).toFixed(1)},${pts[i-1].y.toFixed(1)} ${(pts[i].x - dx).toFixed(1)},${pts[i].y.toFixed(1)} ${pts[i].x.toFixed(1)},${pts[i].y.toFixed(1)}`
  }
  const areaPath = `${smoothPath} L ${pts[pts.length-1].x.toFixed(1)},${padT+chartH} L ${pts[0].x.toFixed(1)},${padT+chartH} Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label="WCPM over sessions">
      <defs>
        <linearGradient id="homeAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#homeAreaGrad)" />
      <path d={smoothPath} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#3b82f6" />
      ))}
      {pts.map((p, i) => (
        <text key={i} x={p.x} y={H - 4} fontSize="9" fill="#94a3b8" textAnchor="middle">
          {i + 1}
        </text>
      ))}
    </svg>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function filterSessions(sessions: SessionSummary[], filter: TimeFilter): SessionSummary[] {
  const now = Date.now()
  if (filter === 'Last 3') return [...sessions].reverse().slice(0, 3).reverse()
  const ms: Record<TimeFilter, number> = {
    'This Hour':  60 * 60 * 1000,
    'This Week':  7 * 24 * 60 * 60 * 1000,
    'This Month': 30 * 24 * 60 * 60 * 1000,
    'Last 3': 0,
  }
  return sessions.filter(s => now - s.timestamp <= ms[filter])
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function accuracyColor(pct: number) {
  if (pct >= 90) return 'bg-green-100 text-green-700'
  if (pct >= 80) return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-700'
}

function passageLabel(s: SessionSummary) {
  return s.passageTitle ?? s.passageId.replace(/-g\d+$/, '').replace(/-/g, ' ')
}

// ─── Sessions + Progress section (client) ────────────────────────────────────

const TIME_FILTERS: TimeFilter[] = ['This Hour', 'This Week', 'This Month', 'Last 3']

function SessionsAndProgress() {
  const [allSessions, setAllSessions] = useState<SessionSummary[] | null>(null)
  const [filter, setFilter] = useState<TimeFilter>('This Week')
  const [filterOpen, setFilterOpen] = useState(false)

  useEffect(() => {
    const readerId = localStorage.getItem(READER_ID_KEY)
    if (!readerId) { setAllSessions([]); return }
    fetch(`/api/session?readerId=${encodeURIComponent(readerId)}`)
      .then(r => r.json())
      .then(d => setAllSessions(d.sessions ?? []))
      .catch(() => setAllSessions([]))
  }, [])

  if (allSessions === null) {
    return (
      <div className="grid grid-cols-2 gap-6">
        {[0, 1].map(i => (
          <div key={i} className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm h-48 animate-pulse">
            <div className="h-4 bg-slate-100 rounded w-1/3 mb-4" />
            <div className="space-y-3">
              <div className="h-3 bg-slate-100 rounded" />
              <div className="h-3 bg-slate-100 rounded w-4/5" />
              <div className="h-3 bg-slate-100 rounded w-3/4" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  const noSessions = allSessions.length === 0
  const filtered = filterSessions(allSessions, filter)
  const recentSessions = [...allSessions].reverse().slice(0, 3)
  const avgAccuracy = filtered.length
    ? Math.round(filtered.reduce((s, r) => s + r.metrics.accuracy, 0) / filtered.length)
    : 0
  const totalMinutes = filtered.length
    ? Math.round(filtered.reduce((s, r) => s + r.metrics.durationSeconds, 0) / 60)
    : 0

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Recent sessions */}
      <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
        <h2 className="font-semibold text-slate-800 mb-4">Recent Sessions</h2>

        {noSessions ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-600 mb-1">No sessions yet</p>
            <p className="text-xs text-slate-400 mb-4">Complete at least 3 sessions for data to show up.</p>
            <Link href="/practice" className="text-sm font-medium text-blue-600 hover:text-blue-700">
              Start your first session →
            </Link>
          </div>
        ) : (
          <>
            <div className="divide-y divide-slate-50">
              {recentSessions.map(s => (
                <div key={s.sessionId} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800 capitalize">{passageLabel(s)}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {formatDate(s.timestamp)} · {Math.round(s.metrics.durationSeconds)}s · {s.metrics.wcpm} WCPM
                    </p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${accuracyColor(s.metrics.accuracy)}`}>
                    {Math.round(s.metrics.accuracy)}%
                  </span>
                </div>
              ))}
            </div>
            <Link href="/progress" className="block mt-4 text-sm font-medium text-blue-600 hover:text-blue-700">
              View all sessions →
            </Link>
          </>
        )}
      </div>

      {/* Progress chart */}
      <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold text-slate-800">Your Progress</h2>
          <div className="relative">
            <button
              onClick={() => setFilterOpen(o => !o)}
              className="text-xs font-medium text-slate-500 border border-slate-200 rounded-lg px-2.5 py-1 hover:border-slate-300 transition-colors flex items-center gap-1"
            >
              {filter}
              <svg className={`w-3 h-3 transition-transform ${filterOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {filterOpen && (
              <div className="absolute right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-10 py-1 min-w-[120px]">
                {TIME_FILTERS.map(f => (
                  <button
                    key={f}
                    onClick={() => { setFilter(f); setFilterOpen(false) }}
                    className={`w-full text-left px-3 py-1.5 text-xs font-medium transition-colors ${f === filter ? 'text-blue-600 bg-blue-50' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {noSessions || allSessions.length < 3 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-600 mb-1">
              {noSessions ? 'No sessions logged yet' : `${allSessions.length} of 3 sessions complete`}
            </p>
            <p className="text-xs text-slate-400">You need at least 3 sessions for data to show up.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <p className="text-sm font-medium text-slate-600 mb-1">No sessions in this period</p>
            <p className="text-xs text-slate-400">Try a different time filter or start a new session.</p>
          </div>
        ) : (
          <>
            <div className="mt-2">
              <ProgressChart sessions={filtered} />
            </div>
            <div className="flex gap-8 mt-3">
              <div>
                <p className="text-xs text-slate-400">Average Accuracy</p>
                <p className="text-2xl font-bold text-slate-800">{avgAccuracy}%</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Minutes Practiced</p>
                <p className="text-2xl font-bold text-slate-800">{totalMinutes}m</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-12">
        <div className="grid grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="text-5xl font-bold text-slate-900 leading-tight">
              Read with clarity.<br />Speak with confidence.
            </h1>
            <p className="text-slate-500 mt-5 text-lg leading-relaxed">
              Fluently helps you build stronger oral reading fluency through engaging passages, instant feedback, and personalized insights.
            </p>
            <div className="flex gap-3 mt-8">
              <Link
                href="/practice"
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-colors"
              >
                Start Reading
              </Link>
              <button className="px-6 py-3 text-slate-700 hover:text-slate-900 font-semibold rounded-xl text-sm border border-slate-200 hover:border-slate-300 transition-colors">
                Learn More
              </button>
            </div>
          </div>
          <HeroIllustration />
        </div>
      </section>

      {/* Feature cards */}
      <section className="max-w-6xl mx-auto px-6 pb-12">
        <div className="bg-slate-50 rounded-2xl p-8">
          <div className="grid grid-cols-4 gap-8">
            <FeatureCard
              iconBg="bg-teal-100"
              icon={
                <svg className="w-5 h-5 text-teal-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
              }
              title="Short Sessions"
              description="Timed readings designed to fit your day."
            />
            <FeatureCard
              iconBg="bg-blue-100"
              icon={
                <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
              }
              title="Instant Feedback"
              description="Get immediate results and error breakdowns."
            />
            <FeatureCard
              iconBg="bg-green-100"
              icon={
                <svg className="w-5 h-5 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              }
              title="Track Progress"
              description="Monitor growth over time with detailed reports."
            />
            <FeatureCard
              iconBg="bg-orange-100"
              icon={
                <svg className="w-5 h-5 text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              }
              title="Built for Growth"
              description="For students, teachers, and life-long learners."
            />
          </div>
        </div>
      </section>

      {/* Sessions + Progress */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <SessionsAndProgress />
      </section>
    </main>
  )
}
