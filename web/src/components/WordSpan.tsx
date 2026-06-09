import { useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Tooltip from './Tooltip'
import type { WordStatus } from '../types'

interface Props {
  word: string
  status: WordStatus | undefined
  onUpdateWordStatus: (word: string, status: WordStatus) => Promise<void>
}

export default function WordSpan({ word, status, onUpdateWordStatus }: Props) {
  const [showTooltip, setShowTooltip] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const spanRef = useRef<HTMLSpanElement>(null)
  const enterTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancelLeave = useCallback(() => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current)
  }, [])

  const startLeave = useCallback(() => {
    if (enterTimer.current) clearTimeout(enterTimer.current)
    leaveTimer.current = setTimeout(() => setShowTooltip(false), 200)
  }, [])

  const handleMouseEnter = useCallback(() => {
    cancelLeave()
    enterTimer.current = setTimeout(() => {
      if (spanRef.current) {
        const r = spanRef.current.getBoundingClientRect()
        setPos({ x: r.left + r.width / 2, y: r.top - 8 })
      }
      setShowTooltip(true)
    }, 100)
  }, [cancelLeave])

  const colorClass =
    status === 'learning'
      ? 'text-orange-400 underline decoration-orange-400 underline-offset-2'
      : status === 'learned'
      ? 'text-green-400 underline decoration-green-400 underline-offset-2'
      : ''

  return (
    <>
      <span
        ref={spanRef}
        className="relative inline-block"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={startLeave}
      >
        <span className={`cursor-pointer hover:opacity-80 ${colorClass}`}>{word}</span>
      </span>

      {showTooltip && createPortal(
        // Portal renders at document.body — no clipping from overflow-y:auto on main
        <div
          style={{
            position: 'fixed',
            left: pos.x,
            top: pos.y,
            transform: 'translateX(-50%) translateY(-100%)',
            zIndex: 9999,
          }}
          onMouseEnter={cancelLeave}
          onMouseLeave={startLeave}
        >
          <Tooltip
            word={word}
            status={status}
            onUpdateWordStatus={onUpdateWordStatus}
            onClose={() => setShowTooltip(false)}
          />
        </div>,
        document.body
      )}
    </>
  )
}
