import { describe, test, expect } from 'vitest'
import { formatRelativeTime } from '../utils/time'
import { getPageNumbers } from '../utils/pagination'

// formatRelativeTime uses Date.now() internally, so tests build the ISO string
// relative to the current moment to keep diffs stable.
function iso(msAgo: number): string {
  return new Date(Date.now() - msAgo).toISOString()
}

describe('formatRelativeTime', () => {
  test('returns 剛才 when under 1 minute', () => {
    expect(formatRelativeTime(iso(0))).toBe('剛才')
    expect(formatRelativeTime(iso(59_999))).toBe('剛才')
  })
  test('returns minutes when 1–59 minutes ago', () => {
    expect(formatRelativeTime(iso(60_000))).toBe('1 分鐘前')
    expect(formatRelativeTime(iso(90_000))).toBe('1 分鐘前')
    expect(formatRelativeTime(iso(59 * 60_000))).toBe('59 分鐘前')
  })
  test('returns hours when 1–23 hours ago', () => {
    expect(formatRelativeTime(iso(60 * 60_000))).toBe('1 小時前')
    expect(formatRelativeTime(iso(23 * 60 * 60_000))).toBe('23 小時前')
  })
  test('returns days when 1–6 days ago', () => {
    expect(formatRelativeTime(iso(24 * 60 * 60_000))).toBe('1 天前')
    expect(formatRelativeTime(iso(6 * 24 * 60 * 60_000))).toBe('6 天前')
  })
  test('returns locale date string when 7+ days ago', () => {
    const result = formatRelativeTime(iso(7 * 24 * 60 * 60_000))
    // should be a date like "6/10" not a relative string
    expect(result).not.toMatch(/前|剛才/)
    expect(result).toMatch(/\d+\/\d+/)
  })
  test('handles SQLite datetime without Z suffix (UTC without timezone)', () => {
    // SQLite datetime('now') returns e.g. "2026-06-22 01:02:33" — no Z
    // Should be treated as UTC, giving the same result as with Z
    const withZ = new Date(Date.now() - 5 * 60_000).toISOString()           // "2026-06-22T01:02:33.000Z"
    const withoutZ = withZ.replace('T', ' ').replace(/\.\d{3}Z$/, '')       // "2026-06-22 01:02:33"
    expect(formatRelativeTime(withoutZ)).toBe(formatRelativeTime(withZ))
  })
})

describe('getPageNumbers', () => {
  test('returns all pages when total ≤ 7', () => {
    expect(getPageNumbers(1, 1)).toEqual([1])
    expect(getPageNumbers(1, 5)).toEqual([1, 2, 3, 4, 5])
    expect(getPageNumbers(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })
  test('shows left window when current ≤ 4', () => {
    expect(getPageNumbers(1, 8)).toEqual([1, 2, 3, 4, 5, '…', 8])
    expect(getPageNumbers(4, 10)).toEqual([1, 2, 3, 4, 5, '…', 10])
  })
  test('shows right window when current ≥ total − 3', () => {
    expect(getPageNumbers(8, 8)).toEqual([1, '…', 4, 5, 6, 7, 8])
    expect(getPageNumbers(7, 10)).toEqual([1, '…', 6, 7, 8, 9, 10])
    expect(getPageNumbers(10, 10)).toEqual([1, '…', 6, 7, 8, 9, 10])
  })
  test('shows middle window otherwise', () => {
    expect(getPageNumbers(5, 10)).toEqual([1, '…', 4, 5, 6, '…', 10])
    expect(getPageNumbers(6, 12)).toEqual([1, '…', 5, 6, 7, '…', 12])
  })
  test('returns empty array when total is 0', () => {
    expect(getPageNumbers(1, 0)).toEqual([])
  })
})
