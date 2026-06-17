export type SM2Rating = 1 | 2 | 3 | 4

export interface SM2Result {
  newInterval: number
  newRepetitions: number
  newEaseFactor: number
}

export function calcSM2(
  rating: SM2Rating,
  intervalDays: number,
  repetitions: number,
  easeFactor: number,
): SM2Result {
  let newInterval: number
  let newRepetitions: number
  let newEaseFactor = easeFactor

  if (rating === 1) {
    newInterval = 1
    newRepetitions = 0
    newEaseFactor = Math.max(1.3, easeFactor - 0.2)
  } else if (rating === 2) {
    newInterval = Math.max(1, Math.round(intervalDays * 1.2))
    newRepetitions = repetitions
    newEaseFactor = Math.max(1.3, easeFactor - 0.15)
  } else {
    if (repetitions === 0) newInterval = 1
    else if (repetitions === 1) newInterval = 6
    else newInterval = Math.round(intervalDays * easeFactor)
    if (rating === 4) {
      newInterval = Math.round(newInterval * 1.3)
      newEaseFactor = Math.min(3.0, easeFactor + 0.1)
    }
    newRepetitions = repetitions + 1
    newEaseFactor = Math.max(1.3, newEaseFactor)
  }

  return { newInterval, newRepetitions, newEaseFactor }
}
