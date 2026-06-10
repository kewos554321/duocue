import { BookOpen, BookMarked, Sparkles } from 'lucide-react'
import type { ApiSentence, ApiWord } from '../types'

interface Props {
  sentences: ApiSentence[]
  words: ApiWord[]
  practiceQueueCount: number
  page: 'sentences' | 'words' | 'practice'
  onSelectPage: (p: 'sentences' | 'words' | 'practice') => void
}

export default function Sidebar({ sentences, words, practiceQueueCount, page, onSelectPage }: Props) {
  const learningCount = words.filter(w => w.status === 'learning').length

  const navActive = 'font-medium'
  const navBase = 'w-full text-left px-3 py-2 rounded-xl text-[14px] flex items-center justify-between transition-all duration-150 active:scale-[0.98]'

  return (
    <aside
      className="w-56 shrink-0 flex flex-col border-r overflow-y-auto"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--separator)' }}
    >
      <nav className="px-2 pt-3 flex flex-col gap-0.5">
        <button
          onClick={() => onSelectPage('sentences')}
          className={`${navBase} ${page === 'sentences' ? navActive : ''}`}
          style={{
            color: page === 'sentences' ? 'var(--ios-blue)' : 'var(--text-primary)',
            background: page === 'sentences' ? 'rgba(0,122,255,0.1)' : 'transparent',
          }}
          onMouseEnter={e => {
            if (page !== 'sentences')
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(120,120,128,0.08)'
          }}
          onMouseLeave={e => {
            if (page !== 'sentences')
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
          }}
        >
          <span className="flex items-center gap-2.5">
            <BookOpen size={16} strokeWidth={1.8} />
            全部句子
          </span>
          <Badge count={sentences.length} active={page === 'sentences'} />
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
