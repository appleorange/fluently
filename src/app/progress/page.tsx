'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import LoadingDots from '@/components/LoadingDots'

function SessionDetail({ s }: { s: SessionSummary }) {
  const errors = s.errorCounts
  const totalErrors = errors.substitutions + errors.omissions + errors.insertions + errors.hesitations
  const maxErr = Math.max(errors.substitutions, errors.omissions, errors.insertions, errors.hesitations, 1)

  return (
    <div className="mt-2 mb-1 bg-slate-50 rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-xs text-slate-400 mb-0.5">WCPM</p>
          <p className="text-lg font-bold text-slate-800">{s.metrics.wcpm}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-0.5">Accuracy</p>
          <p className="text-lg font-bold text-slate-800">{Math.round(s.metrics.accuracy)}%</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-0.5">Duration</p>
          <p className="text-lg font-bold text-slate-800">{Math.round(s.metrics.durationSeconds)}s</p>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Error Breakdown</p>
        <div className="space-y-1.5">
          {([
            ['Substitutions', errors.substitutions],
            ['Omissions', errors.omissions],
            ['Insertions', errors.insertions],
            ['Hesitations', errors.hesitations],
          ] as [string, number][]).map(([label, count]) => (
            <div key={label} className="flex items-center gap-2">
              <span className="w-24 text-xs text-slate-500 shrink-0">{label}</span>
              <div className="flex-1 bg-slate-200 rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full bg-red-400"
                  style={{ width: `${Math.round((count / maxErr) * 100)}%` }}
                />
              </div>
              <span className="w-3 text-xs text-slate-600 shrink-0">{count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-200">
        <span>Grade {s.passageGrade} passage</span>
        <span>{totalErrors} total error{totalErrors !== 1 ? 's' : ''}</span>
        {s.selfCorrections > 0 && <span>{s.selfCorrections} self-correction{s.selfCorrections !== 1 ? 's' : ''}</span>}
      </div>
    </div>
  )
}

const READER_ID_KEY = 'fluently-reader-id'
const MIN_SESSIONS = 3

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
  errorCounts: {
    substitutions: number
    omissions: number
    insertions: number
    hesitations: number
  }
  selfCorrections: number
}

// Simple SVG line chart for WCPM over sessions
function SessionChart({ sessions }: { sessions: SessionSummary[] }) {
  const values = sessions.map(s => s.metrics.wcpm)
  const maxVal = Math.max(...values, 1)
  const W = 340
  const H = 100
  const padL = 10, padR = 10, padT = 10, padB = 20
  const chartW = W - padL - padR
  const chartH = H - padT - padB

  const pts = values.map((v, i) => ({
    x: padL + (i / Math.max(values.length - 1, 1)) * chartW,
    y: padT + (1 - v / maxVal) * chartH
  }))

  const dx = (chartW / Math.max(values.length - 1, 1)) / 3
  let smoothPath = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`
  for (let i = 1; i < pts.length; i++) {
    smoothPath += ` C ${(pts[i - 1].x + dx).toFixed(1)},${pts[i - 1].y.toFixed(1)} ${(pts[i].x - dx).toFixed(1)},${pts[i].y.toFixed(1)} ${pts[i].x.toFixed(1)},${pts[i].y.toFixed(1)}`
  }
  const areaPath = `${smoothPath} L ${pts[pts.length - 1].x.toFixed(1)},${padT + chartH} L ${pts[0].x.toFixed(1)},${padT + chartH} Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label="WCPM over sessions">
      <defs>
        <linearGradient id="progressAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#progressAreaGrad)" />
      <path d={smoothPath} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#3b82f6" />
      ))}
      {pts.map((p, i) => (
        <text key={i} x={p.x} y={H - 2} fontSize="9" fill="#94a3b8" textAnchor="middle">
          {i + 1}
        </text>
      ))}
    </svg>
  )
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function accuracyBadge(pct: number) {
  if (pct >= 95) return 'bg-green-100 text-green-700'
  if (pct >= 85) return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-700'
}

export default function ProgressPage() {
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    const readerId = localStorage.getItem(READER_ID_KEY)
    if (!readerId) {
      setSessions([])
      setLoading(false)
      return
    }
    fetch(`/api/session?readerId=${encodeURIComponent(readerId)}`)
      .then(r => r.json())
      .then(d => {
        setSessions(d.sessions ?? [])
      })
      .catch(() => setSessions([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <LoadingDots />
      </main>
    )
  }

  const hasEnoughSessions = sessions !== null && sessions.length >= MIN_SESSIONS

  // Empty state (< 3 sessions)
  if (!hasEnoughSessions) {
    const count = sessions?.length ?? 0
    const remaining = MIN_SESSIONS - count
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <h1 className="text-3xl font-bold text-slate-800 mb-1">Progress</h1>
          <p className="text-slate-400 mb-12">Your reading history and trend charts appear here.</p>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 flex flex-col items-center text-center max-w-md mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-slate-800 mb-2">
              {count === 0 ? 'No sessions yet' : `${count} session${count > 1 ? 's' : ''} complete`}
            </h2>
            <p className="text-sm text-slate-500 leading-relaxed mb-8">
              Complete {remaining} more reading session{remaining > 1 ? 's' : ''} to unlock your progress report, trend chart, and personalized insights.
            </p>
            {count > 0 && (
              <div className="flex gap-2 mb-6">
                {Array.from({ length: MIN_SESSIONS }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-8 h-2 rounded-full ${i < count ? 'bg-blue-500' : 'bg-slate-100'}`}
                  />
                ))}
              </div>
            )}
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

  // Data view (3+ sessions)
  const avgAccuracy = Math.round(sessions.reduce((s, r) => s + r.metrics.accuracy, 0) / sessions.length)
  const avgWCPM = Math.round(sessions.reduce((s, r) => s + r.metrics.wcpm, 0) / sessions.length)
  const totalMinutes = Math.round(sessions.reduce((s, r) => s + r.metrics.durationSeconds, 0) / 60)

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold text-slate-800 mb-1">Progress</h1>
        <p className="text-slate-400 mb-8">{sessions.length} sessions recorded</p>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Avg. Accuracy', value: `${avgAccuracy}%` },
            { label: 'Avg. WCPM', value: avgWCPM },
            { label: 'Minutes Practiced', value: `${totalMinutes}m` },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-center">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">{label}</p>
              <p className="text-3xl font-bold text-slate-800">{value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* WCPM chart */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <h2 className="font-semibold text-slate-800 mb-4">WCPM Over Time</h2>
            <SessionChart sessions={sessions} />
            <p className="text-xs text-slate-400 text-center mt-2">Sessions (chronological)</p>
          </div>

          {/* Recent sessions */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <h2 className="font-semibold text-slate-800 mb-4">Recent Sessions</h2>
            <div className="space-y-0">
              {[...sessions].reverse().slice(0, 6).map(s => (
                <div key={s.sessionId} className="border-b border-slate-50 last:border-0">
                  <button
                    onClick={() => setExpanded(expanded === s.sessionId ? null : s.sessionId)}
                    className="w-full flex items-center justify-between py-2.5 text-left hover:bg-slate-50 rounded-lg px-1 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-700 capitalize">
                        {s.passageTitle ?? s.passageId.replace(/-g\d+$/, '').replace(/-/g, ' ')}
                      </p>
                      <p className="text-xs text-slate-400">
                        {formatDate(s.timestamp)} · {Math.round(s.metrics.durationSeconds)}s · {s.metrics.wcpm} WCPM
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${accuracyBadge(s.metrics.accuracy)}`}>
                        {Math.round(s.metrics.accuracy)}%
                      </span>
                      <svg
                        className={`w-3.5 h-3.5 text-slate-400 transition-transform ${expanded === s.sessionId ? 'rotate-180' : ''}`}
                        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  </button>
                  {expanded === s.sessionId && <SessionDetail s={s} />}
                </div>
              ))}
            </div>
            <Link href="/practice" className="block mt-4 text-sm font-medium text-blue-600 hover:text-blue-700">
              Practice again →
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
