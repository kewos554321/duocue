import { describe, test, expect } from 'vitest'
import app from '../../index'
import { makeMockDB, SESSION_ENTRY, get, patch, del } from '../helpers/mock-db'

const env = (entries: Parameters<typeof makeMockDB>[0]) => ({ DB: makeMockDB(entries) })

describe('GET /words', () => {
  test('returns words list', async () => {
    const words = [{ word: 'hello', status: 'learning' }, { word: 'world', status: 'learned' }]
    const res = await app.request('/words', get(), env([SESSION_ENTRY, { all: words }]))
    expect(res.status).toBe(200)
    expect((await res.json() as any).words).toEqual(words)
  })

  test('returns empty list when no words', async () => {
    const res = await app.request('/words', get(), env([SESSION_ENTRY, { all: [] }]))
    expect(res.status).toBe(200)
    expect((await res.json() as any).words).toEqual([])
  })
})

describe('PATCH /words/:word', () => {
  test('returns 400 for invalid JSON', async () => {
    const { headers } = patch({})
    const res = await app.request('/words/hello', {
      method: 'PATCH',
      headers,
      body: 'not-json',
    }, env([SESSION_ENTRY]))
    expect(res.status).toBe(400)
    expect((await res.json() as any).error).toBe('Invalid JSON body')
  })

  test('returns 400 for invalid status value', async () => {
    const res = await app.request('/words/hello', patch({ status: 'unknown' }), env([SESSION_ENTRY]))
    expect(res.status).toBe(400)
    expect((await res.json() as any).error).toContain('status must be')
  })

  test('returns 400 when status is missing', async () => {
    const res = await app.request('/words/hello', patch({}), env([SESSION_ENTRY]))
    expect(res.status).toBe(400)
  })

  test('sets status to learning', async () => {
    const res = await app.request('/words/hello', patch({ status: 'learning' }), env([SESSION_ENTRY, {}]))
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.word).toBe('hello')
    expect(body.status).toBe('learning')
  })

  test('sets status to learned', async () => {
    const res = await app.request('/words/hello', patch({ status: 'learned' }), env([SESSION_ENTRY, {}]))
    expect(res.status).toBe(200)
    expect((await res.json() as any).status).toBe('learned')
  })

  test('lowercases the word', async () => {
    const res = await app.request('/words/HELLO', patch({ status: 'learning' }), env([SESSION_ENTRY, {}]))
    expect(res.status).toBe(200)
    expect((await res.json() as any).word).toBe('hello')
  })
})

describe('DELETE /words/:word', () => {
  test('deletes word and returns it lowercased', async () => {
    const res = await app.request('/words/Hello', del(), env([SESSION_ENTRY, {}]))
    expect(res.status).toBe(200)
    expect((await res.json() as any).deleted).toBe('hello')
  })
})
