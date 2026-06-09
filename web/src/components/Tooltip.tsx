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
    <div className="w-56 bg-white dark:bg-[#2C2C2E] border border-gray-200 dark:border-white/15 rounded-xl shadow-lg shadow-black/10 dark:shadow-black/40 p-3">
      <div className="flex items-baseline gap-2 mb-1">
        <span className="font-semibold text-gray-900 dark:text-white">{word}</span>
        {partOfSpeech && <span className="text-xs text-gray-400 dark:text-white/40">{partOfSpeech}</span>}
      </div>
      {status && (
        <div
          className="text-xs mb-1"
          style={{ color: status === 'learning' ? '#F97316' : '#22C55E' }}
        >
          ● {status === 'learning' ? '學習中' : '已學習'}
        </div>
      )}
      <div className="text-xs text-gray-500 dark:text-white/60 mb-3 leading-relaxed">
        {loading ? '…' : definition}
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => handleMark('learning')}
          title={status === 'learning' ? '點擊取消標記' : ''}
          className={`flex-1 text-xs py-1.5 rounded-lg transition-colors ${
            status === 'learning'
              ? 'bg-orange-500/30 text-orange-400 hover:bg-orange-500/15'
              : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-white/60 hover:bg-orange-500/20 hover:text-orange-400'
          }`}
        >
          {status === 'learning' ? '✕ 學習中' : '📙 學習中'}
        </button>
        <button
          onClick={() => handleMark('learned')}
          title={status === 'learned' ? '點擊取消標記' : ''}
          className={`flex-1 text-xs py-1.5 rounded-lg transition-colors ${
            status === 'learned'
              ? 'bg-green-500/30 text-green-400 hover:bg-green-500/15'
              : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-white/60 hover:bg-green-500/20 hover:text-green-400'
          }`}
        >
          {status === 'learned' ? '✕ 已學習' : '✅ 已學習'}
        </button>
      </div>
    </div>
  )
}
