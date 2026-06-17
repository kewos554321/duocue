import { describe, test, expect } from 'vitest'
import { calcNextInterval } from '../utils/sm2'

// calcNextInterval mirrors the server-side calcSM2 but returns only the next
// interval in days (reps/ef are managed by the API, web just needs the display value)

describe('calcNextInterval — rating=1 (Again)', () => {
  test('always resets to 1 regardless of previous interval', () => {
    expect(calcNextInterval(1, 30, 5, 2.5)).toBe(1)
    expect(calcNextInterval(1, 1, 0, 2.5)).toBe(1)
  })
})

describe('calcNextInterval — rating=2 (Hard)', () => {
  test('multiplies interval by 1.2 (rounded)', () => {
    expect(calcNextInterval(2, 10, 3, 2.5)).toBe(12)
  })
  test('ensures minimum of 1', () => {
    expect(calcNextInterval(2, 0, 0, 2.5)).toBe(1)
  })
})

describe('calcNextInterval — rating=3 (Good)', () => {
  test('first review (reps=0) gives 1', () => {
    expect(calcNextInterval(3, 1, 0, 2.5)).toBe(1)
  })
  test('second review (reps=1) gives 6', () => {
    expect(calcNextInterval(3, 1, 1, 2.5)).toBe(6)
  })
  test('subsequent reviews multiply interval by easeFactor', () => {
    expect(calcNextInterval(3, 6, 2, 2.5)).toBe(15)
  })
  test('uses actual easeFactor (not hardcoded 2.5)', () => {
    expect(calcNextInterval(3, 6, 2, 1.3)).toBe(8) // round(6 * 1.3) = 8
  })
})

describe('calcNextInterval — rating=4 (Easy)', () => {
  test('first review gives round(1 * 1.3) = 1', () => {
    expect(calcNextInterval(4, 1, 0, 2.5)).toBe(1)
  })
  test('second review gives round(6 * 1.3) = 8', () => {
    expect(calcNextInterval(4, 1, 1, 2.5)).toBe(8)
  })
  test('subsequent reviews: round(round(prev*ef)*1.3)', () => {
    expect(calcNextInterval(4, 6, 2, 2.5)).toBe(20)
  })
  test('uses actual easeFactor when calculating', () => {
    expect(calcNextInterval(4, 6, 2, 1.3)).toBe(Math.round(Math.round(6 * 1.3) * 1.3)) // round(8*1.3)=10
  })
})
