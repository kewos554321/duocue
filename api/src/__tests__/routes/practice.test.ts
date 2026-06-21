import { describe, test, expect } from 'vitest'
import app from '../../index'
import { makeMockDB, SESSION_ENTRY, VALID_TOKEN, AUTH_HEADERS, get, post } from '../helpers/mock-db'

const env = (entries: Parameters<typeof makeMockDB>[0]) => ({ DB: makeMockDB(entries) })

describe('GET /practice/queue', () => {
  test('returns empty queue when no words due', async () => {
    const res = await app.request('/practice/queue', get(), env([SESSION_ENTRY, { all: [] }]))
    expect(res.status).toBe(200)
    expect((await res.json() as any).queue).toEqual([])
  })

  test('returns queue with word and matched sentence', async () => {
    const word = { word: 'hello', intervalDays: 1, nextReviewAt: null, repetitions: 0, easeFactor: 2.5 }
    const sentence = { text: 'Say hello to me', translation: '向我打招呼', videoUrl: 'https://yt.com', timestampS: 10 }
    const res = await app.request('/practice/queue', get(), env([
      SESSION_ENTRY,
      { all: [word] },     // words query
      { all: [sentence] }, // sentence query for 'hello' (consumed by bind before batch)
    ]))
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.queue).toHaveLength(1)
    expect(body.queue[0].word).toBe('hello')
    expect(body.queue[0].sentence).toEqual(sentence)
  })

  test('returns null sentence when no matching sentence found', async () => {
    const word = { word: 'hello', intervalDays: 1, nextReviewAt: null, repetitions: 0, easeFactor: 2.5 }
    const res = await app.request('/practice/queue', get(), env([
      SESSION_ENTRY,
      { all: [word] },
      { all: [] },  // no sentence found
    ]))
    expect(res.status).toBe(200)
    expect((await res.json() as any).queue[0].sentence).toBeNull()
  })

  test('returns queue with multiple words', async () => {
    const words = [
      { word: 'hello', intervalDays: 1, nextReviewAt: null, repetitions: 0, easeFactor: 2.5 },
      { word: 'world', intervalDays: 2, nextReviewAt: null, repetitions: 1, easeFactor: 2.5 },
    ]
    const res = await app.request('/practice/queue', get(), env([
      SESSION_ENTRY,
      { all: words },
      { all: [] },  // no sentence for 'hello'
      { all: [] },  // no sentence for 'world'
    ]))
    expect(res.status).toBe(200)
    expect((await res.json() as any).queue).toHaveLength(2)
  })
})

describe('POST /practice/review', () => {
  test('returns 400 for invalid JSON', async () => {
    const res = await app.request('/practice/review', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: 'not-json',
    }, env([SESSION_ENTRY]))
    expect(res.status).toBe(400)
    expect((await res.json() as any).error).toBe('Invalid JSON body')
  })

  test('returns 400 when word is missing', async () => {
    const res = await app.request('/practice/review', post({ rating: 3 }), env([SESSION_ENTRY]))
    expect(res.status).toBe(400)
    expect((await res.json() as any).error).toContain('word')
  })

  test('returns 400 for rating out of range', async () => {
    const res = await app.request('/practice/review', post({ word: 'hello', rating: 5 }), env([SESSION_ENTRY]))
    expect(res.status).toBe(400)
    expect((await res.json() as any).error).toContain('rating')
  })

  test('returns 400 for rating 0', async () => {
    const res = await app.request('/practice/review', post({ word: 'hello', rating: 0 }), env([SESSION_ENTRY]))
    expect(res.status).toBe(400)
  })

  test('returns 404 when word not found in DB', async () => {
    const res = await app.request('/practice/review', post({ word: 'unknown', rating: 3 }), env([
      SESSION_ENTRY,
      { first: null },
    ]))
    expect(res.status).toBe(404)
    expect((await res.json() as any).error).toBe('Word not found')
  })

  test('returns updated schedule on success (rating 3, stays learning)', async () => {
    const res = await app.request('/practice/review', post({ word: 'hello', rating: 3 }), env([
      SESSION_ENTRY,
      { first: { interval_days: 1, repetitions: 0, ease_factor: 2.5 } },
      {},  // UPDATE words (batch)
      {},  // INSERT reviews (batch)
    ]))
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.word).toBe('hello')
    expect(typeof body.intervalDays).toBe('number')
    expect(typeof body.nextReviewAt).toBe('number')
    expect(body.graduated).toBe(false)
  })

  test('marks word as graduated when interval >= 21 (rating 4, high interval)', async () => {
    const res = await app.request('/practice/review', post({ word: 'hello', rating: 4 }), env([
      SESSION_ENTRY,
      { first: { interval_days: 20, repetitions: 5, ease_factor: 2.5 } },
      {},
      {},
    ]))
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.graduated).toBe(true)
  })

  test('all valid ratings (1-4) are accepted', async () => {
    for (const rating of [1, 2, 3, 4]) {
      const res = await app.request('/practice/review', post({ word: 'hello', rating }), env([
        SESSION_ENTRY,
        { first: { interval_days: 1, repetitions: 0, ease_factor: 2.5 } },
        {},
        {},
      ]))
      expect(res.status).toBe(200)
    }
  })
})

describe('GET /practice/stats', () => {
  test('returns stats with zeros when no reviews', async () => {
    const res = await app.request('/practice/stats', get(), env([
      SESSION_ENTRY,
      { all: [] },                                    // last30
      { all: [] },                                    // streakRows
      { all: [{ learning: 0, learned: 0 }] },         // wordCounts
      { all: [{ count: 0 }] },                        // todayRow
    ]))
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.streak).toBe(0)
    expect(body.todayCount).toBe(0)
    expect(body.wordCounts).toEqual({ learning: 0, learned: 0 })
    expect(body.last30Days).toEqual([])
  })

  test('returns streak of 1 when reviewed today', async () => {
    const todayStr = new Date().toISOString().slice(0, 10)
    const res = await app.request('/practice/stats', get(), env([
      SESSION_ENTRY,
      { all: [{ date: todayStr, count: 3 }] },        // last30
      { all: [{ date: todayStr }] },                   // streakRows
      { all: [{ learning: 2, learned: 1 }] },          // wordCounts
      { all: [{ count: 3 }] },                         // todayRow
    ]))
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.streak).toBe(1)
    expect(body.todayCount).toBe(3)
    expect(body.wordCounts).toEqual({ learning: 2, learned: 1 })
  })

  test('counts consecutive streak correctly', async () => {
    const today = new Date()
    const d = (offset: number) => new Date(today.getTime() - offset * 86400000).toISOString().slice(0, 10)
    const res = await app.request('/practice/stats', get(), env([
      SESSION_ENTRY,
      { all: [] },                                     // last30
      { all: [{ date: d(0) }, { date: d(1) }, { date: d(2) }] },  // streakRows (today, yesterday, 2 days ago)
      { all: [{ learning: 0, learned: 0 }] },
      { all: [{ count: 0 }] },
    ]))
    expect(res.status).toBe(200)
    expect((await res.json() as any).streak).toBe(3)
  })

  test('handles missing wordCounts row gracefully', async () => {
    const res = await app.request('/practice/stats', get(), env([
      SESSION_ENTRY,
      { all: [] },
      { all: [] },
      { all: [] },  // no wordCounts row
      { all: [{ count: 0 }] },
    ]))
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.wordCounts).toEqual({ learning: 0, learned: 0 })
  })
})
