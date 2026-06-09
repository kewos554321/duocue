import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import SentenceCard from '../components/SentenceCard'
import type { ApiSentence, WordStatus } from '../types'

type Filter = 'all' | 'learning' | 'unmarked'

interface Props {
  sentences: ApiSentence[]
  wordMap: Map<string, WordStatus>
  selectedVideoUrl: string | null
  onUpdateWordStatus: (word: string, status: WordStatus) => Promise<void>
  onRemoveWordStatus: (word: string) => Promise<void>
  onDeleteSentence: (id: number) => Promise<void>
}

export default function SentencesPage({ sentences, wordMap, selectedVideoUrl, onUpdateWordStatus, onRemoveWordStatus, onDeleteSentence }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    let result = selectedVideoUrl !== null
      ? sentences.filter(s => s.videoUrl === selectedVideoUrl)
      : sentences

    if (filter === 'learning') {
      result = result.filter(s =>
        s.text.split(/[^a-zA-Z]+/).some(w => w && wordMap.get(w.toLowerCase()) === 'learning')
      )
    } else if (filter === 'unmarked') {
      result = result.filter(s =>
        !s.text.split(/[^a-zA-Z]+/).some(w => w && wordMap.has(w.toLowerCase()))
      )
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(s =>
        s.text.toLowerCase().includes(q) || (s.translation ?? '').toLowerCase().includes(q)
      )
    }

    return result
  }, [sentences, selectedVideoUrl, filter, search, wordMap])

  const FILTERS: [Filter, string][] = [['all', '全部'], ['learning', '學習中'], ['unmarked', '未標記']]

  return (
    <div>
      {/* Controls row */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        {/* iOS-style segmented control */}
        <div
          className="flex rounded-lg p-0.5"
          style={{ background: 'rgba(120,120,128,0.12)' }}
        >
          {FILTERS.map(([f, label]) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-3 py-1 rounded-[6px] text-[13px] transition-all duration-200"
              style={{
                background: filter === f ? 'var(--bg-card)' : 'transparent',
                color: filter === f ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: filter === f ? 600 : 400,
                boxShadow: filter === f ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="relative flex-1 min-w-40 max-w-xs">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--text-secondary)' }}
          />
          <input
            type="text"
            placeholder="搜尋句子…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-xl pl-8 pr-3 py-1.5 text-[14px] outline-none transition-all"
            style={{
              background: 'rgba(120,120,128,0.12)',
              color: 'var(--text-primary)',
            }}
            onFocus={e => (e.currentTarget.style.background = 'rgba(120,120,128,0.18)')}
            onBlur={e => (e.currentTarget.style.background = 'rgba(120,120,128,0.12)')}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div
          className="text-center py-16 text-[14px]"
          style={{ color: 'var(--text-secondary)' }}
        >
          沒有符合的句子
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(s => (
            <SentenceCard
              key={s.id}
              sentence={s}
              wordMap={wordMap}
              onUpdateWordStatus={onUpdateWordStatus}
              onRemoveWordStatus={onRemoveWordStatus}
              onDelete={onDeleteSentence}
            />
          ))}
        </div>
      )}
    </div>
  )
}
