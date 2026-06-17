import { useDefinition } from '../hooks/useDefinition'
import type { PracticeRating, PracticeWord } from '../types'
import { calcNextInterval } from '../utils/sm2'

interface Props {
  item: PracticeWord
  flipped: boolean
  onFlip: () => void
  onAnswer: (rating: PracticeRating) => void
}

const SPEAKER_SVG = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
  </svg>
)

function speak(word: string) {
  if (!('speechSynthesis' in window)) return
  const u = new SpeechSynthesisUtterance(word)
  u.lang = 'en-US'
  u.rate = 0.9
  window.speechSynthesis.speak(u)
}


function metaText(item: PracticeWord): string {
  if (item.nextReviewAt === null) return '新單字 · 首次複習'
  return `間隔：${item.intervalDays} 天`
}

const RATINGS: { rating: PracticeRating; label: string; icon: string; style: React.CSSProperties; hoverBg: string }[] = [
  { rating: 1, label: 'Again', icon: '✕', style: { background: 'rgba(255,69,58,0.12)', color: '#FF453A', border: '1px solid rgba(255,69,58,0.25)' }, hoverBg: 'rgba(255,69,58,0.22)' },
  { rating: 2, label: 'Hard',  icon: '△', style: { background: 'rgba(255,159,10,0.12)', color: '#FF9F0A', border: '1px solid rgba(255,159,10,0.25)' }, hoverBg: 'rgba(255,159,10,0.22)' },
  { rating: 3, label: 'Good',  icon: '✓', style: { background: 'rgba(48,209,88,0.12)',  color: '#30D158', border: '1px solid rgba(48,209,88,0.25)' },  hoverBg: 'rgba(48,209,88,0.22)' },
  { rating: 4, label: 'Easy',  icon: '★', style: { background: 'rgba(10,132,255,0.12)', color: '#0A84FF', border: '1px solid rgba(10,132,255,0.25)' }, hoverBg: 'rgba(10,132,255,0.22)' },
]

export default function FlashCard({ item, flipped, onFlip, onAnswer }: Props) {
  const { definition, partOfSpeech, loading } = useDefinition(item.word)

  const sentHtml = item.sentence
    ? item.sentence.text.replace(new RegExp(`(${item.word})`, 'gi'), '<span style="color:var(--ios-orange);font-weight:600">$1</span>')
    : null

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-[460px]">
      {/* Card */}
      <div className="w-full" style={{ display: 'grid' }}>
        {/* Front */}
        <div
          style={{
            gridArea: '1/1',
            background: 'var(--bg-card)',
            border: '1px solid var(--separator)',
            borderRadius: '16px',
            padding: '28px 24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            minHeight: '160px',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transition: 'opacity 0.15s, transform 0.35s cubic-bezier(0.4,0,0.2,1)',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            opacity: flipped ? 0 : 1,
            zIndex: flipped ? 1 : 2,
            pointerEvents: flipped ? 'none' : 'all',
          }}
        >
          <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: '10px' }}>
            英文單字
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ fontSize: '36px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              {item.word}
            </div>
            <button
              onClick={() => speak(item.word)}
              title="播放發音"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '50%', background: 'var(--bg-subtle)', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', flexShrink: 0 }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-subtle)'; e.currentTarget.style.color = 'var(--text-tertiary)' }}
            >
              {SPEAKER_SVG}
            </button>
          </div>
          {partOfSpeech && (
            <div style={{ fontSize: '12px', fontStyle: 'italic', color: 'var(--text-tertiary)', marginTop: '6px' }}>
              {partOfSpeech}
            </div>
          )}
          <div style={{ fontSize: '11px', color: 'var(--text-disabled)', marginTop: '14px', padding: '4px 10px', background: 'var(--bg-subtle)', borderRadius: '20px' }}>
            {metaText(item)}
          </div>
        </div>

        {/* Back */}
        <div
          style={{
            gridArea: '1/1',
            background: 'var(--bg-card)',
            border: '1px solid var(--separator)',
            borderRadius: '16px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transition: 'opacity 0.15s, transform 0.35s cubic-bezier(0.4,0,0.2,1)',
            transform: flipped ? 'rotateY(0deg)' : 'rotateY(-180deg)',
            opacity: flipped ? 1 : 0,
            zIndex: flipped ? 2 : 1,
            pointerEvents: flipped ? 'all' : 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>{item.word}</div>
            {partOfSpeech && (
              <div style={{ fontSize: '11px', fontStyle: 'italic', color: 'var(--text-tertiary)' }}>{partOfSpeech}</div>
            )}
            <button
              onClick={() => speak(item.word)}
              title="播放發音"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '50%', background: 'var(--bg-subtle)', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', flexShrink: 0 }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-subtle)'; e.currentTarget.style.color = 'var(--text-tertiary)' }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </svg>
            </button>
          </div>
          <div style={{ fontSize: '13px', lineHeight: 1.55, color: loading ? 'var(--text-tertiary)' : 'var(--text-secondary)' }}>
            {loading ? '…' : definition}
          </div>
          {sentHtml && (
            <>
              <div style={{ height: '1px', background: 'var(--separator)', margin: '4px 0' }} />
              <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-disabled)' }}>
                出現在句子
              </div>
              <div style={{ fontSize: '12px', lineHeight: 1.6, color: 'var(--text-tertiary)' }} dangerouslySetInnerHTML={{ __html: sentHtml }} />
              {item.sentence?.translation && (
                <div style={{ fontSize: '11px', color: 'var(--text-disabled)' }}>{item.sentence.translation}</div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Controls */}
      {!flipped ? (
        <button
          onClick={onFlip}
          className="px-6 py-2 rounded-xl text-sm transition-colors"
          style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
        >
          翻面看答案 →
        </button>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px', width: '100%' }}>
          {RATINGS.map(({ rating, label, icon, style, hoverBg }) => (
            <button
              key={rating}
              onClick={() => onAnswer(rating)}
              style={{ ...style, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '12px 6px', borderRadius: '14px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, gap: '3px' }}
              onMouseEnter={e => (e.currentTarget.style.background = hoverBg)}
              onMouseLeave={e => (e.currentTarget.style.background = style.background as string)}
            >
              {icon} {label}
              <span style={{ fontSize: '10px', fontWeight: 400, opacity: 0.65 }}>{calcNextInterval(rating, item.intervalDays, item.repetitions, item.easeFactor)} 天後</span>
            </button>
          ))}
        </div>
      )}

      <div style={{ fontSize: '11px', color: 'var(--text-disabled)' }}>
        {flipped ? (
          <>誠實評分 · <kbd style={{ background: 'var(--bg-subtle)', border: '1px solid var(--separator)', borderRadius: '4px', padding: '1px 5px', fontSize: '10px' }}>1</kbd>–<kbd style={{ background: 'var(--bg-subtle)', border: '1px solid var(--separator)', borderRadius: '4px', padding: '1px 5px', fontSize: '10px' }}>4</kbd> 快捷鍵</>
        ) : (
          <>先回想這個單字的意思，再翻面確認 · <kbd style={{ background: 'var(--bg-subtle)', border: '1px solid var(--separator)', borderRadius: '4px', padding: '1px 5px', fontSize: '10px' }}>Space</kbd></>
        )}
      </div>
    </div>
  )
}
