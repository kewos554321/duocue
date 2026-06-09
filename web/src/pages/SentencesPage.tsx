import { useState, useMemo } from 'react'
import SentenceCard from '../components/SentenceCard'
import type { ApiSentence, WordStatus } from '../types'

type Filter = 'all' | 'learning' | 'unmarked'

interface Props {
  sentences: ApiSentence[]
  wordMap: Map<string, WordStatus>
  selectedVideoUrl: string | null
  onUpdateWordStatus: (word: string, status: WordStatus) => Promise<void>
}

export default function SentencesPage({ sentences, wordMap, selectedVideoUrl, onUpdateWordStatus }: Props) {
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

  const FILTERS: [Filter, string][] = [['all', '全部'], ['learning', '有學習中'], ['unmarked', '未標記']]

  return (
    <div>
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex gap-1">
          {FILTERS.map(([f, label]) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                filter === f
                  ? 'bg-white text-black font-medium'
                  : 'bg-white/10 text-white/60 hover:bg-white/15'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="搜尋句子…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-40 max-w-xs bg-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-white/30 outline-none focus:bg-white/15 transition-colors"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-white/30 text-sm">沒有符合的句子</div>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map(s => (
            <SentenceCard
              key={s.id}
              sentence={s}
              wordMap={wordMap}
              onUpdateWordStatus={onUpdateWordStatus}
            />
          ))}
        </div>
      )}
    </div>
  )
}
