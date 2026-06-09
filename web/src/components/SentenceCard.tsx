import { useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { ExternalLink, X } from 'lucide-react'
import type { ApiSentence, WordStatus } from '../types'
import WordSpan from './WordSpan'

const PAD = 8

function DisabledTimestamp({ children, label }: { children: React.ReactNode; label: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [pos, setPos] = useState<{ x: number; y: number; flip: boolean } | null>(null)

  const handleEnter = useCallback(() => {
    if (!ref.current) return
    const r = ref.current.getBoundingClientRect()
    const tooltipW = 180
    const rawX = r.left + r.width / 2
    const clampedX = Math.max(PAD + tooltipW / 2, Math.min(window.innerWidth - PAD - tooltipW / 2, rawX))
    const flip = r.top < 60
    setPos({ x: clampedX, y: flip ? r.bottom + 6 : r.top - 6, flip })
  }, [])

  const handleLeave = useCallback(() => setPos(null), [])

  return (
    <>
      <span
        ref={ref}
        className="flex items-center gap-1 text-[12px] cursor-not-allowed"
        style={{ color: 'var(--text-secondary)', opacity: 0.45 }}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
      >
        {children}
      </span>
      {pos && createPortal(
        <div
          style={{
            position: 'fixed',
            left: pos.x,
            top: pos.y,
            transform: pos.flip ? 'translateX(-50%)' : 'translateX(-50%) translateY(-100%)',
            zIndex: 9999,
            pointerEvents: 'none',
          }}
        >
          <div
            className="text-[11px] rounded-lg px-2.5 py-1.5 whitespace-nowrap"
            style={{
              background: 'var(--bg-card)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--separator)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            }}
          >
            {label}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

interface Props {
  sentence: ApiSentence
  wordMap: Map<string, WordStatus>
  onUpdateWordStatus: (word: string, status: WordStatus) => Promise<void>
  onRemoveWordStatus: (word: string) => Promise<void>
  onDelete: (id: number) => Promise<void>
}

const PLATFORM_COLOR: Record<string, string> = {
  netflix: '#E50914',
  hbomax: '#5822B4',
  youtube: '#FF0000',
}

const PLATFORM_LABEL: Record<string, string> = {
  netflix: 'Netflix',
  hbomax: 'HBO Max',
  youtube: 'YouTube',
}

function formatTime(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function getJumpUrl(url: string, platform: string, timestampS: number): string {
  try {
    const u = new URL(url)
    if (platform === 'netflix' || platform === 'youtube') {
      u.searchParams.set('t', String(timestampS))
    }
    return u.toString()
  } catch {
    return url
  }
}

function tokenize(text: string): Array<{ raw: string; isWord: boolean }> {
  return text.split(/([a-zA-Z]+)/).map(part => ({
    raw: part,
    isWord: /^[a-zA-Z]+$/.test(part),
  }))
}

export default function SentenceCard({ sentence, wordMap, onUpdateWordStatus, onRemoveWordStatus, onDelete }: Props) {
  const tokens = tokenize(sentence.text)

  const taggedWords = [
    ...new Set(
      tokens
        .filter(t => t.isWord && wordMap.has(t.raw.toLowerCase()))
        .map(t => t.raw.toLowerCase())
    ),
  ]

  const platformColor = PLATFORM_COLOR[sentence.platform] ?? '#888'

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all duration-150"
      style={{
        background: 'var(--bg-card)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
      }}
    >
      {/* Card header */}
      <div
        className="flex items-center justify-between px-4 pt-3 pb-2.5 gap-2"
        style={{ borderBottom: '1px solid var(--separator)' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: platformColor }}
          />
          <span
            className="text-[12px] font-medium shrink-0"
            style={{ color: platformColor, opacity: 0.85 }}
          >
            {PLATFORM_LABEL[sentence.platform] ?? sentence.platform}
          </span>
          <span
            className="text-[12px] truncate"
            style={{ color: 'var(--text-secondary)' }}
          >
            {sentence.videoTitle ?? sentence.videoUrl.replace(/^https?:\/\//, '').slice(0, 40)}
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {sentence.platform === 'hbomax' ? (
            <DisabledTimestamp label="HBO Max 不支援時間點跳轉">
              <ExternalLink size={11} strokeWidth={2} />
              {formatTime(sentence.timestampS)}
            </DisabledTimestamp>
          ) : (
            <a
              href={getJumpUrl(sentence.videoUrl, sentence.platform, sentence.timestampS)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[12px] transition-opacity hover:opacity-70"
              style={{ color: 'var(--ios-blue)' }}
            >
              <ExternalLink size={11} strokeWidth={2} />
              {formatTime(sentence.timestampS)}
            </a>
          )}
          <button
            onClick={() => onDelete(sentence.id)}
            className="w-5 h-5 flex items-center justify-center rounded-full transition-all hover:opacity-70"
            style={{ color: 'var(--text-secondary)', background: 'rgba(120,120,128,0.1)' }}
            title="刪除"
            aria-label="刪除句子"
          >
            <X size={10} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-3">
        <p
          className="text-[15px] leading-relaxed mb-1"
          style={{ color: 'var(--text-primary)' }}
        >
          {tokens.map((t, i) =>
            t.isWord ? (
              <WordSpan
                key={i}
                word={t.raw}
                status={wordMap.get(t.raw.toLowerCase())}
                onUpdateWordStatus={onUpdateWordStatus}
                onRemoveWordStatus={onRemoveWordStatus}
              />
            ) : (
              <span key={i}>{t.raw}</span>
            )
          )}
        </p>

        {sentence.translation && (
          <p
            className="text-[13px] leading-relaxed"
            style={{ color: 'var(--text-secondary)' }}
          >
            {sentence.translation}
          </p>
        )}

        {taggedWords.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {taggedWords.map(w => (
              <span
                key={w}
                className="text-[11px] rounded-full px-2 py-0.5"
                style={{
                  background: wordMap.get(w) === 'learning'
                    ? 'rgba(255,149,0,0.12)'
                    : 'rgba(52,199,89,0.12)',
                  color: wordMap.get(w) === 'learning'
                    ? 'var(--ios-orange)'
                    : 'var(--ios-green)',
                }}
              >
                {w}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
