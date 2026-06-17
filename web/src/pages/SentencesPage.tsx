import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import RecentSentencesTab from '../components/RecentSentencesTab'
import AllSentencesTab from '../components/AllSentencesTab'
import type { ApiSentence, ApiVideo, WordStatus } from '../types'

interface Props {
  tab: 'recent' | 'all'
  sentences: ApiSentence[]
  videos: ApiVideo[]
  wordMap: Map<string, WordStatus>
  onUpdateWordStatus: (word: string, status: WordStatus) => Promise<void>
  onRemoveWordStatus: (word: string) => Promise<void>
  onDeleteSentence: (id: number) => Promise<void>
  onOpenAI: (sentence: ApiSentence) => void
  onRefreshSentences: () => Promise<void>
}

export default function SentencesPage({ tab, sentences, videos, wordMap, onUpdateWordStatus, onRemoveWordStatus, onDeleteSentence, onOpenAI, onRefreshSentences }: Props) {
  const tabProps = { sentences, wordMap, onUpdateWordStatus, onRemoveWordStatus, onDeleteSentence, onOpenAI }
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      await onRefreshSentences()
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div
          className="flex rounded-lg p-0.5 w-fit"
          style={{ background: 'rgba(120,120,128,0.12)' }}
        >
          {([
            ['recent', '/sentences/recent', '最近加入'],
            ['all', '/sentences/all', '全部句子'],
          ] as const).map(([key, to, label]) => (
            <NavLink
              key={key}
              to={to}
              className="px-4 py-1.5 rounded-[6px] text-[13px] transition-all duration-200 no-underline"
              style={({ isActive }) => ({
                background: isActive ? 'var(--bg-card)' : 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: isActive ? 600 : 400,
                boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
              })}
            >
              {label}
            </NavLink>
          ))}
        </div>

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          title="重新整理句子列表"
          className="w-8 h-8 flex items-center justify-center rounded-full transition-colors hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-40"
          style={{ color: 'var(--text-secondary)' }}
        >
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {tab === 'recent'
        ? <RecentSentencesTab {...tabProps} />
        : <AllSentencesTab {...tabProps} videos={videos} />
      }
    </div>
  )
}
