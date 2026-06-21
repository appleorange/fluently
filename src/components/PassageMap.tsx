'use client'

import { useState, useRef } from 'react'

interface PassageMapProps {
  onGenerate: (complexity: number, register: number) => void
  isGenerating: boolean
  initialComplexity?: number
  initialRegister?: number
  recommendedPosition?: { complexity: number; register: number } | null
  readOnly?: boolean
}

const SIZE = 360
const DOT_STEP = 20
const DOT_R = 2
const POINT_R = 8

export default function PassageMap({
  onGenerate,
  isGenerating,
  initialComplexity = 0.5,
  initialRegister = 0.5,
  recommendedPosition = null,
  readOnly = false
}: PassageMapProps) {
  const [pos, setPos] = useState({
    x: initialComplexity * SIZE,
    y: (1 - initialRegister) * SIZE
  })

  const recommended = recommendedPosition
    ? { x: recommendedPosition.complexity * SIZE, y: (1 - recommendedPosition.register) * SIZE }
    : null
  const showArrow = recommended && Math.hypot(recommended.x - pos.x, recommended.y - pos.y) > 6
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
      {/* Canvas — labels live inside the SVG so alignment is exact */}
      <div className="relative">
        <svg
          ref={svgRef}
          width={SIZE}
          height={SIZE}
          className="rounded-xl border border-slate-200 bg-white touch-none"
          style={{ cursor: isGenerating ? 'wait' : readOnly ? 'default' : 'crosshair' }}
          onPointerDown={isGenerating || readOnly ? undefined : handlePointerDown}
          onPointerMove={isGenerating || readOnly ? undefined : handlePointerMove}
          onPointerUp={isGenerating || readOnly ? undefined : handlePointerUp}
        >
          {dots}

          {/* Y-axis — vertical line through center */}
          <line x1={SIZE / 2} y1={0} x2={SIZE / 2} y2={SIZE} stroke="#cbd5e1" strokeWidth={1} strokeDasharray="4 3" style={{ pointerEvents: 'none' }} />
          <text x={SIZE / 2} y={14} fontSize={10} fill="#94a3b8" textAnchor="middle" style={{ pointerEvents: 'none', userSelect: 'none' }}>Formal</text>
          <text x={SIZE / 2} y={SIZE - 6} fontSize={10} fill="#94a3b8" textAnchor="middle" style={{ pointerEvents: 'none', userSelect: 'none' }}>Casual</text>

          {/* X-axis — horizontal line through center */}
          <line x1={0} y1={SIZE / 2} x2={SIZE} y2={SIZE / 2} stroke="#cbd5e1" strokeWidth={1} strokeDasharray="4 3" style={{ pointerEvents: 'none' }} />
          <text x={6} y={SIZE / 2 - 4} fontSize={10} fill="#94a3b8" textAnchor="start" style={{ pointerEvents: 'none', userSelect: 'none' }}>Easy</text>
          <text x={SIZE - 6} y={SIZE / 2 - 4} fontSize={10} fill="#94a3b8" textAnchor="end" style={{ pointerEvents: 'none', userSelect: 'none' }}>Difficult</text>

          {/* Recommended next position — arrow from current pin, drawn before the pin so the pin sits on top */}
          {showArrow && recommended && (
            <>
              <defs>
                <marker id="rec-arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                  <path d="M0,0 L8,4 L0,8 Z" fill="#2563eb" />
                </marker>
              </defs>
              <line
                x1={pos.x} y1={pos.y} x2={recommended.x} y2={recommended.y}
                stroke="#2563eb" strokeWidth={2} strokeDasharray="5 4"
                markerEnd="url(#rec-arrowhead)" style={{ pointerEvents: 'none' }}
              />
              <circle cx={recommended.x} cy={recommended.y} r={5} fill="#2563eb" style={{ pointerEvents: 'none' }} />
            </>
          )}

          {/* Draggable point */}
          <circle
            cx={pos.x}
            cy={pos.y}
            r={POINT_R}
            fill="#f97316"
            stroke="#c2410c"
            strokeWidth={2.5}
            style={{ filter: 'drop-shadow(0 2px 6px rgba(249,115,22,0.45))', pointerEvents: 'none' }}
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
  )
}
