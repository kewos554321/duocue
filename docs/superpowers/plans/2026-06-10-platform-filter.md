# Platform Filter in SentencesPage — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move sidebar's platform/video navigation into an inline filter bar at the top of SentencesPage and remove "依影片" from the sidebar.

**Architecture:** Four sequential file changes — slim Sidebar, slim Layout, update App state wiring, add filter UI to SentencesPage. SentencesPage takes ownership of `selectedPlatform` and `selectedVideoUrl` as local state; it receives `videos` as a new prop.

**Tech Stack:** React 19, TypeScript 5.6, Tailwind CSS 4, Vite 6. No test framework — use `tsc --noEmit` for verification.

---

### Task 1: Slim down Sidebar

Remove "依影片" section and video-related props.

**Files:**
- Modify: `web/src/components/Sidebar.tsx`

- [ ] **Step 1: Replace Sidebar.tsx with the slimmed version**

Full replacement (all video-related code removed):

```tsx
import { BookOpen, BookMarked, Sparkles } from 'lucide-react'
import type { ApiSentence, ApiWord } from '../types'

interface Props {
  sentences: ApiSentence[]
  words: ApiWord[]
  practiceQueueCount: number
  page: 'sentences' | 'words' | 'practice'
  onSelectPage: (p: 'sentences' | 'words' | 'practice') => void
}

export default function Sidebar({ sentences, words, practiceQueueCount, page, onSelectPage }: Props) {
  const learningCount = words.filter(w => w.status === 'learning').length

  const navActive = 'font-medium'
  const navBase = 'w-full text-left px-3 py-2 rounded-xl text-[14px] flex items-center justify-between transition-all duration-150 active:scale-[0.98]'

  return (
    <aside
      className="w-56 shrink-0 flex flex-col border-r overflow-y-auto"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--separator)' }}
    >
      <nav className="px-2 pt-3 flex flex-col gap-0.5">
        <button
          onClick={() => onSelectPage('sentences')}
          className={`${navBase} ${page === 'sentences' ? navActive : ''}`}
          style={{
            color: page === 'sentences' ? 'var(--ios-blue)' : 'var(--text-primary)',
            background: page === 'sentences' ? 'rgba(0,122,255,0.1)' : 'transparent',
          }}
          onMouseEnter={e => {
            if (page !== 'sentences')
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(120,120,128,0.08)'
          }}
          onMouseLeave={e => {
            if (page !== 'sentences')
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
          }}
        >
          <span className="flex items-center gap-2.5">
            <BookOpen size={16} strokeWidth={1.8} />
            全部句子
          </span>
          <Badge count={sentences.length} active={page === 'sentences'} />
        </button>

        <button
          onClick={() => onSelectPage('words')}
          className={`${navBase} ${page === 'words' ? navActive : ''}`}
          style={{
            color: page === 'words' ? 'var(--ios-blue)' : 'var(--text-primary)',
            background: page === 'words' ? 'rgba(0,122,255,0.1)' : 'transparent',
          }}
          onMouseEnter={e => {
            if (page !== 'words')
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(120,120,128,0.08)'
          }}
          onMouseLeave={e => {
            if (page !== 'words')
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
          }}
        >
          <span className="flex items-center gap-2.5">
            <BookMarked size={16} strokeWidth={1.8} />
            單字本
          </span>
          {learningCount > 0 && <Badge count={learningCount} active={page === 'words'} />}
        </button>

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

- [ ] **Step 2: Verify types**

```bash
cd web && npx tsc --noEmit
```

Expected: errors about Layout still passing removed props — that's fine, those will be fixed in Task 2.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/Sidebar.tsx
git commit -m "refactor(sidebar): remove 依影片 section and video-related props"
```

---

### Task 2: Slim down Layout

Remove `videos`, `selectedVideoUrl`, `onSelectVideo` from Layout's props and its Sidebar call.

**Files:**
- Modify: `web/src/components/Layout.tsx`

- [ ] **Step 1: Replace Layout.tsx**

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
  page: 'sentences' | 'words' | 'practice'
  onSelectPage: (p: 'sentences' | 'words' | 'practice') => void
  children: ReactNode
}

export default function Layout({ sentences, words, practiceQueueCount, page, onSelectPage, children }: Props) {
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
          page={page}
          onSelectPage={onSelectPage}
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

- [ ] **Step 2: Verify types**

```bash
cd web && npx tsc --noEmit
```

Expected: errors about App.tsx still passing removed props — fine, fixed in Task 3.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/Layout.tsx
git commit -m "refactor(layout): remove video-related props"
```

---

### Task 3: Update App.tsx wiring

Remove `selectedVideoUrl` state, remove video props from Layout, pass `videos` to SentencesPage.

**Files:**
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Replace App.tsx**

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
      words={words}
      practiceQueueCount={practiceQueue.length}
      page={page}
      onSelectPage={setPage}
    >
      {page === 'sentences' ? (
        <SentencesPage
          sentences={sentences}
          videos={videos}
          wordMap={wordMap}
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

- [ ] **Step 2: Verify types**

```bash
cd web && npx tsc --noEmit
```

Expected: error about SentencesPage missing `videos` prop and having unknown `selectedVideoUrl` prop — fixed in Task 4.

- [ ] **Step 3: Commit**

```bash
git add web/src/App.tsx
git commit -m "refactor(app): remove selectedVideoUrl state, pass videos to SentencesPage"
```

---

### Task 4: Add platform filter bar to SentencesPage

Add `videos` prop, local filter state, and the filter bar UI (platform chips + video dropdown).

**Files:**
- Modify: `web/src/pages/SentencesPage.tsx`

- [ ] **Step 1: Replace SentencesPage.tsx**

```tsx
import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import SentenceCard from '../components/SentenceCard'
import type { ApiSentence, ApiVideo, WordStatus } from '../types'

type Filter = 'all' | 'learning' | 'unmarked'

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

interface Props {
  sentences: ApiSentence[]
  videos: ApiVideo[]
  wordMap: Map<string, WordStatus>
  onUpdateWordStatus: (word: string, status: WordStatus) => Promise<void>
  onRemoveWordStatus: (word: string) => Promise<void>
  onDeleteSentence: (id: number) => Promise<void>
}

export default function SentencesPage({ sentences, videos, wordMap, onUpdateWordStatus, onRemoveWordStatus, onDeleteSentence }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null)
  const [selectedVideoUrl, setSelectedVideoUrl] = useState<string | null>(null)

  const platformGroups = useMemo(
    () => videos.reduce<Record<string, ApiVideo[]>>((acc, v) => {
      if (!acc[v.platform]) acc[v.platform] = []
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

  const FILTERS: [Filter, string][] = [['all', '全部'], ['learning', '學習中'], ['unmarked', '未標記']]

  const selectPlatform = (p: string | null) => {
    setSelectedPlatform(p)
    setSelectedVideoUrl(null)
  }

  return (
    <div>
      {/* Controls row 1: platform chips + video dropdown */}
      {Object.keys(platformGroups).length > 0 && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {/* 全部 chip */}
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

          {/* Per-platform chips */}
          {Object.keys(platformGroups).map(p => {
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

          {/* Divider + video dropdown — only when a platform is selected */}
          {selectedPlatform !== null && (
            <>
              <div
                className="w-px h-4 shrink-0"
                style={{ background: 'var(--separator)' }}
              />
              <select
                value={selectedVideoUrl ?? ''}
                onChange={e => setSelectedVideoUrl(e.target.value || null)}
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

      {/* Controls row 2: word status filter + search */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div
          className="flex rounded-lg p-0.5"
          style={{ background: 'rgba(120,120,128,0.12)' }}
        >
          {FILTERS.map(([f, label]) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
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
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--text-secondary)' }}
          />
          <input
            type="text"
            placeholder="搜尋句子…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-xl pl-8 pr-3 py-1.5 text-[14px] outline-none transition-all"
            style={{
              background: 'rgba(120,120,128,0.12)',
              color: 'var(--text-primary)',
            }}
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
          沒有符合的句子
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(s => (
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
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify types pass cleanly**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run dev server and verify in browser**

```bash
cd web && npm run dev
```

Check:
- Sidebar has no "依影片" section
- Sentences page shows platform chips (only platforms that exist in data)
- Clicking a platform chip filters sentences and reveals video dropdown
- Clicking the active chip (✕) resets back to 全部
- Selecting a video in the dropdown further filters to that video
- Segmented control and search still work alongside the new filter

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/SentencesPage.tsx
git commit -m "feat(sentences): add platform and video filter bar"
```
