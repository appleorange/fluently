'use client'

import { WordStatus, Passage } from '@/lib/types'

export interface PassageDisplayProps {
  passage: Passage
  wordStatuses: Map<number, WordStatus>
}

function getWordClass(status: WordStatus): string {
  switch (status) {
    case 'correct':
      return 'bg-green-100 text-green-800'
    case 'substitution':
    case 'omission':
    case 'insertion':
      return 'bg-red-100 text-red-800'
    case 'hesitation':
      return 'bg-yellow-100 text-yellow-800'
    case 'uncertain':
      return 'bg-slate-100 text-slate-400 italic'
    case 'pending':
    default:
      return 'text-slate-500'
  }
}

export default function PassageDisplay({ passage, wordStatuses }: PassageDisplayProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
      <div className="mb-4">
        <h2 className="font-semibold text-slate-800">{passage.title}</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Grade {passage.grade} &middot; Target: {passage.targetWCPM} WCPM
        </p>
      </div>

      <p className="leading-loose text-base select-none">
        {passage.text.trim().split(/\s+/).map((word, i) => {
          const status = wordStatuses.get(i) ?? 'pending'
          return (
            <span key={i} className="inline">
              <span
                className={`rounded px-0.5 transition-colors duration-150 ${getWordClass(status)}`}
              >
                {word}
              </span>
              {' '}
            </span>
          )
        })}
      </p>

      <div className="flex flex-wrap gap-4 mt-5 pt-4 border-t border-slate-100">
        <LegendItem color="bg-green-100" label="Correct" />
        <LegendItem color="bg-red-100" label="Error" />
        <LegendItem color="bg-yellow-100" label="Hesitation" />
        <LegendItem color="bg-slate-100" label="Uncertain transcription" />
        <LegendItem color="bg-slate-50" label="Not yet read" />
      </div>
    </div>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-slate-500">
      <span className={`inline-block w-3 h-3 rounded-sm ${color}`} />
      {label}
    </span>
  )
}

// Mock data for visual testing — remove once real pipeline is wired
export const MOCK_PASSAGE: Passage = {
  grade: 4,
  title: 'The New Puppy',
  source: 'Mock passage for UI development',
  targetWCPM: 115,
  text: 'Maya found a small brown puppy sleeping under the old oak tree in her backyard. She ran inside to tell her mother, who smiled and said they could keep it if no one came to claim it. Maya named the puppy Biscuit and spent the whole afternoon making a cozy bed from an empty cardboard box.',
  words: [
    'Maya', 'found', 'a', 'small', 'brown', 'puppy', 'sleeping', 'under', 'the', 'old',
    'oak', 'tree', 'in', 'her', 'backyard', 'She', 'ran', 'inside', 'to', 'tell',
    'her', 'mother', 'who', 'smiled', 'and', 'said', 'they', 'could', 'keep', 'it',
    'if', 'no', 'one', 'came', 'to', 'claim', 'it', 'Maya', 'named', 'the',
    'puppy', 'Biscuit', 'and', 'spent', 'the', 'whole', 'afternoon', 'making', 'a', 'cozy',
    'bed', 'from', 'an', 'empty', 'cardboard', 'box',
  ],
}

export const MOCK_WORD_STATUSES: Map<number, WordStatus> = new Map([
  [0, 'correct'],
  [1, 'correct'],
  [2, 'correct'],
  [3, 'correct'],
  [4, 'correct'],
  [5, 'correct'],
  [6, 'substitution'],  // said "running" instead of "sleeping"
  [7, 'correct'],
  [8, 'correct'],
  [9, 'correct'],
  [10, 'correct'],
  [11, 'correct'],
  [12, 'correct'],
  [13, 'correct'],
  [14, 'correct'],
  [15, 'hesitation'],   // long pause before "She"
  [16, 'correct'],
  [17, 'correct'],
  [18, 'correct'],
  [19, 'correct'],
  [20, 'correct'],
  [21, 'omission'],     // skipped "mother"
  [22, 'correct'],
  [23, 'correct'],
  [24, 'correct'],
  [25, 'correct'],
  [26, 'correct'],
  [27, 'correct'],
  [28, 'correct'],
  [29, 'correct'],
  // remaining words are 'pending' (not yet read)
])
