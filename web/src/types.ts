export type WordStatus = 'learning' | 'learned'

export interface ApiSentence {
  id: number
  text: string
  translation: string | null
  timestampS: number
  platform: string
  videoUrl: string
  videoTitle: string | null
  createdAt: string
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
