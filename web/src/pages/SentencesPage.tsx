import { useState, useMemo, useEffect } from 'react'
import { Search } from 'lucide-react'
import SentenceCard from '../components/SentenceCard'
import type { ApiSentence, WordStatus } from '../types'

const PAGE_SIZE = 25

function getPageNumbers(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  if (current <= 4) return [1, 2, 3, 4, 5, '…', total]
  if (current >= total - 3) return [1, '…', total - 4, total - 3, total - 2, total - 1, total]
  return [1, '…', current - 1, current, current + 1, '…', total]
}

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
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    setCurrentPage(1)
  }, [filter, search, selectedVideoUrl])

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

  const totalPages = useMemo(() => Math.ceil(filtered.length / PAGE_SIZE), [filtered])
  const paginated = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage]
  )

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
        <>
          <div className="flex flex-col gap-3">
            {paginated.map(s => (
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

          {totalPages > 1 && (
            <div
              className="mt-6 pt-5 flex flex-col items-center gap-2.5"
              style={{ borderTop: '1px solid var(--separator)' }}
            >
              {/* Page buttons */}
              <div className="flex items-center gap-1">
                {/* Prev */}
                <button
                  onClick={() => setCurrentPage(p => p - 1)}
                  disabled={currentPage === 1}
                  className="min-w-[32px] h-8 rounded-lg flex items-center justify-center text-[18px] transition-colors px-2"
                  style={{
                    color: 'var(--ios-blue)',
                    background: 'transparent',
                    opacity: currentPage === 1 ? 0.3 : 1,
                    pointerEvents: currentPage === 1 ? 'none' : 'auto',
                  }}
                >
                  ‹
                </button>

                {getPageNumbers(currentPage, totalPages).map((p, i) =>
                  p === '…' ? (
                    <span
                      key={`dots-${i}`}
                      className="px-1 text-[14px]"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p as number)}
                      className="min-w-[32px] h-8 rounded-lg flex items-center justify-center text-[14px] transition-colors px-2"
                      style={{
                        background: currentPage === p ? 'var(--ios-blue)' : 'transparent',
                        color: currentPage === p ? 'white' : 'var(--text-secondary)',
                        fontWeight: currentPage === p ? 600 : 400,
                      }}
                    >
                      {p}
                    </button>
                  )
                )}

                {/* Next */}
                <button
                  onClick={() => setCurrentPage(p => p + 1)}
                  disabled={currentPage === totalPages}
                  className="min-w-[32px] h-8 rounded-lg flex items-center justify-center text-[18px] transition-colors px-2"
                  style={{
                    color: 'var(--ios-blue)',
                    background: 'transparent',
                    opacity: currentPage === totalPages ? 0.3 : 1,
                    pointerEvents: currentPage === totalPages ? 'none' : 'auto',
                  }}
                >
                  ›
                </button>
              </div>

              {/* Count label */}
              <div className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                顯示 {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} / {filtered.length} 筆
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
