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

interface Props {
  words: ApiWord[]
  sentences: ApiSentence[]
  onUpdateWordStatus: (word: string, status: WordStatus) => Promise<void>
  onRemoveWord: (word: string) => Promise<void>
}

export default function WordBookPage({ words, sentences, onUpdateWordStatus, onRemoveWord }: Props) {
  const markedWords = words.filter(w => w.status === 'learning' || w.status === 'learned')

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
          {markedWords.length} 個
        </span>
      </h2>
      <div className="flex flex-col gap-2.5">
        {markedWords.map(w => (
          <WordRow key={w.word} word={w} sentences={sentences} onUpdateWordStatus={onUpdateWordStatus} onRemoveWord={onRemoveWord} />
        ))}
      </div>
    </div>
  )
}
