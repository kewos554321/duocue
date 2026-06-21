import { describe, test, expect } from 'vitest'
import app from '../../index'
import { makeMockDB, SESSION_ENTRY, VALID_TOKEN, AUTH_HEADERS, post, get, del } from '../helpers/mock-db'

const env = (entries: Parameters<typeof makeMockDB>[0]) => ({ DB: makeMockDB(entries) })

describe('POST /sentences', () => {
  test('returns 400 for invalid JSON', async () => {
    const res = await app.request('/sentences', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: 'not-json',
    }, env([SESSION_ENTRY]))
    expect(res.status).toBe(400)
    expect((await res.json() as any).error).toBe('Invalid JSON body')
  })

  test('returns 400 when required fields are missing', async () => {
    const res = await app.request('/sentences', post({ platform: 'youtube', videoUrl: 'https://yt.com' }), env([SESSION_ENTRY]))
    expect(res.status).toBe(400)
    expect((await res.json() as any).error).toContain('required')
  })

  test('returns 400 when timestampS is missing', async () => {
    const res = await app.request('/sentences', post({
      platform: 'youtube', videoUrl: 'https://yt.com', text: 'Hello',
    }), env([SESSION_ENTRY]))
    expect(res.status).toBe(400)
  })

  test('returns 201 with sentence id on success', async () => {
    const res = await app.request('/sentences', post({
      platform: 'youtube',
      videoUrl: 'https://yt.com/v/abc',
      text: 'Hello world',
      translation: '你好世界',
      timestampS: 42,
    }), env([
      SESSION_ENTRY,
      {},                         // INSERT/UPDATE videos
      { first: { id: 10 } },     // SELECT video
      { lastRowId: 99 },          // INSERT sentence
    ]))
    expect(res.status).toBe(201)
    expect((await res.json() as any).id).toBe(99)
  })

  test('returns 500 when video record cannot be created', async () => {
    const res = await app.request('/sentences', post({
      platform: 'youtube',
      videoUrl: 'https://yt.com/v/abc',
      text: 'Hello',
      timestampS: 0,
    }), env([
      SESSION_ENTRY,
      {},            // INSERT/UPDATE videos
      { first: null }, // SELECT video returns null
    ]))
    expect(res.status).toBe(500)
  })
})

describe('GET /sentences', () => {
  test('returns sentences list', async () => {
    const sentences = [
      { id: 1, text: 'Hello', translation: '你好', platform: 'youtube', videoUrl: 'https://yt.com', videoTitle: '', timestampS: 0, createdAt: '2024-01-01T00:00:00Z', aiNote: null, aiNoteUpdatedAt: null },
    ]
    const res = await app.request('/sentences', get(), env([SESSION_ENTRY, { all: sentences }]))
    expect(res.status).toBe(200)
    expect((await res.json() as any).sentences).toEqual(sentences)
  })

  test('returns empty list when no sentences', async () => {
    const res = await app.request('/sentences', get(), env([SESSION_ENTRY, { all: [] }]))
    expect(res.status).toBe(200)
    expect((await res.json() as any).sentences).toEqual([])
  })

  test('accepts platform filter', async () => {
    const res = await app.request('/sentences?platform=netflix', get(), env([SESSION_ENTRY, { all: [] }]))
    expect(res.status).toBe(200)
  })

  test('accepts videoUrl filter', async () => {
    const res = await app.request('/sentences?videoUrl=https://yt.com/v/1', get(), env([SESSION_ENTRY, { all: [] }]))
    expect(res.status).toBe(200)
  })
})

describe('GET /sentences/latest', () => {
  test('returns null when no sentences exist', async () => {
    const res = await app.request('/sentences/latest', get(), env([SESSION_ENTRY, { first: null }]))
    expect(res.status).toBe(200)
    expect((await res.json() as any).latest).toBeNull()
  })

  test('returns latest sentence id and createdAt', async () => {
    const row = { id: 5, createdAt: '2024-06-01T12:00:00Z' }
    const res = await app.request('/sentences/latest', get(), env([SESSION_ENTRY, { first: row }]))
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.latest.id).toBe(5)
    expect(body.latest.createdAt).toBe('2024-06-01T12:00:00Z')
  })
})

describe('DELETE /sentences/:id', () => {
  test('returns 400 for non-numeric id', async () => {
    const res = await app.request('/sentences/abc', del(), env([SESSION_ENTRY]))
    expect(res.status).toBe(400)
    expect((await res.json() as any).error).toBe('Invalid id')
  })

  test('deletes sentence and returns id', async () => {
    const res = await app.request('/sentences/7', del(), env([SESSION_ENTRY, {}]))
    expect(res.status).toBe(200)
    expect((await res.json() as any).deleted).toBe(7)
  })
})
