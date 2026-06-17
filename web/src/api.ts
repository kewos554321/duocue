import { API_ENDPOINT } from './config'
import { getToken, clearToken } from './auth'
import type { ApiSentence, ApiVideo, ApiWord, WordStatus, PracticeWord, PracticeStats, ChatMessage, ApiSettings } from './types'

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${API_ENDPOINT}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': 'application/json',
    },
  })
  if (res.status === 401) {
    clearToken()
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }
  return res
}

export async function register(email: string, password: string): Promise<string> {
  const res = await fetch(`${API_ENDPOINT}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `Register failed: ${res.status}`)
  return data.token as string
}

export async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${API_ENDPOINT}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `Login failed: ${res.status}`)
  return data.token as string
}

export async function logout(): Promise<void> {
  await request('/auth/logout', { method: 'POST' })
}

export async function fetchSentences(): Promise<ApiSentence[]> {
  const res = await request('/sentences')
  if (!res.ok) throw new Error(`GET /sentences failed: ${res.status}`)
  const { sentences } = await res.json()
  return sentences as ApiSentence[]
}


export async function fetchVideos(): Promise<ApiVideo[]> {
  const res = await request('/videos')
  if (!res.ok) throw new Error(`GET /videos failed: ${res.status}`)
  const { videos } = await res.json()
  return videos as ApiVideo[]
}

export async function fetchWords(): Promise<ApiWord[]> {
  const res = await request('/words')
  if (!res.ok) throw new Error(`GET /words failed: ${res.status}`)
  const { words } = await res.json()
  return words as ApiWord[]
}

export async function deleteSentence(id: number): Promise<void> {
  const res = await request(`/sentences/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`DELETE /sentences/${id} failed: ${res.status}`)
}

export async function removeWord(word: string): Promise<void> {
  const res = await request(`/words/${encodeURIComponent(word.toLowerCase())}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`DELETE /words/${word} failed: ${res.status}`)
}

export async function patchWordStatus(word: string, status: WordStatus): Promise<void> {
  const res = await request(`/words/${encodeURIComponent(word.toLowerCase())}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
  if (!res.ok) throw new Error(`PATCH /words/${word} failed: ${res.status}`)
}

export async function patchVideoTitle(url: string, title: string): Promise<void> {
  const res = await request('/videos', {
    method: 'PATCH',
    body: JSON.stringify({ url, title }),
  })
  if (!res.ok) throw new Error(`PATCH /videos failed: ${res.status}`)
}

export async function fetchPracticeQueue(): Promise<PracticeWord[]> {
  const res = await request('/practice/queue')
  if (!res.ok) throw new Error(`GET /practice/queue failed: ${res.status}`)
  const { queue } = await res.json()
  return queue as PracticeWord[]
}

export async function postPracticeReview(word: string, rating: 1 | 2 | 3 | 4): Promise<void> {
  const res = await request('/practice/review', {
    method: 'POST',
    body: JSON.stringify({ word, rating }),
  })
  if (!res.ok) throw new Error(`POST /practice/review failed: ${res.status}`)
}

export async function fetchPracticeStats(): Promise<PracticeStats> {
  const res = await request('/practice/stats')
  if (!res.ok) throw new Error(`GET /practice/stats failed: ${res.status}`)
  return res.json()
}

export async function streamAiChat(
  sentenceId: number,
  messages: ChatMessage[],
  onDelta: (text: string) => void,
): Promise<void> {
  const res = await request(`/sentences/${sentenceId}/ai-chat`, {
    method: 'POST',
    body: JSON.stringify({ messages }),
  })
  if (!res.ok || !res.body) throw new Error(`POST /sentences/${sentenceId}/ai-chat failed: ${res.status}`)

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const chunks = buffer.split('\n\n')
    buffer = chunks.pop() ?? ''
    for (const chunk of chunks) {
      if (!chunk.startsWith('data: ')) continue
      const payload = JSON.parse(chunk.slice(6)) as { delta?: string; done?: boolean; error?: string }
      if (payload.error) throw new Error(payload.error)
      if (payload.delta) onDelta(payload.delta)
    }
  }
}

export async function postNoteSummarize(sentenceId: number, messages: ChatMessage[]): Promise<string> {
  const res = await request(`/sentences/${sentenceId}/note/summarize`, {
    method: 'POST',
    body: JSON.stringify({ messages }),
  })
  if (!res.ok) throw new Error(`POST /sentences/${sentenceId}/note/summarize failed: ${res.status}`)
  const { draft } = await res.json()
  return draft as string
}

export async function saveNote(sentenceId: number, note: string): Promise<number> {
  const res = await request(`/sentences/${sentenceId}/note`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  })
  if (!res.ok) throw new Error(`POST /sentences/${sentenceId}/note failed: ${res.status}`)
  const { aiNoteUpdatedAt } = await res.json()
  return aiNoteUpdatedAt as number
}

export async function deleteNote(sentenceId: number): Promise<void> {
  const res = await request(`/sentences/${sentenceId}/note`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`DELETE /sentences/${sentenceId}/note failed: ${res.status}`)
}

export async function getSettings(): Promise<ApiSettings> {
  const res = await request('/settings')
  if (!res.ok) throw new Error(`GET /settings failed: ${res.status}`)
  return res.json()
}

export async function saveGeminiKey(geminiApiKey: string): Promise<void> {
  const res = await request('/settings', {
    method: 'POST',
    body: JSON.stringify({ geminiApiKey }),
  })
  if (!res.ok) throw new Error(`POST /settings failed: ${res.status}`)
}
