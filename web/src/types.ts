export type WordStatus = 'learning' | 'learned'

export type PracticeRating = 1 | 2 | 3 | 4

export interface ApiSentence {
  id: number
  text: string
  translation: string | null
  timestampS: number
  platform: string
  videoUrl: string
  videoTitle: string | null
  createdAt: string
  aiNote: string | null
  aiNoteUpdatedAt: number | null
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ApiSettings {
  hasGeminiKey: boolean
}

export interface ApiVideo {
  platform: string
  url: string
  title: string | null
  sentenceCount: number
}

export interface ApiWord {
  word: string
  status: WordStatus
}

export interface PracticeSentence {
  text: string
  translation: string | null
  videoUrl: string
  timestampS: number
}

export interface PracticeWord {
  word: string
  intervalDays: number
  nextReviewAt: number | null
  repetitions: number
  easeFactor: number
  sentence: PracticeSentence | null
}

export interface PracticeStats {
  streak: number
  todayCount: number
  wordCounts: { learning: number; learned: number }
  last30Days: { date: string; count: number }[]
}
