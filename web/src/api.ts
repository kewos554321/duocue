import { API_ENDPOINT, API_KEY } from './config'
import type { ApiSentence, ApiVideo, ApiWord, WordStatus } from './types'

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

export async function patchWordStatus(word: string, status: WordStatus): Promise<void> {
  const res = await fetch(`${API_ENDPOINT}/words/${encodeURIComponent(word.toLowerCase())}`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ status }),
  })
  if (!res.ok) throw new Error(`PATCH /words/${word} failed: ${res.status}`)
}
