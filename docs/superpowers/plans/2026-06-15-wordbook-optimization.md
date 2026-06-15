# WordBook Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Optimize WordBookPage with search/filter/sort, inline status toggling, word removal, source video display, and definition API caching.

**Architecture:** All changes are client-side only. `useDefinition` gains a module-level Map cache so each word is only fetched once per session. `WordBookPage` gains a toolbar (search + status filter) and sorting with section labels. `WordRow` gains a clickable status badge, hover-to-remove ✕ button, and source video chips derived from matching sentences.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, lucide-react

---

## Files Changed

| File | Action |
|------|--------|
| `web/src/hooks/useDefinition.ts` | Modify — add module-level cache Map |
| `web/src/pages/WordBookPage.tsx` | Modify — toolbar, filter, sort, updated WordRow |
| `web/src/App.tsx` | Modify — pass `onUpdateWordStatus` + `onRemoveWord` to WordBookPage |

---

### Task 1: Cache definitions in `useDefinition.ts`

**Files:**
- Modify: `web/src/hooks/useDefinition.ts`

- [ ] **Step 1: Replace the file with a cached version**

```ts
import { useState, useEffect } from 'react'

interface DictionaryEntry {
  meanings: Array<{
    partOfSpeech: string
    definitions: Array<{ definition: string }>
  }>
}

const cache = new Map<string, { definition: string; partOfSpeech: string }>()

export function useDefinition(word: string | null) {
  const hit = word ? cache.get(word) : undefined
  const [definition, setDefinition] = useState<string>(hit?.definition ?? '—')
  const [partOfSpeech, setPartOfSpeech] = useState<string>(hit?.partOfSpeech ?? '')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!word) return
    const cached = cache.get(word)
    if (cached) {
      setDefinition(cached.definition)
      setPartOfSpeech(cached.partOfSpeech)
      return
    }
    setLoading(true)
    setDefinition('—')
    setPartOfSpeech('')
    fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`)
      .then(r => (r.ok ? r.json() : null) as Promise<DictionaryEntry[] | null>)
      .then(data => {
        const meaning = data?.[0]?.meanings?.[0]
        const pos = meaning?.partOfSpeech ?? ''
        const def = meaning?.definitions?.[0]?.definition ?? '—'
        cache.set(word, { definition: def, partOfSpeech: pos })
        setPartOfSpeech(pos)
        setDefinition(def)
      })
      .catch(() => setDefinition('—'))
      .finally(() => setLoading(false))
  }, [word])

  return { definition, partOfSpeech, loading }
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd web && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/hooks/useDefinition.ts
git commit -m "perf(web): add session cache to useDefinition to avoid re-fetching"
```

---

### Task 2: Wire new props through App.tsx → WordBookPage

**Files:**
- Modify: `web/src/App.tsx` (line 87)
- Modify: `web/src/pages/WordBookPage.tsx` — Props interface + WordRow interface

- [ ] **Step 1: Update the `/words` route in `App.tsx`**

Find line 87:
```tsx
<Route path="/words" element={<WordBookPage words={words} sentences={sentences} />} />
```
Replace with:
```tsx
<Route path="/words" element={<WordBookPage words={words} sentences={sentences} onUpdateWordStatus={updateWordStatus} onRemoveWord={handleRemoveWord} />} />
```

- [ ] **Step 2: Update `WordBookPage.tsx` — Props interface, WordRowProps, and function signatures**

At the top of `WordBookPage.tsx`, change the import to add `WordStatus` and `X`:
```tsx
import { useState, Fragment } from 'react'
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react'
import { useDefinition } from '../hooks/useDefinition'
import type { ApiSentence, ApiWord, WordStatus } from '../types'
```

Update `WordRowProps`:
```tsx
interface WordRowProps {
  word: ApiWord
  sentences: ApiSentence[]
  onUpdateWordStatus: (word: string, status: WordStatus) => Promise<void>
  onRemoveWord: (word: string) => Promise<void>
}
```

Update `WordRow` function signature (keep body unchanged for now):
```tsx
function WordRow({ word, sentences, onUpdateWordStatus, onRemoveWord }: WordRowProps) {
```

Update page `Props`:
```tsx
interface Props {
  words: ApiWord[]
  sentences: ApiSentence[]
  onUpdateWordStatus: (word: string, status: WordStatus) => Promise<void>
  onRemoveWord: (word: string) => Promise<void>
}
```

Update `WordBookPage` function signature:
```tsx
export default function WordBookPage({ words, sentences, onUpdateWordStatus, onRemoveWord }: Props) {
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd web && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add web/src/App.tsx web/src/pages/WordBookPage.tsx
git commit -m "refactor(web): add onUpdateWordStatus + onRemoveWord props to WordBookPage"
```

---

### Task 3: Add toolbar (search + filter) and sort + section labels to WordBookPage

**Files:**
- Modify: `web/src/pages/WordBookPage.tsx` — replace the `WordBookPage` export function only (keep `WordRow` unchanged)

- [ ] **Step 1: Replace the `WordBookPage` export function**

Replace everything from `interface Props` to the end of the file with:

```tsx
type StatusFilter = 'all' | 'learning' | 'learned'

const FILTERS: [StatusFilter, string][] = [
  ['all', '全部'],
  ['learning', '學習中'],
  ['learned', '已學習'],
]

interface Props {
  words: ApiWord[]
  sentences: ApiSentence[]
  onUpdateWordStatus: (word: string, status: WordStatus) => Promise<void>
  onRemoveWord: (word: string) => Promise<void>
}

export default function WordBookPage({ words, sentences, onUpdateWordStatus, onRemoveWord }: Props) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')

  const markedWords = words.filter(w => w.status === 'learning' || w.status === 'learned')

  const filtered = markedWords
    .filter(w => {
      if (statusFilter === 'learning' && w.status !== 'learning') return false
      if (statusFilter === 'learned' && w.status !== 'learned') return false
      if (search.trim() && !w.word.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'learning' ? -1 : 1
      return a.word.localeCompare(b.word)
    })

  if (markedWords.length === 0) {
    return (
      <div
        className="text-center py-16 text-[14px]"
        style={{ color: 'var(--text-secondary)' }}
      >
        還沒有標記的單字。<br />
        <span className="text-[13px]">在句子頁面 hover 任何單字可標記學習狀態。</span>
      </div>
    )
  }

  return (
    <div>
      <h2
        className="font-semibold text-[17px] mb-4"
        style={{ color: 'var(--text-primary)' }}
      >
        單字本
        <span
          className="ml-2 text-[14px] font-normal"
          style={{ color: 'var(--text-secondary)' }}
        >
          {filtered.length} 個
        </span>
      </h2>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="flex rounded-lg p-0.5" style={{ background: 'rgba(120,120,128,0.12)' }}>
          {FILTERS.map(([f, label]) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className="px-3 py-1 rounded-[6px] text-[13px] transition-all duration-200"
              style={{
                background: statusFilter === f ? 'var(--bg-card)' : 'transparent',
                color: statusFilter === f ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: statusFilter === f ? 600 : 400,
                boxShadow: statusFilter === f ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-36 max-w-xs">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--text-secondary)' }}
          />
          <input
            type="text"
            placeholder="搜尋單字…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-xl pl-8 pr-3 py-1.5 text-[14px] outline-none"
            style={{ background: 'rgba(120,120,128,0.12)', color: 'var(--text-primary)' }}
            onFocus={e => (e.currentTarget.style.background = 'rgba(120,120,128,0.18)')}
            onBlur={e => (e.currentTarget.style.background = 'rgba(120,120,128,0.12)')}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div
          className="text-center py-16 text-[14px]"
          style={{ color: 'var(--text-secondary)' }}
        >
          沒有符合的單字
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map((w, i) => (
            <Fragment key={w.word}>
              {statusFilter === 'all' && (i === 0 || filtered[i - 1].status !== w.status) && (
                <p
                  className="text-[11px] font-semibold uppercase tracking-wide mt-2 first:mt-0"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {w.status === 'learning' ? '學習中' : '已學習'}
                </p>
              )}
              <WordRow
                word={w}
                sentences={sentences}
                onUpdateWordStatus={onUpdateWordStatus}
                onRemoveWord={onRemoveWord}
              />
            </Fragment>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd web && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Start dev server and verify in browser**

```bash
cd web && npm run dev
```

Open http://localhost:5173/words and confirm:
- Filter chips appear and switch between 全部 / 學習中 / 已學習
- Search box filters words as you type
- In "全部" mode, section labels "學習中" / "已學習" appear above each group
- Words sort: learning first, then alphabetical within each group

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/WordBookPage.tsx
git commit -m "feat(web): add search, filter, and sort to WordBookPage"
```

---

### Task 4: Status toggle + word removal in WordRow

**Files:**
- Modify: `web/src/pages/WordBookPage.tsx` — replace `WordRow` function only

- [ ] **Step 1: Replace the `WordRow` function**

Replace from `function WordRow` to its closing `}` with:

```tsx
function WordRow({ word, sentences, onUpdateWordStatus, onRemoveWord }: WordRowProps) {
  const { definition, partOfSpeech } = useDefinition(word.word)
  const [expanded, setExpanded] = useState(false)

  const matchingSentences = sentences.filter(s =>
    new RegExp(`(?<![a-zA-Z])${word.word}(?![a-zA-Z])`, 'i').test(s.text)
  )

  const isLearning = word.status === 'learning'

  return (
    <div
      className="group rounded-2xl overflow-hidden transition-all duration-150 relative"
      style={{
        background: 'var(--bg-card)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      {/* Remove button — visible on hover */}
      <button
        onClick={() => onRemoveWord(word.word)}
        className="absolute top-2.5 right-2.5 w-[22px] h-[22px] rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:brightness-110"
        style={{ background: 'rgba(255,69,58,0.15)', color: 'var(--ios-red)' }}
        title="移除單字"
        aria-label="移除單字"
      >
        <X size={10} strokeWidth={2.5} />
      </button>

      <div className="px-4 py-3.5 pr-10">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span
                className="font-semibold text-[16px]"
                style={{ color: 'var(--text-primary)' }}
              >
                {word.word}
              </span>
              {partOfSpeech && (
                <span
                  className="text-[11px]"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {partOfSpeech}
                </span>
              )}
              {/* Clickable status badge */}
              <button
                onClick={() => onUpdateWordStatus(word.word, isLearning ? 'learned' : 'learning')}
                className="text-[11px] rounded-full px-2 py-0.5 transition-all hover:brightness-110 active:scale-95"
                style={{
                  background: isLearning ? 'rgba(255,149,0,0.12)' : 'rgba(52,199,89,0.12)',
                  color: isLearning ? 'var(--ios-orange)' : 'var(--ios-green)',
                  border: 'none',
                  cursor: 'pointer',
                }}
                title="點擊切換狀態"
              >
                {isLearning ? '學習中' : '已學習'}
              </button>
            </div>
            {definition && (
              <p
                className="text-[13px] leading-relaxed"
                style={{ color: 'var(--text-secondary)' }}
              >
                {definition}
              </p>
            )}
          </div>

          {matchingSentences.length > 0 && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="flex items-center gap-1 text-[12px] shrink-0 transition-opacity hover:opacity-70 mt-0.5"
              style={{ color: 'var(--ios-blue)' }}
            >
              {matchingSentences.length} 例句
              {expanded
                ? <ChevronUp size={12} strokeWidth={2} />
                : <ChevronDown size={12} strokeWidth={2} />
              }
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div
          className="px-4 pb-3.5 flex flex-col gap-2 border-t"
          style={{ borderColor: 'var(--separator)' }}
        >
          <div className="pt-3 flex flex-col gap-2">
            {matchingSentences.map(s => (
              <p
                key={s.id}
                className="text-[13px] leading-relaxed"
                style={{ color: 'var(--text-secondary)' }}
              >
                {s.text}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd web && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Verify in browser**

Open http://localhost:5173/words and confirm:
- Hovering a card reveals a red ✕ button at top-right; clicking it removes the word from the list
- Clicking the status badge (學習中 / 已學習) toggles it; the word moves to the correct group on next render

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/WordBookPage.tsx
git commit -m "feat(web): add inline status toggle and hover-to-remove to WordRow"
```

---

### Task 5: Source video chips in WordRow

**Files:**
- Modify: `web/src/pages/WordBookPage.tsx` — add platform constants at the top, update `WordRow` to show source chips and per-sentence source labels

- [ ] **Step 1: Add platform constants after the imports**

After the import block, add:

```tsx
const PLATFORM_COLOR: Record<string, string> = {
  netflix: '#E50914',
  hbomax: '#5822B4',
  youtube: '#FF0000',
}

const PLATFORM_LABEL: Record<string, string> = {
  netflix: 'Netflix',
  hbomax: 'HBO Max',
  youtube: 'YouTube',
}
```

- [ ] **Step 2: Replace the `WordRow` function with the version that includes source chips**

Replace `function WordRow` to its closing `}` with:

```tsx
function WordRow({ word, sentences, onUpdateWordStatus, onRemoveWord }: WordRowProps) {
  const { definition, partOfSpeech } = useDefinition(word.word)
  const [expanded, setExpanded] = useState(false)

  const matchingSentences = sentences.filter(s =>
    new RegExp(`(?<![a-zA-Z])${word.word}(?![a-zA-Z])`, 'i').test(s.text)
  )

  const uniqueSources = matchingSentences.filter(
    (s, i, arr) => arr.findIndex(x => x.videoUrl === s.videoUrl) === i
  )

  const isLearning = word.status === 'learning'

  return (
    <div
      className="group rounded-2xl overflow-hidden transition-all duration-150 relative"
      style={{
        background: 'var(--bg-card)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      {/* Remove button — visible on hover */}
      <button
        onClick={() => onRemoveWord(word.word)}
        className="absolute top-2.5 right-2.5 w-[22px] h-[22px] rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:brightness-110"
        style={{ background: 'rgba(255,69,58,0.15)', color: 'var(--ios-red)' }}
        title="移除單字"
        aria-label="移除單字"
      >
        <X size={10} strokeWidth={2.5} />
      </button>

      <div className="px-4 py-3.5 pr-10">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span
                className="font-semibold text-[16px]"
                style={{ color: 'var(--text-primary)' }}
              >
                {word.word}
              </span>
              {partOfSpeech && (
                <span
                  className="text-[11px]"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {partOfSpeech}
                </span>
              )}
              <button
                onClick={() => onUpdateWordStatus(word.word, isLearning ? 'learned' : 'learning')}
                className="text-[11px] rounded-full px-2 py-0.5 transition-all hover:brightness-110 active:scale-95"
                style={{
                  background: isLearning ? 'rgba(255,149,0,0.12)' : 'rgba(52,199,89,0.12)',
                  color: isLearning ? 'var(--ios-orange)' : 'var(--ios-green)',
                  border: 'none',
                  cursor: 'pointer',
                }}
                title="點擊切換狀態"
              >
                {isLearning ? '學習中' : '已學習'}
              </button>
            </div>

            {definition && (
              <p
                className="text-[13px] leading-relaxed mb-2"
                style={{ color: 'var(--text-secondary)' }}
              >
                {definition}
              </p>
            )}

            {/* Source chips */}
            {uniqueSources.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {uniqueSources.map(s => (
                  <span
                    key={s.videoUrl}
                    className="flex items-center gap-1 text-[11px] rounded-md px-2 py-0.5"
                    style={{
                      background: 'rgba(120,120,128,0.12)',
                      color: 'var(--text-secondary)',
                      border: '1px solid rgba(120,120,128,0.18)',
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: PLATFORM_COLOR[s.platform] ?? '#888' }}
                    />
                    <span className="truncate max-w-[160px]">
                      {s.videoTitle ?? PLATFORM_LABEL[s.platform] ?? s.platform}
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {matchingSentences.length > 0 && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="flex items-center gap-1 text-[12px] shrink-0 transition-opacity hover:opacity-70 mt-0.5"
              style={{ color: 'var(--ios-blue)' }}
            >
              {matchingSentences.length} 例句
              {expanded
                ? <ChevronUp size={12} strokeWidth={2} />
                : <ChevronDown size={12} strokeWidth={2} />
              }
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div
          className="px-4 pb-3.5 flex flex-col gap-3 border-t"
          style={{ borderColor: 'var(--separator)' }}
        >
          <div className="pt-3 flex flex-col gap-3">
            {matchingSentences.map(s => (
              <div key={s.id} className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: PLATFORM_COLOR[s.platform] ?? '#888' }}
                  />
                  <span
                    className="text-[11px] truncate"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {s.videoTitle ?? PLATFORM_LABEL[s.platform] ?? s.platform}
                  </span>
                </div>
                <p
                  className="text-[13px] leading-relaxed"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {s.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd web && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Verify in browser**

Open http://localhost:5173/words and confirm:
- Source chips appear below the definition (showing platform color dot + video title)
- Words from multiple shows display multiple chips side by side
- Expanding a card shows each sentence with its source title + platform dot above it

- [ ] **Step 5: Commit**

```bash
git add web/src/pages/WordBookPage.tsx
git commit -m "feat(web): show source video chips on each word card"
```
