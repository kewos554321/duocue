import { useMemo } from 'react'
import SentenceCard from './SentenceCard'
import { formatRelativeTime } from '../utils/time'
import type { ApiSentence, WordStatus } from '../types'

interface Props {
  sentences: ApiSentence[]
  wordMap: Map<string, WordStatus>
  onUpdateWordStatus: (word: string, status: WordStatus) => Promise<void>
  onRemoveWordStatus: (word: string) => Promise<void>
  onDeleteSentence: (id: number) => Promise<void>
}

export default function RecentSentencesTab({ sentences, wordMap, onUpdateWordStatus, onRemoveWordStatus, onDeleteSentence }: Props) {
  const recent = useMemo(
    () =>
      [...sentences]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 20),
    [sentences]
  )

  if (recent.length === 0) {
    return (
      <div
        className="text-center py-16 text-[14px]"
        style={{ color: 'var(--text-secondary)' }}
      >
        還沒有儲存的句子
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {recent.map(s => (
        <SentenceCard
          key={s.id}
          sentence={s}
          wordMap={wordMap}
          onUpdateWordStatus={onUpdateWordStatus}
          onRemoveWordStatus={onRemoveWordStatus}
          onDelete={onDeleteSentence}
          relativeTime={formatRelativeTime(s.createdAt)}
        />
      ))}
    </div>
  )
}
