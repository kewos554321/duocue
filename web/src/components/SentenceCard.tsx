import type { ApiSentence, WordStatus } from '../types'
import WordSpan from './WordSpan'

interface Props {
  sentence: ApiSentence
  wordMap: Map<string, WordStatus>
  onUpdateWordStatus: (word: string, status: WordStatus) => Promise<void>
  onDelete: (id: number) => Promise<void>
}

const PLATFORM_BADGE: Record<string, string> = {
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

export default function SentenceCard({ sentence, wordMap, onUpdateWordStatus, onDelete }: Props) {
  const tokens = tokenize(sentence.text)

  const taggedWords = [
    ...new Set(
      tokens
        .filter(t => t.isWord && wordMap.has(t.raw.toLowerCase()))
        .map(t => t.raw.toLowerCase())
    ),
  ]

  return (
    <div className="bg-[#1C1C1E] rounded-xl p-4 border border-white/10">
      {/* Card header */}
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 text-xs text-white/40 min-w-0">
          <span className="bg-white/10 rounded px-2 py-0.5 shrink-0">
            {PLATFORM_BADGE[sentence.platform] ?? sentence.platform}
          </span>
          <span className="truncate">
            {sentence.videoTitle ?? sentence.videoUrl.replace(/^https?:\/\//, '').slice(0, 50)}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <a
            href={getJumpUrl(sentence.videoUrl, sentence.platform, sentence.timestampS)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            ▶ {formatTime(sentence.timestampS)} 跳回
          </a>
          <button
            onClick={() => onDelete(sentence.id)}
            className="text-white/20 hover:text-red-400 transition-colors text-sm"
            title="刪除"
          >
            ✕
          </button>
        </div>
      </div>

      {/* English text with word-status coloring */}
      <p className="text-white text-base leading-relaxed mb-1">
        {tokens.map((t, i) =>
          t.isWord ? (
            <WordSpan
              key={i}
              word={t.raw}
              status={wordMap.get(t.raw.toLowerCase())}
              onUpdateWordStatus={onUpdateWordStatus}
            />
          ) : (
            <span key={i}>{t.raw}</span>
          )
        )}
      </p>

      {/* Chinese translation */}
      {sentence.translation && (
        <p className="text-white/50 text-sm mb-3">{sentence.translation}</p>
      )}

      {/* Tagged word chips */}
      {taggedWords.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {taggedWords.map(w => (
            <span
              key={w}
              className={`text-xs rounded px-2 py-0.5 ${
                wordMap.get(w) === 'learning'
                  ? 'bg-orange-500/20 text-orange-400'
                  : 'bg-green-500/20 text-green-400'
              }`}
            >
              {w}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
