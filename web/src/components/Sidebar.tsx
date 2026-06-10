import { useState } from 'react'
import { BookOpen, BookMarked, Sparkles, ChevronDown, ChevronUp, PlayCircle } from 'lucide-react'
import type { ApiSentence, ApiVideo, ApiWord } from '../types'

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

interface Props {
  sentences: ApiSentence[]
  videos: ApiVideo[]
  words: ApiWord[]
  practiceQueueCount: number
  page: 'sentences' | 'words' | 'practice'
  selectedVideoUrl: string | null
  onSelectPage: (p: 'sentences' | 'words' | 'practice') => void
  onSelectVideo: (url: string | null) => void
}

export default function Sidebar({ sentences, videos, words, practiceQueueCount, page, selectedVideoUrl, onSelectPage, onSelectVideo }: Props) {
  const [expandedPlatforms, setExpandedPlatforms] = useState<Set<string>>(new Set())

  const togglePlatform = (platform: string) => {
    setExpandedPlatforms(prev => {
      const next = new Set(prev)
      next.has(platform) ? next.delete(platform) : next.add(platform)
      return next
    })
  }

  const platformGroups = videos.reduce<Record<string, ApiVideo[]>>((acc, v) => {
    if (!acc[v.platform]) acc[v.platform] = []
    acc[v.platform].push(v)
    return acc
  }, {})

  const learningCount = words.filter(w => w.status === 'learning').length

  const navActive = 'font-medium'
  const navBase = 'w-full text-left px-3 py-2 rounded-xl text-[14px] flex items-center justify-between transition-all duration-150 active:scale-[0.98]'

  return (
    <aside
      className="w-56 shrink-0 flex flex-col border-r overflow-y-auto"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--separator)' }}
    >
      {/* Main nav */}
      <nav className="px-2 pt-3 flex flex-col gap-0.5">
        <button
          onClick={() => { onSelectPage('sentences'); onSelectVideo(null) }}
          className={`${navBase} ${page === 'sentences' && selectedVideoUrl === null ? navActive : ''}`}
          style={{
            color: page === 'sentences' && selectedVideoUrl === null ? 'var(--ios-blue)' : 'var(--text-primary)',
            background: page === 'sentences' && selectedVideoUrl === null ? 'rgba(0,122,255,0.1)' : 'transparent',
          }}
          onMouseEnter={e => {
            if (!(page === 'sentences' && selectedVideoUrl === null))
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(120,120,128,0.08)'
          }}
          onMouseLeave={e => {
            if (!(page === 'sentences' && selectedVideoUrl === null))
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
          }}
        >
          <span className="flex items-center gap-2.5">
            <BookOpen size={16} strokeWidth={1.8} />
            全部句子
          </span>
          <Badge count={sentences.length} active={page === 'sentences' && selectedVideoUrl === null} />
        </button>

        <button
          onClick={() => onSelectPage('words')}
          className={`${navBase} ${page === 'words' ? navActive : ''}`}
          style={{
            color: page === 'words' ? 'var(--ios-blue)' : 'var(--text-primary)',
            background: page === 'words' ? 'rgba(0,122,255,0.1)' : 'transparent',
          }}
          onMouseEnter={e => {
            if (page !== 'words')
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(120,120,128,0.08)'
          }}
          onMouseLeave={e => {
            if (page !== 'words')
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
          }}
        >
          <span className="flex items-center gap-2.5">
            <BookMarked size={16} strokeWidth={1.8} />
            單字本
          </span>
          {learningCount > 0 && <Badge count={learningCount} active={page === 'words'} />}
        </button>

        <button
          onClick={() => onSelectPage('practice')}
          className={`${navBase} ${page === 'practice' ? navActive : ''}`}
          style={{
            color: page === 'practice' ? 'var(--ios-blue)' : 'var(--text-primary)',
            background: page === 'practice' ? 'rgba(0,122,255,0.1)' : 'transparent',
          }}
          onMouseEnter={e => {
            if (page !== 'practice')
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(120,120,128,0.08)'
          }}
          onMouseLeave={e => {
            if (page !== 'practice')
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
          }}
        >
          <span className="flex items-center gap-2.5">
            <Sparkles size={16} strokeWidth={1.8} />
            練習
          </span>
          {practiceQueueCount > 0 && (
            <span
              className="text-[11px] rounded-full px-1.5 py-0.5 min-w-[20px] text-center tabular-nums"
              style={{
                background: page === 'practice' ? 'rgba(0,122,255,0.15)' : 'rgba(255,149,0,0.2)',
                color: page === 'practice' ? 'var(--ios-blue)' : 'var(--ios-orange)',
              }}
            >
              {practiceQueueCount}
            </span>
          )}
        </button>
      </nav>

      {/* Video groups */}
      {Object.keys(platformGroups).length > 0 && (
        <div className="mt-5 px-2">
          <div
            className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-secondary)' }}
          >
            依影片
          </div>
          {Object.entries(platformGroups).map(([platform, vids]) => (
            <div key={platform}>
              <button
                onClick={() => togglePlatform(platform)}
                className="w-full text-left px-3 py-2 rounded-xl text-[13px] flex justify-between items-center transition-all duration-150"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(120,120,128,0.08)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: PLATFORM_COLOR[platform] ?? '#888' }}
                  />
                  {PLATFORM_LABEL[platform] ?? platform}
                </span>
                {expandedPlatforms.has(platform)
                  ? <ChevronUp size={12} strokeWidth={2} />
                  : <ChevronDown size={12} strokeWidth={2} />
                }
              </button>
              {expandedPlatforms.has(platform) && vids.map(v => (
                <button
                  key={v.url}
                  onClick={() => { onSelectPage('sentences'); onSelectVideo(v.url) }}
                  className="w-full text-left pl-7 pr-3 py-1.5 text-[12px] rounded-xl flex justify-between items-center gap-2 transition-all duration-150"
                  style={{
                    color: selectedVideoUrl === v.url ? 'var(--ios-blue)' : 'var(--text-secondary)',
                    background: selectedVideoUrl === v.url ? 'rgba(0,122,255,0.08)' : 'transparent',
                    fontWeight: selectedVideoUrl === v.url ? 500 : 400,
                  }}
                  onMouseEnter={e => {
                    if (selectedVideoUrl !== v.url)
                      (e.currentTarget as HTMLButtonElement).style.background = 'rgba(120,120,128,0.08)'
                  }}
                  onMouseLeave={e => {
                    if (selectedVideoUrl !== v.url)
                      (e.currentTarget as HTMLButtonElement).style.background = selectedVideoUrl === v.url ? 'rgba(0,122,255,0.08)' : 'transparent'
                  }}
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    <PlayCircle size={11} strokeWidth={1.8} className="shrink-0" />
                    <span className="truncate">{v.title ?? v.url.replace(/^https?:\/\//, '').slice(0, 28) + '…'}</span>
                  </span>
                  <span className="shrink-0 text-[11px]" style={{ color: 'var(--text-secondary)', opacity: 0.6 }}>
                    {v.sentenceCount}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Account */}
      <div
        className="mt-auto px-4 py-4 flex items-center gap-3 border-t"
        style={{ borderColor: 'var(--separator)' }}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-semibold shrink-0 text-white"
          style={{ background: 'var(--ios-blue)' }}
        >
          W
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>Wei Chieh</div>
          <div className="text-[11px] truncate" style={{ color: 'var(--text-secondary)' }}>kewos554321@gmail.com</div>
        </div>
      </div>
    </aside>
  )
}

function Badge({ count, active }: { count: number; active: boolean }) {
  return (
    <span
      className="text-[11px] rounded-full px-1.5 py-0.5 min-w-[20px] text-center tabular-nums"
      style={{
        background: active ? 'rgba(0,122,255,0.15)' : 'rgba(120,120,128,0.12)',
        color: active ? 'var(--ios-blue)' : 'var(--text-secondary)',
      }}
    >
      {count}
    </span>
  )
}
