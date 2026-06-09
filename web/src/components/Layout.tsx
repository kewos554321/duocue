import type { ReactNode } from 'react'
import Sidebar from './Sidebar'
import { useTheme } from '../hooks/useTheme'
import type { ApiSentence, ApiVideo, ApiWord } from '../types'

interface Props {
  sentences: ApiSentence[]
  videos: ApiVideo[]
  words: ApiWord[]
  page: 'sentences' | 'words'
  selectedVideoUrl: string | null
  onSelectPage: (p: 'sentences' | 'words') => void
  onSelectVideo: (url: string | null) => void
  children: ReactNode
}

export default function Layout({ sentences, videos, words, page, selectedVideoUrl, onSelectPage, onSelectVideo, children }: Props) {
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50 dark:bg-black">
      {/* Header */}
      <header className="shrink-0 h-12 flex items-center justify-between px-5 bg-white dark:bg-[#1C1C1E] border-b border-gray-200 dark:border-white/10">
        <span className="text-gray-900 dark:text-white font-bold text-base tracking-tight select-none">● DuoCue</span>
        <button
          onClick={toggleTheme}
          className="text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/70 text-lg transition-colors"
          title={theme === 'dark' ? '切換為淺色' : '切換為深色'}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          sentences={sentences}
          videos={videos}
          words={words}
          page={page}
          selectedVideoUrl={selectedVideoUrl}
          onSelectPage={onSelectPage}
          onSelectVideo={onSelectVideo}
        />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
