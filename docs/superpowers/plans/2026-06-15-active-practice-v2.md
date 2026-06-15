# Active Practice v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade flashcard practice to SM-2 spaced repetition with 4-level grading, per-review logging, on-demand audio, keyboard shortcuts, and a stats dashboard.

**Architecture:** Phased delivery — DB migration + SM-2 API first, then frontend card upgrade, then stats page. The `reviews` table is the foundation for all stats; it's inserted on every `POST /practice/review`. No test framework is installed, so correctness is verified with TypeScript type checking (`tsc --noEmit`) and `curl` against `wrangler dev`.

**Tech Stack:** Cloudflare Workers + Hono + D1 SQLite (API), React 19 + TypeScript + Vite + Tailwind + React Router v7 + lucide-react (Web)

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `api/schema.sql` | Modify | Add migration: `ease_factor`, `repetitions` on `words`; new `reviews` table |
| `api/src/index.ts` | Modify | Update `POST /practice/review` (SM-2 logic + reviews insert); add `GET /practice/stats` |
| `web/src/types.ts` | Modify | Add `PracticeRating`, update `PracticeWord`, add `PracticeStats` |
| `web/src/api.ts` | Modify | Update `postPracticeReview` signature; add `fetchPracticeStats` |
| `web/src/components/FlashCard.tsx` | Modify | 4-level buttons, SVG speaker icon inline with word |
| `web/src/pages/PracticePage.tsx` | Modify | Keyboard shortcuts; update `onReview` prop type |
| `web/src/pages/StatsPage.tsx` | Create | Stats dashboard: streak, bar chart, word counts |
| `web/src/components/Sidebar.tsx` | Modify | Add 統計 nav item |
| `web/src/App.tsx` | Modify | `handleReview` → rating 1–4; fetch stats; `/stats` route |

---

## Task 1: DB Migration

**Files:**
- Modify: `api/schema.sql`

- [ ] **Step 1: Append migration to schema.sql**

Open `api/schema.sql` and append at the bottom (do not touch existing CREATE TABLE statements):

```sql
-- Migration: SM-2 spaced repetition fields
ALTER TABLE words ADD COLUMN ease_factor REAL NOT NULL DEFAULT 2.5;
ALTER TABLE words ADD COLUMN repetitions  INTEGER NOT NULL DEFAULT 0;

-- Review log: one row per practice review event
CREATE TABLE IF NOT EXISTS reviews (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  word            TEXT    NOT NULL,
  rating          INTEGER NOT NULL CHECK(rating IN (1,2,3,4)),
  reviewed_at     INTEGER NOT NULL,
  interval_before INTEGER NOT NULL,
  interval_after  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reviews_word ON reviews(word);
CREATE INDEX IF NOT EXISTS idx_reviews_date ON reviews(reviewed_at);
```

- [ ] **Step 2: Apply migration to local D1**

```bash
cd api
npx wrangler d1 execute duocue --local --command="ALTER TABLE words ADD COLUMN ease_factor REAL NOT NULL DEFAULT 2.5"
npx wrangler d1 execute duocue --local --command="ALTER TABLE words ADD COLUMN repetitions INTEGER NOT NULL DEFAULT 0"
npx wrangler d1 execute duocue --local --command="CREATE TABLE IF NOT EXISTS reviews (id INTEGER PRIMARY KEY AUTOINCREMENT, word TEXT NOT NULL, rating INTEGER NOT NULL CHECK(rating IN (1,2,3,4)), reviewed_at INTEGER NOT NULL, interval_before INTEGER NOT NULL, interval_after INTEGER NOT NULL)"
npx wrangler d1 execute duocue --local --command="CREATE INDEX IF NOT EXISTS idx_reviews_word ON reviews(word)"
npx wrangler d1 execute duocue --local --command="CREATE INDEX IF NOT EXISTS idx_reviews_date ON reviews(reviewed_at)"
```

Expected: Each command prints `✅ Executed successfully`.

- [ ] **Step 3: Verify columns exist**

```bash
npx wrangler d1 execute duocue --local --command="PRAGMA table_info(words)"
npx wrangler d1 execute duocue --local --command="PRAGMA table_info(reviews)"
```

Expected: `words` has `ease_factor` and `repetitions` columns. `reviews` table has all 6 columns.

- [ ] **Step 4: Commit**

```bash
git add api/schema.sql
git commit -m "feat(db): add SM-2 fields to words and create reviews log table"
```

---

## Task 2: API — SM-2 Review Endpoint

**Files:**
- Modify: `api/src/index.ts` (the `POST /practice/review` handler, lines ~193–221)

- [ ] **Step 1: Replace the review handler**

Find the existing `app.post('/practice/review', ...)` block and replace it entirely with:

```typescript
function calcSM2(
  rating: 1 | 2 | 3 | 4,
  intervalDays: number,
  repetitions: number,
  easeFactor: number,
): { newInterval: number; newRepetitions: number; newEaseFactor: number } {
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

app.post('/practice/review', async (c) => {
  let body: { word?: string; rating?: number }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const { word, rating } = body
  if (!word || ![1, 2, 3, 4].includes(rating as number)) {
    return c.json({ error: 'word and rating (1|2|3|4) required' }, 400)
  }

  const w = word.toLowerCase()
  const r = rating as 1 | 2 | 3 | 4

  const current = await c.env.DB.prepare(
    `SELECT interval_days, repetitions, ease_factor FROM words WHERE word = ?`
  ).bind(w).first<{ interval_days: number; repetitions: number; ease_factor: number }>()

  if (!current) return c.json({ error: 'Word not found' }, 404)

  const { newInterval, newRepetitions, newEaseFactor } = calcSM2(
    r,
    current.interval_days,
    current.repetitions,
    current.ease_factor,
  )

  const nextReviewAt = Math.floor(Date.now() / 1000) + newInterval * 86400
  const newStatus = newInterval >= 21 ? 'learned' : 'learning'

  await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE words SET interval_days = ?, next_review_at = ?, ease_factor = ?, repetitions = ?, status = ? WHERE word = ?`
    ).bind(newInterval, nextReviewAt, newEaseFactor, newRepetitions, newStatus, w),
    c.env.DB.prepare(
      `INSERT INTO reviews (word, rating, reviewed_at, interval_before, interval_after) VALUES (?, ?, ?, ?, ?)`
    ).bind(w, r, Math.floor(Date.now() / 1000), current.interval_days, newInterval),
  ])

  return c.json({ word: w, intervalDays: newInterval, nextReviewAt, graduated: newStatus === 'learned' })
})
```

- [ ] **Step 2: Type-check**

```bash
cd api
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Manual test with wrangler dev**

In one terminal:
```bash
cd api && npm run dev
```

In a second terminal (replace `<KEY>` with the value from your `.dev.vars` `API_KEY`):

```bash
# First confirm a learning word exists
curl -s http://localhost:8787/practice/queue \
  -H "Authorization: Bearer <KEY>" | jq '.queue[0]'

# Review with rating 3 (Good)
curl -s -X POST http://localhost:8787/practice/review \
  -H "Authorization: Bearer <KEY>" \
  -H "Content-Type: application/json" \
  -d '{"word":"<WORD_FROM_ABOVE>","rating":3}' | jq .
```

Expected response contains `intervalDays`, `nextReviewAt`, `graduated: false`.

```bash
# Review with rating 1 (Again) — interval should reset to 1
curl -s -X POST http://localhost:8787/practice/review \
  -H "Authorization: Bearer <KEY>" \
  -H "Content-Type: application/json" \
  -d '{"word":"<WORD>","rating":1}' | jq .intervalDays
```

Expected: `1`

```bash
# Old 'result' field should now be rejected
curl -s -X POST http://localhost:8787/practice/review \
  -H "Authorization: Bearer <KEY>" \
  -H "Content-Type: application/json" \
  -d '{"word":"<WORD>","result":"know"}' | jq .error
```

Expected: `"word and rating (1|2|3|4) required"`

- [ ] **Step 4: Commit**

```bash
git add api/src/index.ts
git commit -m "feat(api): replace binary review with SM-2 algorithm and reviews log"
```

---

## Task 3: API — Stats Endpoint

**Files:**
- Modify: `api/src/index.ts` (add new route after the review handler, before `export default app`)

- [ ] **Step 1: Add the stats handler**

Insert before `export default app`:

```typescript
app.get('/practice/stats', async (c) => {
  const now = Math.floor(Date.now() / 1000)
  const thirtyDaysAgo = now - 30 * 86400

  const [last30, streakRows, wordCounts, todayRow] = await c.env.DB.batch([
    c.env.DB.prepare(`
      SELECT date(reviewed_at, 'unixepoch') AS date, COUNT(*) AS count
      FROM reviews
      WHERE reviewed_at >= ?
      GROUP BY date
      ORDER BY date ASC
    `).bind(thirtyDaysAgo),

    c.env.DB.prepare(`
      SELECT date(reviewed_at, 'unixepoch') AS date
      FROM reviews
      GROUP BY date
      ORDER BY date DESC
    `),

    c.env.DB.prepare(`
      SELECT
        SUM(CASE WHEN status = 'learning' THEN 1 ELSE 0 END) AS learning,
        SUM(CASE WHEN status = 'learned'  THEN 1 ELSE 0 END) AS learned
      FROM words
    `),

    c.env.DB.prepare(`
      SELECT COUNT(*) AS count FROM reviews
      WHERE reviewed_at >= unixepoch('now','start of day')
    `),
  ])

  // Calculate streak from consecutive dates (desc)
  const dates = (streakRows.results as { date: string }[]).map(r => r.date)
  const todayStr = new Date().toISOString().slice(0, 10)
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

  let streak = 0
  if (dates.length > 0 && (dates[0] === todayStr || dates[0] === yesterdayStr)) {
    streak = 1
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1]).getTime()
      const curr = new Date(dates[i]).getTime()
      if ((prev - curr) / 86400000 === 1) streak++
      else break
    }
  }

  const counts = (wordCounts.results[0] as { learning: number; learned: number }) ?? { learning: 0, learned: 0 }

  return c.json({
    streak,
    todayCount: (todayRow.results[0] as { count: number })?.count ?? 0,
    wordCounts: { learning: counts.learning ?? 0, learned: counts.learned ?? 0 },
    last30Days: last30.results as { date: string; count: number }[],
  })
})
```

- [ ] **Step 2: Type-check**

```bash
cd api && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Manual test**

```bash
curl -s http://localhost:8787/practice/stats \
  -H "Authorization: Bearer <KEY>" | jq .
```

Expected:
```json
{
  "streak": 0,
  "todayCount": 3,
  "wordCounts": { "learning": 12, "learned": 5 },
  "last30Days": [{ "date": "2026-06-15", "count": 3 }]
}
```

- [ ] **Step 4: Commit**

```bash
git add api/src/index.ts
git commit -m "feat(api): add GET /practice/stats endpoint"
```

---

## Task 4: Web — Types and API Layer

**Files:**
- Modify: `web/src/types.ts`
- Modify: `web/src/api.ts`

- [ ] **Step 1: Update types.ts**

Replace the full contents of `web/src/types.ts`:

```typescript
export type WordStatus = 'learning' | 'learned'
export type PracticeRating = 1 | 2 | 3 | 4

export interface ApiSentence {
  id: number
  text: string
  translation: string | null
  timestampS: number
  platform: string
  videoUrl: string
  videoTitle: string | null
  createdAt: string
}

export interface ApiVideo {
  platform: string
  url: string
  title: string | null
  sentenceCount: number
}

export interface ApiWord {
  word: string
  status: WordStatus
}

export interface PracticeSentence {
  text: string
  translation: string | null
  videoUrl: string
  timestampS: number
}

export interface PracticeWord {
  word: string
  intervalDays: number
  nextReviewAt: number | null
  sentence: PracticeSentence | null
}

export interface PracticeStats {
  streak: number
  todayCount: number
  wordCounts: { learning: number; learned: number }
  last30Days: { date: string; count: number }[]
}
```

- [ ] **Step 2: Update api.ts**

First update the import line at the top of `api.ts`:

```typescript
import type { ApiSentence, ApiVideo, ApiWord, WordStatus, PracticeWord, PracticeStats } from './types'
```

Then replace the `fetchPracticeQueue` and `postPracticeReview` functions and add `fetchPracticeStats` at the bottom:

```typescript
export async function fetchPracticeQueue(): Promise<PracticeWord[]> {
  const res = await fetch(`${API_ENDPOINT}/practice/queue`, { headers: authHeaders })
  if (!res.ok) throw new Error(`GET /practice/queue failed: ${res.status}`)
  const { queue } = await res.json()
  return queue as PracticeWord[]
}

export async function postPracticeReview(word: string, rating: 1 | 2 | 3 | 4): Promise<void> {
  const res = await fetch(`${API_ENDPOINT}/practice/review`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ word, rating }),
  })
  if (!res.ok) throw new Error(`POST /practice/review failed: ${res.status}`)
}

export async function fetchPracticeStats(): Promise<PracticeStats> {
  const res = await fetch(`${API_ENDPOINT}/practice/stats`, { headers: authHeaders })
  if (!res.ok) throw new Error(`GET /practice/stats failed: ${res.status}`)
  return res.json()
}
```

- [ ] **Step 3: Type-check**

```bash
cd web && npx tsc --noEmit
```

Expected: Errors about `postPracticeReview` call sites in `App.tsx` — those get fixed in Task 6. Confirm no errors in `types.ts` or `api.ts` themselves.

- [ ] **Step 4: Commit**

```bash
git add web/src/types.ts web/src/api.ts
git commit -m "feat(web): update types and API layer for SM-2 rating and stats"
```

---

## Task 5: Web — FlashCard v2

**Files:**
- Modify: `web/src/components/FlashCard.tsx`

- [ ] **Step 1: Replace FlashCard.tsx entirely**

```typescript
import { useDefinition } from '../hooks/useDefinition'
import type { PracticeRating, PracticeWord } from '../types'

interface Props {
  item: PracticeWord
  flipped: boolean
  onFlip: () => void
  onAnswer: (rating: PracticeRating) => void
}

const SPEAKER_SVG = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
  </svg>
)

function speak(word: string) {
  if (!('speechSynthesis' in window)) return
  const u = new SpeechSynthesisUtterance(word)
  u.lang = 'en-US'
  u.rate = 0.9
  window.speechSynthesis.speak(u)
}

function calcNextInterval(item: PracticeWord, rating: PracticeRating): number {
  const ef = 2.5
  const prev = item.intervalDays
  if (rating === 1) return 1
  if (rating === 2) return Math.max(1, Math.round(prev * 1.2))
  const base = prev < 2 ? 1 : prev < 7 ? 6 : Math.round(prev * ef)
  return rating === 4 ? Math.round(base * 1.3) : base
}

function metaText(item: PracticeWord): string {
  if (item.nextReviewAt === null) return '新單字 · 首次複習'
  return `間隔：${item.intervalDays} 天`
}

const RATINGS: { rating: PracticeRating; label: string; icon: string; style: React.CSSProperties; hoverBg: string }[] = [
  { rating: 1, label: 'Again', icon: '✕', style: { background: 'rgba(255,69,58,0.12)', color: '#FF453A', border: '1px solid rgba(255,69,58,0.25)' }, hoverBg: 'rgba(255,69,58,0.22)' },
  { rating: 2, label: 'Hard',  icon: '△', style: { background: 'rgba(255,159,10,0.12)', color: '#FF9F0A', border: '1px solid rgba(255,159,10,0.25)' }, hoverBg: 'rgba(255,159,10,0.22)' },
  { rating: 3, label: 'Good',  icon: '✓', style: { background: 'rgba(48,209,88,0.12)',  color: '#30D158', border: '1px solid rgba(48,209,88,0.25)' },  hoverBg: 'rgba(48,209,88,0.22)' },
  { rating: 4, label: 'Easy',  icon: '★', style: { background: 'rgba(10,132,255,0.12)', color: '#0A84FF', border: '1px solid rgba(10,132,255,0.25)' }, hoverBg: 'rgba(10,132,255,0.22)' },
]

export default function FlashCard({ item, flipped, onFlip, onAnswer }: Props) {
  const { definition, partOfSpeech, loading } = useDefinition(item.word)

  const sentHtml = item.sentence
    ? item.sentence.text.replace(new RegExp(`(${item.word})`, 'gi'), '<span style="color:var(--ios-orange);font-weight:600">$1</span>')
    : null

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-[460px]">
      {/* Card */}
      <div className="w-full" style={{ display: 'grid' }}>
        {/* Front */}
        <div
          style={{
            gridArea: '1/1',
            background: 'var(--bg-card)',
            border: '1px solid var(--separator)',
            borderRadius: '16px',
            padding: '28px 24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            minHeight: '160px',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transition: 'opacity 0.15s, transform 0.35s cubic-bezier(0.4,0,0.2,1)',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            opacity: flipped ? 0 : 1,
            zIndex: flipped ? 1 : 2,
            pointerEvents: flipped ? 'none' : 'all',
          }}
        >
          <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: '10px' }}>
            英文單字
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ fontSize: '36px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              {item.word}
            </div>
            <button
              onClick={() => speak(item.word)}
              title="播放發音"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '50%', background: 'var(--bg-subtle)', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', flexShrink: 0 }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-subtle)'; e.currentTarget.style.color = 'var(--text-tertiary)' }}
            >
              {SPEAKER_SVG}
            </button>
          </div>
          {partOfSpeech && (
            <div style={{ fontSize: '12px', fontStyle: 'italic', color: 'var(--text-tertiary)', marginTop: '6px' }}>
              {partOfSpeech}
            </div>
          )}
          <div style={{ fontSize: '11px', color: 'var(--text-disabled)', marginTop: '14px', padding: '4px 10px', background: 'var(--bg-subtle)', borderRadius: '20px' }}>
            {metaText(item)}
          </div>
        </div>

        {/* Back */}
        <div
          style={{
            gridArea: '1/1',
            background: 'var(--bg-card)',
            border: '1px solid var(--separator)',
            borderRadius: '16px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transition: 'opacity 0.15s, transform 0.35s cubic-bezier(0.4,0,0.2,1)',
            transform: flipped ? 'rotateY(0deg)' : 'rotateY(-180deg)',
            opacity: flipped ? 1 : 0,
            zIndex: flipped ? 2 : 1,
            pointerEvents: flipped ? 'all' : 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>{item.word}</div>
            {partOfSpeech && (
              <div style={{ fontSize: '11px', fontStyle: 'italic', color: 'var(--text-tertiary)' }}>{partOfSpeech}</div>
            )}
            <button
              onClick={() => speak(item.word)}
              title="播放發音"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '50%', background: 'var(--bg-subtle)', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', flexShrink: 0 }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-subtle)'; e.currentTarget.style.color = 'var(--text-tertiary)' }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </svg>
            </button>
          </div>
          <div style={{ fontSize: '13px', lineHeight: 1.55, color: loading ? 'var(--text-tertiary)' : 'var(--text-secondary)' }}>
            {loading ? '…' : definition}
          </div>
          {sentHtml && (
            <>
              <div style={{ height: '1px', background: 'var(--separator)', margin: '4px 0' }} />
              <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-disabled)' }}>
                出現在句子
              </div>
              <div style={{ fontSize: '12px', lineHeight: 1.6, color: 'var(--text-tertiary)' }} dangerouslySetInnerHTML={{ __html: sentHtml }} />
              {item.sentence?.translation && (
                <div style={{ fontSize: '11px', color: 'var(--text-disabled)' }}>{item.sentence.translation}</div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Controls */}
      {!flipped ? (
        <button
          onClick={onFlip}
          className="px-6 py-2 rounded-xl text-sm transition-colors"
          style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
        >
          翻面看答案 →
        </button>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px', width: '100%' }}>
          {RATINGS.map(({ rating, label, icon, style, hoverBg }) => (
            <button
              key={rating}
              onClick={() => onAnswer(rating)}
              style={{ ...style, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '12px 6px', borderRadius: '14px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, gap: '3px' }}
              onMouseEnter={e => (e.currentTarget.style.background = hoverBg)}
              onMouseLeave={e => (e.currentTarget.style.background = style.background as string)}
            >
              {icon} {label}
              <span style={{ fontSize: '10px', fontWeight: 400, opacity: 0.65 }}>{calcNextInterval(item, rating)} 天後</span>
            </button>
          ))}
        </div>
      )}

      <div style={{ fontSize: '11px', color: 'var(--text-disabled)' }}>
        {flipped ? (
          <>誠實評分 · <kbd style={{ background: 'var(--bg-subtle)', border: '1px solid var(--separator)', borderRadius: '4px', padding: '1px 5px', fontSize: '10px' }}>1</kbd>–<kbd style={{ background: 'var(--bg-subtle)', border: '1px solid var(--separator)', borderRadius: '4px', padding: '1px 5px', fontSize: '10px' }}>4</kbd> 快捷鍵</>
        ) : (
          <>先回想這個單字的意思，再翻面確認 · <kbd style={{ background: 'var(--bg-subtle)', border: '1px solid var(--separator)', borderRadius: '4px', padding: '1px 5px', fontSize: '10px' }}>Space</kbd></>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
cd web && npx tsc --noEmit
```

Expected: Errors only in `App.tsx` and `PracticePage.tsx` (not yet updated). No errors in `FlashCard.tsx`.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/FlashCard.tsx
git commit -m "feat(web): upgrade FlashCard to 4-level SM-2 rating with SVG audio icon"
```

---

## Task 6: Web — PracticePage Keyboard Shortcuts

**Files:**
- Modify: `web/src/pages/PracticePage.tsx`

- [ ] **Step 1: Replace PracticePage.tsx entirely**

```typescript
import { useState, useEffect, useCallback } from 'react'
import FlashCard from '../components/FlashCard'
import type { PracticeRating, PracticeWord } from '../types'

interface Props {
  queue: PracticeWord[]
  onReview: (word: string, rating: PracticeRating) => Promise<void>
}

export default function PracticePage({ queue, onReview }: Props) {
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [done, setDone] = useState(0)

  const total = queue.length

  const handleAnswer = useCallback(async (rating: PracticeRating) => {
    await onReview(queue[idx].word, rating)
    setDone(d => d + 1)
    setIdx(i => i + 1)
    setFlipped(false)
  }, [idx, queue, onReview])

  const handleFlip = useCallback(() => setFlipped(true), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (!flipped && (e.code === 'Space' || e.code === 'ArrowRight')) {
        e.preventDefault()
        handleFlip()
      }
      if (flipped && e.key === '1') handleAnswer(1)
      if (flipped && e.key === '2') handleAnswer(2)
      if (flipped && e.key === '3') handleAnswer(3)
      if (flipped && e.key === '4') handleAnswer(4)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flipped, handleFlip, handleAnswer])

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center" style={{ minHeight: '60vh', gap: '12px', textAlign: 'center' }}>
        <div style={{ fontSize: '40px' }}>✅</div>
        <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>今天沒有待複習單字</div>
        <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
          繼續在影片中儲存句子，單字加入學習清單後<br />明天會出現在這裡
        </div>
      </div>
    )
  }

  if (done >= total) {
    return (
      <div className="flex flex-col items-center justify-center" style={{ minHeight: '60vh', gap: '12px', textAlign: 'center' }}>
        <div style={{ fontSize: '40px' }}>🎉</div>
        <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>今日練習完成！</div>
        <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
          完成了 {total} 個單字的複習
        </div>
      </div>
    )
  }

  const pct = Math.round(done / total * 100)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>🧠 練習</h1>
        <span style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>今日待複習：{total} 個單字</span>
      </div>
      <div className="flex items-center gap-3">
        <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{done} / {total}</span>
        <div style={{ flex: 1, height: '3px', background: 'var(--bg-hover)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: '#30D158', borderRadius: '2px', transition: 'width 0.4s ease' }} />
        </div>
      </div>
      <div className="flex justify-center">
        <FlashCard
          item={queue[idx]}
          flipped={flipped}
          onFlip={handleFlip}
          onAnswer={handleAnswer}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
cd web && npx tsc --noEmit
```

Expected: Errors only in `App.tsx` (not yet updated). No errors in `PracticePage.tsx`.

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/PracticePage.tsx
git commit -m "feat(web): add keyboard shortcuts to PracticePage"
```

---

## Task 7: Web — StatsPage, Sidebar, App Wiring

**Files:**
- Create: `web/src/pages/StatsPage.tsx`
- Modify: `web/src/components/Sidebar.tsx`
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Create StatsPage.tsx**

Create `web/src/pages/StatsPage.tsx`:

```typescript
import { BarChart2 } from 'lucide-react'
import type { PracticeStats } from '../types'

interface Props {
  stats: PracticeStats | null
  loading: boolean
}

export default function StatsPage({ stats, loading }: Props) {
  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
        <span style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>載入中…</span>
      </div>
    )
  }

  const max = Math.max(...stats.last30Days.map(d => d.count), 1)

  // Build a 30-slot array aligned to today
  const today = new Date().toISOString().slice(0, 10)
  const slots: { date: string; count: number }[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)
    const found = stats.last30Days.find(r => r.date === d)
    slots.push({ date: d, count: found?.count ?? 0 })
  }

  return (
    <div className="flex flex-col gap-5" style={{ maxWidth: '600px' }}>
      <h1 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BarChart2 size={18} strokeWidth={1.8} />
          學習統計
        </span>
      </h1>

      {/* Hero stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
        <StatCard label="🔥 連續天數" value={stats.streak} unit="天" valueColor="var(--ios-orange)" />
        <StatCard label="今日完成" value={stats.todayCount} unit="個單字" />
        <StatCard label="學習中" value={stats.wordCounts.learning} unit="個單字" />
      </div>

      {/* Bar chart */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--separator)', borderRadius: '16px', padding: '20px' }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>過去 30 天複習量</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '80px' }}>
          {slots.map(({ date, count }) => {
            const h = count > 0 ? Math.max(4, Math.round((count / max) * 72)) : 2
            const isToday = date === today
            return (
              <div key={date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', height: '80px', justifyContent: 'flex-end' }} title={`${date}: ${count} 個`}>
                <div
                  style={{
                    width: '100%',
                    height: `${h}px`,
                    background: isToday ? 'rgba(48,209,88,0.85)' : count > 0 ? 'rgba(48,209,88,0.38)' : 'var(--bg-subtle)',
                    borderRadius: '3px 3px 0 0',
                    transition: 'background 0.15s',
                  }}
                />
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
          <span style={{ fontSize: '10px', color: 'var(--text-disabled)' }}>30 天前</span>
          <span style={{ fontSize: '10px', color: 'var(--ios-green)', fontWeight: 600 }}>今天</span>
        </div>
      </div>

      {/* Word status */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--separator)', borderRadius: '16px', padding: '18px 20px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--ios-orange)', display: 'inline-block' }} />
            學習中
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)' }}>{stats.wordCounts.learning}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '3px' }}>個單字</div>
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--separator)', borderRadius: '16px', padding: '18px 20px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--ios-green)', display: 'inline-block' }} />
            已學會
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)' }}>{stats.wordCounts.learned}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '3px' }}>個單字</div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, unit, valueColor }: { label: string; value: number; unit: string; valueColor?: string }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--separator)', borderRadius: '16px', padding: '18px 20px' }}>
      <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: '28px', fontWeight: 700, color: valueColor ?? 'var(--text-primary)' }}>{value}</div>
      <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '3px' }}>{unit}</div>
    </div>
  )
}
```

- [ ] **Step 2: Add stats nav item to Sidebar.tsx**

In `web/src/components/Sidebar.tsx`, add import for `BarChart2` to the existing lucide import:

```typescript
import { BookOpen, BookMarked, Sparkles, BarChart2 } from 'lucide-react'
```

Add `statsActive` match after the existing `practiceActive` line:

```typescript
const statsActive = !!useMatch('/stats')
```

Add the stats nav Link after the practice Link (before the closing `</nav>`):

```typescript
<Link
  to="/stats"
  className={`${navBase} ${statsActive ? 'font-medium' : ''}`}
  style={navStyle(statsActive)}
  onMouseEnter={e => handleMouseEnter(e, statsActive)}
  onMouseLeave={e => handleMouseLeave(e, statsActive)}
>
  <span className="flex items-center gap-2.5">
    <BarChart2 size={16} strokeWidth={1.8} />
    統計
  </span>
</Link>
```

- [ ] **Step 3: Update App.tsx**

Replace the full `App.tsx` with:

```typescript
import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import SentencesPage from './pages/SentencesPage'
import WordBookPage from './pages/WordBookPage'
import PracticePage from './pages/PracticePage'
import StatsPage from './pages/StatsPage'
import {
  fetchSentences, fetchVideos, fetchWords,
  fetchPracticeQueue, fetchPracticeStats,
  patchWordStatus, deleteSentence, removeWord, postPracticeReview,
} from './api'
import type { ApiSentence, ApiVideo, ApiWord, WordStatus, PracticeWord, PracticeStats } from './types'

export default function App() {
  const [sentences, setSentences] = useState<ApiSentence[]>([])
  const [videos, setVideos] = useState<ApiVideo[]>([])
  const [words, setWords] = useState<ApiWord[]>([])
  const [practiceQueue, setPracticeQueue] = useState<PracticeWord[]>([])
  const [stats, setStats] = useState<PracticeStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([fetchSentences(), fetchVideos(), fetchWords(), fetchPracticeQueue(), fetchPracticeStats()])
      .then(([s, v, w, q, st]) => {
        setSentences(s)
        setVideos(v)
        setWords(w)
        setPracticeQueue(q)
        setStats(st)
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  const handleDeleteSentence = async (id: number) => {
    await deleteSentence(id)
    setSentences(prev => prev.filter(s => s.id !== id))
  }

  const handleRemoveWord = async (word: string) => {
    await removeWord(word)
    setWords(prev => prev.filter(w => w.word !== word))
  }

  const updateWordStatus = async (word: string, status: WordStatus) => {
    await patchWordStatus(word, status)
    setWords(prev =>
      prev.some(w => w.word === word)
        ? prev.map(w => (w.word === word ? { ...w, status } : w))
        : [...prev, { word, status }]
    )
  }

  const handleReview = async (word: string, rating: 1 | 2 | 3 | 4) => {
    await postPracticeReview(word, rating)
    setPracticeQueue(prev => prev.filter(w => w.word !== word))
    // Refresh stats after each review so todayCount stays live
    fetchPracticeStats().then(setStats).catch(() => {})
  }

  const wordMap = new Map(words.map(w => [w.word, w.status]))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white/40 text-sm">
        載入中…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-red-400 text-sm">
        {error}
      </div>
    )
  }

  const sentenceProps = {
    sentences,
    videos,
    wordMap,
    onUpdateWordStatus: updateWordStatus,
    onRemoveWordStatus: handleRemoveWord,
    onDeleteSentence: handleDeleteSentence,
  }

  return (
    <Layout sentences={sentences} words={words} practiceQueueCount={practiceQueue.length}>
      <Routes>
        <Route path="/" element={<Navigate to="/sentences/recent" replace />} />
        <Route path="/sentences/recent" element={<SentencesPage tab="recent" {...sentenceProps} />} />
        <Route path="/sentences/all" element={<SentencesPage tab="all" {...sentenceProps} />} />
        <Route path="/words" element={<WordBookPage words={words} sentences={sentences} />} />
        <Route path="/practice" element={<PracticePage queue={practiceQueue} onReview={handleReview} />} />
        <Route path="/stats" element={<StatsPage stats={stats} loading={false} />} />
      </Routes>
    </Layout>
  )
}
```

- [ ] **Step 4: Type-check everything**

```bash
cd web && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Visual test — start dev server**

```bash
cd web && npm run dev
```

Open http://localhost:5173 and verify:
- Practice page shows 4 rating buttons after flip
- Speaker icon sits inline with the word (not below it)
- Space flips card; 1/2/3/4 rate after flip
- 統計 nav item appears in sidebar and navigates to StatsPage
- StatsPage shows streak, bar chart, word counts (may show zeros if reviews table is empty locally)

- [ ] **Step 6: Commit**

```bash
git add web/src/pages/StatsPage.tsx web/src/components/Sidebar.tsx web/src/App.tsx
git commit -m "feat(web): add StatsPage, stats nav item, and wire SM-2 review through App"
```

---

## Task 8: Deploy

- [ ] **Step 1: Apply migration to production D1**

```bash
cd api
npx wrangler d1 execute duocue --command="ALTER TABLE words ADD COLUMN ease_factor REAL NOT NULL DEFAULT 2.5"
npx wrangler d1 execute duocue --command="ALTER TABLE words ADD COLUMN repetitions INTEGER NOT NULL DEFAULT 0"
npx wrangler d1 execute duocue --command="CREATE TABLE IF NOT EXISTS reviews (id INTEGER PRIMARY KEY AUTOINCREMENT, word TEXT NOT NULL, rating INTEGER NOT NULL CHECK(rating IN (1,2,3,4)), reviewed_at INTEGER NOT NULL, interval_before INTEGER NOT NULL, interval_after INTEGER NOT NULL)"
npx wrangler d1 execute duocue --command="CREATE INDEX IF NOT EXISTS idx_reviews_word ON reviews(word)"
npx wrangler d1 execute duocue --command="CREATE INDEX IF NOT EXISTS idx_reviews_date ON reviews(reviewed_at)"
```

Expected: Each command prints `✅ Executed successfully`.

- [ ] **Step 2: Deploy API**

```bash
cd api && npm run deploy
```

Expected: `✅ Deployed ... duocue-api`

- [ ] **Step 3: Deploy Web**

```bash
cd web && npm run build
```

Expected: No TypeScript errors, Vite build completes. Deploy the `dist/` folder to your hosting provider (Cloudflare Pages or equivalent).

- [ ] **Step 4: Smoke test production**

Open the production URL, navigate to 練習, flip a card, click Good (or press 3), then check 統計 — todayCount should be 1.

- [ ] **Step 5: Final commit**

```bash
git add .
git commit -m "chore: production deploy of active practice v2"
```
