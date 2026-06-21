'use client'

import { Metrics } from '@/lib/types'

export interface MetricsDashboardProps {
  metrics: Metrics
  targetWCPM?: number
}

function wcpmColor(wcpm: number, target: number): string {
  const ratio = wcpm / target
  if (ratio >= 0.9) return 'text-green-600'
  if (ratio >= 0.7) return 'text-yellow-600'
  return 'text-red-600'
}

function accuracyColor(accuracy: number): string {
  if (accuracy >= 95) return 'text-green-600'
  if (accuracy >= 85) return 'text-yellow-600'
  return 'text-red-600'
}

function boundaryColor(pct: number): string {
  if (pct >= 75) return 'bg-green-400'
  if (pct >= 50) return 'bg-yellow-400'
  return 'bg-red-400'
}

interface ErrorBarProps {
  label: string
  count: number
  maxCount: number
  color: string
}

function ErrorBar({ label, count, maxCount }: ErrorBarProps & { color: string }) {
  const widthPct = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 text-right text-sm text-slate-500 shrink-0">{label}</span>
      <div className="flex-1 bg-slate-100 rounded-full h-2.5">
        <div
          className="h-2.5 rounded-full bg-red-400 transition-all duration-300"
          style={{ width: `${widthPct}%` }}
        />
      </div>
      <span className="w-4 text-sm font-medium text-slate-700 shrink-0">{count}</span>
    </div>
  )
}

export default function MetricsDashboard({ metrics, targetWCPM = 115 }: MetricsDashboardProps) {
  const { wcpm, accuracy, errorCounts, pausePlacement, durationSeconds, correctWords, totalWords } = metrics
  const maxErrorCount = Math.max(
    errorCounts.substitutions,
    errorCounts.omissions,
    errorCounts.insertions,
    errorCounts.verbalHesitations,
    errorCounts.silentHesitations,
    1
  )
  const durationLabel = `${Math.floor(durationSeconds)}s`

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
      <h2 className="font-semibold text-slate-800 mb-5">Session Results</h2>

      {/* Top stats row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard
          label="WCPM"
          value={Math.round(wcpm)}
          sub={`Target: ${targetWCPM}`}
          valueClass={`text-4xl font-bold ${wcpmColor(wcpm, targetWCPM)}`}
        />
        <StatCard
          label="Accuracy"
          value={`${Math.round(accuracy)}%`}
          sub={`${correctWords} of ${totalWords} words`}
          valueClass={`text-4xl font-bold ${accuracyColor(accuracy)}`}
        />
        <StatCard
          label="Duration"
          value={durationLabel}
          sub="reading time"
          valueClass="text-4xl font-bold text-slate-700"
        />
      </div>

      {/* Error breakdown */}
      <div className="mb-5">
        <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-3">Error breakdown</h3>
        <div className="space-y-2.5">
          <ErrorBar label="Substitutions" count={errorCounts.substitutions} maxCount={maxErrorCount} color="bg-red-400" />
          <ErrorBar label="Omissions"     count={errorCounts.omissions}     maxCount={maxErrorCount} color="bg-red-400" />
          <ErrorBar label="Insertions"    count={errorCounts.insertions}    maxCount={maxErrorCount} color="bg-red-400" />
          <ErrorBar label="Verbal hesitations" count={errorCounts.verbalHesitations} maxCount={maxErrorCount} color="bg-red-400" />
          <ErrorBar label="Silent hesitations" count={errorCounts.silentHesitations} maxCount={maxErrorCount} color="bg-red-400" />
        </div>
      </div>

      {/* Pause placement */}
      <div>
        <div className="flex justify-between items-baseline mb-1.5">
          <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wide">Pause placement</h3>
          <span className="text-sm font-semibold text-slate-700">
            {pausePlacement.boundaryPercent}% at phrase boundaries
          </span>
        </div>
        <div className="bg-slate-100 rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full transition-all duration-300 ${boundaryColor(pausePlacement.boundaryPercent)}`}
            style={{ width: `${pausePlacement.boundaryPercent}%` }}
          />
        </div>
        <p className="text-xs text-slate-400 mt-1.5">
          {pausePlacement.atBoundary} of {pausePlacement.totalPauses} pauses at syntactic boundaries
          {pausePlacement.midPhrase > 0 && ` · ${pausePlacement.midPhrase} mid-phrase pause${pausePlacement.midPhrase > 1 ? 's' : ''}`}
        </p>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  sub,
  valueClass,
}: {
  label: string
  value: string | number
  sub: string
  valueClass: string
}) {
  return (
    <div className="text-center bg-slate-50 rounded-lg p-4">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={valueClass}>{value}</p>
      <p className="text-xs text-slate-400 mt-1">{sub}</p>
    </div>
  )
}

// Mock data for visual testing — remove once real pipeline is wired
export const MOCK_METRICS: Metrics = {
  wcpm: 87,
  correctWords: 48,
  totalWords: 56,
  durationSeconds: 33.1,
  errorCounts: {
    substitutions: 3,
    omissions: 1,
    insertions: 0,
    verbalHesitations: 1,
    silentHesitations: 1,
  },
  pausePlacement: {
    totalPauses: 5,
    atBoundary: 4,
    midPhrase: 1,
    boundaryPercent: 80,
  },
  selfCorrections: 0,
  accuracy: 85.7,
}
