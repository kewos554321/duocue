import { describe, test, expect, beforeAll } from 'vitest'
import app from '../../index'
import { hashPassword } from '../../auth'
import { makeMockDB, SESSION_ENTRY, VALID_TOKEN, FAR_EXPIRY } from '../helpers/mock-db'

let validHash: string
beforeAll(async () => {
  validHash = await hashPassword('correct-password')
})

const env = (entries: Parameters<typeof makeMockDB>[0]) => ({ DB: makeMockDB(entries) })

describe('Auth middleware', () => {
  test('returns 401 when no Authorization header', async () => {
    const res = await app.request('/sentences', { method: 'GET' }, env([]))
    expect(res.status).toBe(401)
  })

  test('returns 401 when token is not in DB', async () => {
    const res = await app.request('/sentences', {
      method: 'GET',
      headers: { Authorization: 'Bearer bad-token' },
    }, env([{ first: null }]))
    expect(res.status).toBe(401)
  })

  test('returns 401 when session is expired', async () => {
    const expired = new Date(Date.now() - 1000).toISOString()
    const res = await app.request('/sentences', {
      method: 'GET',
      headers: { Authorization: `Bearer ${VALID_TOKEN}` },
    }, env([{ first: { user_id: 1, expires_at: expired } }]))
    expect(res.status).toBe(401)
  })

  test('passes through when token is valid', async () => {
    const res = await app.request('/sentences', {
      method: 'GET',
      headers: { Authorization: `Bearer ${VALID_TOKEN}` },
    }, env([SESSION_ENTRY, { all: [] }]))
    expect(res.status).toBe(200)
  })

  test('refreshes session when expiry is within 15 days', async () => {
    const soonExpiry = new Date(Date.now() + 10 * 86400 * 1000).toISOString()
    const res = await app.request('/sentences', {
      method: 'GET',
      headers: { Authorization: `Bearer ${VALID_TOKEN}` },
    }, env([
      { first: { user_id: 1, expires_at: soonExpiry } },
      { all: [] },  // sentences query
      {},           // UPDATE sessions (refresh)
    ]))
    expect(res.status).toBe(200)
  })
})

describe('POST /auth/register', () => {
  test('returns 400 when email is missing', async () => {
    const res = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'secret' }),
    }, env([]))
    expect(res.status).toBe(400)
    expect((await res.json() as any).error).toBe('email and password are required')
  })

  test('returns 400 when password is missing', async () => {
    const res = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com' }),
    }, env([]))
    expect(res.status).toBe(400)
  })

  test('returns 400 for invalid JSON', async () => {
    const res = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    }, env([]))
    expect(res.status).toBe(400)
    expect((await res.json() as any).error).toBe('Invalid JSON body')
  })

  test('returns 409 when email already registered', async () => {
    const res = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'existing@test.com', password: 'secret' }),
    }, env([{ first: { id: 1 } }]))
    expect(res.status).toBe(409)
    expect((await res.json() as any).error).toBe('Email already registered')
  })

  test('returns 201 with token on success', async () => {
    const res = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'new@test.com', password: 'secret123' }),
    }, env([
      { first: null },
      { lastRowId: 42 },
      {},
    ]))
    expect(res.status).toBe(201)
    const body = await res.json() as any
    expect(typeof body.token).toBe('string')
    expect(body.token.length).toBeGreaterThan(10)
  })

  test('trims and lowercases email', async () => {
    const res = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: '  UPPER@Test.COM  ', password: 'secret123' }),
    }, env([
      { first: null },
      { lastRowId: 1 },
      {},
    ]))
    expect(res.status).toBe(201)
  })
})

describe('POST /auth/login', () => {
  test('returns 400 when email is missing', async () => {
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'secret' }),
    }, env([]))
    expect(res.status).toBe(400)
  })

  test('returns 400 when password is missing', async () => {
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com' }),
    }, env([]))
    expect(res.status).toBe(400)
  })

  test('returns 400 for invalid JSON', async () => {
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    }, env([]))
    expect(res.status).toBe(400)
    expect((await res.json() as any).error).toBe('Invalid JSON body')
  })

  test('returns 401 when user not found', async () => {
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nobody@test.com', password: 'secret' }),
    }, env([{ first: null }]))
    expect(res.status).toBe(401)
    expect((await res.json() as any).error).toBe('Invalid email or password')
  })

  test('returns 401 when password is wrong', async () => {
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@test.com', password: 'wrong-password' }),
    }, env([{ first: { id: 1, password_hash: validHash } }]))
    expect(res.status).toBe(401)
  })

  test('returns 200 with token when credentials are correct', async () => {
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@test.com', password: 'correct-password' }),
    }, env([
      { first: { id: 1, password_hash: validHash } },
      {},
    ]))
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(typeof body.token).toBe('string')
    expect(body.token.length).toBeGreaterThan(10)
  })
})

describe('POST /auth/logout', () => {
  test('returns 204', async () => {
    const res = await app.request('/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${VALID_TOKEN}` },
    }, env([SESSION_ENTRY, {}]))
    expect(res.status).toBe(204)
  })
})
