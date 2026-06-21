import { describe, test, expect } from 'vitest'
import app from '../../index'
import { makeMockDB, SESSION_ENTRY, AUTH_HEADERS, get, post } from '../helpers/mock-db'

const env = (entries: Parameters<typeof makeMockDB>[0]) => ({ DB: makeMockDB(entries) })

describe('GET /settings', () => {
  test('returns hasGeminiKey false when no key stored', async () => {
    const res = await app.request('/settings', get(), env([SESSION_ENTRY, { first: null }]))
    expect(res.status).toBe(200)
    expect((await res.json() as any).hasGeminiKey).toBe(false)
  })

  test('returns hasGeminiKey true when key exists', async () => {
    const res = await app.request('/settings', get(), env([SESSION_ENTRY, { first: { value: 'my-api-key' } }]))
    expect(res.status).toBe(200)
    expect((await res.json() as any).hasGeminiKey).toBe(true)
  })
})

describe('POST /settings', () => {
  test('returns 400 for invalid JSON', async () => {
    const res = await app.request('/settings', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: 'not-json',
    }, env([SESSION_ENTRY]))
    expect(res.status).toBe(400)
    expect((await res.json() as any).error).toBe('Invalid JSON body')
  })

  test('returns 400 when geminiApiKey is missing', async () => {
    const res = await app.request('/settings', post({}), env([SESSION_ENTRY]))
    expect(res.status).toBe(400)
    expect((await res.json() as any).error).toBe('geminiApiKey is required')
  })

  test('returns 400 when geminiApiKey is empty string', async () => {
    const res = await app.request('/settings', post({ geminiApiKey: '   ' }), env([SESSION_ENTRY]))
    expect(res.status).toBe(400)
  })

  test('saves key and returns ok', async () => {
    const res = await app.request('/settings', post({ geminiApiKey: 'AIza-test-key' }), env([SESSION_ENTRY, {}]))
    expect(res.status).toBe(200)
    expect((await res.json() as any).ok).toBe(true)
  })
})
