# Video Title Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users rename video titles inline from the SentencesPage filter bar.

**Architecture:** New `PATCH /videos` API endpoint updates the title in D1 by URL. In the web app, `SentencesPage` tracks a `localVideos` state copy so renames are reflected immediately without re-fetching. A `VideoTitleEditor` component handles the pencil-icon → inline-input toggle.

**Tech Stack:** Hono (Cloudflare Workers), D1 SQLite, React 19, TypeScript, Tailwind CSS v4, lucide-react

---

### Task 1: API — `PATCH /videos` endpoint

**Files:**
- Modify: `api/src/index.ts`

- [ ] **Step 1: Add the endpoint**

  Open `api/src/index.ts`. Add this block **before** `export default app` (after the existing `app.get('/videos', ...)` handler):

  ```ts
  app.patch('/videos', async (c) => {
    let body: { url?: string; title?: string }
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400)
    }

    const { url, title } = body
    if (!url || !title?.trim()) {
      return c.json({ error: 'url and title are required' }, 400)
    }

    const result = await c.env.DB.prepare(
      `UPDATE videos SET title = ? WHERE url = ?`
    ).bind(title.trim(), url).run()

    if (result.meta.changes === 0) {
      return c.json({ error: 'Video not found' }, 404)
    }

    return c.json({ url, title: title.trim() })
  })
  ```

- [ ] **Step 2: Start local API and verify with curl**

  In `api/` directory:
  ```bash
  npm run dev
  ```

  In another terminal — pick a real video URL from your local D1, then:
  ```bash
  # Validation: missing title → 400
  curl -s -X PATCH http://localhost:8787/videos \
    -H "Authorization: Bearer test" \
    -H "Content-Type: application/json" \
    -d '{"url":"https://example.com"}' | jq .
  # Expected: {"error":"url and title are required"}

  # Unknown URL → 404
  curl -s -X PATCH http://localhost:8787/videos \
    -H "Authorization: Bearer test" \
    -H "Content-Type: application/json" \
    -d '{"url":"https://nope.invalid","title":"Test"}' | jq .
  # Expected: {"error":"Video not found"}
  ```

  > Note: the local `API_KEY` is `test` when running `wrangler dev`. Replace the URL with one that actually exists in your local DB (`wrangler d1 execute duocue --local --command "SELECT url FROM videos LIMIT 1"`).

  ```bash
  # Success case
  curl -s -X PATCH http://localhost:8787/videos \
    -H "Authorization: Bearer test" \
    -H "Content-Type: application/json" \
    -d '{"url":"<real-url>","title":"My New Title"}' | jq .
  # Expected: {"url":"<real-url>","title":"My New Title"}
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add api/src/index.ts
  git commit -m "feat(api): add PATCH /videos endpoint for title rename"
  ```

---

### Task 2: Web API function — `patchVideoTitle`

**Files:**
- Modify: `web/src/api.ts`

- [ ] **Step 1: Add the function**

  In `web/src/api.ts`, add after the existing `patchWordStatus` function:

  ```ts
  export async function patchVideoTitle(url: string, title: string): Promise<void> {
    const res = await fetch(`${API_ENDPOINT}/videos`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ url, title }),
    })
    if (!res.ok) throw new Error(`PATCH /videos failed: ${res.status}`)
  }
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  In `web/` directory:
  ```bash
  npx tsc --noEmit
  ```
  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add web/src/api.ts
  git commit -m "feat(web/api): add patchVideoTitle function"
  ```

---

### Task 3: `VideoTitleEditor` component

**Files:**
- Create: `web/src/components/VideoTitleEditor.tsx`

- [ ] **Step 1: Create the component**

  Create `web/src/components/VideoTitleEditor.tsx`:

  ```tsx
  import { useState, useEffect, useRef } from 'react'
  import { Pencil } from 'lucide-react'

  interface Props {
    title: string | null
    onRename: (newTitle: string) => Promise<void>
  }

  export default function VideoTitleEditor({ title, onRename }: Props) {
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState(title ?? '')
    const [error, setError] = useState<string | null>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
      if (editing) inputRef.current?.focus()
    }, [editing])

    // Keep draft in sync if parent title changes (e.g. different video selected)
    useEffect(() => {
      if (!editing) setDraft(title ?? '')
    }, [title, editing])

    const startEdit = () => {
      setDraft(title ?? '')
      setError(null)
      setEditing(true)
    }

    const cancel = () => {
      setEditing(false)
      setError(null)
    }

    const save = async () => {
      const trimmed = draft.trim()
      if (!trimmed) return
      try {
        await onRename(trimmed)
        setEditing(false)
        setError(null)
      } catch {
        setError('更新失敗，請再試')
      }
    }

    if (!editing) {
      return (
        <button
          onClick={startEdit}
          className="flex items-center justify-center p-1 rounded-md transition-colors"
          style={{ color: 'var(--text-secondary)' }}
          title="改名"
          onMouseOver={e => (e.currentTarget.style.color = 'var(--text-primary)')}
          onMouseOut={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
        >
          <Pencil size={12} />
        </button>
      )
    }

    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <input
            ref={inputRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') save()
              if (e.key === 'Escape') cancel()
            }}
            className="px-2 py-0.5 rounded-md text-[12px] outline-none"
            style={{
              background: 'rgba(120,120,128,0.18)',
              color: 'var(--text-primary)',
              border: '1px solid rgba(0,122,255,0.5)',
              boxShadow: '0 0 0 2px rgba(0,122,255,0.12)',
              minWidth: '140px',
            }}
          />
          <button
            onClick={save}
            disabled={!draft.trim()}
            className="px-2 py-0.5 rounded-md text-[12px] font-medium"
            style={{
              background: 'rgba(0,122,255,0.15)',
              color: 'var(--ios-blue)',
              border: '1px solid rgba(0,122,255,0.3)',
              opacity: draft.trim() ? 1 : 0.4,
              cursor: draft.trim() ? 'pointer' : 'default',
            }}
          >
            儲存
          </button>
          <button
            onClick={cancel}
            className="px-2 py-0.5 rounded-md text-[12px]"
            style={{
              color: 'var(--text-secondary)',
              border: '1px solid rgba(120,120,128,0.2)',
              cursor: 'pointer',
            }}
          >
            取消
          </button>
        </div>
        {error && (
          <span className="text-[11px]" style={{ color: 'var(--ios-red, #ff3b30)' }}>
            {error}
          </span>
        )}
      </div>
    )
  }
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit
  ```
  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add web/src/components/VideoTitleEditor.tsx
  git commit -m "feat(web): add VideoTitleEditor component"
  ```

---

### Task 4: Wire `VideoTitleEditor` into `SentencesPage`

**Files:**
- Modify: `web/src/pages/SentencesPage.tsx`

- [ ] **Step 1: Add `localVideos` state and `handleRename`**

  In `web/src/pages/SentencesPage.tsx`, make the following changes:

  **At the top, add imports:**
  ```tsx
  import { useState, useMemo } from 'react'  // already present
  // add:
  import VideoTitleEditor from '../components/VideoTitleEditor'
  import { patchVideoTitle } from '../api'
  ```

  The full import line for `useState, useMemo` is already there. Just add the two new imports below the existing ones.

  **Inside the component function, after the existing `useState` declarations, add:**
  ```tsx
  const [localVideos, setLocalVideos] = useState<ApiVideo[]>(videos)
  ```

  **Replace the `platformGroups` memo** — change `videos` to `localVideos`:
  ```tsx
  const platformGroups = useMemo(
    () => localVideos.reduce<Record<string, ApiVideo[]>>((acc, v) => {
      if (!acc[v.platform]) acc[v.platform] = []
      if (!acc[v.platform].some(x => x.url === v.url))
        acc[v.platform].push(v)
      return acc
    }, {}),
    [localVideos]
  )
  ```

  **Add the rename handler** (after `selectPlatform`):
  ```tsx
  const handleRename = async (videoUrl: string, newTitle: string) => {
    setLocalVideos(prev =>
      prev.map(v => v.url === videoUrl ? { ...v, title: newTitle } : v)
    )
    try {
      await patchVideoTitle(videoUrl, newTitle)
    } catch {
      // revert optimistic update
      setLocalVideos(prev =>
        prev.map(v => v.url === videoUrl ? { ...v, title: videos.find(o => o.url === videoUrl)?.title ?? v.title } : v)
      )
    }
  }
  ```

- [ ] **Step 2: Add `VideoTitleEditor` next to the video dropdown**

  In the JSX, find the `<select>` block inside `{selectedPlatform !== null && (...)}`. The current structure is:

  ```tsx
  <>
    <div className="w-px h-4 shrink-0" style={{ background: 'var(--separator)' }} />
    <select ...>
      ...
    </select>
  </>
  ```

  Replace it with:

  ```tsx
  <>
    <div className="w-px h-4 shrink-0" style={{ background: 'var(--separator)' }} />
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
    {selectedVideoUrl && (
      <VideoTitleEditor
        title={localVideos.find(v => v.url === selectedVideoUrl)?.title ?? null}
        onRename={(newTitle) => handleRename(selectedVideoUrl, newTitle)}
      />
    )}
  </>
  ```

- [ ] **Step 3: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit
  ```
  Expected: no errors.

- [ ] **Step 4: Manual test in browser**

  Start the web app (pointing at the deployed API or local `wrangler dev`):
  ```bash
  npm run dev
  ```

  Test checklist:
  - [ ] Select a platform chip → video dropdown appears
  - [ ] Select a specific video → pencil icon `✏️` appears to the right of the dropdown
  - [ ] Click pencil → input appears pre-filled with current title, auto-focused
  - [ ] Press `Escape` → input disappears, no change
  - [ ] Click pencil again → type a new name → press `Enter` → title updates in dropdown immediately
  - [ ] Click pencil again → type a new name → click 儲存 → title updates
  - [ ] Clear the input → 儲存 button grays out and is disabled
  - [ ] Switch to a different video → pencil editor closes, resets to new video's title

- [ ] **Step 5: Commit**

  ```bash
  git add web/src/pages/SentencesPage.tsx
  git commit -m "feat(sentences): add inline video title rename via VideoTitleEditor"
  ```

---

### Task 5: Deploy

- [ ] **Step 1: Deploy API**

  In `api/`:
  ```bash
  npm run deploy
  ```

- [ ] **Step 2: Build and deploy web**

  In `web/`:
  ```bash
  npm run build
  ```
  Then deploy via Cloudflare Pages (push to main or use `wrangler pages deploy dist`).

- [ ] **Step 3: Smoke test on production**

  On `duocue-web.pages.dev`: select a video, rename it, reload the page, confirm the new name persists.
