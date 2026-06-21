import { vi, describe, test, expect, beforeEach } from 'vitest'

vi.mock('../auth', () => ({
  getToken: vi.fn(() => 'test-token'),
  clearToken: vi.fn(),
}))
vi.mock('../config', () => ({ API_ENDPOINT: 'https://api.test' }))

import { clearToken } from '../auth'
import {
  register, login, logout,
  fetchSentences, fetchWords, fetchVideos, fetchPracticeQueue, fetchPracticeStats,
  patchWordStatus, patchVideoTitle, postPracticeReview,
  deleteSentence, removeWord,
  streamAiChat, postNoteSummarize, saveNote, deleteNote,
  getSettings, saveGeminiKey,
} from '../api'

function mockFetch(body: unknown, status = 200): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
    body: null,
  })
}

function sseStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c))
      controller.close()
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('window', { location: { href: '' } })
})

// ── register / login ───────────────────────────────────────────────────────

describe('register', () => {
  test('returns token on success', async () => {
    vi.stubGlobal('fetch', mockFetch({ token: 'tok123' }, 201))
    expect(await register('a@b.com', 'pw')).toBe('tok123')
  })
  test('throws server error message on failure', async () => {
    vi.stubGlobal('fetch', mockFetch({ error: 'Email already registered' }, 409))
    await expect(register('a@b.com', 'pw')).rejects.toThrow('Email already registered')
  })
  test('throws fallback message when no error field', async () => {
    vi.stubGlobal('fetch', mockFetch({}, 500))
    await expect(register('a@b.com', 'pw')).rejects.toThrow('Register failed: 500')
  })
})

describe('login', () => {
  test('returns token on success', async () => {
    vi.stubGlobal('fetch', mockFetch({ token: 'tok456' }))
    expect(await login('a@b.com', 'pw')).toBe('tok456')
  })
  test('throws server error message on failure', async () => {
    vi.stubGlobal('fetch', mockFetch({ error: 'Invalid email or password' }, 401))
    await expect(login('a@b.com', 'wrong')).rejects.toThrow('Invalid email or password')
  })
})

// ── request() 401 middleware ───────────────────────────────────────────────

describe('authenticated request — 401 handling', () => {
  test('clears token and redirects to /login on 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 401, json: vi.fn(), body: null,
    }))
    await expect(fetchSentences()).rejects.toThrow('Unauthorized')
    expect(clearToken).toHaveBeenCalledOnce()
    expect((window as Window & typeof globalThis).location.href).toBe('/login')
  })
})

// ── data-fetching endpoints ────────────────────────────────────────────────

describe('fetchSentences', () => {
  test('returns sentences array on success', async () => {
    const sentences = [{ id: 1, text: 'Hello' }]
    vi.stubGlobal('fetch', mockFetch({ sentences }))
    expect(await fetchSentences()).toEqual(sentences)
  })
  test('throws on non-ok response', async () => {
    vi.stubGlobal('fetch', mockFetch({}, 500))
    await expect(fetchSentences()).rejects.toThrow('GET /sentences failed: 500')
  })
})

describe('fetchWords', () => {
  test('returns words array on success', async () => {
    const words = [{ word: 'hello', status: 'learning' }]
    vi.stubGlobal('fetch', mockFetch({ words }))
    expect(await fetchWords()).toEqual(words)
  })
})

describe('fetchPracticeQueue', () => {
  test('returns queue array on success', async () => {
    const queue = [{ word: 'hello', intervalDays: 1, nextReviewAt: null, repetitions: 0, easeFactor: 2.5, sentence: null }]
    vi.stubGlobal('fetch', mockFetch({ queue }))
    expect(await fetchPracticeQueue()).toEqual(queue)
  })
})

describe('patchWordStatus', () => {
  test('lowercases the word in the URL', async () => {
    const stub = mockFetch({})
    vi.stubGlobal('fetch', stub)
    await patchWordStatus('HELLO', 'learning')
    expect((stub.mock.calls[0][0] as string)).toContain('HELLO'.toLowerCase())
  })
})

describe('postPracticeReview', () => {
  test('throws on non-ok response', async () => {
    vi.stubGlobal('fetch', mockFetch({ error: 'Word not found' }, 404))
    await expect(postPracticeReview('hello', 3)).rejects.toThrow('POST /practice/review failed: 404')
  })
})

// ── streamAiChat (SSE parsing) ─────────────────────────────────────────────

describe('streamAiChat', () => {
  test('calls onDelta for each delta event', async () => {
    const stream = sseStream([
      'data: {"delta":"Hello"}\n\ndata: {"delta":" world"}\n\ndata: {"done":true}\n\n',
    ])
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, body: stream }))
    const deltas: string[] = []
    await streamAiChat(1, [], d => deltas.push(d))
    expect(deltas).toEqual(['Hello', ' world'])
  })

  test('reassembles events split across multiple reads', async () => {
    // Simulates chunk boundary inside an SSE line
    const encoder = new TextEncoder()
    const parts = [
      encoder.encode('data: {"delta":"He'),
      encoder.encode('llo"}\n\ndata: {"done":true}\n\n'),
    ]
    let i = 0
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (i < parts.length) controller.enqueue(parts[i++])
        else controller.close()
      },
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, body: stream }))
    const deltas: string[] = []
    await streamAiChat(1, [], d => deltas.push(d))
    expect(deltas).toEqual(['Hello'])
  })

  test('throws when SSE payload contains an error field', async () => {
    const stream = sseStream(['data: {"error":"GEMINI_KEY_MISSING"}\n\n'])
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, body: stream }))
    await expect(streamAiChat(1, [], () => {})).rejects.toThrow('GEMINI_KEY_MISSING')
  })

  test('throws on non-ok HTTP response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400, body: null }))
    await expect(streamAiChat(1, [], () => {})).rejects.toThrow('POST /sentences/1/ai-chat failed: 400')
  })

  test('ignores lines not starting with data:', async () => {
    const stream = sseStream([
      ': keep-alive\n\ndata: {"delta":"Hi"}\n\ndata: {"done":true}\n\n',
    ])
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, body: stream }))
    const deltas: string[] = []
    await streamAiChat(1, [], d => deltas.push(d))
    expect(deltas).toEqual(['Hi'])
  })
})

// ── note endpoints ─────────────────────────────────────────────────────────

describe('postNoteSummarize', () => {
  test('returns draft text', async () => {
    vi.stubGlobal('fetch', mockFetch({ draft: 'My note summary' }))
    expect(await postNoteSummarize(1, [])).toBe('My note summary')
  })
})

describe('saveNote', () => {
  test('returns aiNoteUpdatedAt timestamp', async () => {
    vi.stubGlobal('fetch', mockFetch({ ok: true, aiNoteUpdatedAt: 1234567890 }))
    expect(await saveNote(1, 'my note')).toBe(1234567890)
  })
})

describe('getSettings', () => {
  test('returns settings object', async () => {
    vi.stubGlobal('fetch', mockFetch({ hasGeminiKey: true }))
    expect(await getSettings()).toEqual({ hasGeminiKey: true })
  })
})

describe('saveGeminiKey', () => {
  test('throws on non-ok response', async () => {
    vi.stubGlobal('fetch', mockFetch({ error: 'geminiApiKey is required' }, 400))
    await expect(saveGeminiKey('')).rejects.toThrow('POST /settings failed: 400')
  })
})

// ── logout ─────────────────────────────────────────────────────────────────

describe('logout', () => {
  test('calls POST /auth/logout', async () => {
    const stub = mockFetch({})
    vi.stubGlobal('fetch', stub)
    await logout()
    expect(stub).toHaveBeenCalledOnce()
    expect((stub.mock.calls[0][0] as string)).toContain('/auth/logout')
  })
})

// ── fetchVideos ────────────────────────────────────────────────────────────

describe('fetchVideos', () => {
  test('returns videos array on success', async () => {
    const videos = [{ platform: 'youtube', url: 'https://yt.com', title: 'Lesson 1', sentenceCount: 3 }]
    vi.stubGlobal('fetch', mockFetch({ videos }))
    expect(await fetchVideos()).toEqual(videos)
  })
  test('throws on non-ok response', async () => {
    vi.stubGlobal('fetch', mockFetch({}, 500))
    await expect(fetchVideos()).rejects.toThrow('GET /videos failed: 500')
  })
})

// ── deleteSentence ─────────────────────────────────────────────────────────

describe('deleteSentence', () => {
  test('calls DELETE /sentences/:id', async () => {
    const stub = mockFetch({})
    vi.stubGlobal('fetch', stub)
    await deleteSentence(7)
    expect((stub.mock.calls[0][0] as string)).toContain('/sentences/7')
  })
  test('throws on non-ok response', async () => {
    vi.stubGlobal('fetch', mockFetch({}, 500))
    await expect(deleteSentence(7)).rejects.toThrow('DELETE /sentences/7 failed: 500')
  })
})

// ── removeWord ─────────────────────────────────────────────────────────────

describe('removeWord', () => {
  test('calls DELETE /words/:word lowercased', async () => {
    const stub = mockFetch({})
    vi.stubGlobal('fetch', stub)
    await removeWord('HELLO')
    expect((stub.mock.calls[0][0] as string)).toContain('/words/hello')
  })
  test('throws on non-ok response', async () => {
    vi.stubGlobal('fetch', mockFetch({}, 500))
    await expect(removeWord('hello')).rejects.toThrow('DELETE /words/hello failed: 500')
  })
})

// ── patchWordStatus ────────────────────────────────────────────────────────

describe('patchWordStatus success', () => {
  test('resolves without throwing on success', async () => {
    vi.stubGlobal('fetch', mockFetch({}))
    await expect(patchWordStatus('hello', 'learned')).resolves.toBeUndefined()
  })
  test('throws on non-ok response', async () => {
    vi.stubGlobal('fetch', mockFetch({}, 400))
    await expect(patchWordStatus('hello', 'learning')).rejects.toThrow('PATCH /words/hello failed: 400')
  })
})

// ── patchVideoTitle ────────────────────────────────────────────────────────

describe('patchVideoTitle', () => {
  test('calls PATCH /videos with url and title', async () => {
    const stub = mockFetch({})
    vi.stubGlobal('fetch', stub)
    await patchVideoTitle('https://yt.com/v/1', 'New Title')
    expect((stub.mock.calls[0][0] as string)).toContain('/videos')
  })
  test('throws on non-ok response', async () => {
    vi.stubGlobal('fetch', mockFetch({ error: 'Video not found' }, 404))
    await expect(patchVideoTitle('https://yt.com/bad', '')).rejects.toThrow('PATCH /videos failed: 404')
  })
})

// ── fetchPracticeStats ─────────────────────────────────────────────────────

describe('fetchPracticeStats', () => {
  test('returns stats object on success', async () => {
    const stats = { streak: 3, todayCount: 5, wordCounts: { learning: 2, learned: 1 }, last30Days: [] }
    vi.stubGlobal('fetch', mockFetch(stats))
    expect(await fetchPracticeStats()).toEqual(stats)
  })
  test('throws on non-ok response', async () => {
    vi.stubGlobal('fetch', mockFetch({}, 500))
    await expect(fetchPracticeStats()).rejects.toThrow('GET /practice/stats failed: 500')
  })
})

// ── postPracticeReview ─────────────────────────────────────────────────────

describe('postPracticeReview success', () => {
  test('resolves without throwing on success', async () => {
    vi.stubGlobal('fetch', mockFetch({}))
    await expect(postPracticeReview('hello', 3)).resolves.toBeUndefined()
  })
})

// ── deleteNote ─────────────────────────────────────────────────────────────

describe('deleteNote', () => {
  test('calls DELETE /sentences/:id/note', async () => {
    const stub = mockFetch({})
    vi.stubGlobal('fetch', stub)
    await deleteNote(5)
    expect((stub.mock.calls[0][0] as string)).toContain('/sentences/5/note')
  })
  test('throws on non-ok response', async () => {
    vi.stubGlobal('fetch', mockFetch({ error: 'Sentence not found' }, 404))
    await expect(deleteNote(99)).rejects.toThrow('DELETE /sentences/99/note failed: 404')
  })
})

// ── postNoteSummarize error case ───────────────────────────────────────────

describe('postNoteSummarize error', () => {
  test('throws on non-ok response', async () => {
    vi.stubGlobal('fetch', mockFetch({ error: 'Sentence not found' }, 404))
    await expect(postNoteSummarize(1, [])).rejects.toThrow('POST /sentences/1/note/summarize failed: 404')
  })
})

// ── saveNote error case ────────────────────────────────────────────────────

describe('saveNote error', () => {
  test('throws on non-ok response', async () => {
    vi.stubGlobal('fetch', mockFetch({ error: 'note is required' }, 400))
    await expect(saveNote(1, '')).rejects.toThrow('POST /sentences/1/note failed: 400')
  })
})

// ── getSettings error case ─────────────────────────────────────────────────

describe('getSettings error', () => {
  test('throws on non-ok response', async () => {
    vi.stubGlobal('fetch', mockFetch({}, 401))
    await expect(getSettings()).rejects.toThrow('Unauthorized')
  })
})
