'use client'

import { useState, useRef } from 'react'

interface PassageMapProps {
  onGenerate: (complexity: number, register: number) => void
  isGenerating: boolean
  initialComplexity?: number
  initialRegister?: number
}

const SIZE = 360
const DOT_STEP = 20
const DOT_R = 2
const POINT_R = 8

export default function PassageMap({
  onGenerate,
  isGenerating,
  initialComplexity = 0.5,
  initialRegister = 0.5
}: PassageMapProps) {
  const [pos, setPos] = useState({
    x: initialComplexity * SIZE,
    y: (1 - initialRegister) * SIZE
  })
  const dragging = useRef(false)
  const svgRef = useRef<SVGSVGElement>(null)

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

  const toSVGPos = (clientX: number, clientY: number) => {
    const rect = svgRef.current!.getBoundingClientRect()
    return {
      x: clamp(clientX - rect.left, 0, SIZE),
      y: clamp(clientY - rect.top, 0, SIZE)
    }
  }

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragging.current = true
    const p = toSVGPos(e.clientX, e.clientY)
    setPos(p)
  }

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging.current) return
    const p = toSVGPos(e.clientX, e.clientY)
    setPos(p)
  }

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging.current) return
    dragging.current = false
    const p = toSVGPos(e.clientX, e.clientY)
    setPos(p)
    onGenerate(p.x / SIZE, 1 - p.y / SIZE)
  }

  // Build dot grid
  const dots: React.ReactNode[] = []
  for (let x = DOT_STEP; x < SIZE; x += DOT_STEP) {
    for (let y = DOT_STEP; y < SIZE; y += DOT_STEP) {
      dots.push(<circle key={`${x}-${y}`} cx={x} cy={y} r={DOT_R} fill="#e2e8f0" />)
    }
  }

  return (
    <div className="flex flex-col gap-1 select-none">
      <div className="flex gap-2 items-stretch">
        {/* Y-axis labels */}
        <div className="flex flex-col justify-between items-end text-xs text-slate-400 pr-1 w-12">
          <span>Formal</span>
          <span>Casual</span>
        </div>

        {/* Canvas */}
        <div className="relative">
          <svg
            ref={svgRef}
            width={SIZE}
            height={SIZE}
            className="rounded-xl border border-slate-200 bg-white touch-none"
            style={{ cursor: isGenerating ? 'wait' : 'crosshair' }}
            onPointerDown={isGenerating ? undefined : handlePointerDown}
            onPointerMove={isGenerating ? undefined : handlePointerMove}
            onPointerUp={isGenerating ? undefined : handlePointerUp}
          >
            {dots}

            {/* Draggable point */}
            <circle
              cx={pos.x}
              cy={pos.y}
              r={POINT_R}
              fill="#f97316"
              stroke="#c2410c"
              strokeWidth={2.5}
              className="pointer-events-none"
              style={{ filter: 'drop-shadow(0 2px 6px rgba(249,115,22,0.45))' }}
            />

            {/* Generating overlay */}
            {isGenerating && (
              <rect x={0} y={0} width={SIZE} height={SIZE} fill="rgba(248,250,252,0.72)" rx={12} />
            )}
          </svg>

          {/* Spinner centered over canvas */}
          {isGenerating && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <svg className="animate-spin h-8 w-8 text-orange-500" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* X-axis labels */}
      <div className="flex justify-between text-xs text-slate-400 pl-14">
        <span>Easy</span>
        <span>Difficult</span>
      </div>
    </div>
  )
}
