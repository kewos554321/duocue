import { describe, test, expect } from 'vitest'
import app from '../../index'
import { makeMockDB, SESSION_ENTRY, get, patch } from '../helpers/mock-db'

const env = (entries: Parameters<typeof makeMockDB>[0]) => ({ DB: makeMockDB(entries) })

describe('GET /videos', () => {
  test('returns videos list with sentence counts', async () => {
    const videos = [
      { platform: 'youtube', url: 'https://yt.com/v/1', title: 'Lesson 1', sentenceCount: 3 },
    ]
    const res = await app.request('/videos', get(), env([SESSION_ENTRY, { all: videos }]))
    expect(res.status).toBe(200)
    expect((await res.json() as any).videos).toEqual(videos)
  })

  test('returns empty list when no videos', async () => {
    const res = await app.request('/videos', get(), env([SESSION_ENTRY, { all: [] }]))
    expect(res.status).toBe(200)
    expect((await res.json() as any).videos).toEqual([])
  })
})

describe('PATCH /videos', () => {
  test('returns 400 for invalid JSON', async () => {
    const { headers } = patch({})
    const res = await app.request('/videos', {
      method: 'PATCH',
      headers,
      body: 'not-json',
    }, env([SESSION_ENTRY]))
    expect(res.status).toBe(400)
    expect((await res.json() as any).error).toBe('Invalid JSON body')
  })

  test('returns 400 when url is missing', async () => {
    const res = await app.request('/videos', patch({ title: 'New Title' }), env([SESSION_ENTRY]))
    expect(res.status).toBe(400)
    expect((await res.json() as any).error).toBe('url is required')
  })

  test('returns 404 when video not found', async () => {
    const res = await app.request('/videos', patch({ url: 'https://yt.com/v/999' }), env([SESSION_ENTRY, { changes: 0 }]))
    expect(res.status).toBe(404)
    expect((await res.json() as any).error).toBe('Video not found')
  })

  test('updates title and returns url and new title', async () => {
    const res = await app.request('/videos', patch({ url: 'https://yt.com/v/1', title: 'Updated' }), env([SESSION_ENTRY, { changes: 1 }]))
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.url).toBe('https://yt.com/v/1')
    expect(body.title).toBe('Updated')
  })

  test('sets title to null when empty string is provided', async () => {
    const res = await app.request('/videos', patch({ url: 'https://yt.com/v/1', title: '' }), env([SESSION_ENTRY, { changes: 1 }]))
    expect(res.status).toBe(200)
    expect((await res.json() as any).title).toBeNull()
  })

  test('sets title to null when title is omitted', async () => {
    const res = await app.request('/videos', patch({ url: 'https://yt.com/v/1' }), env([SESSION_ENTRY, { changes: 1 }]))
    expect(res.status).toBe(200)
    expect((await res.json() as any).title).toBeNull()
  })
})
