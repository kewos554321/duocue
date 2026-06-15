import { Link, useMatch } from 'react-router-dom'
import { BookOpen, BookMarked, Sparkles, BarChart2 } from 'lucide-react'
import type { ApiSentence, ApiWord } from '../types'

interface Props {
  sentences: ApiSentence[]
  words: ApiWord[]
  practiceQueueCount: number
}

export default function Sidebar({ sentences, words, practiceQueueCount }: Props) {
  const learningCount = words.filter(w => w.status === 'learning').length

  const sentencesActive = !!useMatch('/sentences/*')
  const wordsActive = !!useMatch('/words')
  const practiceActive = !!useMatch('/practice')
  const statsActive = !!useMatch('/stats')

  const navBase = 'w-full text-left px-3 py-2 rounded-xl text-[14px] flex items-center justify-between transition-all duration-150 active:scale-[0.98]'

  function navStyle(active: boolean) {
    return {
      color: active ? 'var(--ios-blue)' : 'var(--text-primary)',
      background: active ? 'rgba(0,122,255,0.1)' : 'transparent',
    }
  }

  function handleMouseEnter(e: React.MouseEvent<HTMLAnchorElement>, active: boolean) {
    if (!active) e.currentTarget.style.background = 'rgba(120,120,128,0.08)'
  }

  function handleMouseLeave(e: React.MouseEvent<HTMLAnchorElement>, active: boolean) {
    if (!active) e.currentTarget.style.background = 'transparent'
  }

  return (
    <aside
      className="w-56 shrink-0 flex flex-col border-r overflow-y-auto"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--separator)' }}
    >
      <nav className="px-2 pt-3 flex flex-col gap-0.5">
        <Link
          to="/sentences/recent"
          className={`${navBase} ${sentencesActive ? 'font-medium' : ''}`}
          style={navStyle(sentencesActive)}
          onMouseEnter={e => handleMouseEnter(e, sentencesActive)}
          onMouseLeave={e => handleMouseLeave(e, sentencesActive)}
        >
          <span className="flex items-center gap-2.5">
            <BookOpen size={16} strokeWidth={1.8} />
            句子
          </span>
          <Badge count={sentences.length} active={sentencesActive} />
        </Link>

        <Link
          to="/words"
          className={`${navBase} ${wordsActive ? 'font-medium' : ''}`}
          style={navStyle(wordsActive)}
          onMouseEnter={e => handleMouseEnter(e, wordsActive)}
          onMouseLeave={e => handleMouseLeave(e, wordsActive)}
        >
          <span className="flex items-center gap-2.5">
            <BookMarked size={16} strokeWidth={1.8} />
            單字本
          </span>
          {learningCount > 0 && <Badge count={learningCount} active={wordsActive} />}
        </Link>

        <Link
          to="/practice"
          className={`${navBase} ${practiceActive ? 'font-medium' : ''}`}
          style={navStyle(practiceActive)}
          onMouseEnter={e => handleMouseEnter(e, practiceActive)}
          onMouseLeave={e => handleMouseLeave(e, practiceActive)}
        >
          <span className="flex items-center gap-2.5">
            <Sparkles size={16} strokeWidth={1.8} />
            練習
          </span>
          {practiceQueueCount > 0 && (
            <span
              className="text-[11px] rounded-full px-1.5 py-0.5 min-w-[20px] text-center tabular-nums"
              style={{
                background: practiceActive ? 'rgba(0,122,255,0.15)' : 'rgba(255,149,0,0.2)',
                color: practiceActive ? 'var(--ios-blue)' : 'var(--ios-orange)',
              }}
            >
              {practiceQueueCount}
            </span>
          )}
        </Link>

        <Link
          to="/stats"
          className={`${navBase} ${statsActive ? 'font-medium' : ''}`}
          style={navStyle(statsActive)}
          onMouseEnter={e => handleMouseEnter(e, statsActive)}
          onMouseLeave={e => handleMouseLeave(e, statsActive)}
        >
          <span className="flex items-center gap-2.5">
            <BarChart2 size={16} strokeWidth={1.8} />
            統計
          </span>
        </Link>
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
