import { useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Tooltip from './Tooltip'
import type { WordStatus } from '../types'

interface Props {
  word: string
  status: WordStatus | undefined
  onUpdateWordStatus: (word: string, status: WordStatus) => Promise<void>
  onRemoveWordStatus: (word: string) => Promise<void>
}

const TOOLTIP_W = 224 // w-56
const PAD = 8

export default function WordSpan({ word, status, onUpdateWordStatus, onRemoveWordStatus }: Props) {
  const [showTooltip, setShowTooltip] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0, flip: false })
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
        const centerX = r.left + r.width / 2
        const clampedX = Math.max(
          PAD + TOOLTIP_W / 2,
          Math.min(window.innerWidth - PAD - TOOLTIP_W / 2, centerX)
        )
        const flip = r.top < 220
        setPos({
          x: clampedX,
          y: flip ? r.bottom + 8 : r.top - 8,
          flip,
        })
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
        <div
          style={{
            position: 'fixed',
            left: pos.x,
            top: pos.y,
            transform: pos.flip
              ? 'translateX(-50%)'
              : 'translateX(-50%) translateY(-100%)',
            zIndex: 9999,
          }}
          onMouseEnter={cancelLeave}
          onMouseLeave={startLeave}
        >
          <Tooltip
            word={word}
            status={status}
            onUpdateWordStatus={onUpdateWordStatus}
            onRemoveWordStatus={onRemoveWordStatus}
            onClose={() => setShowTooltip(false)}
          />
        </div>,
        document.body
      )}
    </>
  )
}
