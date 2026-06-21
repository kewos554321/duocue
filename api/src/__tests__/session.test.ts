import { describe, test, expect } from 'vitest'
import { needsRefresh } from '../index'

describe('needsRefresh', () => {
  test('returns false when session expires in more than 15 days', () => {
    const future = new Date(Date.now() + 20 * 86400 * 1000).toISOString()
    expect(needsRefresh(future)).toBe(false)
  })

  test('returns true when session expires in fewer than 15 days', () => {
    const soon = new Date(Date.now() + 10 * 86400 * 1000).toISOString()
    expect(needsRefresh(soon)).toBe(true)
  })

  test('returns true when session is already expired', () => {
    const past = new Date(Date.now() - 1000).toISOString()
    expect(needsRefresh(past)).toBe(true)
  })

  test('returns true when exactly at the 15-day threshold', () => {
    const now = new Date()
    const threshold = new Date(now.getTime() + 15 * 86400 * 1000)
    // expires_at == threshold means < threshold is false — should NOT refresh
    expect(needsRefresh(new Date(threshold.getTime() + 1).toISOString(), now)).toBe(false)
    // expires_at one ms before threshold — should refresh
    expect(needsRefresh(new Date(threshold.getTime() - 1).toISOString(), now)).toBe(true)
  })
})
