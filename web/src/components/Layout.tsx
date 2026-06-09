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
    <div className="flex h-screen overflow-hidden bg-black">
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
  )
}
