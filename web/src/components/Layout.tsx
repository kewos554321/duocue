import type { ReactNode } from 'react'
import Sidebar from './Sidebar'
import { useTheme } from '../hooks/useTheme'
import { Sun, Moon } from 'lucide-react'
import type { ApiSentence, ApiWord } from '../types'

interface Props {
  sentences: ApiSentence[]
  words: ApiWord[]
  practiceQueueCount: number
  page: 'sentences' | 'words' | 'practice'
  onSelectPage: (p: 'sentences' | 'words' | 'practice') => void
  children: ReactNode
}

export default function Layout({ sentences, words, practiceQueueCount, page, onSelectPage, children }: Props) {
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <header
        className="shrink-0 h-12 flex items-center justify-between px-5 border-b"
        style={{
          background: 'var(--bg-card)',
          borderColor: 'var(--separator)',
        }}
      >
        <span
          className="font-semibold text-[15px] tracking-tight select-none"
          style={{ color: 'var(--text-primary)' }}
        >
          DuoCue
        </span>
        <button
          onClick={toggleTheme}
          className="w-8 h-8 flex items-center justify-center rounded-full transition-colors hover:bg-black/5 dark:hover:bg-white/10"
          title={theme === 'dark' ? '切換為淺色' : '切換為深色'}
          aria-label={theme === 'dark' ? '切換為淺色' : '切換為深色'}
        >
          {theme === 'dark'
            ? <Sun size={16} style={{ color: 'var(--text-secondary)' }} />
            : <Moon size={16} style={{ color: 'var(--text-secondary)' }} />
          }
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          sentences={sentences}
          words={words}
          practiceQueueCount={practiceQueueCount}
          page={page}
          onSelectPage={onSelectPage}
        />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
