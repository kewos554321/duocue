import { useState } from 'react'
import type { ApiSentence, ApiVideo, ApiWord } from '../types'

const PLATFORM_LABEL: Record<string, string> = {
  netflix: 'Netflix 🔴',
  hbomax: 'HBO Max 🔵',
  youtube: 'YouTube 🔴',
}

interface Props {
  sentences: ApiSentence[]
  videos: ApiVideo[]
  words: ApiWord[]
  page: 'sentences' | 'words'
  selectedVideoUrl: string | null
  onSelectPage: (p: 'sentences' | 'words') => void
  onSelectVideo: (url: string | null) => void
}

export default function Sidebar({ sentences, videos, words, page, selectedVideoUrl, onSelectPage, onSelectVideo }: Props) {
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

  return (
    <aside className="w-56 shrink-0 flex flex-col bg-[#1C1C1E] border-r border-white/10 overflow-y-auto">
      {/* Logo */}
      <div className="px-4 py-5 text-white font-bold text-lg tracking-tight select-none">
        ● DuoCue
      </div>

      {/* Main nav */}
      <nav className="px-2 flex flex-col gap-1">
        <button
          onClick={() => { onSelectPage('sentences'); onSelectVideo(null) }}
          className={`w-full text-left px-3 py-2 rounded-lg text-sm flex justify-between items-center transition-colors ${
            page === 'sentences' && selectedVideoUrl === null
              ? 'bg-white/10 text-white'
              : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
        >
          <span>📖 全部句子</span>
          <span className="text-xs bg-white/10 rounded px-1.5 py-0.5">{sentences.length}</span>
        </button>

        <button
          onClick={() => onSelectPage('words')}
          className={`w-full text-left px-3 py-2 rounded-lg text-sm flex justify-between items-center transition-colors ${
            page === 'words'
              ? 'bg-white/10 text-white'
              : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
        >
          <span>📝 單字本</span>
          <span className="text-xs bg-white/10 rounded px-1.5 py-0.5">{learningCount}</span>
        </button>

        <button
          disabled
          className="w-full text-left px-3 py-2 rounded-lg text-sm flex justify-between items-center text-white/25 cursor-not-allowed"
        >
          <span>🧠 練習</span>
          <span className="text-xs bg-white/5 rounded px-1.5 py-0.5">未來</span>
        </button>
      </nav>

      {/* Video groups */}
      {Object.keys(platformGroups).length > 0 && (
        <div className="mt-4 px-2">
          <div className="px-3 py-1 text-xs text-white/30 uppercase tracking-wider mb-1">依影片</div>
          {Object.entries(platformGroups).map(([platform, vids]) => (
            <div key={platform}>
              <button
                onClick={() => togglePlatform(platform)}
                className="w-full text-left px-3 py-2 text-sm text-white/50 hover:text-white hover:bg-white/5 rounded-lg flex justify-between items-center transition-colors"
              >
                <span>{PLATFORM_LABEL[platform] ?? platform}</span>
                <span className="text-xs">{expandedPlatforms.has(platform) ? '▲' : '▼'}</span>
              </button>
              {expandedPlatforms.has(platform) && vids.map(v => (
                <button
                  key={v.url}
                  onClick={() => { onSelectPage('sentences'); onSelectVideo(v.url) }}
                  className={`w-full text-left px-4 py-1.5 text-xs rounded-lg flex justify-between items-center transition-colors ${
                    selectedVideoUrl === v.url
                      ? 'bg-white/10 text-white'
                      : 'text-white/40 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span className="truncate">{v.title ?? v.url.replace(/^https?:\/\//, '').slice(0, 32) + '…'}</span>
                  <span className="ml-1 shrink-0 text-white/30">{v.sentenceCount}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Account (hardcoded MVP) */}
      <div className="mt-auto px-4 py-4 border-t border-white/10 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold shrink-0">
          W
        </div>
        <div className="min-w-0">
          <div className="text-sm text-white truncate">Wei Chieh</div>
          <div className="text-xs text-white/40 truncate">kewos554321@gmail.com</div>
        </div>
      </div>
    </aside>
  )
}
