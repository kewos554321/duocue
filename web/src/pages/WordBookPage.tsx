import { useState } from 'react'
import { useDefinition } from '../hooks/useDefinition'
import type { ApiSentence, ApiWord } from '../types'

interface WordRowProps {
  word: ApiWord
  sentences: ApiSentence[]
}

function WordRow({ word, sentences }: WordRowProps) {
  const { definition, partOfSpeech } = useDefinition(word.word)
  const [expanded, setExpanded] = useState(false)

  const matchingSentences = sentences.filter(s =>
    new RegExp(`(?<![a-zA-Z])${word.word}(?![a-zA-Z])`, 'i').test(s.text)
  )

  return (
    <div className="bg-[#1C1C1E] rounded-xl p-4 border border-white/10">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-semibold text-white text-base">{word.word}</span>
            {partOfSpeech && (
              <span className="text-xs text-white/40">{partOfSpeech}</span>
            )}
            <span
              className={`text-xs rounded px-2 py-0.5 ${
                word.status === 'learning'
                  ? 'bg-orange-500/20 text-orange-400'
                  : 'bg-green-500/20 text-green-400'
              }`}
            >
              {word.status === 'learning' ? '學習中' : '已學習'}
            </span>
          </div>
          <div className="text-xs text-white/50 mt-1 leading-relaxed">{definition}</div>
        </div>

        {matchingSentences.length > 0 && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-xs text-white/40 hover:text-white/70 shrink-0 transition-colors"
          >
            {matchingSentences.length} 個句子 {expanded ? '▲' : '▼'}
          </button>
        )}
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-white/10 flex flex-col gap-2">
          {matchingSentences.map(s => (
            <p key={s.id} className="text-sm text-white/70 leading-relaxed">{s.text}</p>
          ))}
        </div>
      )}
    </div>
  )
}

interface Props {
  words: ApiWord[]
  sentences: ApiSentence[]
}

export default function WordBookPage({ words, sentences }: Props) {
  const markedWords = words.filter(w => w.status === 'learning' || w.status === 'learned')

  if (markedWords.length === 0) {
    return (
      <div className="text-white/30 text-sm">
        還沒有標記的單字。在句子頁面 hover 任何單字可標記學習狀態。
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-white font-semibold text-lg mb-4">
        單字本 ({markedWords.length})
      </h2>
      <div className="flex flex-col gap-3">
        {markedWords.map(w => (
          <WordRow key={w.word} word={w} sentences={sentences} />
        ))}
      </div>
    </div>
  )
}
