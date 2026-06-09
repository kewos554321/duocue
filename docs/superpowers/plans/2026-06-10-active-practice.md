# Active Practice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a flashcard practice page to the DuoCue web app with spaced repetition scheduling (doubling-interval algorithm).

**Architecture:** Two new API endpoints on the existing Cloudflare Workers API (`GET /practice/queue`, `POST /practice/review`), two new DB columns on `words`, and two new React components (`FlashCard`, `PracticePage`) wired into the existing `App` + `Sidebar`.

**Tech Stack:** Cloudflare Workers + D1 (Hono), React 19 + TypeScript, Tailwind CSS v4, Vite

---

## File Map

| Action | File | What changes |
|---|---|---|
| Modify | `api/schema.sql` | Document new columns |
| Modify | `api/src/index.ts` | Add GET /practice/queue, POST /practice/review |
| Modify | `web/src/types.ts` | Add PracticeWord, PracticeSentence |
| Modify | `web/src/api.ts` | Add fetchPracticeQueue, postPracticeReview |
| Create | `web/src/components/FlashCard.tsx` | Flashcard UI component |
| Create | `web/src/pages/PracticePage.tsx` | Practice page |
| Modify | `web/src/App.tsx` | Add 'practice' page routing |
| Modify | `web/src/components/Sidebar.tsx` | Enable practice nav item + badge |

---

## Task 1: DB Migration

**Files:**
- Modify: `api/schema.sql`

- [ ] **Step 1: Run migration on local D1**

```bash
cd api
npx wrangler d1 execute duocue --local --command "ALTER TABLE words ADD COLUMN next_review_at INTEGER DEFAULT NULL"
npx wrangler d1 execute duocue --local --command "ALTER TABLE words ADD COLUMN interval_days INTEGER DEFAULT 1"
```

Expected: `✅ Successfully executed SQL` for each command.

- [ ] **Step 2: Verify columns exist locally**

```bash
npx wrangler d1 execute duocue --local --command "SELECT word, status, next_review_at, interval_days FROM words LIMIT 3"
```

Expected: table output with `next_review_at` = null and `interval_days` = 1 for existing rows.

- [ ] **Step 3: Run migration on remote D1**

```bash
npx wrangler d1 execute duocue --command "ALTER TABLE words ADD COLUMN next_review_at INTEGER DEFAULT NULL"
npx wrangler d1 execute duocue --command "ALTER TABLE words ADD COLUMN interval_days INTEGER DEFAULT 1"
```

- [ ] **Step 4: Update schema.sql**

Add after the `words` table definition:

```sql
CREATE TABLE IF NOT EXISTS words (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  word            TEXT NOT NULL UNIQUE,
  status          TEXT NOT NULL DEFAULT 'learning',
  next_review_at  INTEGER DEFAULT NULL,
  interval_days   INTEGER DEFAULT 1
);
```

Replace the existing `words` block (lines 17–21) with the above. This is documentation only — ALTER TABLE already ran.

- [ ] **Step 5: Commit**

```bash
cd ..
git add api/schema.sql
git commit -m "feat(db): add next_review_at and interval_days to words table"
```

---

## Task 2: API — GET /practice/queue

**Files:**
- Modify: `api/src/index.ts`

- [ ] **Step 1: Add the endpoint**

Add after the `app.get('/videos', ...)` handler (before `export default app`):

```ts
app.get('/practice/queue', async (c) => {
  const { results: words } = await c.env.DB.prepare(`
    SELECT word, interval_days AS intervalDays, next_review_at AS nextReviewAt
    FROM words
    WHERE status = 'learning'
      AND (next_review_at IS NULL OR next_review_at <= unixepoch())
    ORDER BY COALESCE(next_review_at, 0) ASC
  `).all<{ word: string; intervalDays: number; nextReviewAt: number | null }>()

  if (words.length === 0) return c.json({ queue: [] })

  const stmts = words.map(w =>
    c.env.DB.prepare(`
      SELECT s.text, s.translation, v.url AS videoUrl, s.timestamp_s AS timestampS
      FROM sentences s JOIN videos v ON v.id = s.video_id
      WHERE LOWER(s.text) LIKE '% ' || LOWER(?) || ' %'
         OR LOWER(s.text) LIKE LOWER(?) || ' %'
         OR LOWER(s.text) LIKE '% ' || LOWER(?)
         OR LOWER(s.text) = LOWER(?)
      ORDER BY RANDOM() LIMIT 1
    `).bind(w.word, w.word, w.word, w.word)
  )

  const sentenceResults = await c.env.DB.batch(stmts)

  const queue = words.map((w, i) => ({
    word: w.word,
    intervalDays: w.intervalDays,
    nextReviewAt: w.nextReviewAt,
    sentence: (sentenceResults[i].results[0] as {
      text: string; translation: string | null; videoUrl: string; timestampS: number
    } | undefined) ?? null,
  }))

  return c.json({ queue })
})
```

- [ ] **Step 2: Start local dev server and test**

```bash
cd api
npx wrangler dev
```

In another terminal:

```bash
curl -s -H "Authorization: Bearer $(grep API_KEY api/.dev.vars | cut -d= -f2)" \
  http://localhost:8787/practice/queue | jq .
```

Expected: `{ "queue": [...] }` — words where `status='learning'` and `next_review_at IS NULL`.

> **Note:** `api/.dev.vars` contains `API_KEY=<value>`. Use that value directly if the grep doesn't work: `curl -s -H "Authorization: Bearer <key>" http://localhost:8787/practice/queue | jq .`

- [ ] **Step 3: Commit**

```bash
cd ..
git add api/src/index.ts
git commit -m "feat(api): add GET /practice/queue endpoint"
```

---

## Task 3: API — POST /practice/review

**Files:**
- Modify: `api/src/index.ts`

- [ ] **Step 1: Add the endpoint**

Add after the `GET /practice/queue` handler:

```ts
app.post('/practice/review', async (c) => {
  let body: { word?: string; result?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const { word, result } = body
  if (!word || (result !== 'know' && result !== 'unknown')) {
    return c.json({ error: 'word and result ("know"|"unknown") required' }, 400)
  }

  const w = word.toLowerCase()
  const current = await c.env.DB.prepare(
    `SELECT interval_days FROM words WHERE word = ?`
  ).bind(w).first<{ interval_days: number }>()

  if (!current) return c.json({ error: 'Word not found' }, 404)

  const newInterval = result === 'know' ? current.interval_days * 2 : 1
  const nextReviewAt = Math.floor(Date.now() / 1000) + newInterval * 86400

  await c.env.DB.prepare(
    `UPDATE words SET interval_days = ?, next_review_at = ? WHERE word = ?`
  ).bind(newInterval, nextReviewAt, w).run()

  return c.json({ word: w, intervalDays: newInterval, nextReviewAt })
})
```

- [ ] **Step 2: Test with local dev server**

```bash
# Mark a word as "know" (replace "thought" with a real word in your DB)
curl -s -X POST http://localhost:8787/practice/review \
  -H "Authorization: Bearer <your-api-key>" \
  -H "Content-Type: application/json" \
  -d '{"word":"thought","result":"know"}' | jq .
```

Expected: `{ "word": "thought", "intervalDays": 2, "nextReviewAt": <timestamp> }`

```bash
# Verify it no longer appears in queue
curl -s -H "Authorization: Bearer <your-api-key>" \
  http://localhost:8787/practice/queue | jq '.queue | map(.word)'
```

Expected: "thought" is not in the array.

- [ ] **Step 3: Test error case**

```bash
curl -s -X POST http://localhost:8787/practice/review \
  -H "Authorization: Bearer <your-api-key>" \
  -H "Content-Type: application/json" \
  -d '{"word":"thought","result":"invalid"}' | jq .
```

Expected: `{ "error": "word and result (\"know\"|\"unknown\") required" }` with HTTP 400.

- [ ] **Step 4: Deploy API**

```bash
cd api
npx wrangler deploy
```

Expected: `✅ Deployed duocue-api` with the workers.dev URL.

- [ ] **Step 5: Commit**

```bash
cd ..
git add api/src/index.ts
git commit -m "feat(api): add POST /practice/review endpoint"
```

---

## Task 4: Frontend — Types + API Layer

**Files:**
- Modify: `web/src/types.ts`
- Modify: `web/src/api.ts`

- [ ] **Step 1: Add types to `web/src/types.ts`**

Append to the end of the file:

```ts
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
```

- [ ] **Step 2: Add API functions to `web/src/api.ts`**

Append to the end of the file:

```ts
export async function fetchPracticeQueue(): Promise<PracticeWord[]> {
  const res = await fetch(`${API_ENDPOINT}/practice/queue`, { headers: authHeaders })
  if (!res.ok) throw new Error(`GET /practice/queue failed: ${res.status}`)
  const { queue } = await res.json()
  return queue as PracticeWord[]
}

export async function postPracticeReview(word: string, result: 'know' | 'unknown'): Promise<void> {
  const res = await fetch(`${API_ENDPOINT}/practice/review`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ word, result }),
  })
  if (!res.ok) throw new Error(`POST /practice/review failed: ${res.status}`)
}
```

Also add the import at the top of `api.ts` — update the existing import line:

```ts
import type { ApiSentence, ApiVideo, ApiWord, WordStatus, PracticeWord } from './types'
```

- [ ] **Step 3: Check TypeScript compiles**

```bash
cd web
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd ..
git add web/src/types.ts web/src/api.ts
git commit -m "feat(web): add PracticeWord types and API functions"
```

---

## Task 5: FlashCard Component

**Files:**
- Create: `web/src/components/FlashCard.tsx`

- [ ] **Step 1: Add missing CSS variables to `web/src/index.css`**

Add to the `:root` block (after `--ios-red`):
```css
  --text-tertiary: rgba(60, 60, 67, 0.4);
  --text-disabled: rgba(60, 60, 67, 0.25);
  --bg-subtle: rgba(120, 120, 128, 0.08);
  --bg-hover: rgba(120, 120, 128, 0.12);
```

Add to the `.dark` block (after `--ios-red`):
```css
  --text-tertiary: rgba(235, 235, 245, 0.35);
  --text-disabled: rgba(235, 235, 245, 0.2);
  --bg-subtle: rgba(255, 255, 255, 0.05);
  --bg-hover: rgba(255, 255, 255, 0.08);
```

- [ ] **Step 2: Create the component**

Create `web/src/components/FlashCard.tsx`:

```tsx
import { useDefinition } from '../hooks/useDefinition'
import type { PracticeWord } from '../types'

interface Props {
  item: PracticeWord
  flipped: boolean
  onFlip: () => void
  onAnswer: (result: 'know' | 'unknown') => void
}

function metaText(item: PracticeWord): string {
  if (item.nextReviewAt === null) return '新單字 · 首次複習'
  return `間隔：${item.intervalDays} 天`
}

export default function FlashCard({ item, flipped, onFlip, onAnswer }: Props) {
  const { definition, partOfSpeech, loading } = useDefinition(item.word)

  const nextKnow = item.intervalDays * 2
  const nextUnknown = 1

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
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            minHeight: '140px',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transition: 'opacity 0.15s, transform 0.35s cubic-bezier(0.4,0,0.2,1)',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            opacity: flipped ? 0 : 1,
            zIndex: flipped ? 1 : 2,
            pointerEvents: flipped ? 'none' : 'all',
          }}
        >
          <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: '6px' }}>
            英文單字
          </div>
          <div style={{ fontSize: '36px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            {item.word}
          </div>
          {partOfSpeech && (
            <div style={{ fontSize: '12px', fontStyle: 'italic', color: 'var(--text-tertiary)', marginTop: '4px' }}>
              {partOfSpeech}
            </div>
          )}
          <div style={{ fontSize: '11px', color: 'var(--text-disabled)', marginTop: '10px' }}>
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
          <div>
            <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>{item.word}</div>
            {partOfSpeech && (
              <div style={{ fontSize: '11px', fontStyle: 'italic', color: 'var(--text-tertiary)' }}>{partOfSpeech}</div>
            )}
          </div>
          <div style={{ fontSize: '13px', lineHeight: 1.55, color: loading ? 'var(--text-tertiary)' : 'var(--text-secondary)' }}>
            {loading ? '…' : definition}
          </div>
          {item.sentence && (
            <>
              <div style={{ height: '1px', background: 'var(--separator)', margin: '2px 0' }} />
              <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-disabled)' }}>
                出現在句子
              </div>
              <div style={{ fontSize: '12px', lineHeight: 1.55, color: 'var(--text-tertiary)' }}
                dangerouslySetInnerHTML={{
                  __html: item.sentence.text.replace(
                    new RegExp(`(${item.word})`, 'gi'),
                    '<span style="color:var(--ios-orange);font-weight:600">$1</span>'
                  )
                }}
              />
              {item.sentence.translation && (
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
          style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
        >
          翻面看答案 →
        </button>
      ) : (
        <div className="flex gap-3 w-full">
          <button
            onClick={() => onAnswer('unknown')}
            className="flex-1 flex flex-col items-center py-3 rounded-2xl text-sm font-semibold gap-0.5 transition-colors"
            style={{ background: 'rgba(255,69,58,0.12)', color: '#FF453A', border: '1px solid rgba(255,69,58,0.2)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,69,58,0.2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,69,58,0.12)')}
          >
            ✕ 不知道
            <span style={{ fontSize: '11px', fontWeight: 400, opacity: 0.65 }}>重設 → {nextUnknown} 天後</span>
          </button>
          <button
            onClick={() => onAnswer('know')}
            className="flex-1 flex flex-col items-center py-3 rounded-2xl text-sm font-semibold gap-0.5 transition-colors"
            style={{ background: 'rgba(48,209,88,0.12)', color: '#30D158', border: '1px solid rgba(48,209,88,0.2)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(48,209,88,0.2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(48,209,88,0.12)')}
          >
            ✓ 知道
            <span style={{ fontSize: '11px', fontWeight: 400, opacity: 0.65 }}>下次 → {nextKnow} 天後</span>
          </button>
        </div>
      )}

      <div style={{ fontSize: '11px', color: 'var(--text-disabled)' }}>
        {flipped ? '誠實評分——這樣記憶曲線才準確' : '先回想這個單字的意思，再翻面確認'}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Check TypeScript**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd ..
git add web/src/index.css web/src/components/FlashCard.tsx
git commit -m "feat(web): add FlashCard component and CSS variables"
```

---

## Task 6: PracticePage Component

**Files:**
- Create: `web/src/pages/PracticePage.tsx`

- [ ] **Step 1: Create the page**

Create `web/src/pages/PracticePage.tsx`:

```tsx
import { useState } from 'react'
import FlashCard from '../components/FlashCard'
import type { PracticeWord } from '../types'

interface Props {
  queue: PracticeWord[]
  onReview: (word: string, result: 'know' | 'unknown') => Promise<void>
}

export default function PracticePage({ queue, onReview }: Props) {
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [done, setDone] = useState(0)

  if (queue.length === 0) {
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

  const total = queue.length
  const pct = Math.round(done / total * 100)

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

  const handleAnswer = async (result: 'know' | 'unknown') => {
    await onReview(queue[idx].word, result)
    setDone(d => d + 1)
    setIdx(i => i + 1)
    setFlipped(false)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>🧠 練習</h1>
        <span style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>今日待複習：{total} 個單字</span>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-3">
        <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{done} / {total}</span>
        <div style={{ flex: 1, height: '3px', background: 'var(--bg-hover)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: '#30D158', borderRadius: '2px', transition: 'width 0.4s ease' }} />
        </div>
      </div>

      {/* Card */}
      <div className="flex justify-center">
        <FlashCard
          item={queue[idx]}
          flipped={flipped}
          onFlip={() => setFlipped(true)}
          onAnswer={handleAnswer}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Check TypeScript**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd ..
git add web/src/pages/PracticePage.tsx
git commit -m "feat(web): add PracticePage component"
```

---

## Task 7: Wire Up App.tsx + Sidebar.tsx

**Files:**
- Modify: `web/src/App.tsx`
- Modify: `web/src/components/Sidebar.tsx`

- [ ] **Step 1: Update `web/src/App.tsx`**

Full replacement of the file:

```tsx
import { useState, useEffect } from 'react'
import Layout from './components/Layout'
import SentencesPage from './pages/SentencesPage'
import WordBookPage from './pages/WordBookPage'
import PracticePage from './pages/PracticePage'
import { fetchSentences, fetchVideos, fetchWords, fetchPracticeQueue, patchWordStatus, deleteSentence, removeWord, postPracticeReview } from './api'
import type { ApiSentence, ApiVideo, ApiWord, WordStatus, PracticeWord } from './types'

export default function App() {
  const [sentences, setSentences] = useState<ApiSentence[]>([])
  const [videos, setVideos] = useState<ApiVideo[]>([])
  const [words, setWords] = useState<ApiWord[]>([])
  const [practiceQueue, setPracticeQueue] = useState<PracticeWord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [page, setPage] = useState<'sentences' | 'words' | 'practice'>('sentences')
  const [selectedVideoUrl, setSelectedVideoUrl] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([fetchSentences(), fetchVideos(), fetchWords(), fetchPracticeQueue()])
      .then(([s, v, w, q]) => {
        setSentences(s)
        setVideos(v)
        setWords(w)
        setPracticeQueue(q)
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

  const handleReview = async (word: string, result: 'know' | 'unknown') => {
    await postPracticeReview(word, result)
    setPracticeQueue(prev => prev.filter(w => w.word !== word))
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

  return (
    <Layout
      sentences={sentences}
      videos={videos}
      words={words}
      practiceQueueCount={practiceQueue.length}
      page={page}
      selectedVideoUrl={selectedVideoUrl}
      onSelectPage={setPage}
      onSelectVideo={setSelectedVideoUrl}
    >
      {page === 'sentences' ? (
        <SentencesPage
          sentences={sentences}
          wordMap={wordMap}
          selectedVideoUrl={selectedVideoUrl}
          onUpdateWordStatus={updateWordStatus}
          onRemoveWordStatus={handleRemoveWord}
          onDeleteSentence={handleDeleteSentence}
        />
      ) : page === 'words' ? (
        <WordBookPage
          words={words}
          sentences={sentences}
        />
      ) : (
        <PracticePage
          queue={practiceQueue}
          onReview={handleReview}
        />
      )}
    </Layout>
  )
}
```

- [ ] **Step 2: Update `web/src/components/Layout.tsx` props**

The `Layout` component needs to accept `practiceQueueCount` and pass it to `Sidebar`. Change the `Props` interface (line 7) and the `Sidebar` call (line 52):

In `Layout.tsx`, change the `Props` interface from:
```ts
interface Props {
  sentences: ApiSentence[]
  videos: ApiVideo[]
  words: ApiWord[]
  page: 'sentences' | 'words'
  selectedVideoUrl: string | null
  onSelectPage: (p: 'sentences' | 'words') => void
  onSelectVideo: (url: string | null) => void
  children: ReactNode
}
```

To:
```ts
interface Props {
  sentences: ApiSentence[]
  videos: ApiVideo[]
  words: ApiWord[]
  practiceQueueCount: number
  page: 'sentences' | 'words' | 'practice'
  selectedVideoUrl: string | null
  onSelectPage: (p: 'sentences' | 'words' | 'practice') => void
  onSelectVideo: (url: string | null) => void
  children: ReactNode
}
```

And in the `Sidebar` call inside `Layout.tsx`, add `practiceQueueCount={practiceQueueCount}`.

Full updated `Layout.tsx` function signature line:
```tsx
export default function Layout({ sentences, videos, words, practiceQueueCount, page, selectedVideoUrl, onSelectPage, onSelectVideo, children }: Props) {
```

- [ ] **Step 3: Update `web/src/components/Sidebar.tsx`**

Change the `Props` interface to:
```ts
interface Props {
  sentences: ApiSentence[]
  videos: ApiVideo[]
  words: ApiWord[]
  practiceQueueCount: number
  page: 'sentences' | 'words' | 'practice'
  selectedVideoUrl: string | null
  onSelectPage: (p: 'sentences' | 'words' | 'practice') => void
  onSelectVideo: (url: string | null) => void
}
```

Update the function signature:
```tsx
export default function Sidebar({ sentences, videos, words, practiceQueueCount, page, selectedVideoUrl, onSelectPage, onSelectVideo }: Props) {
```

Replace the disabled `練習` button (lines 102–117) with:
```tsx
<button
  onClick={() => onSelectPage('practice')}
  className={`${navBase} ${page === 'practice' ? navActive : ''}`}
  style={{
    color: page === 'practice' ? 'var(--ios-blue)' : 'var(--text-primary)',
    background: page === 'practice' ? 'rgba(0,122,255,0.1)' : 'transparent',
  }}
  onMouseEnter={e => {
    if (page !== 'practice')
      (e.currentTarget as HTMLButtonElement).style.background = 'rgba(120,120,128,0.08)'
  }}
  onMouseLeave={e => {
    if (page !== 'practice')
      (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
  }}
>
  <span className="flex items-center gap-2.5">
    <Sparkles size={16} strokeWidth={1.8} />
    練習
  </span>
  {practiceQueueCount > 0 && (
    <span
      className="text-[11px] rounded-full px-1.5 py-0.5 min-w-[20px] text-center tabular-nums"
      style={{
        background: page === 'practice' ? 'rgba(0,122,255,0.15)' : 'rgba(255,149,0,0.2)',
        color: page === 'practice' ? 'var(--ios-blue)' : 'var(--ios-orange)',
      }}
    >
      {practiceQueueCount}
    </span>
  )}
</button>
```

- [ ] **Step 4: Check TypeScript**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Start dev server and verify in browser**

```bash
npm run dev
```

Open http://localhost:5173. Check:
1. Sidebar shows 🧠 練習 with orange badge (if there are due words)
2. Clicking 練習 shows the practice page
3. Flashcard front shows word + pos
4. Clicking 翻面 shows definition + example sentence
5. Clicking 知道 / 不知道 advances to next card and updates progress bar
6. After all cards, completion screen appears

- [ ] **Step 6: Commit**

```bash
cd ..
git add web/src/App.tsx web/src/components/Layout.tsx web/src/components/Sidebar.tsx
git commit -m "feat(web): wire up practice page routing and sidebar badge"
```

---

## Task 8: Deploy + Final Verification

- [ ] **Step 1: Build and deploy web**

```bash
cd web
npm run build
npx wrangler pages deploy dist --project-name duocue-web
```

Expected: deployment URL (e.g. `https://duocue-web.pages.dev`)

- [ ] **Step 2: Smoke test production**

Open the production URL. Verify:
1. Practice badge appears in sidebar
2. Full card flow works end-to-end
3. After reviewing a word, refresh the page — that word should no longer appear in the queue (it has been scheduled for the future)

- [ ] **Step 3: Final commit**

```bash
cd ..
git add -A
git status  # verify only expected files changed
git commit -m "feat: active practice with spaced repetition (flashcard + doubling interval)"
```
