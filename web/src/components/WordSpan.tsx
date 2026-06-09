import { useState, useRef, useCallback } from 'react'
import Tooltip from './Tooltip'
import type { WordStatus } from '../types'

interface Props {
  word: string
  status: WordStatus | undefined
  onUpdateWordStatus: (word: string, status: WordStatus) => Promise<void>
}

export default function WordSpan({ word, status, onUpdateWordStatus }: Props) {
  const [showTooltip, setShowTooltip] = useState(false)
  const enterTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMouseEnter = useCallback(() => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current)
    enterTimer.current = setTimeout(() => setShowTooltip(true), 100)
  }, [])

  const handleMouseLeave = useCallback(() => {
    if (enterTimer.current) clearTimeout(enterTimer.current)
    leaveTimer.current = setTimeout(() => setShowTooltip(false), 200)
  }, [])

  const colorClass =
    status === 'learning'
      ? 'text-orange-400 underline decoration-orange-400 underline-offset-2'
      : status === 'learned'
      ? 'text-green-400 underline decoration-green-400 underline-offset-2'
      : ''

  return (
    // Tooltip is a child of this container — mouseLeave does NOT fire when
    // mouse moves from word to tooltip, so the tooltip stays open.
    <span className="relative inline-block" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <span className={`cursor-pointer hover:opacity-80 ${colorClass}`}>{word}</span>
      {showTooltip && (
        <Tooltip
          word={word}
          status={status}
          onUpdateWordStatus={onUpdateWordStatus}
          onClose={() => setShowTooltip(false)}
        />
      )}
    </span>
  )
}
