# Web Frontend (Sentence Library) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a React 19 + Vite + Tailwind CSS v4 web app deployed to Cloudflare Pages that shows saved sentences, supports word-status hover tooltips, and lets the user browse by video or review their word book.

**Architecture:** Single-page app in `web/` (npm workspace). All data comes from `https://duocue-api.kewos554321.workers.dev` via direct `fetch` calls — no client-side cache library. Page navigation is state-based (no router). API key is hardcoded in `web/src/config.ts` (MVP). GET /sentences already JOINs video data, so each sentence carries `platform`, `videoUrl`, `videoTitle`, `timestampS` — no client-side join needed.

**Tech Stack:** React 19, Vite 6, TypeScript 5.6, Tailwind CSS v4 (`@tailwindcss/vite`), Cloudflare Pages

---

## File Map

| File | Role |
|------|------|
| `web/package.json` | Workspace package with scripts |
| `web/tsconfig.json` | TypeScript config (bundler mode) |
| `web/vite.config.ts` | Vite with React + Tailwind v4 plugins |
| `web/index.html` | HTML entry point |
| `web/src/index.css` | `@import "tailwindcss"` + body styles |
| `web/src/main.tsx` | React root mount |
| `web/src/types.ts` | `ApiSentence`, `ApiVideo`, `ApiWord`, `WordStatus` |
| `web/src/config.ts` | `API_ENDPOINT`, `API_KEY` |
| `web/src/api.ts` | `fetchSentences`, `fetchVideos`, `fetchWords`, `patchWordStatus` |
| `web/src/App.tsx` | Root: loads data, owns page + filter state, passes down |
| `web/src/components/Layout.tsx` | Outer shell: sidebar + main area wrapper |
| `web/src/components/Sidebar.tsx` | Nav menu + video groups + hardcoded account section |
| `web/src/components/SentenceCard.tsx` | One sentence card: text, colors, jump button, tags |
| `web/src/components/WordSpan.tsx` | Inline word with hover tooltip open/close timing |
| `web/src/components/Tooltip.tsx` | Hover tooltip: definition + status buttons |
| `web/src/hooks/useDefinition.ts` | Fetch definition from dictionaryapi.dev |
| `web/src/pages/SentencesPage.tsx` | Sentence list + filter chips + search |
| `web/src/pages/WordBookPage.tsx` | All marked words with definition + sentence count |

---

## API response shapes (reference for all tasks)

```typescript
// GET /sentences
{ sentences: Array<{
  id: number; text: string; translation: string | null;
  timestampS: number; platform: string;
  videoUrl: string; videoTitle: string | null; createdAt: string
}> }

// GET /videos
{ videos: Array<{
  platform: string; url: string;
  title: string | null; sentenceCount: number
}> }

// GET /words
{ words: Array<{ word: string; status: 'learning' | 'learned' }> }

// PATCH /words/:word  body: { status }
{ word: string; status: string }
```

---

### Task 1: Scaffold web/ — Vite + React 19 + TypeScript + Tailwind CSS v4

**Files:**
- Create: `web/package.json`
- Create: `web/tsconfig.json`
- Create: `web/vite.config.ts`
- Create: `web/index.html`
- Create: `web/src/main.tsx`
- Create: `web/src/index.css`

- [ ] **Step 1: Create `web/package.json`**

```json
{
  "name": "duocue-web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "tailwindcss": "^4.0.0",
    "typescript": "~5.6.0",
    "vite": "^6.0.0"
  }
}
```

- [ ] **Step 2: Create `web/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `web/vite.config.ts`**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { outDir: 'dist' },
})
```

- [ ] **Step 4: Create `web/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>DuoCue</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `web/src/index.css`**

```css
@import "tailwindcss";

body {
  margin: 0;
  background: #000;
  color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
}

* {
  box-sizing: border-box;
}
```

- [ ] **Step 6: Create `web/src/main.tsx`**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

- [ ] **Step 7: Create placeholder `web/src/App.tsx` so TypeScript compiles**

```tsx
export default function App() {
  return <div className="p-4 text-white">DuoCue loading…</div>
}
```

- [ ] **Step 8: Install dependencies from monorepo root**

```bash
npm install
```

Expected: installs react, react-dom, vite, tailwindcss etc. into root `node_modules/` (npm workspaces hoisting). No separate `web/node_modules/` is created — that's expected.

- [ ] **Step 9: Verify dev server starts**

```bash
npm run dev -w web
```

Expected: Vite starts at `http://localhost:5173`. Open it — should show "DuoCue loading…" in white text on black background.

- [ ] **Step 10: Commit**

```bash
git add web/
git commit -m "feat(web): scaffold Vite + React 19 + TypeScript + Tailwind CSS v4"
```

---

### Task 2: Types + config + API layer

**Files:**
- Create: `web/src/types.ts`
- Create: `web/src/config.ts`
- Create: `web/src/api.ts`

- [ ] **Step 1: Create `web/src/types.ts`**

```typescript
export type WordStatus = 'learning' | 'learned'

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
```

- [ ] **Step 2: Create `web/src/config.ts`**

```typescript
export const API_ENDPOINT = 'https://duocue-api.kewos554321.workers.dev'
export const API_KEY = '1faabc8c509c427f5acf0fb8861732b63d5dc6af3c910558db38eec289f3e3d7'
```

- [ ] **Step 3: Create `web/src/api.ts`**

```typescript
import { API_ENDPOINT, API_KEY } from './config'
import type { ApiSentence, ApiVideo, ApiWord, WordStatus } from './types'

const authHeaders = {
  Authorization: `Bearer ${API_KEY}`,
  'Content-Type': 'application/json',
}

export async function fetchSentences(): Promise<ApiSentence[]> {
  const res = await fetch(`${API_ENDPOINT}/sentences`, { headers: authHeaders })
  if (!res.ok) throw new Error(`GET /sentences failed: ${res.status}`)
  const { sentences } = await res.json()
  return sentences as ApiSentence[]
}

export async function fetchVideos(): Promise<ApiVideo[]> {
  const res = await fetch(`${API_ENDPOINT}/videos`, { headers: authHeaders })
  if (!res.ok) throw new Error(`GET /videos failed: ${res.status}`)
  const { videos } = await res.json()
  return videos as ApiVideo[]
}

export async function fetchWords(): Promise<ApiWord[]> {
  const res = await fetch(`${API_ENDPOINT}/words`, { headers: authHeaders })
  if (!res.ok) throw new Error(`GET /words failed: ${res.status}`)
  const { words } = await res.json()
  return words as ApiWord[]
}

export async function patchWordStatus(word: string, status: WordStatus): Promise<void> {
  const res = await fetch(`${API_ENDPOINT}/words/${encodeURIComponent(word.toLowerCase())}`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ status }),
  })
  if (!res.ok) throw new Error(`PATCH /words/${word} failed: ${res.status}`)
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add web/src/types.ts web/src/config.ts web/src/api.ts
git commit -m "feat(web): add types, config, and API fetch layer"
```

---

### Task 3: Layout — Header + Sidebar

**Files:**
- Create: `web/src/components/Layout.tsx`
- Create: `web/src/components/Sidebar.tsx`

- [ ] **Step 1: Create `web/src/components/Sidebar.tsx`**

```tsx
import { useState } from 'react'
import type { ApiSentence, ApiVideo, ApiWord } from '../types'

const PLATFORM_LABEL: Record<string, string> = {
  netflix: 'Netflix 🔴',
  hbomax: 'HBO Max 🔵',
  youtube: 'YouTube 🔴',
}

interface Props {
  sentences: ApiSentence[]
  videos: ApiVideo[]
  words: ApiWord[]
  page: 'sentences' | 'words'
  selectedVideoUrl: string | null
  onSelectPage: (p: 'sentences' | 'words') => void
  onSelectVideo: (url: string | null) => void
}

export default function Sidebar({ sentences, videos, words, page, selectedVideoUrl, onSelectPage, onSelectVideo }: Props) {
  const [expandedPlatforms, setExpandedPlatforms] = useState<Set<string>>(new Set())

  const togglePlatform = (platform: string) => {
    setExpandedPlatforms(prev => {
      const next = new Set(prev)
      next.has(platform) ? next.delete(platform) : next.add(platform)
      return next
    })
  }

  const platformGroups = videos.reduce<Record<string, ApiVideo[]>>((acc, v) => {
    if (!acc[v.platform]) acc[v.platform] = []
    acc[v.platform].push(v)
    return acc
  }, {})

  const learningCount = words.filter(w => w.status === 'learning').length

  return (
    <aside className="w-56 shrink-0 flex flex-col bg-[#1C1C1E] border-r border-white/10 overflow-y-auto">
      {/* Logo */}
      <div className="px-4 py-5 text-white font-bold text-lg tracking-tight select-none">
        ● DuoCue
      </div>

      {/* Main nav */}
      <nav className="px-2 flex flex-col gap-1">
        <button
          onClick={() => { onSelectPage('sentences'); onSelectVideo(null) }}
          className={`w-full text-left px-3 py-2 rounded-lg text-sm flex justify-between items-center transition-colors ${
            page === 'sentences' && selectedVideoUrl === null
              ? 'bg-white/10 text-white'
              : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
        >
          <span>📖 全部句子</span>
          <span className="text-xs bg-white/10 rounded px-1.5 py-0.5">{sentences.length}</span>
        </button>

        <button
          onClick={() => onSelectPage('words')}
          className={`w-full text-left px-3 py-2 rounded-lg text-sm flex justify-between items-center transition-colors ${
            page === 'words'
              ? 'bg-white/10 text-white'
              : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
        >
          <span>📝 單字本</span>
          <span className="text-xs bg-white/10 rounded px-1.5 py-0.5">{learningCount}</span>
        </button>

        <button
          disabled
          className="w-full text-left px-3 py-2 rounded-lg text-sm flex justify-between items-center text-white/25 cursor-not-allowed"
        >
          <span>🧠 練習</span>
          <span className="text-xs bg-white/5 rounded px-1.5 py-0.5">未來</span>
        </button>
      </nav>

      {/* Video groups */}
      {Object.keys(platformGroups).length > 0 && (
        <div className="mt-4 px-2">
          <div className="px-3 py-1 text-xs text-white/30 uppercase tracking-wider mb-1">依影片</div>
          {Object.entries(platformGroups).map(([platform, vids]) => (
            <div key={platform}>
              <button
                onClick={() => togglePlatform(platform)}
                className="w-full text-left px-3 py-2 text-sm text-white/50 hover:text-white hover:bg-white/5 rounded-lg flex justify-between items-center transition-colors"
              >
                <span>{PLATFORM_LABEL[platform] ?? platform}</span>
                <span className="text-xs">{expandedPlatforms.has(platform) ? '▲' : '▼'}</span>
              </button>
              {expandedPlatforms.has(platform) && vids.map(v => (
                <button
                  key={v.url}
                  onClick={() => { onSelectPage('sentences'); onSelectVideo(v.url) }}
                  className={`w-full text-left px-4 py-1.5 text-xs rounded-lg flex justify-between items-center transition-colors ${
                    selectedVideoUrl === v.url
                      ? 'bg-white/10 text-white'
                      : 'text-white/40 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span className="truncate">{v.title ?? v.url.replace(/^https?:\/\//, '').slice(0, 32) + '…'}</span>
                  <span className="ml-1 shrink-0 text-white/30">{v.sentenceCount}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Account (hardcoded MVP) */}
      <div className="mt-auto px-4 py-4 border-t border-white/10 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold shrink-0">
          W
        </div>
        <div className="min-w-0">
          <div className="text-sm text-white truncate">Wei Chieh</div>
          <div className="text-xs text-white/40 truncate">kewos554321@gmail.com</div>
        </div>
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: Create `web/src/components/Layout.tsx`**

```tsx
import type { ReactNode } from 'react'
import Sidebar from './Sidebar'
import type { ApiSentence, ApiVideo, ApiWord } from '../types'

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

export default function Layout({ sentences, videos, words, page, selectedVideoUrl, onSelectPage, onSelectVideo, children }: Props) {
  return (
    <div className="flex h-screen overflow-hidden bg-black">
      <Sidebar
        sentences={sentences}
        videos={videos}
        words={words}
        page={page}
        selectedVideoUrl={selectedVideoUrl}
        onSelectPage={onSelectPage}
        onSelectVideo={onSelectVideo}
      />
      <main className="flex-1 overflow-y-auto p-6">
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/
git commit -m "feat(web): add Layout and Sidebar components"
```

---

### Task 4: Sentences page — list, filter chips, search, sentence cards

**Files:**
- Create: `web/src/components/SentenceCard.tsx`
- Create: `web/src/pages/SentencesPage.tsx`

- [ ] **Step 1: Create `web/src/components/SentenceCard.tsx`**

```tsx
import type { ApiSentence, WordStatus } from '../types'
import WordSpan from './WordSpan'

interface Props {
  sentence: ApiSentence
  wordMap: Map<string, WordStatus>
  onUpdateWordStatus: (word: string, status: WordStatus) => Promise<void>
}

const PLATFORM_BADGE: Record<string, string> = {
  netflix: 'Netflix',
  hbomax: 'HBO Max',
  youtube: 'YouTube',
}

function formatTime(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function getJumpUrl(url: string, platform: string, timestampS: number): string {
  try {
    const u = new URL(url)
    if (platform === 'netflix' || platform === 'youtube') {
      u.searchParams.set('t', String(timestampS))
    }
    return u.toString()
  } catch {
    return url
  }
}

// Split text into word and non-word tokens for coloring
function tokenize(text: string): Array<{ raw: string; isWord: boolean }> {
  return text.split(/([a-zA-Z]+)/).map(part => ({
    raw: part,
    isWord: /^[a-zA-Z]+$/.test(part),
  }))
}

export default function SentenceCard({ sentence, wordMap, onUpdateWordStatus }: Props) {
  const tokens = tokenize(sentence.text)

  const taggedWords = [
    ...new Set(
      tokens
        .filter(t => t.isWord && wordMap.has(t.raw.toLowerCase()))
        .map(t => t.raw.toLowerCase())
    ),
  ]

  return (
    <div className="bg-[#1C1C1E] rounded-xl p-4 border border-white/10">
      {/* Card header */}
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 text-xs text-white/40 min-w-0">
          <span className="bg-white/10 rounded px-2 py-0.5 shrink-0">
            {PLATFORM_BADGE[sentence.platform] ?? sentence.platform}
          </span>
          <span className="truncate">
            {sentence.videoTitle ?? sentence.videoUrl.replace(/^https?:\/\//, '').slice(0, 50)}
          </span>
        </div>
        <a
          href={getJumpUrl(sentence.videoUrl, sentence.platform, sentence.timestampS)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-400 hover:text-blue-300 shrink-0"
        >
          ▶ {formatTime(sentence.timestampS)} 跳回
        </a>
      </div>

      {/* English text with word-status coloring */}
      <p className="text-white text-base leading-relaxed mb-1">
        {tokens.map((t, i) =>
          t.isWord ? (
            <WordSpan
              key={i}
              word={t.raw}
              status={wordMap.get(t.raw.toLowerCase())}
              onUpdateWordStatus={onUpdateWordStatus}
            />
          ) : (
            <span key={i}>{t.raw}</span>
          )
        )}
      </p>

      {/* Chinese translation */}
      {sentence.translation && (
        <p className="text-white/50 text-sm mb-3">{sentence.translation}</p>
      )}

      {/* Tagged word chips */}
      {taggedWords.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {taggedWords.map(w => (
            <span
              key={w}
              className={`text-xs rounded px-2 py-0.5 ${
                wordMap.get(w) === 'learning'
                  ? 'bg-orange-500/20 text-orange-400'
                  : 'bg-green-500/20 text-green-400'
              }`}
            >
              {w}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
```

Note: `WordSpan` is created in Task 5. For now, create a minimal stub so TypeScript compiles:

```bash
mkdir -p web/src/components
cat > web/src/components/WordSpan.tsx << 'EOF'
import type { WordStatus } from '../types'
interface Props { word: string; status: WordStatus | undefined; onUpdateWordStatus: (w: string, s: WordStatus) => Promise<void> }
export default function WordSpan({ word }: Props) { return <span>{word}</span> }
EOF
```

- [ ] **Step 2: Create `web/src/pages/SentencesPage.tsx`**

```tsx
import { useState, useMemo } from 'react'
import SentenceCard from '../components/SentenceCard'
import type { ApiSentence, WordStatus } from '../types'

type Filter = 'all' | 'learning' | 'unmarked'

interface Props {
  sentences: ApiSentence[]
  wordMap: Map<string, WordStatus>
  selectedVideoUrl: string | null
  onUpdateWordStatus: (word: string, status: WordStatus) => Promise<void>
}

export default function SentencesPage({ sentences, wordMap, selectedVideoUrl, onUpdateWordStatus }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    let result = selectedVideoUrl !== null
      ? sentences.filter(s => s.videoUrl === selectedVideoUrl)
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
  }, [sentences, selectedVideoUrl, filter, search, wordMap])

  const FILTERS: [Filter, string][] = [['all', '全部'], ['learning', '有學習中'], ['unmarked', '未標記']]

  return (
    <div>
      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex gap-1">
          {FILTERS.map(([f, label]) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                filter === f
                  ? 'bg-white text-black font-medium'
                  : 'bg-white/10 text-white/60 hover:bg-white/15'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="搜尋句子…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-40 max-w-xs bg-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-white/30 outline-none focus:bg-white/15 transition-colors"
        />
      </div>

      {/* Sentence list */}
      {filtered.length === 0 ? (
        <div className="text-white/30 text-sm">沒有符合的句子</div>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map(s => (
            <SentenceCard
              key={s.id}
              sentence={s}
              wordMap={wordMap}
              onUpdateWordStatus={onUpdateWordStatus}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/SentenceCard.tsx web/src/components/WordSpan.tsx web/src/pages/SentencesPage.tsx
git commit -m "feat(web): add SentencesPage with filter chips, search, and sentence cards"
```

---

### Task 5: WordSpan + Tooltip — hover definition + status update

**Files:**
- Create: `web/src/hooks/useDefinition.ts`
- Replace: `web/src/components/WordSpan.tsx` (replaces the stub from Task 4)
- Create: `web/src/components/Tooltip.tsx`

- [ ] **Step 1: Create `web/src/hooks/useDefinition.ts`**

```typescript
import { useState, useEffect } from 'react'

interface DictionaryEntry {
  meanings: Array<{
    partOfSpeech: string
    definitions: Array<{ definition: string }>
  }>
}

export function useDefinition(word: string | null) {
  const [definition, setDefinition] = useState<string>('—')
  const [partOfSpeech, setPartOfSpeech] = useState<string>('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!word) return
    setLoading(true)
    setDefinition('—')
    setPartOfSpeech('')
    fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`)
      .then(r => (r.ok ? r.json() : null) as Promise<DictionaryEntry[] | null>)
      .then(data => {
        const meaning = data?.[0]?.meanings?.[0]
        setPartOfSpeech(meaning?.partOfSpeech ?? '')
        setDefinition(meaning?.definitions?.[0]?.definition ?? '—')
      })
      .catch(() => setDefinition('—'))
      .finally(() => setLoading(false))
  }, [word])

  return { definition, partOfSpeech, loading }
}
```

- [ ] **Step 2: Create `web/src/components/Tooltip.tsx`**

```tsx
import { useDefinition } from '../hooks/useDefinition'
import type { WordStatus } from '../types'

interface Props {
  word: string
  status: WordStatus | undefined
  onUpdateWordStatus: (word: string, status: WordStatus) => Promise<void>
  onClose: () => void
}

export default function Tooltip({ word, status, onUpdateWordStatus, onClose }: Props) {
  const { definition, partOfSpeech, loading } = useDefinition(word.toLowerCase())

  const handleMark = async (s: WordStatus) => {
    await onUpdateWordStatus(word.toLowerCase(), s)
    onClose()
  }

  return (
    <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-[#2C2C2E] border border-white/15 rounded-xl shadow-xl p-3">
      {/* Word + part of speech */}
      <div className="flex items-baseline gap-2 mb-1">
        <span className="font-semibold text-white">{word}</span>
        {partOfSpeech && <span className="text-xs text-white/40">{partOfSpeech}</span>}
      </div>

      {/* Current status */}
      {status && (
        <div
          className="text-xs mb-1"
          style={{ color: status === 'learning' ? '#F97316' : '#22C55E' }}
        >
          ● {status === 'learning' ? '學習中' : '已學習'}
        </div>
      )}

      {/* Definition */}
      <div className="text-xs text-white/60 mb-3 leading-relaxed">
        {loading ? '…' : definition}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => handleMark('learning')}
          className={`flex-1 text-xs py-1.5 rounded-lg transition-colors ${
            status === 'learning'
              ? 'bg-orange-500/30 text-orange-400'
              : 'bg-white/10 text-white/60 hover:bg-orange-500/20 hover:text-orange-400'
          }`}
        >
          📙 學習中
        </button>
        <button
          onClick={() => handleMark('learned')}
          className={`flex-1 text-xs py-1.5 rounded-lg transition-colors ${
            status === 'learned'
              ? 'bg-green-500/30 text-green-400'
              : 'bg-white/10 text-white/60 hover:bg-green-500/20 hover:text-green-400'
          }`}
        >
          ✅ 已學習
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Replace `web/src/components/WordSpan.tsx` with real implementation**

```tsx
import { useState, useRef, useCallback } from 'react'
import Tooltip from './Tooltip'
import type { WordStatus } from '../types'

interface Props {
  word: string
  status: WordStatus | undefined
  onUpdateWordStatus: (word: string, status: WordStatus) => Promise<void>
}

export default function WordSpan({ word, status, onUpdateWordStatus }: Props) {
  const [showTooltip, setShowTooltip] = useState(false)
  const enterTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMouseEnter = useCallback(() => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current)
    enterTimer.current = setTimeout(() => setShowTooltip(true), 100)
  }, [])

  const handleMouseLeave = useCallback(() => {
    if (enterTimer.current) clearTimeout(enterTimer.current)
    leaveTimer.current = setTimeout(() => setShowTooltip(false), 200)
  }, [])

  const colorClass =
    status === 'learning'
      ? 'text-orange-400 underline decoration-orange-400 underline-offset-2'
      : status === 'learned'
      ? 'text-green-400 underline decoration-green-400 underline-offset-2'
      : ''

  return (
    // The Tooltip is a child of this container, so mouseLeave does NOT fire
    // when the mouse moves from the word onto the tooltip — both are descendants.
    <span className="relative inline-block" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <span className={`cursor-pointer ${colorClass} hover:opacity-80`}>{word}</span>
      {showTooltip && (
        <Tooltip
          word={word}
          status={status}
          onUpdateWordStatus={onUpdateWordStatus}
          onClose={() => setShowTooltip(false)}
        />
      )}
    </span>
  )
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add web/src/hooks/ web/src/components/WordSpan.tsx web/src/components/Tooltip.tsx
git commit -m "feat(web): add WordSpan with hover tooltip, definition lookup, and status update"
```

---

### Task 6: Word book page

**Files:**
- Create: `web/src/pages/WordBookPage.tsx`

- [ ] **Step 1: Create `web/src/pages/WordBookPage.tsx`**

```tsx
import { useState } from 'react'
import { useDefinition } from '../hooks/useDefinition'
import type { ApiSentence, ApiWord, WordStatus } from '../types'

interface WordRowProps {
  word: ApiWord
  sentences: ApiSentence[]
}

function WordRow({ word, sentences }: WordRowProps) {
  const { definition, partOfSpeech } = useDefinition(word.word)
  const [expanded, setExpanded] = useState(false)

  const matchingSentences = sentences.filter(s =>
    new RegExp(`(?<![a-zA-Z])${word.word}(?![a-zA-Z])`, 'i').test(s.text)
  )

  return (
    <div className="bg-[#1C1C1E] rounded-xl p-4 border border-white/10">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-semibold text-white text-base">{word.word}</span>
            {partOfSpeech && (
              <span className="text-xs text-white/40">{partOfSpeech}</span>
            )}
            <span
              className={`text-xs rounded px-2 py-0.5 ${
                word.status === 'learning'
                  ? 'bg-orange-500/20 text-orange-400'
                  : 'bg-green-500/20 text-green-400'
              }`}
            >
              {word.status === 'learning' ? '學習中' : '已學習'}
            </span>
          </div>
          <div className="text-xs text-white/50 mt-1 leading-relaxed">{definition}</div>
        </div>

        {matchingSentences.length > 0 && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-xs text-white/40 hover:text-white/70 shrink-0 transition-colors"
          >
            {matchingSentences.length} 個句子 {expanded ? '▲' : '▼'}
          </button>
        )}
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-white/10 flex flex-col gap-2">
          {matchingSentences.map(s => (
            <p key={s.id} className="text-sm text-white/70 leading-relaxed">
              {s.text}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

interface Props {
  words: ApiWord[]
  sentences: ApiSentence[]
}

export default function WordBookPage({ words, sentences }: Props) {
  const markedWords = words.filter(w => w.status === 'learning' || w.status === 'learned')

  if (markedWords.length === 0) {
    return (
      <div className="text-white/30 text-sm">
        還沒有標記的單字。在句子頁面 hover 任何單字可標記學習狀態。
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-white font-semibold text-lg mb-4">
        單字本 ({markedWords.length})
      </h2>
      <div className="flex flex-col gap-3">
        {markedWords.map(w => (
          <WordRow key={w.word} word={w} sentences={sentences} />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/WordBookPage.tsx
git commit -m "feat(web): add WordBookPage with definition lookup and sentence count"
```

---

### Task 7: App.tsx — wire data loading + page navigation

**Files:**
- Replace: `web/src/App.tsx` (replace the placeholder from Task 1)

- [ ] **Step 1: Replace `web/src/App.tsx`**

```tsx
import { useState, useEffect } from 'react'
import Layout from './components/Layout'
import SentencesPage from './pages/SentencesPage'
import WordBookPage from './pages/WordBookPage'
import { fetchSentences, fetchVideos, fetchWords, patchWordStatus } from './api'
import type { ApiSentence, ApiVideo, ApiWord, WordStatus } from './types'

export default function App() {
  const [sentences, setSentences] = useState<ApiSentence[]>([])
  const [videos, setVideos] = useState<ApiVideo[]>([])
  const [words, setWords] = useState<ApiWord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [page, setPage] = useState<'sentences' | 'words'>('sentences')
  const [selectedVideoUrl, setSelectedVideoUrl] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([fetchSentences(), fetchVideos(), fetchWords()])
      .then(([s, v, w]) => {
        setSentences(s)
        setVideos(v)
        setWords(w)
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  const updateWordStatus = async (word: string, status: WordStatus) => {
    await patchWordStatus(word, status)
    setWords(prev =>
      prev.some(w => w.word === word)
        ? prev.map(w => (w.word === word ? { ...w, status } : w))
        : [...prev, { word, status }]
    )
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
        />
      ) : (
        <WordBookPage
          words={words}
          sentences={sentences}
        />
      )}
    </Layout>
  )
}
```

Note on `updateWordStatus`: if the word doesn't exist in the list yet (e.g., user marks an unmarked word from the tooltip), it's appended to the local state so it immediately appears in the word book.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run dev server and test end-to-end**

```bash
npm run dev -w web
```

Open `http://localhost:5173`. Verify:
- Page loads with 載入中… then shows layout
- Sidebar shows sentence count and learning word count
- Sidebar video groups are collapsible
- Sentences page shows sentence cards
- Words with learning/learned status show orange/green underlines
- Hovering a word shows tooltip after ~100ms with definition + buttons
- Clicking a status button updates word color immediately
- Clicking 📝 單字本 shows the word book
- Search and filter chips work

- [ ] **Step 4: Commit**

```bash
git add web/src/App.tsx
git commit -m "feat(web): wire App.tsx — data loading, page navigation, word status updates"
```

---

### Task 8: Build and deploy to Cloudflare Pages

**Files:**
- No file changes — build + deploy only

- [ ] **Step 1: Build the web app**

```bash
npm run build -w web
```

Expected: `web/dist/` created with `index.html` + hashed JS/CSS bundles. No TypeScript errors. Build summary shows file sizes.

- [ ] **Step 2: Deploy to Cloudflare Pages**

```bash
npx wrangler pages deploy web/dist --project-name duocue-web
```

On first run: creates the Pages project `duocue-web` in the same Cloudflare account as the Worker. On subsequent runs: creates a new deployment.

Expected output includes a URL like:
```
✨ Deployment complete! Take a peek over at https://duocue-web.pages.dev
```

- [ ] **Step 3: Verify the deployed app**

Open the Cloudflare Pages URL. Verify:
- Page loads (not blank, no console errors)
- Sentences from the DB appear
- Hover tooltip works on deployed URL (CORS is allowed — Worker has `cors()` middleware)
- Word status update persists (mark a word, reload, check it's still marked)
- Jump button opens the correct video URL in a new tab

- [ ] **Step 4: Commit the Pages URL**

```bash
git commit --allow-empty -m "chore: deploy web frontend to Cloudflare Pages (duocue-web.pages.dev)"
```

---

## Done

All 6 success criteria from the spec:

| Criterion | Task |
|-----------|------|
| Pages deploy succeeds, accessible via URL | Task 8 |
| All saved sentences shown, count matches DB | Task 7 |
| Sidebar video groups correct, filter works | Tasks 3, 7 |
| Marked words show orange/green underlines | Task 5 |
| Hover word → tooltip with English definition | Task 5 |
| Click tooltip button → word status updates immediately | Tasks 5, 7 |
| Click jump button → new tab opens video at timestamp | Task 4 |
| Search box → instant sentence filter | Task 4 |
