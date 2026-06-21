'use client'

import { useState, useRef } from 'react'
import DotGrid from './DotGrid'

interface PassageMapProps {
  onGenerate: (complexity: number, register: number) => void
  isGenerating: boolean
  initialComplexity?: number
  initialRegister?: number
  recommendedPosition?: { complexity: number; register: number } | null
  readOnly?: boolean
}

const SIZE = 360
const GRID_DOT_SIZE = 3 // matches the DotGrid dotSize prop below
const SELECTED_DOT_R = GRID_DOT_SIZE // radius = grid dot's own diameter = twice its radius
const DOT_ACTIVE_COLOR = '#3c1bc4'
const SELECTED_DOT_COLOR = '#2563eb' // blue

function toPoint(complexity: number, register: number) {
  return { x: complexity * SIZE, y: (1 - register) * SIZE }
}

export default function PassageMap({
  onGenerate,
  isGenerating,
  initialComplexity,
  initialRegister,
  recommendedPosition = null,
  readOnly = false
}: PassageMapProps) {
  // No selection at all until the reader actually picks a spot — initialComplexity/Register are
  // only passed by the caller once a real choice exists (e.g. the passage just read).
  const [pos, setPos] = useState<{ x: number; y: number } | null>(
    initialComplexity !== undefined && initialRegister !== undefined
      ? toPoint(initialComplexity, initialRegister)
      : null
  )

  const recommended = recommendedPosition ? toPoint(recommendedPosition.complexity, recommendedPosition.register) : null
  const showArrow = !!(recommended && pos && Math.hypot(recommended.x - pos.x, recommended.y - pos.y) > 6)
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
    setPos(toSVGPos(e.clientX, e.clientY))
  }

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging.current) return
    setPos(toSVGPos(e.clientX, e.clientY))
  }

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging.current) return
    dragging.current = false
    const p = toSVGPos(e.clientX, e.clientY)
    setPos(p)
    onGenerate(p.x / SIZE, 1 - p.y / SIZE)
  }

  return (
    <div className="flex flex-col gap-1 select-none">
      {/* Canvas — labels live inside the SVG so alignment is exact */}
      <div className="relative rounded-xl border border-slate-200 bg-white overflow-hidden" style={{ width: SIZE, height: SIZE }}>
        {/* Animated dot grid background — reacts to hover (proximity glow) and click (shockwave) */}
        <div className="absolute inset-0">
          <DotGrid
            dotSize={GRID_DOT_SIZE}
            gap={10}
            baseColor="#e2e8f0"
            activeColor={DOT_ACTIVE_COLOR}
            proximity={80}
            shockRadius={150}
            shockStrength={5}
            resistance={750}
            returnDuration={1.5}
            lockedPointer={pos}
          />
        </div>

        <svg
          ref={svgRef}
          width={SIZE}
          height={SIZE}
          className="absolute inset-0 touch-none"
          style={{ cursor: isGenerating ? 'wait' : readOnly ? 'default' : 'crosshair' }}
          onPointerDown={isGenerating || readOnly ? undefined : handlePointerDown}
          onPointerMove={isGenerating || readOnly ? undefined : handlePointerMove}
          onPointerUp={isGenerating || readOnly ? undefined : handlePointerUp}
        >
          {/* Y-axis — vertical line through center */}
          <line x1={SIZE / 2} y1={0} x2={SIZE / 2} y2={SIZE} stroke="#cbd5e1" strokeWidth={1} strokeDasharray="4 3" style={{ pointerEvents: 'none' }} />
          <text x={SIZE / 2} y={14} fontSize={10} fill="#94a3b8" textAnchor="middle" style={{ pointerEvents: 'none', userSelect: 'none' }}>Formal</text>
          <text x={SIZE / 2} y={SIZE - 6} fontSize={10} fill="#94a3b8" textAnchor="middle" style={{ pointerEvents: 'none', userSelect: 'none' }}>Casual</text>

          {/* X-axis — horizontal line through center */}
          <line x1={0} y1={SIZE / 2} x2={SIZE} y2={SIZE / 2} stroke="#cbd5e1" strokeWidth={1} strokeDasharray="4 3" style={{ pointerEvents: 'none' }} />
          <text x={6} y={SIZE / 2 - 4} fontSize={10} fill="#94a3b8" textAnchor="start" style={{ pointerEvents: 'none', userSelect: 'none' }}>Easy</text>
          <text x={SIZE - 6} y={SIZE / 2 - 4} fontSize={10} fill="#94a3b8" textAnchor="end" style={{ pointerEvents: 'none', userSelect: 'none' }}>Difficult</text>

          {/* Recommended next position — dot always shows when a recommendation exists (even if
              it's the same spot as the current pin — that's a valid "stay here" outcome); the
              arrow only draws when there's an actual meaningful distance to point across. */}
          {recommended && pos && showArrow && (
            <circle cx={recommended.x} cy={recommended.y} r={SELECTED_DOT_R + 3}
              fill="none" stroke="#16a34a" strokeWidth={1.5} strokeDasharray="3 2"
              style={{ pointerEvents: 'none' }} />
          )}

          {/* Selected position — a solid navy dot, twice the size of the background grid dots.
              Nothing renders here at all until the reader actually picks a position. */}
          {pos && (
            <circle
              cx={pos.x}
              cy={pos.y}
              r={SELECTED_DOT_R}
              fill={SELECTED_DOT_COLOR}
              style={{ pointerEvents: 'none' }}
            />
          )}

          {/* Recommendation is the same spot as current — show as a blue halo ring around the
              selected dot instead of a coincident dot that would just be hidden underneath it */}
          {recommended && pos && !showArrow && (
            <circle
              cx={pos.x} cy={pos.y} r={SELECTED_DOT_R + 3}
              fill="none" stroke="#16a34a" strokeWidth={1.5} strokeDasharray="3 2"
              style={{ pointerEvents: 'none' }}
            />
          )}

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
