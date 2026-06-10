import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import SentenceCard from '../components/SentenceCard'
import type { ApiSentence, ApiVideo, WordStatus } from '../types'

type Filter = 'all' | 'learning' | 'unmarked'

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

interface Props {
  sentences: ApiSentence[]
  videos: ApiVideo[]
  wordMap: Map<string, WordStatus>
  onUpdateWordStatus: (word: string, status: WordStatus) => Promise<void>
  onRemoveWordStatus: (word: string) => Promise<void>
  onDeleteSentence: (id: number) => Promise<void>
}

export default function SentencesPage({ sentences, videos, wordMap, onUpdateWordStatus, onRemoveWordStatus, onDeleteSentence }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null)
  const [selectedVideoUrl, setSelectedVideoUrl] = useState<string | null>(null)

  const platformGroups = useMemo(
    () => videos.reduce<Record<string, ApiVideo[]>>((acc, v) => {
      if (!acc[v.platform]) acc[v.platform] = []
      if (!acc[v.platform].some(x => x.url === v.url))
        acc[v.platform].push(v)
      return acc
    }, {}),
    [videos]
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

  const FILTERS: [Filter, string][] = [['all', '全部'], ['learning', '學習中'], ['unmarked', '未標記']]

  const selectPlatform = (p: string | null) => {
    setSelectedPlatform(p)
    setSelectedVideoUrl(null)
  }

  return (
    <div>
      {/* Controls row 1: platform chips + video dropdown */}
      {Object.keys(platformGroups).length > 0 && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {/* 全部 chip */}
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

          {/* Per-platform chips */}
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

          {/* Divider + video dropdown — only when a platform is selected */}
          {selectedPlatform !== null && (
            <>
              <div
                className="w-px h-4 shrink-0"
                style={{ background: 'var(--separator)' }}
              />
              <select
                value={selectedVideoUrl ?? ''}
                onChange={e => setSelectedVideoUrl(e.target.value || null)}
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
            </>
          )}
        </div>
      )}

      {/* Controls row 2: word status filter + search */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
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
