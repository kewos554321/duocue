# Active Practice v2 — Design Spec

**Date:** 2026-06-15  
**Status:** Approved

## Overview

Upgrade the existing binary-rating flashcard system to SM-2 spaced repetition with four-level grading, per-review logging, keyboard shortcuts, on-demand audio pronunciation, and a stats dashboard.

## Approach

Three-phase incremental delivery:

1. **DB migration + SM-2 algorithm** — schema changes and new review endpoint logic (can ship together since they share the same migration)
2. **Frontend: 4-level cards + keyboard + audio** — update FlashCard and PracticePage
3. **Stats dashboard** — new StatsPage fed by the reviews log

## Database Schema

### Modify `words` table

```sql
ALTER TABLE words ADD COLUMN ease_factor REAL NOT NULL DEFAULT 2.5;
ALTER TABLE words ADD COLUMN repetitions  INTEGER NOT NULL DEFAULT 0;
```

### New `reviews` table

```sql
CREATE TABLE reviews (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  word            TEXT    NOT NULL,
  rating          INTEGER NOT NULL CHECK(rating IN (1,2,3,4)),
  reviewed_at     INTEGER NOT NULL,   -- unix timestamp
  interval_before INTEGER NOT NULL,
  interval_after  INTEGER NOT NULL
);
CREATE INDEX idx_reviews_word ON reviews(word);
CREATE INDEX idx_reviews_date ON reviews(reviewed_at);
```

`rating` values: 1=Again, 2=Hard, 3=Good, 4=Easy

## API

### `POST /practice/review`

**Request body change:** `rating: 1|2|3|4` replaces `result: 'know'|'unknown'`.

**SM-2 calculation:**

```
Again (1): interval = 1, repetitions = 0, ease_factor -= 0.20
Hard  (2): interval = max(1, round(prev * 1.2)), ease_factor -= 0.15
Good  (3): SM-2 formula, ease_factor unchanged
Easy  (4): SM-2 formula × 1.3 bonus, ease_factor += 0.10

SM-2 formula (Good / Easy path):
  if repetitions == 0 → interval = 1
  if repetitions == 1 → interval = 6
  else               → interval = round(prev_interval * ease_factor)
  repetitions += 1
  ease_factor = max(1.3, ease_factor)

Auto-graduation: if interval_after >= 21, set words.status = 'learned'
```

After updating `words`, INSERT one row into `reviews` with interval_before and interval_after.

### `GET /practice/stats`

Returns:

```json
{
  "streak": 5,
  "todayCount": 12,
  "wordCounts": { "learning": 34, "learned": 89 },
  "last30Days": [
    { "date": "2026-06-15", "count": 12 }
  ]
}
```

`streak` = consecutive days with at least one review, calculated from `reviews` table grouped by date.

## Frontend

### FlashCard.tsx

**4-level answer buttons** (replace 2-button row):

| Button | Color | Label | Hint |
|--------|-------|-------|------|
| Again  | Red   | ✕ Again | 1 天後 |
| Hard   | Orange | △ Hard | X 天後 |
| Good   | Green  | ✓ Good | X 天後 |
| Easy   | Blue   | ★ Easy | X 天後 |

Each button shows the computed next interval as a sub-label.

**Speaker icon:**
- SVG speaker icon (not emoji), placed inline to the right of the word
- Present on both card front and card back (smaller on back)
- Styled as a circular icon button (`var(--bg-subtle)` background, hover feedback)
- Click-only trigger — no auto-play on flip

**Keyboard shortcuts** (only active on practice page):

| Key | Action |
|-----|--------|
| `Space` / `→` | Flip card (only before flip) |
| `1` | Again (only after flip) |
| `2` | Hard (only after flip) |
| `3` | Good (only after flip) |
| `4` | Easy (only after flip) |

### StatsPage.tsx (new)

Accessible from sidebar. Three sections:

1. **Hero row** — streak count, today's completed count, all-time total
2. **30-day bar chart** — CSS-only, no chart library, daily review counts with today highlighted
3. **Word status** — learning count vs learned count in two side-by-side cards

No per-word individual history page (deferred — out of scope for this iteration).

### Sidebar

Add `📊 統計` nav item linking to StatsPage.

## Out of Scope

- Per-word review history detail page
- Practice session summary screen after completion
- Export / data download
- Mobile app
