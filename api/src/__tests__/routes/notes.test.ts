import { describe, test, expect, vi, beforeEach } from 'vitest'
import app from '../../index'
import { makeMockDB, SESSION_ENTRY, AUTH_HEADERS, get, post, del } from '../helpers/mock-db'

const mocks = vi.hoisted(() => ({
  generateContentStream: vi.fn().mockImplementation(
    async () => (async function* () { yield { text: 'mocked chunk' } })()
  ),
  generateContent: vi.fn().mockResolvedValue({ text: 'mocked summary note' }),
}))

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = {
      generateContentStream: mocks.generateContentStream,
      generateContent: mocks.generateContent,
    }
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.generateContentStream.mockImplementation(
    async () => (async function* () { yield { text: 'mocked chunk' } })()
  )
  mocks.generateContent.mockResolvedValue({ text: 'mocked summary note' })
})

const env = (entries: Parameters<typeof makeMockDB>[0]) => ({ DB: makeMockDB(entries) })
const MESSAGES = [{ role: 'user', content: 'What does this mean?' }]

describe('POST /sentences/:id/ai-chat', () => {
  test('returns 400 for non-numeric id', async () => {
    const res = await app.request('/sentences/abc/ai-chat', post({ messages: MESSAGES }), env([SESSION_ENTRY]))
    expect(res.status).toBe(400)
    expect((await res.json() as any).error).toBe('Invalid id')
  })

  test('returns 400 for invalid JSON', async () => {
    const res = await app.request('/sentences/1/ai-chat', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: 'not-json',
    }, env([SESSION_ENTRY]))
    expect(res.status).toBe(400)
    expect((await res.json() as any).error).toBe('Invalid JSON body')
  })

  test('returns 400 when messages is empty array', async () => {
    const res = await app.request('/sentences/1/ai-chat', post({ messages: [] }), env([SESSION_ENTRY]))
    expect(res.status).toBe(400)
    expect((await res.json() as any).error).toBe('messages is required')
  })

  test('returns 400 when messages is missing', async () => {
    const res = await app.request('/sentences/1/ai-chat', post({}), env([SESSION_ENTRY]))
    expect(res.status).toBe(400)
  })

  test('returns 404 when sentence not found', async () => {
    const res = await app.request('/sentences/1/ai-chat', post({ messages: MESSAGES }), env([
      SESSION_ENTRY,
      { first: null },
    ]))
    expect(res.status).toBe(404)
    expect((await res.json() as any).error).toBe('Sentence not found')
  })

  test('returns 400 GEMINI_KEY_MISSING when no api key configured', async () => {
    const res = await app.request('/sentences/1/ai-chat', post({ messages: MESSAGES }), env([
      SESSION_ENTRY,
      { first: { text: 'Hello', translation: null } },
      { first: null },
    ]))
    expect(res.status).toBe(400)
    expect((await res.json() as any).error).toBe('GEMINI_KEY_MISSING')
  })

  test('streams SSE delta events when gemini key is configured', async () => {
    const res = await app.request('/sentences/1/ai-chat', post({ messages: MESSAGES }), env([
      SESSION_ENTRY,
      { first: { text: 'Hello world', translation: '你好世界' } },
      { first: { value: 'fake-gemini-key' } },
    ]))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')
    const text = await res.text()
    expect(text).toContain('mocked chunk')
    expect(text).toContain('"done":true')
  })

  test('sends SSE error event when Gemini stream throws', async () => {
    mocks.generateContentStream.mockImplementationOnce(() => {
      throw new Error('Gemini API error')
    })
    const res = await app.request('/sentences/1/ai-chat', post({ messages: MESSAGES }), env([
      SESSION_ENTRY,
      { first: { text: 'Hello', translation: null } },
      { first: { value: 'fake-gemini-key' } },
    ]))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')
    const text = await res.text()
    expect(text).toContain('"error"')
    expect(text).toContain('Gemini API error')
  })
})

describe('POST /sentences/:id/note/summarize', () => {
  test('returns 400 for non-numeric id', async () => {
    const res = await app.request('/sentences/abc/note/summarize', post({ messages: MESSAGES }), env([SESSION_ENTRY]))
    expect(res.status).toBe(400)
    expect((await res.json() as any).error).toBe('Invalid id')
  })

  test('returns 400 for invalid JSON', async () => {
    const res = await app.request('/sentences/1/note/summarize', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: 'not-json',
    }, env([SESSION_ENTRY]))
    expect(res.status).toBe(400)
    expect((await res.json() as any).error).toBe('Invalid JSON body')
  })

  test('returns 400 when messages is missing', async () => {
    const res = await app.request('/sentences/1/note/summarize', post({}), env([SESSION_ENTRY]))
    expect(res.status).toBe(400)
  })

  test('returns 404 when sentence not found', async () => {
    const res = await app.request('/sentences/1/note/summarize', post({ messages: MESSAGES }), env([
      SESSION_ENTRY,
      { first: null },
    ]))
    expect(res.status).toBe(404)
  })

  test('returns 400 GEMINI_KEY_MISSING when no api key configured', async () => {
    const res = await app.request('/sentences/1/note/summarize', post({ messages: MESSAGES }), env([
      SESSION_ENTRY,
      { first: { text: 'Hello', translation: '你好' } },
      { first: null },
    ]))
    expect(res.status).toBe(400)
    expect((await res.json() as any).error).toBe('GEMINI_KEY_MISSING')
  })

  test('returns draft and covers assistant role mapping', async () => {
    const messages = [
      { role: 'user', content: 'What does this mean?' },
      { role: 'assistant', content: 'It means hello.' },
    ]
    const res = await app.request('/sentences/1/note/summarize', post({ messages }), env([
      SESSION_ENTRY,
      { first: { text: 'Hello world', translation: '你好世界' } },
      { first: { value: 'fake-gemini-key' } },
    ]))
    expect(res.status).toBe(200)
    expect((await res.json() as any).draft).toBe('mocked summary note')
  })
})

describe('POST /sentences/:id/note', () => {
  test('returns 400 for non-numeric id', async () => {
    const res = await app.request('/sentences/abc/note', post({ note: 'my note' }), env([SESSION_ENTRY]))
    expect(res.status).toBe(400)
    expect((await res.json() as any).error).toBe('Invalid id')
  })

  test('returns 400 for invalid JSON', async () => {
    const res = await app.request('/sentences/1/note', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: 'not-json',
    }, env([SESSION_ENTRY]))
    expect(res.status).toBe(400)
    expect((await res.json() as any).error).toBe('Invalid JSON body')
  })

  test('returns 400 when note is missing', async () => {
    const res = await app.request('/sentences/1/note', post({}), env([SESSION_ENTRY]))
    expect(res.status).toBe(400)
    expect((await res.json() as any).error).toBe('note is required')
  })

  test('returns 400 when note is blank whitespace', async () => {
    const res = await app.request('/sentences/1/note', post({ note: '   ' }), env([SESSION_ENTRY]))
    expect(res.status).toBe(400)
  })

  test('returns 404 when sentence not found (changes=0)', async () => {
    const res = await app.request('/sentences/1/note', post({ note: 'useful note' }), env([
      SESSION_ENTRY,
      { changes: 0 },
    ]))
    expect(res.status).toBe(404)
    expect((await res.json() as any).error).toBe('Sentence not found')
  })

  test('saves note and returns ok with timestamp', async () => {
    const res = await app.request('/sentences/1/note', post({ note: 'useful note' }), env([
      SESSION_ENTRY,
      { changes: 1 },
    ]))
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.ok).toBe(true)
    expect(typeof body.aiNoteUpdatedAt).toBe('number')
  })
})

describe('DELETE /sentences/:id/note', () => {
  test('returns 400 for non-numeric id', async () => {
    const res = await app.request('/sentences/abc/note', del(), env([SESSION_ENTRY]))
    expect(res.status).toBe(400)
    expect((await res.json() as any).error).toBe('Invalid id')
  })

  test('returns 404 when sentence not found (changes=0)', async () => {
    const res = await app.request('/sentences/99/note', del(), env([SESSION_ENTRY, { changes: 0 }]))
    expect(res.status).toBe(404)
    expect((await res.json() as any).error).toBe('Sentence not found')
  })

  test('deletes note and returns ok', async () => {
    const res = await app.request('/sentences/1/note', del(), env([SESSION_ENTRY, {}]))
    expect(res.status).toBe(200)
    expect((await res.json() as any).ok).toBe(true)
  })
})

describe('GET /notes', () => {
  test('returns notes list', async () => {
    const notes = [
      { sentenceId: 1, text: 'Hello', translation: '你好', platform: 'youtube', videoTitle: 'Lesson 1', videoUrl: 'https://yt.com', timestampS: 10, aiNote: 'Some note', aiNoteUpdatedAt: 1700000000 },
    ]
    const res = await app.request('/notes', get(), env([SESSION_ENTRY, { all: notes }]))
    expect(res.status).toBe(200)
    expect((await res.json() as any).notes).toEqual(notes)
  })

  test('returns empty list when no notes', async () => {
    const res = await app.request('/notes', get(), env([SESSION_ENTRY, { all: [] }]))
    expect(res.status).toBe(200)
    expect((await res.json() as any).notes).toEqual([])
  })
})
