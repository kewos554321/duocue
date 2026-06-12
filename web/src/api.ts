import { API_ENDPOINT, API_KEY } from './config'
import type { ApiSentence, ApiVideo, ApiWord, WordStatus, PracticeWord } from './types'

const authHeaders = {
  Authorization: `Bearer ${API_KEY}`,
  'Content-Type': 'application/json',
}

export async function fetchSentences(): Promise<ApiSentence[]> {
  const res = await fetch(`${API_ENDPOINT}/sentences`, { headers: authHeaders })
  if (!res.ok) throw new Error(`GET /sentences failed: ${res.status}`)
  const { sentences } = await res.json()
  return sentences as ApiSentence[]
}

export async function fetchVideos(): Promise<ApiVideo[]> {
  const res = await fetch(`${API_ENDPOINT}/videos`, { headers: authHeaders })
  if (!res.ok) throw new Error(`GET /videos failed: ${res.status}`)
  const { videos } = await res.json()
  return videos as ApiVideo[]
}

export async function fetchWords(): Promise<ApiWord[]> {
  const res = await fetch(`${API_ENDPOINT}/words`, { headers: authHeaders })
  if (!res.ok) throw new Error(`GET /words failed: ${res.status}`)
  const { words } = await res.json()
  return words as ApiWord[]
}

export async function deleteSentence(id: number): Promise<void> {
  const res = await fetch(`${API_ENDPOINT}/sentences/${id}`, {
    method: 'DELETE',
    headers: authHeaders,
  })
  if (!res.ok) throw new Error(`DELETE /sentences/${id} failed: ${res.status}`)
}

export async function removeWord(word: string): Promise<void> {
  const res = await fetch(`${API_ENDPOINT}/words/${encodeURIComponent(word.toLowerCase())}`, {
    method: 'DELETE',
    headers: authHeaders,
  })
  if (!res.ok) throw new Error(`DELETE /words/${word} failed: ${res.status}`)
}

export async function patchWordStatus(word: string, status: WordStatus): Promise<void> {
  const res = await fetch(`${API_ENDPOINT}/words/${encodeURIComponent(word.toLowerCase())}`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ status }),
  })
  if (!res.ok) throw new Error(`PATCH /words/${word} failed: ${res.status}`)
}

export async function patchVideoTitle(url: string, title: string): Promise<void> {
  const res = await fetch(`${API_ENDPOINT}/videos`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ url, title }),
  })
  if (!res.ok) throw new Error(`PATCH /videos failed: ${res.status}`)
}

export async function fetchPracticeQueue(): Promise<PracticeWord[]> {
  const res = await fetch(`${API_ENDPOINT}/practice/queue`, { headers: authHeaders })
  if (!res.ok) throw new Error(`GET /practice/queue failed: ${res.status}`)
  const { queue } = await res.json()
  return queue as PracticeWord[]
}

export async function postPracticeReview(word: string, result: 'know' | 'unknown'): Promise<void> {
  const res = await fetch(`${API_ENDPOINT}/practice/review`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ word, result }),
  })
  if (!res.ok) throw new Error(`POST /practice/review failed: ${res.status}`)
}
