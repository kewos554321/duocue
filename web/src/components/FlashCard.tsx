import { useDefinition } from '../hooks/useDefinition'
import type { PracticeWord } from '../types'

interface Props {
  item: PracticeWord
  flipped: boolean
  onFlip: () => void
  onAnswer: (result: 'know' | 'unknown') => void
}

function metaText(item: PracticeWord): string {
  if (item.nextReviewAt === null) return '新單字 · 首次複習'
  return `間隔：${item.intervalDays} 天`
}

export default function FlashCard({ item, flipped, onFlip, onAnswer }: Props) {
  const { definition, partOfSpeech, loading } = useDefinition(item.word)

  const nextKnow = item.intervalDays * 2
  const nextUnknown = 1

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
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            minHeight: '140px',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transition: 'opacity 0.15s, transform 0.35s cubic-bezier(0.4,0,0.2,1)',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            opacity: flipped ? 0 : 1,
            zIndex: flipped ? 1 : 2,
            pointerEvents: flipped ? 'none' : 'all',
          }}
        >
          <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: '6px' }}>
            英文單字
          </div>
          <div style={{ fontSize: '36px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            {item.word}
          </div>
          {partOfSpeech && (
            <div style={{ fontSize: '12px', fontStyle: 'italic', color: 'var(--text-tertiary)', marginTop: '4px' }}>
              {partOfSpeech}
            </div>
          )}
          <div style={{ fontSize: '11px', color: 'var(--text-disabled)', marginTop: '10px' }}>
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
          <div>
            <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>{item.word}</div>
            {partOfSpeech && (
              <div style={{ fontSize: '11px', fontStyle: 'italic', color: 'var(--text-tertiary)' }}>{partOfSpeech}</div>
            )}
          </div>
          <div style={{ fontSize: '13px', lineHeight: 1.55, color: loading ? 'var(--text-tertiary)' : 'var(--text-secondary)' }}>
            {loading ? '…' : definition}
          </div>
          {item.sentence && (
            <>
              <div style={{ height: '1px', background: 'var(--separator)', margin: '2px 0' }} />
              <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-disabled)' }}>
                出現在句子
              </div>
              <div
                style={{ fontSize: '12px', lineHeight: 1.55, color: 'var(--text-tertiary)' }}
                dangerouslySetInnerHTML={{
                  __html: item.sentence.text.replace(
                    new RegExp(`(${item.word})`, 'gi'),
                    '<span style="color:var(--ios-orange);font-weight:600">$1</span>'
                  )
                }}
              />
              {item.sentence.translation && (
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
          style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
        >
          翻面看答案 →
        </button>
      ) : (
        <div className="flex gap-3 w-full">
          <button
            onClick={() => onAnswer('unknown')}
            className="flex-1 flex flex-col items-center py-3 rounded-2xl text-sm font-semibold gap-0.5 transition-colors"
            style={{ background: 'rgba(255,69,58,0.12)', color: '#FF453A', border: '1px solid rgba(255,69,58,0.2)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,69,58,0.2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,69,58,0.12)')}
          >
            ✕ 不知道
            <span style={{ fontSize: '11px', fontWeight: 400, opacity: 0.65 }}>重設 → {nextUnknown} 天後</span>
          </button>
          <button
            onClick={() => onAnswer('know')}
            className="flex-1 flex flex-col items-center py-3 rounded-2xl text-sm font-semibold gap-0.5 transition-colors"
            style={{ background: 'rgba(48,209,88,0.12)', color: '#30D158', border: '1px solid rgba(48,209,88,0.2)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(48,209,88,0.2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(48,209,88,0.12)')}
          >
            ✓ 知道
            <span style={{ fontSize: '11px', fontWeight: 400, opacity: 0.65 }}>下次 → {nextKnow} 天後</span>
          </button>
        </div>
      )}

      <div style={{ fontSize: '11px', color: 'var(--text-disabled)' }}>
        {flipped ? '誠實評分——這樣記憶曲線才準確' : '先回想這個單字的意思，再翻面確認'}
      </div>
    </div>
  )
}
