import { describe, test, expect } from 'vitest'
import { calcSM2 } from '../sm2'

describe('calcSM2 — rating=1 (Again)', () => {
  test('resets interval to 1 regardless of previous', () => {
    expect(calcSM2(1, 30, 5, 2.5).newInterval).toBe(1)
  })
  test('resets repetitions to 0', () => {
    expect(calcSM2(1, 30, 5, 2.5).newRepetitions).toBe(0)
  })
  test('decrements easeFactor by 0.2', () => {
    expect(calcSM2(1, 1, 0, 2.5).newEaseFactor).toBeCloseTo(2.3)
  })
  test('clamps easeFactor at minimum 1.3', () => {
    expect(calcSM2(1, 1, 0, 1.4).newEaseFactor).toBe(1.3)
    expect(calcSM2(1, 1, 0, 1.3).newEaseFactor).toBe(1.3)
  })
})

describe('calcSM2 — rating=2 (Hard)', () => {
  test('multiplies interval by 1.2 (rounded)', () => {
    expect(calcSM2(2, 10, 3, 2.5).newInterval).toBe(12)
  })
  test('ensures interval minimum of 1', () => {
    expect(calcSM2(2, 0, 0, 2.5).newInterval).toBe(1)
  })
  test('keeps repetitions unchanged', () => {
    expect(calcSM2(2, 10, 3, 2.5).newRepetitions).toBe(3)
  })
  test('decrements easeFactor by 0.15', () => {
    expect(calcSM2(2, 10, 3, 2.5).newEaseFactor).toBeCloseTo(2.35)
  })
  test('clamps easeFactor at minimum 1.3', () => {
    expect(calcSM2(2, 10, 3, 1.3).newEaseFactor).toBe(1.3)
  })
})

describe('calcSM2 — rating=3 (Good)', () => {
  test('first review (reps=0) gives interval 1', () => {
    expect(calcSM2(3, 1, 0, 2.5).newInterval).toBe(1)
  })
  test('second review (reps=1) gives interval 6', () => {
    expect(calcSM2(3, 1, 1, 2.5).newInterval).toBe(6)
  })
  test('subsequent reviews multiply interval by easeFactor', () => {
    expect(calcSM2(3, 6, 2, 2.5).newInterval).toBe(15) // round(6 * 2.5)
  })
  test('increments repetitions by 1', () => {
    expect(calcSM2(3, 6, 2, 2.5).newRepetitions).toBe(3)
  })
  test('does not change easeFactor', () => {
    expect(calcSM2(3, 6, 2, 2.5).newEaseFactor).toBeCloseTo(2.5)
  })
  test('easeFactor remains at minimum 1.3 when already low', () => {
    expect(calcSM2(3, 6, 2, 1.3).newEaseFactor).toBe(1.3)
  })
})

describe('calcSM2 — rating=4 (Easy)', () => {
  test('first review (reps=0) gives interval round(1 * 1.3)', () => {
    expect(calcSM2(4, 1, 0, 2.5).newInterval).toBe(1) // round(1 * 1.3) = 1
  })
  test('second review (reps=1) gives interval round(6 * 1.3)', () => {
    expect(calcSM2(4, 1, 1, 2.5).newInterval).toBe(8) // round(6 * 1.3) = 8
  })
  test('subsequent reviews: round(round(prev*ef)*1.3)', () => {
    expect(calcSM2(4, 6, 2, 2.5).newInterval).toBe(20) // round(round(6*2.5)*1.3) = round(15*1.3) = round(19.5) = 20
  })
  test('increments repetitions by 1', () => {
    expect(calcSM2(4, 6, 2, 2.5).newRepetitions).toBe(3)
  })
  test('increments easeFactor by 0.1', () => {
    expect(calcSM2(4, 6, 2, 2.5).newEaseFactor).toBeCloseTo(2.6)
  })
  test('clamps easeFactor at maximum 3.0', () => {
    expect(calcSM2(4, 6, 2, 3.0).newEaseFactor).toBe(3.0)
    expect(calcSM2(4, 6, 2, 2.95).newEaseFactor).toBe(3.0)
  })
})
