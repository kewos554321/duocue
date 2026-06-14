import { NavLink } from 'react-router-dom'
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
}

export default function SentencesPage({ tab, sentences, videos, wordMap, onUpdateWordStatus, onRemoveWordStatus, onDeleteSentence }: Props) {
  const tabProps = { sentences, wordMap, onUpdateWordStatus, onRemoveWordStatus, onDeleteSentence }

  return (
    <div>
      <div
        className="flex rounded-lg p-0.5 mb-6 w-fit"
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

      {tab === 'recent'
        ? <RecentSentencesTab {...tabProps} />
        : <AllSentencesTab {...tabProps} videos={videos} />
      }
    </div>
  )
}
