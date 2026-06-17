import type { PracticeRating } from '../types'

export function calcNextInterval(
  rating: PracticeRating,
  intervalDays: number,
  repetitions: number,
  easeFactor: number,
): number {
  if (rating === 1) return 1
  if (rating === 2) return Math.max(1, Math.round(intervalDays * 1.2))

  let base: number
  if (repetitions === 0) base = 1
  else if (repetitions === 1) base = 6
  else base = Math.round(intervalDays * easeFactor)

  return rating === 4 ? Math.round(base * 1.3) : base
}
