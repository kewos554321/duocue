import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import SentenceCard from './SentenceCard'
import VideoTitleEditor from './VideoTitleEditor'
import { patchVideoTitle } from '../api'
import type { ApiSentence, ApiVideo, WordStatus } from '../types'

type Filter = 'all' | 'learning' | 'unmarked'

const PAGE_SIZE = 20

const PLATFORM_LABEL: Record<string, string> = {
  netflix: 'Netflix',
  hbomax: 'HBO Max',
  youtube: 'YouTube',
}

const PLATFORM_COLOR: Record<string, string> = {
  netflix: '#E50914',
  hbomax: '#5822B4',
  youtube: '#FF0000',
}

const PLATFORM_BG_ACTIVE: Record<string, string> = {
  netflix: 'rgba(229,9,20,0.1)',
  hbomax: 'rgba(88,34,180,0.1)',
  youtube: 'rgba(255,0,0,0.1)',
}

const PLATFORM_BORDER_ACTIVE: Record<string, string> = {
  netflix: 'rgba(229,9,20,0.37)',
  hbomax: 'rgba(88,34,180,0.37)',
  youtube: 'rgba(255,0,0,0.37)',
}

function getPageNumbers(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  if (current <= 4) return [1, 2, 3, 4, 5, '…', total]
  if (current >= total - 3) return [1, '…', total - 4, total - 3, total - 2, total - 1, total]
  return [1, '…', current - 1, current, current + 1, '…', total]
}

interface Props {
  sentences: ApiSentence[]
  videos: ApiVideo[]
  wordMap: Map<string, WordStatus>
  onUpdateWordStatus: (word: string, status: WordStatus) => Promise<void>
  onRemoveWordStatus: (word: string) => Promise<void>
  onDeleteSentence: (id: number) => Promise<void>
  onOpenAI: (sentence: ApiSentence) => void
}

export default function AllSentencesTab({ sentences, videos, wordMap, onUpdateWordStatus, onRemoveWordStatus, onDeleteSentence, onOpenAI }: Props) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [currentPage, setCurrentPage] = useState(1)
  const [localVideos, setLocalVideos] = useState<ApiVideo[]>(videos)

  const selectedPlatform = searchParams.get('platform')
  const selectedVideoUrl = searchParams.get('video')
  const filter = (searchParams.get('filter') as Filter) ?? 'all'
  const search = searchParams.get('q') ?? ''

  const handleRename = async (videoUrl: string, newTitle: string) => {
    setLocalVideos(prev =>
      prev.map(v => v.url === videoUrl ? { ...v, title: newTitle } : v)
    )
    try {
      await patchVideoTitle(videoUrl, newTitle)
    } catch {
      setLocalVideos(prev =>
        prev.map(v => v.url === videoUrl ? { ...v, title: videos.find(o => o.url === videoUrl)?.title ?? v.title } : v)
      )
    }
  }

  const platformGroups = useMemo(
    () => localVideos.reduce<Record<string, ApiVideo[]>>((acc, v) => {
      if (!acc[v.platform]) acc[v.platform] = []
      if (!acc[v.platform].some(x => x.url === v.url))
        acc[v.platform].push(v)
      return acc
    }, {}),
    [localVideos]
  )

  const filtered = useMemo(() => {
    let result = selectedVideoUrl !== null
      ? sentences.filter(s => s.videoUrl === selectedVideoUrl)
      : selectedPlatform !== null
      ? sentences.filter(s => s.platform === selectedPlatform)
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
  }, [sentences, selectedPlatform, selectedVideoUrl, filter, search, wordMap])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  useEffect(() => { setCurrentPage(1) }, [selectedPlatform, selectedVideoUrl, filter, search])

  const FILTERS: [Filter, string][] = [['all', '全部'], ['learning', '學習中'], ['unmarked', '未標記']]

  const selectPlatform = (p: string | null) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (p) next.set('platform', p)
      else next.delete('platform')
      next.delete('video')
      return next
    })
  }

  const selectVideo = (v: string | null) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (v) next.set('video', v)
      else next.delete('video')
      return next
    })
  }

  const selectFilter = (f: Filter) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (f === 'all') next.delete('filter')
      else next.set('filter', f)
      return next
    })
  }

  const updateSearch = (q: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (q) next.set('q', q)
      else next.delete('q')
      return next
    }, { replace: true })
  }

  return (
    <div>
      {/* Platform chips + video dropdown */}
      {Object.keys(platformGroups).length > 0 && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <button
            onClick={() => selectPlatform(null)}
            className="flex items-center px-3 py-1 rounded-full text-[12px] border transition-all duration-150"
            style={{
              background: selectedPlatform === null ? 'rgba(0,122,255,0.1)' : 'rgba(120,120,128,0.12)',
              color: selectedPlatform === null ? 'var(--ios-blue)' : 'var(--text-secondary)',
              borderColor: selectedPlatform === null ? 'rgba(0,122,255,0.37)' : 'rgba(120,120,128,0.2)',
            }}
          >
            全部
          </button>

          {Object.keys(platformGroups).sort().map(p => {
            const active = selectedPlatform === p
            return (
              <button
                key={p}
                onClick={() => active ? selectPlatform(null) : selectPlatform(p)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] border transition-all duration-150"
                style={{
                  background: active ? (PLATFORM_BG_ACTIVE[p] ?? 'rgba(120,120,128,0.12)') : 'rgba(120,120,128,0.12)',
                  color: active ? (PLATFORM_COLOR[p] ?? 'var(--text-secondary)') : 'var(--text-secondary)',
                  borderColor: active ? (PLATFORM_BORDER_ACTIVE[p] ?? 'rgba(120,120,128,0.2)') : 'rgba(120,120,128,0.2)',
                }}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: PLATFORM_COLOR[p] ?? '#888' }}
                />
                {PLATFORM_LABEL[p] ?? p}
                {active && <span className="opacity-50 text-[10px] ml-0.5">✕</span>}
              </button>
            )
          })}

          {selectedPlatform !== null && (
            <>
              <div className="w-px h-4 shrink-0" style={{ background: 'var(--separator)' }} />
              <select
                value={selectedVideoUrl ?? ''}
                onChange={e => selectVideo(e.target.value || null)}
                className="px-3 py-1 rounded-lg text-[12px] outline-none cursor-pointer"
                style={{
                  background: 'rgba(120,120,128,0.12)',
                  color: selectedVideoUrl
                    ? (PLATFORM_COLOR[selectedPlatform] ?? 'var(--text-primary)')
                    : 'var(--text-secondary)',
                  border: `1px solid ${selectedVideoUrl
                    ? (PLATFORM_BORDER_ACTIVE[selectedPlatform] ?? 'rgba(120,120,128,0.2)')
                    : 'rgba(120,120,128,0.2)'}`,
                }}
              >
                <option value="">所有影片</option>
                {(platformGroups[selectedPlatform] ?? []).map(v => (
                  <option key={v.url} value={v.url}>
                    {v.title ?? v.url.replace(/^https?:\/\//, '').slice(0, 30)}
                  </option>
                ))}
              </select>
              {selectedVideoUrl && (
                <VideoTitleEditor
                  title={localVideos.find(v => v.url === selectedVideoUrl)?.title ?? null}
                  onRename={(newTitle) => handleRename(selectedVideoUrl, newTitle)}
                />
              )}
            </>
          )}
        </div>
      )}

      {/* Word status filter + search */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex rounded-lg p-0.5" style={{ background: 'rgba(120,120,128,0.12)' }}>
          {FILTERS.map(([f, label]) => (
            <button
              key={f}
              onClick={() => selectFilter(f)}
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

        <div className="relative flex-1 min-w-40 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }} />
          <input
            type="text"
            placeholder="搜尋句子…"
            value={search}
            onChange={e => updateSearch(e.target.value)}
            className="w-full rounded-xl pl-8 pr-3 py-1.5 text-[14px] outline-none transition-all"
            style={{ background: 'rgba(120,120,128,0.12)', color: 'var(--text-primary)' }}
            onFocus={e => (e.currentTarget.style.background = 'rgba(120,120,128,0.18)')}
            onBlur={e => (e.currentTarget.style.background = 'rgba(120,120,128,0.12)')}
          />
        </div>
      </div>

      {/* Sentence list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-[14px]" style={{ color: 'var(--text-secondary)' }}>
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
                onOpenAI={onOpenAI}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1.5 mt-6">
              {getPageNumbers(currentPage, totalPages).map((n, i) =>
                n === '…' ? (
                  <span key={`ellipsis-${i}`} className="px-1 text-[13px]" style={{ color: 'var(--text-secondary)' }}>…</span>
                ) : (
                  <button
                    key={n}
                    onClick={() => setCurrentPage(n)}
                    className="min-w-[32px] h-8 px-2 rounded-lg text-[13px] transition-all"
                    style={{
                      background: currentPage === n ? 'var(--ios-blue)' : 'rgba(120,120,128,0.12)',
                      color: currentPage === n ? '#fff' : 'var(--text-primary)',
                      fontWeight: currentPage === n ? 600 : 400,
                    }}
                  >
                    {n}
                  </button>
                )
              )}
            </div>
          )}

          <div className="text-center mt-2 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
            共 {filtered.length} 句 · 第 {currentPage} / {totalPages} 頁
          </div>
        </>
      )}
    </div>
  )
}
