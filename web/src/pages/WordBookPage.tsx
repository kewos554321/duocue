import { useState, Fragment } from 'react'
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react'
import { useDefinition } from '../hooks/useDefinition'
import type { ApiSentence, ApiWord, WordStatus } from '../types'

interface WordRowProps {
  word: ApiWord
  sentences: ApiSentence[]
  onUpdateWordStatus: (word: string, status: WordStatus) => Promise<void>
  onRemoveWord: (word: string) => Promise<void>
}

function WordRow({ word, sentences, onUpdateWordStatus, onRemoveWord }: WordRowProps) {
  const { definition, partOfSpeech } = useDefinition(word.word)
  const [expanded, setExpanded] = useState(false)

  const matchingSentences = sentences.filter(s =>
    new RegExp(`(?<![a-zA-Z])${word.word}(?![a-zA-Z])`, 'i').test(s.text)
  )

  const isLearning = word.status === 'learning'

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all duration-150"
      style={{
        background: 'var(--bg-card)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      <div className="px-4 py-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span
                className="font-semibold text-[16px]"
                style={{ color: 'var(--text-primary)' }}
              >
                {word.word}
              </span>
              {partOfSpeech && (
                <span
                  className="text-[11px]"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {partOfSpeech}
                </span>
              )}
              <span
                className="text-[11px] rounded-full px-2 py-0.5"
                style={{
                  background: isLearning ? 'rgba(255,149,0,0.12)' : 'rgba(52,199,89,0.12)',
                  color: isLearning ? 'var(--ios-orange)' : 'var(--ios-green)',
                }}
              >
                {isLearning ? '學習中' : '已學習'}
              </span>
            </div>
            {definition && (
              <p
                className="text-[13px] leading-relaxed"
                style={{ color: 'var(--text-secondary)' }}
              >
                {definition}
              </p>
            )}
          </div>

          {matchingSentences.length > 0 && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="flex items-center gap-1 text-[12px] shrink-0 transition-opacity hover:opacity-70 mt-0.5"
              style={{ color: 'var(--ios-blue)' }}
            >
              {matchingSentences.length} 例句
              {expanded
                ? <ChevronUp size={12} strokeWidth={2} />
                : <ChevronDown size={12} strokeWidth={2} />
              }
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div
          className="px-4 pb-3.5 flex flex-col gap-2 border-t"
          style={{ borderColor: 'var(--separator)' }}
        >
          <div className="pt-3 flex flex-col gap-2">
            {matchingSentences.map(s => (
              <p
                key={s.id}
                className="text-[13px] leading-relaxed"
                style={{ color: 'var(--text-secondary)' }}
              >
                {s.text}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

type StatusFilter = 'all' | 'learning' | 'learned'

const FILTERS: [StatusFilter, string][] = [
  ['all', '全部'],
  ['learning', '學習中'],
  ['learned', '已學習'],
]

interface Props {
  words: ApiWord[]
  sentences: ApiSentence[]
  onUpdateWordStatus: (word: string, status: WordStatus) => Promise<void>
  onRemoveWord: (word: string) => Promise<void>
}

export default function WordBookPage({ words, sentences, onUpdateWordStatus, onRemoveWord }: Props) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')

  const markedWords = words.filter(w => w.status === 'learning' || w.status === 'learned')

  const filtered = markedWords
    .filter(w => {
      if (statusFilter === 'learning' && w.status !== 'learning') return false
      if (statusFilter === 'learned' && w.status !== 'learned') return false
      if (search.trim() && !w.word.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'learning' ? -1 : 1
      return a.word.localeCompare(b.word)
    })

  if (markedWords.length === 0) {
    return (
      <div
        className="text-center py-16 text-[14px]"
        style={{ color: 'var(--text-secondary)' }}
      >
        還沒有標記的單字。<br />
        <span className="text-[13px]">在句子頁面 hover 任何單字可標記學習狀態。</span>
      </div>
    )
  }

  return (
    <div>
      <h2
        className="font-semibold text-[17px] mb-4"
        style={{ color: 'var(--text-primary)' }}
      >
        單字本
        <span
          className="ml-2 text-[14px] font-normal"
          style={{ color: 'var(--text-secondary)' }}
        >
          {filtered.length} 個
        </span>
      </h2>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="flex rounded-lg p-0.5" style={{ background: 'rgba(120,120,128,0.12)' }}>
          {FILTERS.map(([f, label]) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className="px-3 py-1 rounded-[6px] text-[13px] transition-all duration-200"
              style={{
                background: statusFilter === f ? 'var(--bg-card)' : 'transparent',
                color: statusFilter === f ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: statusFilter === f ? 600 : 400,
                boxShadow: statusFilter === f ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-36 max-w-xs">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--text-secondary)' }}
          />
          <input
            type="text"
            placeholder="搜尋單字…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-xl pl-8 pr-3 py-1.5 text-[14px] outline-none"
            style={{ background: 'rgba(120,120,128,0.12)', color: 'var(--text-primary)' }}
            onFocus={e => (e.currentTarget.style.background = 'rgba(120,120,128,0.18)')}
            onBlur={e => (e.currentTarget.style.background = 'rgba(120,120,128,0.12)')}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div
          className="text-center py-16 text-[14px]"
          style={{ color: 'var(--text-secondary)' }}
        >
          沒有符合的單字
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map((w, i) => (
            <Fragment key={w.word}>
              {statusFilter === 'all' && (i === 0 || filtered[i - 1].status !== w.status) && (
                <p
                  className="text-[11px] font-semibold uppercase tracking-wide mt-2 first:mt-0"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {w.status === 'learning' ? '學習中' : '已學習'}
                </p>
              )}
              <WordRow
                word={w}
                sentences={sentences}
                onUpdateWordStatus={onUpdateWordStatus}
                onRemoveWord={onRemoveWord}
              />
            </Fragment>
          ))}
        </div>
      )}
    </div>
  )
}
