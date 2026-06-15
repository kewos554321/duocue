import { useState, useEffect, useCallback } from 'react'
import FlashCard from '../components/FlashCard'
import type { PracticeRating, PracticeWord } from '../types'

interface Props {
  queue: PracticeWord[]
  onReview: (word: string, rating: PracticeRating) => Promise<void>
}

export default function PracticePage({ queue, onReview }: Props) {
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [done, setDone] = useState(0)

  const total = queue.length

  const handleAnswer = useCallback(async (rating: PracticeRating) => {
    await onReview(queue[idx].word, rating)
    setDone(d => d + 1)
    setIdx(i => i + 1)
    setFlipped(false)
  }, [idx, queue, onReview])

  const handleFlip = useCallback(() => setFlipped(true), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (!flipped && (e.code === 'Space' || e.code === 'ArrowRight')) {
        e.preventDefault()
        handleFlip()
      }
      if (flipped && e.key === '1') handleAnswer(1)
      if (flipped && e.key === '2') handleAnswer(2)
      if (flipped && e.key === '3') handleAnswer(3)
      if (flipped && e.key === '4') handleAnswer(4)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flipped, handleFlip, handleAnswer])

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center" style={{ minHeight: '60vh', gap: '12px', textAlign: 'center' }}>
        <div style={{ fontSize: '40px' }}>✅</div>
        <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>今天沒有待複習單字</div>
        <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
          繼續在影片中儲存句子，單字加入學習清單後<br />明天會出現在這裡
        </div>
      </div>
    )
  }

  if (done >= total) {
    return (
      <div className="flex flex-col items-center justify-center" style={{ minHeight: '60vh', gap: '12px', textAlign: 'center' }}>
        <div style={{ fontSize: '40px' }}>🎉</div>
        <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>今日練習完成！</div>
        <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
          完成了 {total} 個單字的複習
        </div>
      </div>
    )
  }

  const pct = Math.round(done / total * 100)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>🧠 練習</h1>
        <span style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>今日待複習：{total} 個單字</span>
      </div>
      <div className="flex items-center gap-3">
        <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{done} / {total}</span>
        <div style={{ flex: 1, height: '3px', background: 'var(--bg-hover)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: '#30D158', borderRadius: '2px', transition: 'width 0.4s ease' }} />
        </div>
      </div>
      <div className="flex justify-center">
        <FlashCard
          item={queue[idx]}
          flipped={flipped}
          onFlip={handleFlip}
          onAnswer={handleAnswer}
        />
      </div>
    </div>
  )
}
