# AI Sentence Analysis & Notes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an AI chat bottom-sheet for any saved sentence (with note generation + deletion), a new Notes page that lists all sentences with saved notes, and a Settings page where the user supplies their own Gemini API key.

**Architecture:** Cloudflare Workers API gains three new D1 tables/columns (`sentences.ai_note`, `sentences.ai_note_updated_at`, and a new `settings` key-value table), and seven new Hono routes (chat stream, summarize, save note, delete note, list notes, get settings, save settings) split into `api/src/notes.ts` and `api/src/settings.ts`. The React web app gains a portal-rendered bottom sheet (`SentenceAISheet`) owned by `App.tsx`, triggered from `SentenceCard`, a `NotesPage` that derives its list directly from the already-loaded `sentences` array, and a profile-style `SettingsPage` for entering the Gemini key.

**Tech Stack:** Hono (Cloudflare Workers) + D1 SQLite + `@google/genai` (Gemini, TypeScript SDK) for the API; React 19 + TypeScript + Tailwind v4 + `lucide-react` for the web app.

**Note on testing:** This codebase has no test framework installed (no Jest/Vitest, no `*.test.*` files exist in `api/` or `web/`). Adding one is out of scope for this feature. Verification steps below use `wrangler dev` + `curl` for the API and manual browser interaction for the UI, matching how the rest of the codebase is currently verified.

---

## Reference: Spec

Full design at `docs/superpowers/specs/2026-06-16-ai-sentence-analysis-notes-design.md` (amended 2026-06-16 to switch from Anthropic Claude to Google Gemini with a self-service Settings page — see the "superseded"/"added"/"changed 2026-06-16" annotations throughout that doc). Deliberate implementation decisions that refine the spec without contradicting it:

1. **NotesPage data source:** `NotesPage` derives its list by filtering the `sentences` array already held in `App.tsx` state, instead of calling `GET /notes` — avoids a second fetch and a second source of truth. `GET /notes` is still implemented per spec (Task 4) for other clients.
2. **Delete-note gesture in NotesPage:** uses a trash-icon button with inline confirm instead of a swipe gesture (spec allows either).
3. **Settings freshness:** `SentenceAISheet` fetches `GET /settings` itself every time it opens (`useEffect` keyed on `isOpen`), rather than `App.tsx` holding `hasGeminiKey` state and threading it down — this means the gating is always correct immediately after a Settings save, with no stale-state/refresh-callback plumbing needed.

---

## Task 1: Database schema migration

**Status:** ✅ Already complete (commit `9fef51a`, reviewed and approved). No action needed.

---

## Task 2: Settings table migration and Gemini SDK dependency

**Files:**
- Modify: `api/schema.sql`
- Modify: `api/package.json`

- [ ] **Step 1: Add the settings table migration**

Append to the end of `api/schema.sql`:

```sql
-- Migration: app settings (Gemini API key)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
```

- [ ] **Step 2: Apply to local D1 and verify**

```bash
cd api && npm run db:init:local
```
Expected: exits 0.

```bash
cd api && npx wrangler d1 execute duocue --local --command "SELECT name FROM sqlite_master WHERE type='table' AND name='settings';"
```
Expected: one row, `name: settings`.

- [ ] **Step 3: Apply to production D1**

The full `schema.sql` is not safely re-runnable against an already-migrated production database (no `IF NOT EXISTS` guards on the earlier `ALTER TABLE` lines) — this was confirmed during Task 1. Apply only the new statement directly:

```bash
cd api && npx wrangler d1 execute duocue --remote --command "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);"
```
Expected: success. Verify with the same `sqlite_master` query as Step 2 but without `--local`.

- [ ] **Step 4: Install the Gemini SDK**

```bash
cd api && npm install @google/genai
```
Expected: `api/package.json` `dependencies` gains `"@google/genai": "^<version>"`.

- [ ] **Step 5: Commit**

```bash
git add api/schema.sql api/package.json api/package-lock.json
git commit -m "feat(api): add settings table and @google/genai dependency"
```

---

## Task 3: Export Bindings type and extend GET /sentences

**Files:**
- Modify: `api/src/index.ts:4-7` (Bindings type), `api/src/index.ts:62-76` (GET /sentences query)

- [ ] **Step 1: Export Bindings**

In `api/src/index.ts`, change:

```ts
type Bindings = {
  DB: D1Database
  API_KEY: string
}
```

to:

```ts
export type Bindings = {
  DB: D1Database
  API_KEY: string
}
```

(No new env binding is needed — the Gemini key lives in D1, not in Workers env/secrets.)

- [ ] **Step 2: Include the note fields in GET /sentences**

In the same file, change the `query` template inside `app.get('/sentences', ...)`:

```ts
  const query = `
    SELECT s.id, s.text, s.translation,
           s.timestamp_s  AS timestampS,
           v.platform,    v.url   AS videoUrl,
           v.title        AS videoTitle,
           s.created_at   AS createdAt
    FROM sentences s
    JOIN videos v ON v.id = s.video_id
    ${where}
    ORDER BY s.created_at DESC
  `
```

to:

```ts
  const query = `
    SELECT s.id, s.text, s.translation,
           s.timestamp_s  AS timestampS,
           v.platform,    v.url   AS videoUrl,
           v.title        AS videoTitle,
           s.created_at   AS createdAt,
           s.ai_note      AS aiNote,
           s.ai_note_updated_at AS aiNoteUpdatedAt
    FROM sentences s
    JOIN videos v ON v.id = s.video_id
    ${where}
    ORDER BY s.created_at DESC
  `
```

- [ ] **Step 3: Verify**

```bash
cd api && npx wrangler dev --local &
sleep 2
curl -s -H "Authorization: Bearer test-key" http://127.0.0.1:8787/sentences | head -c 400
kill %1
```
Expected: JSON response where each sentence object includes `"aiNote":null` and `"aiNoteUpdatedAt":null` (assuming no notes saved yet).

- [ ] **Step 4: Commit**

```bash
git add api/src/index.ts
git commit -m "feat(api): expose ai_note fields on GET /sentences"
```

---

## Task 4: Note CRUD endpoints (save, delete, list)

**Files:**
- Create: `api/src/notes.ts`
- Modify: `api/src/index.ts` (mount the new routes)

- [ ] **Step 1: Create the notes router file**

Create `api/src/notes.ts`:

```ts
import { Hono } from 'hono'
import type { Bindings } from './index'

export function registerNoteRoutes(app: Hono<{ Bindings: Bindings }>) {
  app.post('/sentences/:id/note', async (c) => {
    const id = parseInt(c.req.param('id'))
    if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)

    let body: { note?: string }
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400)
    }
    if (!body.note || !body.note.trim()) {
      return c.json({ error: 'note is required' }, 400)
    }

    const updatedAt = Math.floor(Date.now() / 1000)
    const result = await c.env.DB.prepare(
      `UPDATE sentences SET ai_note = ?, ai_note_updated_at = ? WHERE id = ?`
    ).bind(body.note.trim(), updatedAt, id).run()

    if (result.meta.changes === 0) return c.json({ error: 'Sentence not found' }, 404)

    return c.json({ ok: true, aiNoteUpdatedAt: updatedAt })
  })

  app.delete('/sentences/:id/note', async (c) => {
    const id = parseInt(c.req.param('id'))
    if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)

    const result = await c.env.DB.prepare(
      `UPDATE sentences SET ai_note = NULL, ai_note_updated_at = NULL WHERE id = ?`
    ).bind(id).run()

    if (result.meta.changes === 0) return c.json({ error: 'Sentence not found' }, 404)

    return c.json({ ok: true })
  })

  app.get('/notes', async (c) => {
    const { results } = await c.env.DB.prepare(`
      SELECT s.id              AS sentenceId,
             s.text,
             s.translation,
             v.platform,
             v.title           AS videoTitle,
             v.url             AS videoUrl,
             s.timestamp_s     AS timestampS,
             s.ai_note         AS aiNote,
             s.ai_note_updated_at AS aiNoteUpdatedAt
      FROM sentences s
      JOIN videos v ON v.id = s.video_id
      WHERE s.ai_note IS NOT NULL
      ORDER BY s.ai_note_updated_at DESC
    `).all()
    return c.json({ notes: results })
  })
}
```

- [ ] **Step 2: Mount the routes in index.ts**

In `api/src/index.ts`, add the import near the top (after the `cors` import):

```ts
import { registerNoteRoutes } from './notes'
```

And just before `export default app`, add:

```ts
registerNoteRoutes(app)

export default app
```

- [ ] **Step 3: Verify with a real sentence id**

```bash
cd api && npx wrangler dev --local &
sleep 2
SID=$(curl -s -H "Authorization: Bearer test-key" http://127.0.0.1:8787/sentences | python3 -c "import json,sys;print(json.load(sys.stdin)['sentences'][0]['id'])")

curl -s -X POST -H "Authorization: Bearer test-key" -H "Content-Type: application/json" \
  -d '{"note":"• test note line"}' http://127.0.0.1:8787/sentences/$SID/note

curl -s -H "Authorization: Bearer test-key" http://127.0.0.1:8787/notes

curl -s -X DELETE -H "Authorization: Bearer test-key" http://127.0.0.1:8787/sentences/$SID/note

curl -s -H "Authorization: Bearer test-key" http://127.0.0.1:8787/notes
kill %1
```
Expected: POST returns `{"ok":true,"aiNoteUpdatedAt":<number>}`; first GET /notes shows one entry with `"sentenceId":<SID>`; DELETE returns `{"ok":true}`; second GET /notes returns `{"notes":[]}`.

If there are no sentences in the local DB yet, insert one first via `POST /sentences` (see existing route in `index.ts:22`) before running this verification.

- [ ] **Step 4: Commit**

```bash
git add api/src/notes.ts api/src/index.ts
git commit -m "feat(api): add note save/delete/list endpoints"
```

---

## Task 5: Settings endpoints (get/save Gemini key)

**Files:**
- Create: `api/src/settings.ts`
- Modify: `api/src/index.ts` (mount the new routes)

- [ ] **Step 1: Create the settings router file**

Create `api/src/settings.ts`:

```ts
import { Hono } from 'hono'
import type { Bindings } from './index'

export function registerSettingsRoutes(app: Hono<{ Bindings: Bindings }>) {
  app.get('/settings', async (c) => {
    const row = await c.env.DB.prepare(
      `SELECT value FROM settings WHERE key = 'gemini_api_key'`
    ).first<{ value: string }>()
    return c.json({ hasGeminiKey: !!row?.value })
  })

  app.post('/settings', async (c) => {
    let body: { geminiApiKey?: string }
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400)
    }
    if (!body.geminiApiKey || !body.geminiApiKey.trim()) {
      return c.json({ error: 'geminiApiKey is required' }, 400)
    }

    await c.env.DB.prepare(
      `INSERT INTO settings (key, value) VALUES ('gemini_api_key', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    ).bind(body.geminiApiKey.trim()).run()

    return c.json({ ok: true })
  })
}
```

- [ ] **Step 2: Mount the routes in index.ts**

In `api/src/index.ts`, add the import next to the notes import:

```ts
import { registerSettingsRoutes } from './settings'
```

And next to `registerNoteRoutes(app)`, before `export default app`:

```ts
registerNoteRoutes(app)
registerSettingsRoutes(app)

export default app
```

- [ ] **Step 3: Verify**

```bash
cd api && npx wrangler dev --local &
sleep 2
curl -s -H "Authorization: Bearer test-key" http://127.0.0.1:8787/settings

curl -s -X POST -H "Authorization: Bearer test-key" -H "Content-Type: application/json" \
  -d '{"geminiApiKey":"fake-key-for-testing"}' http://127.0.0.1:8787/settings

curl -s -H "Authorization: Bearer test-key" http://127.0.0.1:8787/settings
kill %1
```
Expected: first GET returns `{"hasGeminiKey":false}`; POST returns `{"ok":true}`; second GET returns `{"hasGeminiKey":true}`.

- [ ] **Step 4: Commit**

```bash
git add api/src/settings.ts api/src/index.ts
git commit -m "feat(api): add settings endpoints for Gemini API key"
```

---

## Task 6: AI chat streaming and note summarization endpoints (Gemini)

**Files:**
- Modify: `api/src/notes.ts`

- [ ] **Step 1: Add the two AI-calling routes**

In `api/src/notes.ts`, add the import at the top:

```ts
import { GoogleGenAI } from '@google/genai'
```

And add these routes inside `registerNoteRoutes`, above the `app.post('/sentences/:id/note', ...)` route:

```ts
  type ChatMessage = { role: 'user' | 'assistant'; content: string }

  async function loadSentence(c: { env: { DB: D1Database } }, id: number) {
    return c.env.DB.prepare(
      `SELECT text, translation FROM sentences WHERE id = ?`
    ).bind(id).first<{ text: string; translation: string | null }>()
  }

  async function loadGeminiKey(c: { env: { DB: D1Database } }): Promise<string | null> {
    const row = await c.env.DB.prepare(
      `SELECT value FROM settings WHERE key = 'gemini_api_key'`
    ).first<{ value: string }>()
    return row?.value ?? null
  }

  function toGeminiContents(messages: ChatMessage[]) {
    return messages.map(m => ({
      role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
      parts: [{ text: m.content }],
    }))
  }

  app.post('/sentences/:id/ai-chat', async (c) => {
    const id = parseInt(c.req.param('id'))
    if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)

    let body: { messages?: ChatMessage[] }
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400)
    }
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return c.json({ error: 'messages is required' }, 400)
    }

    const sentence = await loadSentence(c, id)
    if (!sentence) return c.json({ error: 'Sentence not found' }, 404)

    const geminiKey = await loadGeminiKey(c)
    if (!geminiKey) return c.json({ error: 'GEMINI_KEY_MISSING' }, 400)

    const ai = new GoogleGenAI({ apiKey: geminiKey })
    const messages = body.messages
    const systemInstruction = `你是一位專業的英語學習助理，精通英語語意、語用與語境差異。\n使用者正在學習以下英語句子，請針對問題給予精簡、有用的分析（以繁體中文回答）。\n\n句子：${sentence.text}\n中文翻譯：${sentence.translation ?? ''}`

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        try {
          const geminiStream = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: toGeminiContents(messages),
            config: { systemInstruction },
          })
          for await (const chunk of geminiStream) {
            if (chunk.text) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: chunk.text })}\n\n`))
            }
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`))
        } catch (err) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: String(err) })}\n\n`))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  })

  app.post('/sentences/:id/note/summarize', async (c) => {
    const id = parseInt(c.req.param('id'))
    if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)

    let body: { messages?: ChatMessage[] }
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400)
    }
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return c.json({ error: 'messages is required' }, 400)
    }

    const sentence = await loadSentence(c, id)
    if (!sentence) return c.json({ error: 'Sentence not found' }, 404)

    const geminiKey = await loadGeminiKey(c)
    if (!geminiKey) return c.json({ error: 'GEMINI_KEY_MISSING' }, 400)

    const ai = new GoogleGenAI({ apiKey: geminiKey })
    const conversation = body.messages
      .map(m => `${m.role === 'user' ? '使用者' : 'AI'}：${m.content}`)
      .join('\n')

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `對話紀錄：\n${conversation}`,
      config: {
        systemInstruction: `你是一位英語學習助理。根據以下對話，為學習者整理一份簡潔的學習筆記，以條列格式（bullet points）呈現，每條控制在30字以內，聚焦在這個句子的語意、用法差異、語境與記憶技巧。不要重複問題，直接給學習重點。\n\n句子：${sentence.text}\n中文翻譯：${sentence.translation ?? ''}`,
      },
    })

    return c.json({ draft: response.text ?? '' })
  })
```

- [ ] **Step 2: Verify the missing-key gate**

This environment has no real Gemini key configured server-side (the key is meant to be entered by the end user through the Settings page, not provisioned by the developer) — so verification here only exercises the `GEMINI_KEY_MISSING` gate, which is fully testable without a real key:

```bash
cd api && npx wrangler dev --local &
sleep 2
SID=$(curl -s -H "Authorization: Bearer test-key" http://127.0.0.1:8787/sentences | python3 -c "import json,sys;print(json.load(sys.stdin)['sentences'][0]['id'])")

curl -s -X POST -H "Authorization: Bearer test-key" -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"這個片語怎麼用？"}]}' \
  http://127.0.0.1:8787/sentences/$SID/ai-chat

curl -s -X POST -H "Authorization: Bearer test-key" -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"這個片語怎麼用？"}]}' \
  http://127.0.0.1:8787/sentences/$SID/note/summarize
kill %1
```
Expected: both return `{"error":"GEMINI_KEY_MISSING"}` with status 400, since no key has been saved via `/settings` yet in this fresh local DB.

If you want to verify the success path end-to-end, first `POST /settings` with a real Gemini key (get one free at https://aistudio.google.com/apikey), then re-run the two calls above — expect the first to stream `data: {"delta":"..."}` lines ending in `data: {"done":true}`, and the second to return `{"draft":"• ..."}`. This is optional and not required to proceed with the plan.

- [ ] **Step 3: Commit**

```bash
git add api/src/notes.ts
git commit -m "feat(api): add AI chat streaming and note summarization endpoints via Gemini"
```

---

## Task 7: Frontend types

**Files:**
- Modify: `web/src/types.ts`

- [ ] **Step 1: Extend ApiSentence, add ChatMessage and ApiSettings**

In `web/src/types.ts`, change:

```ts
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
```

to:

```ts
export interface ApiSentence {
  id: number
  text: string
  translation: string | null
  timestampS: number
  platform: string
  videoUrl: string
  videoTitle: string | null
  createdAt: string
  aiNote: string | null
  aiNoteUpdatedAt: number | null
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ApiSettings {
  hasGeminiKey: boolean
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd web && npx tsc -b --noEmit
```
Expected: no errors about `types.ts` itself. Sentences only come from `fetchSentences()` in this codebase today, so there are no object literals elsewhere that need the two new `ApiSentence` fields — this step should produce zero new errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/types.ts
git commit -m "feat(web): add aiNote, ChatMessage, and ApiSettings types"
```

---

## Task 8: Frontend API layer

**Files:**
- Modify: `web/src/api.ts`

- [ ] **Step 1: Add the new API functions**

In `web/src/api.ts`, change the import line:

```ts
import type { ApiSentence, ApiVideo, ApiWord, WordStatus, PracticeWord, PracticeStats } from './types'
```

to:

```ts
import type { ApiSentence, ApiVideo, ApiWord, WordStatus, PracticeWord, PracticeStats, ChatMessage, ApiSettings } from './types'
```

Then append these functions to the end of the file:

```ts
export async function streamAiChat(
  sentenceId: number,
  messages: ChatMessage[],
  onDelta: (text: string) => void,
): Promise<void> {
  const res = await fetch(`${API_ENDPOINT}/sentences/${sentenceId}/ai-chat`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ messages }),
  })
  if (!res.ok || !res.body) throw new Error(`POST /sentences/${sentenceId}/ai-chat failed: ${res.status}`)

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const chunks = buffer.split('\n\n')
    buffer = chunks.pop() ?? ''
    for (const chunk of chunks) {
      if (!chunk.startsWith('data: ')) continue
      const payload = JSON.parse(chunk.slice(6)) as { delta?: string; done?: boolean; error?: string }
      if (payload.error) throw new Error(payload.error)
      if (payload.delta) onDelta(payload.delta)
    }
  }
}

export async function postNoteSummarize(sentenceId: number, messages: ChatMessage[]): Promise<string> {
  const res = await fetch(`${API_ENDPOINT}/sentences/${sentenceId}/note/summarize`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ messages }),
  })
  if (!res.ok) throw new Error(`POST /sentences/${sentenceId}/note/summarize failed: ${res.status}`)
  const { draft } = await res.json()
  return draft as string
}

export async function saveNote(sentenceId: number, note: string): Promise<number> {
  const res = await fetch(`${API_ENDPOINT}/sentences/${sentenceId}/note`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ note }),
  })
  if (!res.ok) throw new Error(`POST /sentences/${sentenceId}/note failed: ${res.status}`)
  const { aiNoteUpdatedAt } = await res.json()
  return aiNoteUpdatedAt as number
}

export async function deleteNote(sentenceId: number): Promise<void> {
  const res = await fetch(`${API_ENDPOINT}/sentences/${sentenceId}/note`, {
    method: 'DELETE',
    headers: authHeaders,
  })
  if (!res.ok) throw new Error(`DELETE /sentences/${sentenceId}/note failed: ${res.status}`)
}

export async function getSettings(): Promise<ApiSettings> {
  const res = await fetch(`${API_ENDPOINT}/settings`, { headers: authHeaders })
  if (!res.ok) throw new Error(`GET /settings failed: ${res.status}`)
  return res.json()
}

export async function saveGeminiKey(geminiApiKey: string): Promise<void> {
  const res = await fetch(`${API_ENDPOINT}/settings`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ geminiApiKey }),
  })
  if (!res.ok) throw new Error(`POST /settings failed: ${res.status}`)
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd web && npx tsc -b --noEmit
```
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/api.ts
git commit -m "feat(web): add API client functions for AI chat, notes, and settings"
```

---

## Task 9: Add the purple design token

**Files:**
- Modify: `web/src/index.css`

- [ ] **Step 1: Add --ios-purple to both themes**

In `web/src/index.css`, in the `:root` block, after the `--ios-red: #FF3B30;` line, add:

```css
  --ios-purple: #AF52DE;
```

In the `.dark` block, after the `--ios-red: #FF453A;` line, add:

```css
  --ios-purple: #BF5AF2;
```

These are Apple HIG's standard light/dark purple values, matching the pattern already used for blue/orange/green/red in this file.

- [ ] **Step 2: Verify**

```bash
cd web && npm run dev
```
Open the app in a browser, open devtools, and run `getComputedStyle(document.body).getPropertyValue('--ios-purple')` in the console — expect `#AF52DE` (light mode) or `#BF5AF2` (dark mode, if `.dark` class is on `<html>`).

- [ ] **Step 3: Commit**

```bash
git add web/src/index.css
git commit -m "feat(web): add ios-purple design token"
```

---

## Task 10: Ask AI button + note badge on SentenceCard

**Files:**
- Modify: `web/src/components/SentenceCard.tsx`

- [ ] **Step 1: Export the platform maps and add the Sparkles icon import**

In `web/src/components/SentenceCard.tsx`, change:

```ts
import { ExternalLink, X } from 'lucide-react'
```

to:

```ts
import { ExternalLink, X, Sparkles } from 'lucide-react'
```

And change:

```ts
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

to:

```ts
export const PLATFORM_COLOR: Record<string, string> = {
  netflix: '#E50914',
  hbomax: '#5822B4',
  youtube: '#FF0000',
}

export const PLATFORM_LABEL: Record<string, string> = {
  netflix: 'Netflix',
  hbomax: 'HBO Max',
  youtube: 'YouTube',
}
```

- [ ] **Step 2: Add the onOpenAI prop**

Change:

```ts
interface Props {
  sentence: ApiSentence
  wordMap: Map<string, WordStatus>
  onUpdateWordStatus: (word: string, status: WordStatus) => Promise<void>
  onRemoveWordStatus: (word: string) => Promise<void>
  onDelete: (id: number) => Promise<void>
  relativeTime?: string
}
```

to:

```ts
interface Props {
  sentence: ApiSentence
  wordMap: Map<string, WordStatus>
  onUpdateWordStatus: (word: string, status: WordStatus) => Promise<void>
  onRemoveWordStatus: (word: string) => Promise<void>
  onDelete: (id: number) => Promise<void>
  onOpenAI: (sentence: ApiSentence) => void
  relativeTime?: string
}
```

And change the function signature:

```ts
export default function SentenceCard({ sentence, wordMap, onUpdateWordStatus, onRemoveWordStatus, onDelete, relativeTime }: Props) {
```

to:

```ts
export default function SentenceCard({ sentence, wordMap, onUpdateWordStatus, onRemoveWordStatus, onDelete, onOpenAI, relativeTime }: Props) {
```

- [ ] **Step 3: Add the button/badge row**

Find the closing of the tagged-words block (the `{taggedWords.length > 0 && (...)}` block, immediately followed by the two closing `</div>` tags that end the "Content" div and the card div). Change:

```tsx
        {taggedWords.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {taggedWords.map(w => (
              <span
                key={w}
                className="text-[11px] rounded-full px-2 py-0.5"
                style={{
                  background: wordMap.get(w) === 'learning'
                    ? 'rgba(255,149,0,0.12)'
                    : 'rgba(52,199,89,0.12)',
                  color: wordMap.get(w) === 'learning'
                    ? 'var(--ios-orange)'
                    : 'var(--ios-green)',
                }}
              >
                {w}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

to:

```tsx
        {taggedWords.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {taggedWords.map(w => (
              <span
                key={w}
                className="text-[11px] rounded-full px-2 py-0.5"
                style={{
                  background: wordMap.get(w) === 'learning'
                    ? 'rgba(255,149,0,0.12)'
                    : 'rgba(52,199,89,0.12)',
                  color: wordMap.get(w) === 'learning'
                    ? 'var(--ios-orange)'
                    : 'var(--ios-green)',
                }}
              >
                {w}
              </span>
            ))}
          </div>
        )}

        <div className="flex justify-end mt-2.5">
          <button
            onClick={() => onOpenAI(sentence)}
            className="flex items-center gap-1 text-[11px] rounded-full px-2.5 py-1 transition-opacity hover:opacity-70"
            style={
              sentence.aiNote
                ? { background: 'rgba(191,90,242,0.12)', color: 'var(--ios-purple)' }
                : { background: 'rgba(120,120,128,0.1)', color: 'var(--text-secondary)' }
            }
          >
            <Sparkles size={11} strokeWidth={2} />
            {sentence.aiNote ? '筆記 ✓' : 'Ask AI'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify it compiles**

```bash
cd web && npx tsc -b --noEmit
```
Expected: new errors pointing at `RecentSentencesTab.tsx` and `AllSentencesTab.tsx` because they don't pass `onOpenAI` yet — that's expected and fixed in Task 13. Confirm there are no errors inside `SentenceCard.tsx` itself.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/SentenceCard.tsx
git commit -m "feat(web): add Ask AI button and note badge to SentenceCard"
```

---

## Task 11: SentenceAISheet component (with Gemini-key gating)

**Files:**
- Create: `web/src/components/SentenceAISheet.tsx`

- [ ] **Step 1: Create the component**

Create `web/src/components/SentenceAISheet.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Send, KeyRound } from 'lucide-react'
import { streamAiChat, postNoteSummarize, saveNote, deleteNote, getSettings } from '../api'
import { PLATFORM_COLOR } from './SentenceCard'
import type { ApiSentence, ChatMessage } from '../types'

const SUGGESTED_PROMPTS = ['這個片語怎麼用？', '和哪些詞容易搞混？', '舉幾個例句']

interface Props {
  sentence: ApiSentence | null
  isOpen: boolean
  onClose: () => void
  onNoteSaved: (id: number, note: string, updatedAt: number) => void
  onNoteDeleted: (id: number) => void
}

export default function SentenceAISheet({ sentence, isOpen, onClose, onNoteSaved, onNoteDeleted }: Props) {
  const navigate = useNavigate()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [noteDraft, setNoteDraft] = useState<string | null>(null)
  const [generatingNote, setGeneratingNote] = useState(false)
  const [savedNote, setSavedNote] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [hasGeminiKey, setHasGeminiKey] = useState<boolean | null>(null)

  useEffect(() => {
    setMessages([])
    setInput('')
    setStreaming(false)
    setNoteDraft(null)
    setShowDeleteConfirm(false)
    setSavedNote(sentence?.aiNote ?? null)
  }, [sentence?.id])

  useEffect(() => {
    if (!isOpen) return
    setHasGeminiKey(null)
    getSettings().then(s => setHasGeminiKey(s.hasGeminiKey))
  }, [isOpen])

  if (!sentence) return null

  const platformColor = PLATFORM_COLOR[sentence.platform] ?? '#888'
  const hasAiReply = messages.some(m => m.role === 'assistant' && m.content.trim().length > 0)

  const handleGoToSettings = () => {
    onClose()
    navigate('/settings')
  }

  const handleSend = async () => {
    if (!input.trim() || streaming) return
    const userMsg: ChatMessage = { role: 'user', content: input.trim() }
    const priorMessages = messages
    setMessages([...priorMessages, userMsg, { role: 'assistant', content: '' }])
    setInput('')
    setStreaming(true)
    try {
      await streamAiChat(sentence.id, [...priorMessages, userMsg], (delta) => {
        setMessages(prev => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          updated[updated.length - 1] = { ...last, content: last.content + delta }
          return updated
        })
      })
    } catch {
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', content: '（發生錯誤，請再試一次）' }
        return updated
      })
    } finally {
      setStreaming(false)
    }
  }

  const handleGenerateNote = async () => {
    setGeneratingNote(true)
    try {
      const draft = await postNoteSummarize(sentence.id, messages)
      setNoteDraft(draft)
    } finally {
      setGeneratingNote(false)
    }
  }

  const handleSaveNote = async () => {
    if (noteDraft === null) return
    const updatedAt = await saveNote(sentence.id, noteDraft)
    setSavedNote(noteDraft)
    setNoteDraft(null)
    onNoteSaved(sentence.id, noteDraft, updatedAt)
    setJustSaved(true)
    setTimeout(() => setJustSaved(false), 2000)
  }

  const handleDeleteNote = async () => {
    await deleteNote(sentence.id)
    setSavedNote(null)
    setShowDeleteConfirm(false)
    onNoteDeleted(sentence.id)
  }

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-40"
        style={{
          background: 'rgba(0,0,0,0.5)',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 320ms cubic-bezier(0.32, 0.72, 0, 1)',
        }}
        onClick={onClose}
      />
      <div
        className="fixed left-0 right-0 bottom-0 z-50 flex flex-col mx-auto"
        style={{
          maxWidth: 640,
          height: '92vh',
          background: 'var(--bg-card)',
          borderRadius: '20px 20px 0 0',
          transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 320ms cubic-bezier(0.32, 0.72, 0, 1)',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.2)',
        }}
      >
        <div className="flex justify-center pt-2.5 pb-1.5 shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(120,120,128,0.3)' }} />
        </div>

        <div className="px-4 pb-3 shrink-0" style={{ borderBottom: '1px solid var(--separator)' }}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: platformColor }} />
            <span className="text-[11px] truncate" style={{ color: 'var(--text-secondary)' }}>
              {sentence.videoTitle ?? sentence.videoUrl}
            </span>
          </div>
          <p className="text-[15px] leading-snug" style={{ color: 'var(--text-primary)' }}>
            {sentence.text}
          </p>
        </div>

        {hasGeminiKey === false ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'rgba(191,90,242,0.12)' }}>
              <KeyRound size={22} style={{ color: 'var(--ios-purple)' }} />
            </div>
            <p className="text-[14px] leading-relaxed" style={{ color: 'var(--text-primary)' }}>
              請先設定 Gemini API Key 才能使用 AI 解析
            </p>
            <button
              onClick={handleGoToSettings}
              className="rounded-xl px-4 py-2 text-[13px] font-medium"
              style={{ background: 'var(--ios-blue)', color: '#fff' }}
            >
              前往設定
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
              {messages.length === 0 && (
                <div className="flex gap-2 flex-wrap">
                  {SUGGESTED_PROMPTS.map(p => (
                    <button
                      key={p}
                      onClick={() => setInput(p)}
                      className="px-3 py-1.5 rounded-full text-[12px]"
                      style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}

              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className="max-w-[85%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed whitespace-pre-line"
                    style={{
                      background: m.role === 'user' ? 'var(--ios-blue)' : 'var(--bg-subtle)',
                      color: m.role === 'user' ? '#fff' : 'var(--text-primary)',
                    }}
                  >
                    {m.content || (streaming && i === messages.length - 1 ? '…' : '')}
                  </div>
                </div>
              ))}

              {hasAiReply && noteDraft === null && savedNote === null && (
                <button
                  onClick={handleGenerateNote}
                  disabled={generatingNote}
                  className="rounded-xl py-2.5 text-[14px] font-medium mt-1"
                  style={{ background: 'var(--ios-purple)', color: '#fff', opacity: generatingNote ? 0.6 : 1 }}
                >
                  {generatingNote ? '整理中…' : '整理成筆記'}
                </button>
              )}

              {hasAiReply && savedNote !== null && noteDraft === null && (
                <button
                  onClick={handleGenerateNote}
                  disabled={generatingNote}
                  className="rounded-xl py-2 text-[13px]"
                  style={{ background: 'var(--bg-subtle)', color: 'var(--ios-purple)' }}
                >
                  {generatingNote ? '整理中…' : '重新整理筆記'}
                </button>
              )}

              {noteDraft !== null && (
                <div className="rounded-xl p-3" style={{ background: 'var(--bg-subtle)' }}>
                  <div className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--ios-purple)' }}>
                    筆記草稿
                  </div>
                  <textarea
                    value={noteDraft}
                    onChange={e => setNoteDraft(e.target.value)}
                    rows={5}
                    className="w-full bg-transparent outline-none text-[13px] leading-relaxed resize-none"
                    style={{ color: 'var(--text-primary)' }}
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={handleSaveNote}
                      className="flex-1 rounded-lg py-2 text-[13px] font-medium"
                      style={{ background: 'var(--ios-blue)', color: '#fff' }}
                    >
                      儲存筆記
                    </button>
                    <button
                      onClick={() => setNoteDraft(null)}
                      className="flex-1 rounded-lg py-2 text-[13px]"
                      style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}

              {justSaved && (
                <div className="text-center text-[12px]" style={{ color: 'var(--ios-green)' }}>
                  筆記已儲存 ✓
                </div>
              )}

              {savedNote !== null && noteDraft === null && (
                <div className="text-center">
                  {!showDeleteConfirm ? (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="text-[12px] mt-1"
                      style={{ color: 'var(--ios-red)' }}
                    >
                      刪除筆記
                    </button>
                  ) : (
                    <div className="flex items-center justify-center gap-3 mt-1">
                      <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                        確定要刪除這則筆記嗎？
                      </span>
                      <button onClick={handleDeleteNote} className="text-[12px] font-medium" style={{ color: 'var(--ios-red)' }}>
                        刪除
                      </button>
                      <button onClick={() => setShowDeleteConfirm(false)} className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                        取消
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 px-3 py-2.5 shrink-0" style={{ borderTop: '1px solid var(--separator)' }}>
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder="問 AI 關於這個句子…"
                disabled={streaming}
                className="flex-1 rounded-full px-4 py-2 text-[14px] outline-none"
                style={{ background: 'var(--bg-subtle)', color: 'var(--text-primary)' }}
              />
              <button
                onClick={handleSend}
                disabled={streaming || !input.trim()}
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                style={{ background: 'var(--ios-blue)', opacity: streaming || !input.trim() ? 0.4 : 1 }}
              >
                <Send size={15} color="#fff" />
              </button>
            </div>
          </>
        )}
      </div>
    </>,
    document.body
  )
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd web && npx tsc -b --noEmit
```
Expected: no errors in `SentenceAISheet.tsx` (App.tsx isn't wired up yet, so this file isn't imported anywhere yet — `tsc` still type-checks it as part of the project). Note `useNavigate` requires this component to be rendered inside a `react-router-dom` `<Router>` tree — it already is, once wired into `App.tsx` in Task 14, since `App.tsx` itself renders inside the app's router.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/SentenceAISheet.tsx
git commit -m "feat(web): add SentenceAISheet bottom sheet component with key gating"
```

---

## Task 12: SettingsPage (profile-style)

**Files:**
- Create: `web/src/pages/SettingsPage.tsx`

- [ ] **Step 1: Create the page**

Create `web/src/pages/SettingsPage.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { Key, Eye, EyeOff, Check } from 'lucide-react'
import { getSettings, saveGeminiKey } from '../api'

export default function SettingsPage() {
  const [hasGeminiKey, setHasGeminiKey] = useState(false)
  const [loading, setLoading] = useState(true)
  const [keyInput, setKeyInput] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)

  useEffect(() => {
    getSettings().then(s => {
      setHasGeminiKey(s.hasGeminiKey)
      setLoading(false)
    })
  }, [])

  const handleSave = async () => {
    if (!keyInput.trim()) return
    setSaving(true)
    try {
      await saveGeminiKey(keyInput.trim())
      setKeyInput('')
      setHasGeminiKey(true)
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="flex flex-col items-center gap-3 mb-8 mt-4">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(191,90,242,0.12)' }}
        >
          <Key size={26} style={{ color: 'var(--ios-purple)' }} />
        </div>
        <div className="text-center">
          <h1 className="text-[18px] font-bold" style={{ color: 'var(--text-primary)' }}>設定</h1>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>管理你的 AI 設定</p>
        </div>
      </div>

      <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)' }}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>Gemini API Key</span>
          {!loading && (
            <span
              className="flex items-center gap-1.5 text-[12px]"
              style={{ color: hasGeminiKey ? 'var(--ios-green)' : 'var(--text-secondary)' }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: hasGeminiKey ? 'var(--ios-green)' : 'var(--text-secondary)' }}
              />
              {hasGeminiKey ? '已設定' : '尚未設定'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 rounded-xl px-3" style={{ background: 'var(--bg-subtle)' }}>
          <input
            type={showKey ? 'text' : 'password'}
            value={keyInput}
            onChange={e => setKeyInput(e.target.value)}
            placeholder={hasGeminiKey ? '輸入新的 key 以覆蓋' : '貼上你的 Gemini API key'}
            className="flex-1 bg-transparent outline-none py-2.5 text-[14px]"
            style={{ color: 'var(--text-primary)' }}
          />
          <button onClick={() => setShowKey(s => !s)} style={{ color: 'var(--text-secondary)' }} aria-label="顯示/隱藏 key">
            {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>

        <p className="text-[11px] mt-2 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          前往{' '}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noreferrer"
            style={{ color: 'var(--ios-blue)' }}
          >
            Google AI Studio
          </a>
          {' '}建立你的免費 API key。
        </p>

        <button
          onClick={handleSave}
          disabled={!keyInput.trim() || saving}
          className="w-full mt-3 rounded-xl py-2.5 text-[14px] font-medium flex items-center justify-center gap-1.5"
          style={{ background: 'var(--ios-blue)', color: '#fff', opacity: !keyInput.trim() || saving ? 0.5 : 1 }}
        >
          {justSaved ? (
            <>
              <Check size={15} /> 已儲存
            </>
          ) : saving ? (
            '儲存中…'
          ) : (
            '儲存'
          )}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd web && npx tsc -b --noEmit
```
Expected: no errors in `SettingsPage.tsx` itself (it isn't routed yet — fixed in Task 14).

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/SettingsPage.tsx
git commit -m "feat(web): add profile-style SettingsPage for Gemini API key"
```

---

## Task 13: Wire onOpenAI through the sentence tabs

**Files:**
- Modify: `web/src/components/RecentSentencesTab.tsx`
- Modify: `web/src/components/AllSentencesTab.tsx`
- Modify: `web/src/pages/SentencesPage.tsx`

- [ ] **Step 1: RecentSentencesTab**

In `web/src/components/RecentSentencesTab.tsx`, change:

```ts
interface Props {
  sentences: ApiSentence[]
  wordMap: Map<string, WordStatus>
  onUpdateWordStatus: (word: string, status: WordStatus) => Promise<void>
  onRemoveWordStatus: (word: string) => Promise<void>
  onDeleteSentence: (id: number) => Promise<void>
}

export default function RecentSentencesTab({ sentences, wordMap, onUpdateWordStatus, onRemoveWordStatus, onDeleteSentence }: Props) {
```

to:

```ts
interface Props {
  sentences: ApiSentence[]
  wordMap: Map<string, WordStatus>
  onUpdateWordStatus: (word: string, status: WordStatus) => Promise<void>
  onRemoveWordStatus: (word: string) => Promise<void>
  onDeleteSentence: (id: number) => Promise<void>
  onOpenAI: (sentence: ApiSentence) => void
}

export default function RecentSentencesTab({ sentences, wordMap, onUpdateWordStatus, onRemoveWordStatus, onDeleteSentence, onOpenAI }: Props) {
```

And change the `<SentenceCard ... />` usage:

```tsx
        <SentenceCard
          key={s.id}
          sentence={s}
          wordMap={wordMap}
          onUpdateWordStatus={onUpdateWordStatus}
          onRemoveWordStatus={onRemoveWordStatus}
          onDelete={onDeleteSentence}
          relativeTime={formatRelativeTime(s.createdAt)}
        />
```

to:

```tsx
        <SentenceCard
          key={s.id}
          sentence={s}
          wordMap={wordMap}
          onUpdateWordStatus={onUpdateWordStatus}
          onRemoveWordStatus={onRemoveWordStatus}
          onDelete={onDeleteSentence}
          onOpenAI={onOpenAI}
          relativeTime={formatRelativeTime(s.createdAt)}
        />
```

- [ ] **Step 2: AllSentencesTab**

In `web/src/components/AllSentencesTab.tsx`, change:

```ts
interface Props {
  sentences: ApiSentence[]
  videos: ApiVideo[]
  wordMap: Map<string, WordStatus>
  onUpdateWordStatus: (word: string, status: WordStatus) => Promise<void>
  onRemoveWordStatus: (word: string) => Promise<void>
  onDeleteSentence: (id: number) => Promise<void>
}

export default function AllSentencesTab({ sentences, videos, wordMap, onUpdateWordStatus, onRemoveWordStatus, onDeleteSentence }: Props) {
```

to:

```ts
interface Props {
  sentences: ApiSentence[]
  videos: ApiVideo[]
  wordMap: Map<string, WordStatus>
  onUpdateWordStatus: (word: string, status: WordStatus) => Promise<void>
  onRemoveWordStatus: (word: string) => Promise<void>
  onDeleteSentence: (id: number) => Promise<void>
  onOpenAI: (sentence: ApiSentence) => void
}

export default function AllSentencesTab({ sentences, videos, wordMap, onUpdateWordStatus, onRemoveWordStatus, onDeleteSentence, onOpenAI }: Props) {
```

And change the `<SentenceCard ... />` usage:

```tsx
              <SentenceCard
                key={s.id}
                sentence={s}
                wordMap={wordMap}
                onUpdateWordStatus={onUpdateWordStatus}
                onRemoveWordStatus={onRemoveWordStatus}
                onDelete={onDeleteSentence}
              />
```

to:

```tsx
              <SentenceCard
                key={s.id}
                sentence={s}
                wordMap={wordMap}
                onUpdateWordStatus={onUpdateWordStatus}
                onRemoveWordStatus={onRemoveWordStatus}
                onDelete={onDeleteSentence}
                onOpenAI={onOpenAI}
              />
```

- [ ] **Step 3: SentencesPage**

In `web/src/pages/SentencesPage.tsx`, change:

```ts
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
```

to:

```ts
interface Props {
  tab: 'recent' | 'all'
  sentences: ApiSentence[]
  videos: ApiVideo[]
  wordMap: Map<string, WordStatus>
  onUpdateWordStatus: (word: string, status: WordStatus) => Promise<void>
  onRemoveWordStatus: (word: string) => Promise<void>
  onDeleteSentence: (id: number) => Promise<void>
  onOpenAI: (sentence: ApiSentence) => void
}

export default function SentencesPage({ tab, sentences, videos, wordMap, onUpdateWordStatus, onRemoveWordStatus, onDeleteSentence, onOpenAI }: Props) {
  const tabProps = { sentences, wordMap, onUpdateWordStatus, onRemoveWordStatus, onDeleteSentence, onOpenAI }
```

- [ ] **Step 4: Verify it compiles**

```bash
cd web && npx tsc -b --noEmit
```
Expected: remaining errors only in `App.tsx` (doesn't pass `onOpenAI` to `SentencesPage` yet) — fixed in Task 14.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/RecentSentencesTab.tsx web/src/components/AllSentencesTab.tsx web/src/pages/SentencesPage.tsx
git commit -m "feat(web): thread onOpenAI prop through sentence tabs"
```

---

## Task 14: Wire the sheet, settings route, and list-dimming into App.tsx and Layout.tsx

**Files:**
- Modify: `web/src/components/Layout.tsx`
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Layout — add the dimmed prop**

In `web/src/components/Layout.tsx`, change:

```tsx
interface Props {
  sentences: ApiSentence[]
  words: ApiWord[]
  practiceQueueCount: number
  children: ReactNode
}

export default function Layout({ sentences, words, practiceQueueCount, children }: Props) {
```

to:

```tsx
interface Props {
  sentences: ApiSentence[]
  words: ApiWord[]
  practiceQueueCount: number
  dimmed?: boolean
  children: ReactNode
}

export default function Layout({ sentences, words, practiceQueueCount, dimmed, children }: Props) {
```

And change:

```tsx
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto">
            {children}
          </div>
        </main>
```

to:

```tsx
        <main className="flex-1 overflow-y-auto p-6">
          <div
            className="max-w-2xl mx-auto"
            style={{
              transform: dimmed ? 'scale(0.94) translateY(-12px)' : 'none',
              opacity: dimmed ? 0.6 : 1,
              transition: 'transform 320ms cubic-bezier(0.32, 0.72, 0, 1), opacity 320ms cubic-bezier(0.32, 0.72, 0, 1)',
            }}
          >
            {children}
          </div>
        </main>
```

- [ ] **Step 2: App.tsx — own the sheet state and add routes**

In `web/src/App.tsx`, change the imports:

```tsx
import {
  fetchSentences, fetchVideos, fetchWords,
  fetchPracticeQueue, fetchPracticeStats,
  patchWordStatus, deleteSentence, removeWord, postPracticeReview,
} from './api'
import type { ApiSentence, ApiVideo, ApiWord, WordStatus, PracticeWord, PracticeStats } from './types'
```

to:

```tsx
import SentenceAISheet from './components/SentenceAISheet'
import NotesPage from './pages/NotesPage'
import SettingsPage from './pages/SettingsPage'
import {
  fetchSentences, fetchVideos, fetchWords,
  fetchPracticeQueue, fetchPracticeStats,
  patchWordStatus, deleteSentence, removeWord, postPracticeReview, deleteNote,
} from './api'
import type { ApiSentence, ApiVideo, ApiWord, WordStatus, PracticeWord, PracticeStats } from './types'
```

Add state and handlers right after the existing `handleReview` function:

```tsx
  const [aiSheetSentence, setAiSheetSentence] = useState<ApiSentence | null>(null)
  const [aiSheetOpen, setAiSheetOpen] = useState(false)

  const openAiSheet = (sentence: ApiSentence) => {
    setAiSheetSentence(sentence)
    setAiSheetOpen(true)
  }
  const closeAiSheet = () => setAiSheetOpen(false)

  const handleNoteSaved = (id: number, note: string, updatedAt: number) => {
    setSentences(prev => prev.map(s => (s.id === id ? { ...s, aiNote: note, aiNoteUpdatedAt: updatedAt } : s)))
  }
  const handleNoteDeleted = (id: number) => {
    setSentences(prev => prev.map(s => (s.id === id ? { ...s, aiNote: null, aiNoteUpdatedAt: null } : s)))
  }
  const handleDeleteNoteDirect = async (id: number) => {
    await deleteNote(id)
    handleNoteDeleted(id)
  }
```

Update `sentenceProps` to include `onOpenAI`:

```tsx
  const sentenceProps = {
    sentences,
    videos,
    wordMap,
    onUpdateWordStatus: updateWordStatus,
    onRemoveWordStatus: handleRemoveWord,
    onDeleteSentence: handleDeleteSentence,
  }
```

to:

```tsx
  const sentenceProps = {
    sentences,
    videos,
    wordMap,
    onUpdateWordStatus: updateWordStatus,
    onRemoveWordStatus: handleRemoveWord,
    onDeleteSentence: handleDeleteSentence,
    onOpenAI: openAiSheet,
  }
```

Update the `<Layout>` and `<Routes>` block:

```tsx
  return (
    <Layout sentences={sentences} words={words} practiceQueueCount={practiceQueue.length}>
      <Routes>
        <Route path="/" element={<Navigate to="/sentences/recent" replace />} />
        <Route path="/sentences/recent" element={<SentencesPage tab="recent" {...sentenceProps} />} />
        <Route path="/sentences/all" element={<SentencesPage tab="all" {...sentenceProps} />} />
        <Route path="/words" element={<WordBookPage words={words} sentences={sentences} onUpdateWordStatus={updateWordStatus} onRemoveWord={handleRemoveWord} />} />
        <Route path="/practice" element={<PracticePage queue={practiceQueue} onReview={handleReview} />} />
        <Route path="/stats" element={<StatsPage stats={stats} loading={false} />} />
      </Routes>
    </Layout>
  )
```

to:

```tsx
  return (
    <>
      <Layout sentences={sentences} words={words} practiceQueueCount={practiceQueue.length} dimmed={aiSheetOpen}>
        <Routes>
          <Route path="/" element={<Navigate to="/sentences/recent" replace />} />
          <Route path="/sentences/recent" element={<SentencesPage tab="recent" {...sentenceProps} />} />
          <Route path="/sentences/all" element={<SentencesPage tab="all" {...sentenceProps} />} />
          <Route path="/words" element={<WordBookPage words={words} sentences={sentences} onUpdateWordStatus={updateWordStatus} onRemoveWord={handleRemoveWord} />} />
          <Route path="/practice" element={<PracticePage queue={practiceQueue} onReview={handleReview} />} />
          <Route path="/stats" element={<StatsPage stats={stats} loading={false} />} />
          <Route path="/notes" element={<NotesPage sentences={sentences} onOpenAI={openAiSheet} onDeleteNote={handleDeleteNoteDirect} />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Layout>
      <SentenceAISheet
        sentence={aiSheetSentence}
        isOpen={aiSheetOpen}
        onClose={closeAiSheet}
        onNoteSaved={handleNoteSaved}
        onNoteDeleted={handleNoteDeleted}
      />
    </>
  )
```

- [ ] **Step 3: Verify it compiles**

```bash
cd web && npx tsc -b --noEmit
```
Expected: error only about missing `./pages/NotesPage` module (created in Task 15). All other wiring, including `SettingsPage`, should type-check cleanly.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/Layout.tsx web/src/App.tsx
git commit -m "feat(web): wire SentenceAISheet, Settings route, and list-dimming into App"
```

(This commit will leave the build broken until Task 15 adds `NotesPage.tsx` — that's expected for an incremental plan; if a clean build is required at every commit, merge this step into Task 15's commit instead.)

---

## Task 15: NotesPage

**Files:**
- Create: `web/src/pages/NotesPage.tsx`

- [ ] **Step 1: Create the page**

Create `web/src/pages/NotesPage.tsx`:

```tsx
import { useMemo, useState } from 'react'
import { Search, Pencil, Trash2 } from 'lucide-react'
import { PLATFORM_COLOR, PLATFORM_LABEL } from '../components/SentenceCard'
import type { ApiSentence } from '../types'

interface Props {
  sentences: ApiSentence[]
  onOpenAI: (sentence: ApiSentence) => void
  onDeleteNote: (id: number) => Promise<void>
}

function formatDate(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

export default function NotesPage({ sentences, onOpenAI, onDeleteNote }: Props) {
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  const notes = useMemo(
    () => sentences.filter(s => s.aiNote).sort((a, b) => (b.aiNoteUpdatedAt ?? 0) - (a.aiNoteUpdatedAt ?? 0)),
    [sentences]
  )

  const filtered = useMemo(() => {
    if (!search.trim()) return notes
    const q = search.toLowerCase()
    return notes.filter(s =>
      (s.aiNote ?? '').toLowerCase().includes(q) ||
      s.text.toLowerCase().includes(q) ||
      (s.translation ?? '').toLowerCase().includes(q)
    )
  }, [notes, search])

  const groups = useMemo(() => {
    const map = new Map<string, ApiSentence[]>()
    for (const s of filtered) {
      const key = `${s.platform}::${s.videoTitle ?? s.videoUrl}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(s)
    }
    return [...map.entries()]
  }, [filtered])

  const toggleExpanded = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleDelete = async (id: number) => {
    await onDeleteNote(id)
    setConfirmDeleteId(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-[17px] font-bold" style={{ color: 'var(--text-primary)' }}>
          筆記
          <span className="text-[13px] font-normal ml-1.5" style={{ color: 'var(--text-secondary)' }}>
            {notes.length} 則
          </span>
        </h1>
      </div>

      <div className="relative mb-5">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }} />
        <input
          type="search"
          placeholder="搜尋筆記或句子…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-xl pl-8 pr-3 py-2 text-[14px] outline-none"
          style={{ background: 'var(--bg-subtle)', color: 'var(--text-primary)' }}
        />
      </div>

      {notes.length === 0 ? (
        <div className="flex flex-col items-center gap-2.5 py-16 text-center px-8">
          <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'rgba(191,90,242,0.12)' }}>
            <Pencil size={22} style={{ color: 'var(--ios-purple)' }} />
          </div>
          <p className="text-[16px] font-semibold" style={{ color: 'var(--text-primary)' }}>還沒有筆記</p>
          <p className="text-[13px] leading-relaxed max-w-60" style={{ color: 'var(--text-secondary)' }}>
            對任何句子問 AI，整理後就會出現在這裡
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[14px]" style={{ color: 'var(--text-secondary)' }}>
          找不到符合的筆記
        </div>
      ) : (
        groups.map(([key, items]) => {
          const platform = items[0].platform
          const label = items[0].videoTitle ?? items[0].videoUrl
          return (
            <div key={key}>
              <div className="flex items-center gap-1.5 px-1 pt-4 pb-1.5">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: PLATFORM_COLOR[platform] ?? '#888' }} />
                <span className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                  {(PLATFORM_LABEL[platform] ?? platform)} · {label}
                </span>
              </div>

              {items.map(s => {
                const isExpanded = expanded.has(s.id)
                return (
                  <div
                    key={s.id}
                    className="rounded-2xl overflow-hidden mb-2.5"
                    style={{ background: 'var(--bg-card)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
                  >
                    <div
                      className="px-3.5 py-2.5 cursor-pointer"
                      style={{ borderBottom: '1px solid var(--separator)' }}
                      onClick={() => onOpenAI(s)}
                    >
                      <p className="text-[14px] leading-snug mb-0.5" style={{ color: 'var(--text-primary)' }}>{s.text}</p>
                      {s.translation && (
                        <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>{s.translation}</p>
                      )}
                    </div>

                    <div className="px-3.5 py-2.5">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--ios-purple)' }}>
                          筆記
                        </span>
                        <button
                          onClick={() => setConfirmDeleteId(s.id)}
                          className="w-5 h-5 flex items-center justify-center rounded-full hover:opacity-70"
                          style={{ color: 'var(--text-secondary)' }}
                          aria-label="刪除筆記"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>

                      {confirmDeleteId === s.id ? (
                        <div className="flex items-center justify-between">
                          <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>確定要刪除？</span>
                          <div className="flex gap-3">
                            <button onClick={() => handleDelete(s.id)} className="text-[12px] font-medium" style={{ color: 'var(--ios-red)' }}>刪除</button>
                            <button onClick={() => setConfirmDeleteId(null)} className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>取消</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p
                            className="text-[13px] leading-relaxed whitespace-pre-line"
                            style={{
                              color: 'var(--text-primary)',
                              display: isExpanded ? 'block' : '-webkit-box',
                              WebkitBoxOrient: 'vertical',
                              WebkitLineClamp: isExpanded ? 'unset' : 3,
                              overflow: isExpanded ? 'visible' : 'hidden',
                            }}
                          >
                            {s.aiNote}
                          </p>
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                              {formatDate(s.aiNoteUpdatedAt ?? 0)}
                            </span>
                            <button onClick={() => toggleExpanded(s.id)} className="text-[11px]" style={{ color: 'var(--ios-blue)' }}>
                              {isExpanded ? '收合' : '展開'}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd web && npx tsc -b --noEmit
```
Expected: zero errors across the whole project now.

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/NotesPage.tsx
git commit -m "feat(web): add NotesPage listing all sentences with saved notes"
```

---

## Task 16: Notes and Settings nav items

**Files:**
- Modify: `web/src/components/Sidebar.tsx`

- [ ] **Step 1: Add the icon imports and active-match**

In `web/src/components/Sidebar.tsx`, change:

```ts
import { BookOpen, BookMarked, Sparkles, BarChart2 } from 'lucide-react'
```

to:

```ts
import { BookOpen, BookMarked, Sparkles, BarChart2, Pencil, Settings } from 'lucide-react'
```

And change:

```ts
  const sentencesActive = !!useMatch('/sentences/*')
  const wordsActive = !!useMatch('/words')
  const practiceActive = !!useMatch('/practice')
  const statsActive = !!useMatch('/stats')
```

to:

```ts
  const sentencesActive = !!useMatch('/sentences/*')
  const wordsActive = !!useMatch('/words')
  const practiceActive = !!useMatch('/practice')
  const statsActive = !!useMatch('/stats')
  const notesActive = !!useMatch('/notes')
  const settingsActive = !!useMatch('/settings')
```

- [ ] **Step 2: Add the nav links**

Insert two new `<Link>` blocks right after the closing `</Link>` of the 統計 (stats) nav item and before the closing `</nav>` tag:

```tsx
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
      </nav>
```

to:

```tsx
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

        <Link
          to="/notes"
          className={`${navBase} ${notesActive ? 'font-medium' : ''}`}
          style={navStyle(notesActive)}
          onMouseEnter={e => handleMouseEnter(e, notesActive)}
          onMouseLeave={e => handleMouseLeave(e, notesActive)}
        >
          <span className="flex items-center gap-2.5">
            <Pencil size={16} strokeWidth={1.8} />
            筆記
          </span>
        </Link>

        <Link
          to="/settings"
          className={`${navBase} ${settingsActive ? 'font-medium' : ''}`}
          style={navStyle(settingsActive)}
          onMouseEnter={e => handleMouseEnter(e, settingsActive)}
          onMouseLeave={e => handleMouseLeave(e, settingsActive)}
        >
          <span className="flex items-center gap-2.5">
            <Settings size={16} strokeWidth={1.8} />
            設定
          </span>
        </Link>
      </nav>
```

- [ ] **Step 3: Verify it compiles**

```bash
cd web && npx tsc -b --noEmit
```
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/Sidebar.tsx
git commit -m "feat(web): add Notes and Settings nav items to sidebar"
```

---

## Task 17: End-to-end manual verification

**Files:** none (verification only)

- [ ] **Step 1: Start both servers**

```bash
cd api && npx wrangler dev --local &
cd web && npm run dev &
```

- [ ] **Step 2: Walk the Settings flow first**

1. Open the web app, click "設定" in the sidebar. Confirm a profile-style page renders: circular purple key icon, "設定" title, "管理你的 AI 設定" subtitle, and a card with a "尚未設定" gray-dot status.
2. Paste a real Gemini API key (get one free at https://aistudio.google.com/apikey) into the password field, toggle show/hide to confirm it works, then click "儲存". Confirm a brief "已儲存 ✓" state, and the status row flips to a green "已設定" dot.

- [ ] **Step 3: Walk the AI 解析 flow**

1. Go to 句子 (Sentences), find any sentence card. Confirm an "Ask AI" pill button is visible bottom-right of the card.
2. Click it. Confirm: the list behind scales down and dims, the sheet slides up from the bottom with the sentence text in the header and three suggested-prompt chips (since a Gemini key is now configured, the chat UI should render, not the "請先設定" gate).
3. Tap a suggested prompt, then tap send. Confirm the user bubble appears immediately and the assistant bubble streams in text incrementally (not all at once).
4. After the first AI reply, confirm the purple "整理成筆記" button appears.
5. Tap it. Confirm a loading state shows briefly, then an editable "筆記草稿" textarea appears pre-filled with bullet text.
6. Edit the text, tap "儲存筆記". Confirm a "筆記已儲存 ✓" message flashes, the draft section disappears, and a "刪除筆記" link appears.
7. Close the sheet (swipe down or tap the dimmed backdrop). Confirm the card's button now shows "筆記 ✓" with a purple background instead of "Ask AI".
8. Reopen the sheet on the same sentence (tap "筆記 ✓"). Confirm the saved note state persists ("刪除筆記" link visible, "重新整理筆記" button visible instead of "整理成筆記").
9. Tap "刪除筆記", confirm the inline "確定要刪除這則筆記嗎？" prompt, tap "刪除". Confirm the note is cleared and the card badge reverts to "Ask AI" after closing the sheet.

- [ ] **Step 4: Walk the AI-disabled gate (without a key)**

1. Go back to 設定, and (since there's no "clear key" UI) verify the gate by testing on a fresh local DB instead: stop the API server, run `npx wrangler d1 execute duocue --local --command "DELETE FROM settings WHERE key='gemini_api_key';"`, restart the API server.
2. Open the AI sheet on any sentence. Confirm it shows the centered "請先設定 Gemini API Key 才能使用 AI 解析" message with a "前往設定" button, and the chat input is not rendered.
3. Tap "前往設定". Confirm the sheet closes and the app navigates to `/settings`.
4. Re-enter the Gemini key from Step 2 above to restore normal operation for the rest of this verification pass.

- [ ] **Step 5: Walk the 筆記頁 flow**

1. Reopen the sheet on a sentence, generate and save a note (repeat steps from Step 3 above) so at least one note exists.
2. Click "筆記" in the sidebar. Confirm the page shows a section header with the platform dot + show title, and a card with the sentence + translation on top and the note (clamped to 3 lines) below.
3. If the note is longer than 3 lines, confirm "展開"/"收合" toggles correctly.
4. Type a word from the note text into the search bar. Confirm the card stays visible; type something not present anywhere. Confirm "找不到符合的筆記" appears.
5. Clear the search, click the trash icon on a note card, confirm the inline "確定要刪除？" prompt, confirm deletion removes the card from the list immediately.
6. Delete all notes and confirm the empty state ("還沒有筆記" / "對任何句子問 AI，整理後就會出現在這裡") renders.

- [ ] **Step 6: Check both light and dark mode**

Toggle the sun/moon button in the header and repeat a quick visual check of the sheet, Notes page, and Settings page — confirm `--ios-purple`, `--bg-subtle`, and text colors look correct in both themes (no hardcoded black-only colors leaking through).

- [ ] **Step 7: Stop servers**

```bash
kill %1 %2
```

No commit for this task — it's a verification pass only.

---

## Self-Review Notes

- **Spec coverage:** All sections of the amended design spec are implemented — bottom sheet animation (Task 14), chat states A–E (Task 11), note summarization prompt (Task 6), delete-note from both surfaces (Tasks 11, 15), data model incl. `settings` table (Tasks 1, 2), all 7 API endpoints (Tasks 3, 4, 5, 6), NotesPage structure incl. search/grouping/expand (Task 15), SettingsPage (Task 12), Sidebar nav for both 筆記 and 設定 (Task 16), AI-disabled gating (Task 11).
- **Deviations from spec, called out explicitly:** NotesPage derives data from `sentences` instead of calling `GET /notes`; delete-note in NotesPage uses a trash-icon + confirm instead of swipe-left; `SentenceAISheet` fetches its own `hasGeminiKey` status on open instead of `App.tsx` threading it down as a prop (all documented in "Reference: Spec" above and in the amended spec doc itself).
- **Type consistency checked:** `ChatMessage` and `ApiSettings` defined once in `types.ts` (Task 7), reused by `api.ts` (Task 8) and `SentenceAISheet.tsx` / `SettingsPage.tsx` (Tasks 11, 12) — no duplicate/divergent definitions. `PLATFORM_COLOR`/`PLATFORM_LABEL` defined once in `SentenceCard.tsx` (Task 10) and imported by `SentenceAISheet.tsx` and `NotesPage.tsx`. `Bindings` type defined once in `api/src/index.ts` (Task 3) and imported as a type into `api/src/notes.ts` and `api/src/settings.ts` (Tasks 4, 5, 6).
- **No placeholders:** every step shows complete, runnable code or exact commands with expected output.
