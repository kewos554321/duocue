import { BookOpenCheck, GraduationCap, X } from 'lucide-react'
import { useDefinition } from '../hooks/useDefinition'
import type { WordStatus } from '../types'

interface Props {
  word: string
  status: WordStatus | undefined
  onUpdateWordStatus: (word: string, status: WordStatus) => Promise<void>
  onRemoveWordStatus: (word: string) => Promise<void>
  onClose: () => void
}

export default function Tooltip({ word, status, onUpdateWordStatus, onRemoveWordStatus, onClose }: Props) {
  const { definition, partOfSpeech, loading } = useDefinition(word.toLowerCase())

  const handleMark = async (s: WordStatus) => {
    if (status === s) {
      await onRemoveWordStatus(word.toLowerCase())
    } else {
      await onUpdateWordStatus(word.toLowerCase(), s)
    }
    onClose()
  }

  return (
    <div
      className="w-56 rounded-2xl p-3"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--separator)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.08)',
      }}
    >
      {/* Word + POS */}
      <div className="flex items-baseline gap-2 mb-1.5">
        <span
          className="font-semibold text-[15px]"
          style={{ color: 'var(--text-primary)' }}
        >
          {word}
        </span>
        {partOfSpeech && (
          <span
            className="text-[11px]"
            style={{ color: 'var(--text-secondary)' }}
          >
            {partOfSpeech}
          </span>
        )}
      </div>

      {/* Status badge */}
      {status && (
        <div
          className="text-[11px] mb-1.5 flex items-center gap-1"
          style={{ color: status === 'learning' ? 'var(--ios-orange)' : 'var(--ios-green)' }}
        >
          <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: 'currentColor' }} />
          {status === 'learning' ? '學習中' : '已學習'}
        </div>
      )}

      {/* Definition */}
      <div
        className="text-[12px] mb-3 leading-relaxed"
        style={{ color: 'var(--text-secondary)' }}
      >
        {loading ? '…' : definition}
      </div>

      {/* Action buttons */}
      <div className="flex gap-1.5">
        <button
          onClick={() => handleMark('learning')}
          title={status === 'learning' ? '點擊取消標記' : '標記為學習中'}
          className="flex-1 flex items-center justify-center gap-1.5 text-[12px] py-1.5 rounded-xl transition-all duration-150"
          style={{
            background: status === 'learning' ? 'rgba(255,149,0,0.15)' : 'rgba(120,120,128,0.1)',
            color: status === 'learning' ? 'var(--ios-orange)' : 'var(--text-secondary)',
          }}
        >
          {status === 'learning'
            ? <><X size={11} strokeWidth={2.5} /> 取消</>
            : <><GraduationCap size={12} strokeWidth={1.8} /> 學習中</>
          }
        </button>
        <button
          onClick={() => handleMark('learned')}
          title={status === 'learned' ? '點擊取消標記' : '標記為已學習'}
          className="flex-1 flex items-center justify-center gap-1.5 text-[12px] py-1.5 rounded-xl transition-all duration-150"
          style={{
            background: status === 'learned' ? 'rgba(52,199,89,0.15)' : 'rgba(120,120,128,0.1)',
            color: status === 'learned' ? 'var(--ios-green)' : 'var(--text-secondary)',
          }}
        >
          {status === 'learned'
            ? <><X size={11} strokeWidth={2.5} /> 取消</>
            : <><BookOpenCheck size={12} strokeWidth={1.8} /> 已學習</>
          }
        </button>
      </div>
    </div>
  )
}
