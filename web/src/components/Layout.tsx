import type { ReactNode } from 'react'
import Sidebar from './Sidebar'
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
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-black">
      {/* Header */}
      <header className="shrink-0 h-12 flex items-center px-5 bg-[#1C1C1E] border-b border-white/10">
        <span className="text-white font-bold text-base tracking-tight select-none">● DuoCue</span>
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
