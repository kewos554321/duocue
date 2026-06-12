# Sentences Tab Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 最近加入 / 全部句子 tab switcher to SentencesPage, backed by React Router so tab state and filters survive page refresh.

**Architecture:** Install `react-router-dom`; convert App's `page` useState to URL routes; split SentencesPage filter logic into two focused components (`RecentSentencesTab` and `AllSentencesTab`); Sidebar navigation switches from callbacks to `Link` + `useMatch`.

**Tech Stack:** React 19, React Router DOM v6, TypeScript, Tailwind CSS v4, Vite

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `web/src/main.tsx` | Modify | Wrap `<App>` in `<BrowserRouter>` |
| `web/src/App.tsx` | Modify | Replace `page` state with `<Routes>`; pass props to page components |
| `web/src/components/Sidebar.tsx` | Modify | Replace buttons/callbacks with `Link` + `useMatch` |
| `web/src/components/Layout.tsx` | Modify | Remove `page` / `onSelectPage` props |
| `web/src/utils/time.ts` | Create | `formatRelativeTime(isoString)` utility |
| `web/src/components/SentenceCard.tsx` | Modify | Add optional `relativeTime?: string` prop |
| `web/src/components/RecentSentencesTab.tsx` | Create | Last 20 sentences by `createdAt`, relative time, no filters |
| `web/src/components/AllSentencesTab.tsx` | Create | All filter logic + `useSearchParams` + pagination |
| `web/src/pages/SentencesPage.tsx` | Modify | Tab switcher shell; delegates to the two tab components |

---

## Task 1: Install react-router-dom

**Files:**
- Modify: `web/package.json`

- [ ] **Step 1: Install package**

```bash
cd /Users/kewos/Documents/projects/duocue/web
npm install react-router-dom
```

Expected: `react-router-dom` appears in `dependencies` in `package.json`.

- [ ] **Step 2: Verify types are bundled**

```bash
cat node_modules/react-router-dom/package.json | grep '"types"'
```

Expected: a `"types"` or `"typings"` entry — no separate `@types` package needed for v6+.

- [ ] **Step 3: Commit**

```bash
git add web/package.json web/package-lock.json
git commit -m "chore(web): install react-router-dom"
```

---

## Task 2: Wrap App in BrowserRouter and add Routes

**Files:**
- Modify: `web/src/main.tsx`
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Wrap root in BrowserRouter**

Replace `web/src/main.tsx` entirely:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)
```

- [ ] **Step 2: Replace `page` state with Routes in App.tsx**

Replace `web/src/App.tsx` entirely:

```tsx
import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
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
      </Routes>
    </Layout>
  )
}
```

- [ ] **Step 3: Verify dev server starts without error**

```bash
cd /Users/kewos/Documents/projects/duocue/web
npm run dev
```

Expected: Vite starts without TypeScript errors. (Sidebar and Layout will have type errors until Task 3/4 — that's fine, TypeScript strict mode may not block the dev server.)

- [ ] **Step 4: Commit**

```bash
git add web/src/main.tsx web/src/App.tsx
git commit -m "feat(web): add react-router-dom routes, remove page useState"
```

---

## Task 3: Update Sidebar to use Link + useMatch

**Files:**
- Modify: `web/src/components/Sidebar.tsx`

- [ ] **Step 1: Replace Sidebar entirely**

```tsx
import { Link, useMatch } from 'react-router-dom'
import { BookOpen, BookMarked, Sparkles } from 'lucide-react'
import type { ApiSentence, ApiWord } from '../types'

interface Props {
  sentences: ApiSentence[]
  words: ApiWord[]
  practiceQueueCount: number
}

export default function Sidebar({ sentences, words, practiceQueueCount }: Props) {
  const learningCount = words.filter(w => w.status === 'learning').length

  const sentencesActive = !!useMatch('/sentences/*')
  const wordsActive = !!useMatch('/words')
  const practiceActive = !!useMatch('/practice')

  const navBase = 'w-full text-left px-3 py-2 rounded-xl text-[14px] flex items-center justify-between transition-all duration-150 active:scale-[0.98]'

  function navStyle(active: boolean) {
    return {
      color: active ? 'var(--ios-blue)' : 'var(--text-primary)',
      background: active ? 'rgba(0,122,255,0.1)' : 'transparent',
    }
  }

  function handleMouseEnter(e: React.MouseEvent<HTMLAnchorElement>, active: boolean) {
    if (!active) e.currentTarget.style.background = 'rgba(120,120,128,0.08)'
  }

  function handleMouseLeave(e: React.MouseEvent<HTMLAnchorElement>, active: boolean) {
    if (!active) e.currentTarget.style.background = 'transparent'
  }

  return (
    <aside
      className="w-56 shrink-0 flex flex-col border-r overflow-y-auto"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--separator)' }}
    >
      <nav className="px-2 pt-3 flex flex-col gap-0.5">
        <Link
          to="/sentences/recent"
          className={`${navBase} ${sentencesActive ? 'font-medium' : ''}`}
          style={navStyle(sentencesActive)}
          onMouseEnter={e => handleMouseEnter(e, sentencesActive)}
          onMouseLeave={e => handleMouseLeave(e, sentencesActive)}
        >
          <span className="flex items-center gap-2.5">
            <BookOpen size={16} strokeWidth={1.8} />
            句子
          </span>
          <Badge count={sentences.length} active={sentencesActive} />
        </Link>

        <Link
          to="/words"
          className={`${navBase} ${wordsActive ? 'font-medium' : ''}`}
          style={navStyle(wordsActive)}
          onMouseEnter={e => handleMouseEnter(e, wordsActive)}
          onMouseLeave={e => handleMouseLeave(e, wordsActive)}
        >
          <span className="flex items-center gap-2.5">
            <BookMarked size={16} strokeWidth={1.8} />
            單字本
          </span>
          {learningCount > 0 && <Badge count={learningCount} active={wordsActive} />}
        </Link>

        <Link
          to="/practice"
          className={`${navBase} ${practiceActive ? 'font-medium' : ''}`}
          style={navStyle(practiceActive)}
          onMouseEnter={e => handleMouseEnter(e, practiceActive)}
          onMouseLeave={e => handleMouseLeave(e, practiceActive)}
        >
          <span className="flex items-center gap-2.5">
            <Sparkles size={16} strokeWidth={1.8} />
            練習
          </span>
          {practiceQueueCount > 0 && (
            <span
              className="text-[11px] rounded-full px-1.5 py-0.5 min-w-[20px] text-center tabular-nums"
              style={{
                background: practiceActive ? 'rgba(0,122,255,0.15)' : 'rgba(255,149,0,0.2)',
                color: practiceActive ? 'var(--ios-blue)' : 'var(--ios-orange)',
              }}
            >
              {practiceQueueCount}
            </span>
          )}
        </Link>
      </nav>

      <div
        className="mt-auto px-4 py-4 flex items-center gap-3 border-t"
        style={{ borderColor: 'var(--separator)' }}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-semibold shrink-0 text-white"
          style={{ background: 'var(--ios-blue)' }}
        >
          W
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>Wei Chieh</div>
          <div className="text-[11px] truncate" style={{ color: 'var(--text-secondary)' }}>kewos554321@gmail.com</div>
        </div>
      </div>
    </aside>
  )
}

function Badge({ count, active }: { count: number; active: boolean }) {
  return (
    <span
      className="text-[11px] rounded-full px-1.5 py-0.5 min-w-[20px] text-center tabular-nums"
      style={{
        background: active ? 'rgba(0,122,255,0.15)' : 'rgba(120,120,128,0.12)',
        color: active ? 'var(--ios-blue)' : 'var(--text-secondary)',
      }}
    >
      {count}
    </span>
  )
}
```

- [ ] **Step 2: Verify in browser**

Open http://localhost:5173. Click each nav item. The active item should highlight in blue. Clicking "句子" should navigate to `/sentences/recent`.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/Sidebar.tsx
git commit -m "feat(web): replace Sidebar buttons with Link + useMatch"
```

---

## Task 4: Update Layout to remove page/onSelectPage props

**Files:**
- Modify: `web/src/components/Layout.tsx`

- [ ] **Step 1: Replace Layout**

```tsx
import type { ReactNode } from 'react'
import Sidebar from './Sidebar'
import { useTheme } from '../hooks/useTheme'
import { Sun, Moon } from 'lucide-react'
import type { ApiSentence, ApiWord } from '../types'

interface Props {
  sentences: ApiSentence[]
  words: ApiWord[]
  practiceQueueCount: number
  children: ReactNode
}

export default function Layout({ sentences, words, practiceQueueCount, children }: Props) {
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <header
        className="shrink-0 h-12 flex items-center justify-between px-5 border-b"
        style={{
          background: 'var(--bg-card)',
          borderColor: 'var(--separator)',
        }}
      >
        <span
          className="font-semibold text-[15px] tracking-tight select-none"
          style={{ color: 'var(--text-primary)' }}
        >
          DuoCue
        </span>
        <button
          onClick={toggleTheme}
          className="w-8 h-8 flex items-center justify-center rounded-full transition-colors hover:bg-black/5 dark:hover:bg-white/10"
          title={theme === 'dark' ? '切換為淺色' : '切換為深色'}
          aria-label={theme === 'dark' ? '切換為淺色' : '切換為深色'}
        >
          {theme === 'dark'
            ? <Sun size={16} style={{ color: 'var(--text-secondary)' }} />
            : <Moon size={16} style={{ color: 'var(--text-secondary)' }} />
          }
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          sentences={sentences}
          words={words}
          practiceQueueCount={practiceQueueCount}
        />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd /Users/kewos/Documents/projects/duocue/web
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/Layout.tsx
git commit -m "refactor(web): remove page/onSelectPage props from Layout"
```

---

## Task 5: Create formatRelativeTime utility and add relativeTime prop to SentenceCard

**Files:**
- Create: `web/src/utils/time.ts`
- Modify: `web/src/components/SentenceCard.tsx`

- [ ] **Step 1: Create time utility**

Create `web/src/utils/time.ts`:

```ts
export function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return '剛才'
  if (minutes < 60) return `${minutes} 分鐘前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小時前`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} 天前`
  return new Date(isoString).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })
}
```

- [ ] **Step 2: Add `relativeTime` prop to SentenceCard**

In `web/src/components/SentenceCard.tsx`, update the `Props` interface:

```tsx
interface Props {
  sentence: ApiSentence
  wordMap: Map<string, WordStatus>
  onUpdateWordStatus: (word: string, status: WordStatus) => Promise<void>
  onRemoveWordStatus: (word: string) => Promise<void>
  onDelete: (id: number) => Promise<void>
  relativeTime?: string
}
```

Update the function signature:

```tsx
export default function SentenceCard({ sentence, wordMap, onUpdateWordStatus, onRemoveWordStatus, onDelete, relativeTime }: Props) {
```

In the card header's right-side group (the `div` containing the timestamp link and delete button), replace the timestamp section with a conditional:

```tsx
<div className="flex items-center gap-3 shrink-0">
  {relativeTime ? (
    <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
      {relativeTime}
    </span>
  ) : sentence.platform === 'hbomax' ? (
    <DisabledTimestamp label="HBO Max 不支援時間點跳轉">
      <ExternalLink size={11} strokeWidth={2} />
      {formatTime(sentence.timestampS)}
    </DisabledTimestamp>
  ) : (
    <a
      href={getJumpUrl(sentence.videoUrl, sentence.platform, sentence.timestampS)}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1 text-[12px] transition-opacity hover:opacity-70"
      style={{ color: 'var(--ios-blue)' }}
    >
      <ExternalLink size={11} strokeWidth={2} />
      {formatTime(sentence.timestampS)}
    </a>
  )}
  <button
    onClick={() => onDelete(sentence.id)}
    className="w-5 h-5 flex items-center justify-center rounded-full transition-all hover:opacity-70"
    style={{ color: 'var(--text-secondary)', background: 'rgba(120,120,128,0.1)' }}
    title="刪除"
    aria-label="刪除句子"
  >
    <X size={10} strokeWidth={2.5} />
  </button>
</div>
```

- [ ] **Step 3: Run TypeScript check**

```bash
cd /Users/kewos/Documents/projects/duocue/web
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add web/src/utils/time.ts web/src/components/SentenceCard.tsx
git commit -m "feat(web): add formatRelativeTime util and relativeTime prop to SentenceCard"
```

---

## Task 6: Create RecentSentencesTab

**Files:**
- Create: `web/src/components/RecentSentencesTab.tsx`

- [ ] **Step 1: Create the component**

Create `web/src/components/RecentSentencesTab.tsx`:

```tsx
import { useMemo } from 'react'
import SentenceCard from './SentenceCard'
import { formatRelativeTime } from '../utils/time'
import type { ApiSentence, WordStatus } from '../types'

interface Props {
  sentences: ApiSentence[]
  wordMap: Map<string, WordStatus>
  onUpdateWordStatus: (word: string, status: WordStatus) => Promise<void>
  onRemoveWordStatus: (word: string) => Promise<void>
  onDeleteSentence: (id: number) => Promise<void>
}

export default function RecentSentencesTab({ sentences, wordMap, onUpdateWordStatus, onRemoveWordStatus, onDeleteSentence }: Props) {
  const recent = useMemo(
    () =>
      [...sentences]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 20),
    [sentences]
  )

  if (recent.length === 0) {
    return (
      <div
        className="text-center py-16 text-[14px]"
        style={{ color: 'var(--text-secondary)' }}
      >
        還沒有儲存的句子
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {recent.map(s => (
        <SentenceCard
          key={s.id}
          sentence={s}
          wordMap={wordMap}
          onUpdateWordStatus={onUpdateWordStatus}
          onRemoveWordStatus={onRemoveWordStatus}
          onDelete={onDeleteSentence}
          relativeTime={formatRelativeTime(s.createdAt)}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd /Users/kewos/Documents/projects/duocue/web
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/RecentSentencesTab.tsx
git commit -m "feat(web): add RecentSentencesTab component"
```

---

## Task 7: Create AllSentencesTab

**Files:**
- Create: `web/src/components/AllSentencesTab.tsx`

- [ ] **Step 1: Create the component**

Create `web/src/components/AllSentencesTab.tsx`:

```tsx
import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import SentenceCard from './SentenceCard'
import type { ApiSentence, ApiVideo, WordStatus } from '../types'

type Filter = 'all' | 'learning' | 'unmarked'

const PAGE_SIZE = 20

const PLATFORM_LABEL: Record<string, string> = {
  netflix: 'Netflix',
  hbomax: 'HBO Max',
  youtube: 'YouTube',
}

const PLATFORM_COLOR: Record<string, string> = {
  netflix: '#E50914',
  hbomax: '#5822B4',
  youtube: '#FF0000',
}

const PLATFORM_BG_ACTIVE: Record<string, string> = {
  netflix: 'rgba(229,9,20,0.1)',
  hbomax: 'rgba(88,34,180,0.1)',
  youtube: 'rgba(255,0,0,0.1)',
}

const PLATFORM_BORDER_ACTIVE: Record<string, string> = {
  netflix: 'rgba(229,9,20,0.37)',
  hbomax: 'rgba(88,34,180,0.37)',
  youtube: 'rgba(255,0,0,0.37)',
}

function getPageNumbers(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  if (current <= 4) return [1, 2, 3, 4, 5, '…', total]
  if (current >= total - 3) return [1, '…', total - 4, total - 3, total - 2, total - 1, total]
  return [1, '…', current - 1, current, current + 1, '…', total]
}

interface Props {
  sentences: ApiSentence[]
  videos: ApiVideo[]
  wordMap: Map<string, WordStatus>
  onUpdateWordStatus: (word: string, status: WordStatus) => Promise<void>
  onRemoveWordStatus: (word: string) => Promise<void>
  onDeleteSentence: (id: number) => Promise<void>
}

export default function AllSentencesTab({ sentences, videos, wordMap, onUpdateWordStatus, onRemoveWordStatus, onDeleteSentence }: Props) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [currentPage, setCurrentPage] = useState(1)

  const selectedPlatform = searchParams.get('platform')
  const selectedVideoUrl = searchParams.get('video')
  const filter = (searchParams.get('filter') as Filter) ?? 'all'
  const search = searchParams.get('q') ?? ''

  const platformGroups = useMemo(
    () => videos.reduce<Record<string, ApiVideo[]>>((acc, v) => {
      if (!acc[v.platform]) acc[v.platform] = []
      if (!acc[v.platform].some(x => x.url === v.url))
        acc[v.platform].push(v)
      return acc
    }, {}),
    [videos]
  )

  const filtered = useMemo(() => {
    let result = selectedVideoUrl !== null
      ? sentences.filter(s => s.videoUrl === selectedVideoUrl)
      : selectedPlatform !== null
      ? sentences.filter(s => s.platform === selectedPlatform)
      : sentences

    if (filter === 'learning') {
      result = result.filter(s =>
        s.text.split(/[^a-zA-Z]+/).some(w => w && wordMap.get(w.toLowerCase()) === 'learning')
      )
    } else if (filter === 'unmarked') {
      result = result.filter(s =>
        !s.text.split(/[^a-zA-Z]+/).some(w => w && wordMap.has(w.toLowerCase()))
      )
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(s =>
        s.text.toLowerCase().includes(q) || (s.translation ?? '').toLowerCase().includes(q)
      )
    }

    return result
  }, [sentences, selectedPlatform, selectedVideoUrl, filter, search, wordMap])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  useEffect(() => { setCurrentPage(1) }, [selectedPlatform, selectedVideoUrl, filter, search])

  const FILTERS: [Filter, string][] = [['all', '全部'], ['learning', '學習中'], ['unmarked', '未標記']]

  const selectPlatform = (p: string | null) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (p) next.set('platform', p)
      else next.delete('platform')
      next.delete('video')
      return next
    })
  }

  const selectVideo = (v: string | null) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (v) next.set('video', v)
      else next.delete('video')
      return next
    })
  }

  const selectFilter = (f: Filter) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (f === 'all') next.delete('filter')
      else next.set('filter', f)
      return next
    })
  }

  const updateSearch = (q: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (q) next.set('q', q)
      else next.delete('q')
      return next
    }, { replace: true })
  }

  return (
    <div>
      {/* Platform chips + video dropdown */}
      {Object.keys(platformGroups).length > 0 && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <button
            onClick={() => selectPlatform(null)}
            className="flex items-center px-3 py-1 rounded-full text-[12px] border transition-all duration-150"
            style={{
              background: selectedPlatform === null ? 'rgba(0,122,255,0.1)' : 'rgba(120,120,128,0.12)',
              color: selectedPlatform === null ? 'var(--ios-blue)' : 'var(--text-secondary)',
              borderColor: selectedPlatform === null ? 'rgba(0,122,255,0.37)' : 'rgba(120,120,128,0.2)',
            }}
          >
            全部
          </button>

          {Object.keys(platformGroups).sort().map(p => {
            const active = selectedPlatform === p
            return (
              <button
                key={p}
                onClick={() => active ? selectPlatform(null) : selectPlatform(p)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] border transition-all duration-150"
                style={{
                  background: active ? (PLATFORM_BG_ACTIVE[p] ?? 'rgba(120,120,128,0.12)') : 'rgba(120,120,128,0.12)',
                  color: active ? (PLATFORM_COLOR[p] ?? 'var(--text-secondary)') : 'var(--text-secondary)',
                  borderColor: active ? (PLATFORM_BORDER_ACTIVE[p] ?? 'rgba(120,120,128,0.2)') : 'rgba(120,120,128,0.2)',
                }}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: PLATFORM_COLOR[p] ?? '#888' }}
                />
                {PLATFORM_LABEL[p] ?? p}
                {active && <span className="opacity-50 text-[10px] ml-0.5">✕</span>}
              </button>
            )
          })}

          {selectedPlatform !== null && (
            <>
              <div className="w-px h-4 shrink-0" style={{ background: 'var(--separator)' }} />
              <select
                value={selectedVideoUrl ?? ''}
                onChange={e => selectVideo(e.target.value || null)}
                className="px-3 py-1 rounded-lg text-[12px] outline-none cursor-pointer"
                style={{
                  background: 'rgba(120,120,128,0.12)',
                  color: selectedVideoUrl
                    ? (PLATFORM_COLOR[selectedPlatform] ?? 'var(--text-primary)')
                    : 'var(--text-secondary)',
                  border: `1px solid ${selectedVideoUrl
                    ? (PLATFORM_BORDER_ACTIVE[selectedPlatform] ?? 'rgba(120,120,128,0.2)')
                    : 'rgba(120,120,128,0.2)'}`,
                }}
              >
                <option value="">所有影片</option>
                {(platformGroups[selectedPlatform] ?? []).map(v => (
                  <option key={v.url} value={v.url}>
                    {v.title ?? v.url.replace(/^https?:\/\//, '').slice(0, 30)}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
      )}

      {/* Word status filter + search */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex rounded-lg p-0.5" style={{ background: 'rgba(120,120,128,0.12)' }}>
          {FILTERS.map(([f, label]) => (
            <button
              key={f}
              onClick={() => selectFilter(f)}
              className="px-3 py-1 rounded-[6px] text-[13px] transition-all duration-200"
              style={{
                background: filter === f ? 'var(--bg-card)' : 'transparent',
                color: filter === f ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: filter === f ? 600 : 400,
                boxShadow: filter === f ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-40 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }} />
          <input
            type="text"
            placeholder="搜尋句子…"
            value={search}
            onChange={e => updateSearch(e.target.value)}
            className="w-full rounded-xl pl-8 pr-3 py-1.5 text-[14px] outline-none transition-all"
            style={{ background: 'rgba(120,120,128,0.12)', color: 'var(--text-primary)' }}
            onFocus={e => (e.currentTarget.style.background = 'rgba(120,120,128,0.18)')}
            onBlur={e => (e.currentTarget.style.background = 'rgba(120,120,128,0.12)')}
          />
        </div>
      </div>

      {/* Sentence list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-[14px]" style={{ color: 'var(--text-secondary)' }}>
          沒有符合的句子
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {paginated.map(s => (
              <SentenceCard
                key={s.id}
                sentence={s}
                wordMap={wordMap}
                onUpdateWordStatus={onUpdateWordStatus}
                onRemoveWordStatus={onRemoveWordStatus}
                onDelete={onDeleteSentence}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1.5 mt-6">
              {getPageNumbers(currentPage, totalPages).map((n, i) =>
                n === '…' ? (
                  <span key={`ellipsis-${i}`} className="px-1 text-[13px]" style={{ color: 'var(--text-secondary)' }}>…</span>
                ) : (
                  <button
                    key={n}
                    onClick={() => setCurrentPage(n)}
                    className="min-w-[32px] h-8 px-2 rounded-lg text-[13px] transition-all"
                    style={{
                      background: currentPage === n ? 'var(--ios-blue)' : 'rgba(120,120,128,0.12)',
                      color: currentPage === n ? '#fff' : 'var(--text-primary)',
                      fontWeight: currentPage === n ? 600 : 400,
                    }}
                  >
                    {n}
                  </button>
                )
              )}
            </div>
          )}

          <div className="text-center mt-2 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
            共 {filtered.length} 句 · 第 {currentPage} / {totalPages} 頁
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd /Users/kewos/Documents/projects/duocue/web
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/AllSentencesTab.tsx
git commit -m "feat(web): add AllSentencesTab with useSearchParams and pagination"
```

---

## Task 8: Update SentencesPage to tab switcher shell

**Files:**
- Modify: `web/src/pages/SentencesPage.tsx`

- [ ] **Step 1: Replace SentencesPage entirely**

```tsx
import { NavLink } from 'react-router-dom'
import RecentSentencesTab from '../components/RecentSentencesTab'
import AllSentencesTab from '../components/AllSentencesTab'
import type { ApiSentence, ApiVideo, WordStatus } from '../types'

interface Props {
  tab: 'recent' | 'all'
  sentences: ApiSentence[]
  videos: ApiVideo[]
  wordMap: Map<string, WordStatus>
  onUpdateWordStatus: (word: string, status: WordStatus) => Promise<void>
  onRemoveWordStatus: (word: string) => Promise<void>
  onDeleteSentence: (id: number) => Promise<void>
}

export default function SentencesPage({ tab, sentences, videos, wordMap, onUpdateWordStatus, onRemoveWordStatus, onDeleteSentence }: Props) {
  const tabProps = { sentences, wordMap, onUpdateWordStatus, onRemoveWordStatus, onDeleteSentence }

  return (
    <div>
      {/* Tab switcher */}
      <div
        className="flex rounded-lg p-0.5 mb-6 w-fit"
        style={{ background: 'rgba(120,120,128,0.12)' }}
      >
        {([
          ['recent', '/sentences/recent', '最近加入'],
          ['all', '/sentences/all', '全部句子'],
        ] as const).map(([key, to, label]) => (
          <NavLink
            key={key}
            to={to}
            className="px-4 py-1.5 rounded-[6px] text-[13px] transition-all duration-200 no-underline"
            style={({ isActive }) => ({
              background: isActive ? 'var(--bg-card)' : 'transparent',
              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: isActive ? 600 : 400,
              boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
            })}
          >
            {label}
          </NavLink>
        ))}
      </div>

      {tab === 'recent'
        ? <RecentSentencesTab {...tabProps} />
        : <AllSentencesTab {...tabProps} videos={videos} />
      }
    </div>
  )
}
```

- [ ] **Step 2: Run full TypeScript check**

```bash
cd /Users/kewos/Documents/projects/duocue/web
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Manual verification**

Open http://localhost:5173.

Check list:
- [ ] Page loads on `/sentences/recent` by default (not blank, not error)
- [ ] "最近加入" tab is active/highlighted by default
- [ ] Sentences appear in the recent tab, ordered newest first, with relative timestamps
- [ ] Clicking "全部句子" navigates to `/sentences/all` and shows filter UI + paginated list
- [ ] Selecting Netflix chip shows only Netflix sentences
- [ ] Selecting a video from dropdown filters to that video
- [ ] Refreshing on `/sentences/all?platform=netflix` keeps the Netflix filter active
- [ ] Clicking "最近加入" then back to "全部句子" restores the platform filter from URL
- [ ] Sidebar "句子" item is highlighted on both `/sentences/recent` and `/sentences/all`
- [ ] Pagination appears when there are more than 20 sentences in "全部" tab
- [ ] Changing a filter resets to page 1

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/SentencesPage.tsx
git commit -m "feat(web): replace SentencesPage with tab switcher shell"
```
