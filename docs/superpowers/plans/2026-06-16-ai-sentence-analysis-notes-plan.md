# AI Sentence Analysis & Notes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an AI chat bottom-sheet for any saved sentence (with note generation + deletion), and a new Notes page that lists all sentences with saved notes.

**Architecture:** Cloudflare Workers API gains two new `sentences` table columns (`ai_note`, `ai_note_updated_at`) and five new Hono routes (chat stream, summarize, save note, delete note, list notes) split into a new `api/src/notes.ts` file. The React web app gains a portal-rendered bottom sheet (`SentenceAISheet`) owned by `App.tsx`, triggered from `SentenceCard`, and a `NotesPage` that derives its list directly from the already-loaded `sentences` array (no extra fetch, no separate state to keep in sync).

**Tech Stack:** Hono (Cloudflare Workers) + D1 SQLite + `@anthropic-ai/sdk` (TypeScript) for the API; React 19 + TypeScript + Tailwind v4 + `lucide-react` for the web app.

**Note on testing:** This codebase has no test framework installed (no Jest/Vitest, no `*.test.*` files exist in `api/` or `web/`). Adding one is out of scope for this feature. Verification steps below use `wrangler dev` + `curl` for the API and manual browser interaction for the UI, matching how the rest of the codebase is currently verified.

---

## Reference: Spec

Full design at `docs/superpowers/specs/2026-06-16-ai-sentence-analysis-notes-design.md`. Two deliberate implementation decisions that refine the spec without contradicting it:

1. **NotesPage data source:** The spec lists `GET /notes` as the page's data source. Since `ApiSentence` will already carry `aiNote`/`aiNoteUpdatedAt` after Task 3, `NotesPage` derives its list by filtering the `sentences` array already held in `App.tsx` state — this avoids a second fetch and a second source of truth that would need manual syncing after every save/delete. `GET /notes` is still implemented per spec (Task 4) for other clients (e.g. a future mobile/extension surface).
2. **Delete-note gesture in NotesPage:** The spec offers "swipe-left OR long-press menu." This plan uses a small trash-icon button with inline confirm (same pattern as the AI sheet's delete-note flow and consistent with `SentenceCard`'s existing delete-button pattern) instead of a swipe gesture, which would require a new gesture-handling dependency for no added clarity.

---

## Task 1: Database schema migration

**Files:**
- Modify: `api/schema.sql`

- [ ] **Step 1: Add the migration**

Append to the end of `api/schema.sql`:

```sql
-- Migration: AI sentence notes
ALTER TABLE sentences ADD COLUMN ai_note TEXT;
ALTER TABLE sentences ADD COLUMN ai_note_updated_at INTEGER;
```

- [ ] **Step 2: Apply to local D1 and verify**

Run:
```bash
cd api && npm run db:init:local
```
Expected: command exits 0, no errors about duplicate columns (this is the first time these columns are added).

Verify the columns exist:
```bash
cd api && npx wrangler d1 execute duocue --local --command "PRAGMA table_info(sentences);"
```
Expected: output includes rows for `ai_note` (TEXT) and `ai_note_updated_at` (INTEGER).

- [ ] **Step 3: Apply to production D1**

Run:
```bash
cd api && npm run db:init
```
Expected: same success, applied to the remote `duocue` D1 database.

- [ ] **Step 4: Commit**

```bash
git add api/schema.sql
git commit -m "feat(api): add ai_note columns to sentences table"
```

---

## Task 2: Add Anthropic SDK dependency and API key secret

**Files:**
- Modify: `api/package.json`
- Modify: `api/.dev.vars` (gitignored, not committed)

- [ ] **Step 1: Install the SDK**

Run:
```bash
cd api && npm install @anthropic-ai/sdk
```
Expected: `api/package.json` `dependencies` gains `"@anthropic-ai/sdk": "^<version>"`.

- [ ] **Step 2: Add local dev secret**

Edit `api/.dev.vars` (currently contains only `API_KEY=test-key`) to add a real Anthropic API key for local testing:

```
API_KEY=test-key
ANTHROPIC_API_KEY=sk-ant-...
```

This file is already listed in the root `.gitignore` (`api/.dev.vars`) — confirm it is **not** staged before committing anything else in this task.

- [ ] **Step 3: Set the production secret**

Run (this prompts for the key value interactively, do not paste it into chat or commit it):
```bash
cd api && npx wrangler secret put ANTHROPIC_API_KEY
```
Expected: `Success! Uploaded secret ANTHROPIC_API_KEY`.

- [ ] **Step 4: Commit**

```bash
git add api/package.json api/package-lock.json
git commit -m "feat(api): add @anthropic-ai/sdk dependency"
```

---

## Task 3: Export Bindings type and extend GET /sentences

**Files:**
- Modify: `api/src/index.ts:4-7` (Bindings type), `api/src/index.ts:62-76` (GET /sentences query)

- [ ] **Step 1: Export Bindings and add the new env binding**

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
  ANTHROPIC_API_KEY: string
}
```

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

Run:
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

Start the dev server and grab an existing sentence id, then exercise all three routes:

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

## Task 5: AI chat streaming and note summarization endpoints

**Files:**
- Modify: `api/src/notes.ts`

- [ ] **Step 1: Add the two AI-calling routes**

In `api/src/notes.ts`, add the import at the top:

```ts
import Anthropic from '@anthropic-ai/sdk'
```

And add these two routes inside `registerNoteRoutes`, above the `app.post('/sentences/:id/note', ...)` route:

```ts
  type ChatMessage = { role: 'user' | 'assistant'; content: string }

  async function loadSentence(c: { env: { DB: D1Database } }, id: number) {
    return c.env.DB.prepare(
      `SELECT text, translation FROM sentences WHERE id = ?`
    ).bind(id).first<{ text: string; translation: string | null }>()
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

    const anthropic = new Anthropic({ apiKey: c.env.ANTHROPIC_API_KEY })
    const messages = body.messages

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        try {
          const aiStream = anthropic.messages.stream({
            model: 'claude-haiku-4-5',
            max_tokens: 1024,
            system: `你是一位專業的英語學習助理，精通英語語意、語用與語境差異。\n使用者正在學習以下英語句子，請針對問題給予精簡、有用的分析（以繁體中文回答）。\n\n句子：${sentence.text}\n中文翻譯：${sentence.translation ?? ''}`,
            messages,
          })
          for await (const event of aiStream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: event.delta.text })}\n\n`))
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

    const anthropic = new Anthropic({ apiKey: c.env.ANTHROPIC_API_KEY })
    const conversation = body.messages
      .map(m => `${m.role === 'user' ? '使用者' : 'AI'}：${m.content}`)
      .join('\n')

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 512,
      system: `你是一位英語學習助理。根據以下對話，為學習者整理一份簡潔的學習筆記，以條列格式（bullet points）呈現，每條控制在30字以內，聚焦在這個句子的語意、用法差異、語境與記憶技巧。不要重複問題，直接給學習重點。\n\n句子：${sentence.text}\n中文翻譯：${sentence.translation ?? ''}`,
      messages: [{ role: 'user', content: `對話紀錄：\n${conversation}` }],
    })

    const draft = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('\n')

    return c.json({ draft })
  })
```

- [ ] **Step 2: Verify streaming and summarize manually**

```bash
cd api && npx wrangler dev --local &
sleep 2
SID=$(curl -s -H "Authorization: Bearer test-key" http://127.0.0.1:8787/sentences | python3 -c "import json,sys;print(json.load(sys.stdin)['sentences'][0]['id'])")

curl -sN -X POST -H "Authorization: Bearer test-key" -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"這個片語怎麼用？"}]}' \
  http://127.0.0.1:8787/sentences/$SID/ai-chat

curl -s -X POST -H "Authorization: Bearer test-key" -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"這個片語怎麼用？"},{"role":"assistant","content":"這是一個常見的口語用法..."}]}' \
  http://127.0.0.1:8787/sentences/$SID/note/summarize
kill %1
```
Expected: the first command streams multiple `data: {"delta":"..."}` lines ending in `data: {"done":true}`; the second returns `{"draft":"• ..."}`.

- [ ] **Step 3: Commit**

```bash
git add api/src/notes.ts
git commit -m "feat(api): add AI chat streaming and note summarization endpoints"
```

---

## Task 6: Frontend types

**Files:**
- Modify: `web/src/types.ts`

- [ ] **Step 1: Extend ApiSentence and add ChatMessage**

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
```

- [ ] **Step 2: Verify it compiles**

```bash
cd web && npx tsc -b --noEmit
```
Expected: errors in `SentenceCard.tsx` usages are fine for now (later tasks fix them) — but there should be no errors about `types.ts` itself. If `tsc` reports unrelated pre-existing errors from this change alone (e.g. object literals creating `ApiSentence` without the two new fields), note them; they'll be fixed when the API client and any sentence-construction code is touched in later tasks. There are no such literals in this codebase today (sentences only come from `fetchSentences()`), so this step should produce zero new errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/types.ts
git commit -m "feat(web): add aiNote fields and ChatMessage type"
```

---

## Task 7: Frontend API layer

**Files:**
- Modify: `web/src/api.ts`

- [ ] **Step 1: Add the new API functions**

In `web/src/api.ts`, change the import line:

```ts
import type { ApiSentence, ApiVideo, ApiWord, WordStatus, PracticeWord, PracticeStats } from './types'
```

to:

```ts
import type { ApiSentence, ApiVideo, ApiWord, WordStatus, PracticeWord, PracticeStats, ChatMessage } from './types'
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
```

- [ ] **Step 2: Verify it compiles**

```bash
cd web && npx tsc -b --noEmit
```
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/api.ts
git commit -m "feat(web): add API client functions for AI chat and notes"
```

---

## Task 8: Add the purple design token

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

## Task 9: Ask AI button + note badge on SentenceCard

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
Expected: new errors pointing at `RecentSentencesTab.tsx` and `AllSentencesTab.tsx` because they don't pass `onOpenAI` yet — that's expected and fixed in Task 11. Confirm there are no errors inside `SentenceCard.tsx` itself.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/SentenceCard.tsx
git commit -m "feat(web): add Ask AI button and note badge to SentenceCard"
```

---

## Task 10: SentenceAISheet component

**Files:**
- Create: `web/src/components/SentenceAISheet.tsx`

- [ ] **Step 1: Create the component**

Create `web/src/components/SentenceAISheet.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Send } from 'lucide-react'
import { streamAiChat, postNoteSummarize, saveNote, deleteNote } from '../api'
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
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [noteDraft, setNoteDraft] = useState<string | null>(null)
  const [generatingNote, setGeneratingNote] = useState(false)
  const [savedNote, setSavedNote] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [justSaved, setJustSaved] = useState(false)

  useEffect(() => {
    setMessages([])
    setInput('')
    setStreaming(false)
    setNoteDraft(null)
    setShowDeleteConfirm(false)
    setSavedNote(sentence?.aiNote ?? null)
  }, [sentence?.id])

  if (!sentence) return null

  const platformColor = PLATFORM_COLOR[sentence.platform] ?? '#888'
  const hasAiReply = messages.some(m => m.role === 'assistant' && m.content.trim().length > 0)

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
Expected: no errors in `SentenceAISheet.tsx` (App.tsx isn't wired up yet, so this file isn't imported anywhere yet — `tsc` still type-checks it as part of the project).

- [ ] **Step 3: Commit**

```bash
git add web/src/components/SentenceAISheet.tsx
git commit -m "feat(web): add SentenceAISheet bottom sheet component"
```

---

## Task 11: Wire onOpenAI through the sentence tabs

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
Expected: remaining errors only in `App.tsx` (doesn't pass `onOpenAI` to `SentencesPage` yet) — fixed in Task 12.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/RecentSentencesTab.tsx web/src/components/AllSentencesTab.tsx web/src/pages/SentencesPage.tsx
git commit -m "feat(web): thread onOpenAI prop through sentence tabs"
```

---

## Task 12: Wire the sheet and list-dimming into App.tsx and Layout.tsx

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

- [ ] **Step 2: App.tsx — own the sheet state**

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
Expected: error only about missing `./pages/NotesPage` module (created in Task 13). All other wiring should type-check cleanly.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/Layout.tsx web/src/App.tsx
git commit -m "feat(web): wire SentenceAISheet and list-dimming into App"
```

(This commit will leave the build broken until Task 13 adds `NotesPage.tsx` — that's expected for an incremental plan; if a clean build is required at every commit, merge this step into Task 13's commit instead.)

---

## Task 13: NotesPage

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

## Task 14: Notes nav item

**Files:**
- Modify: `web/src/components/Sidebar.tsx`

- [ ] **Step 1: Add the Pencil icon import and active-match**

In `web/src/components/Sidebar.tsx`, change:

```ts
import { BookOpen, BookMarked, Sparkles, BarChart2 } from 'lucide-react'
```

to:

```ts
import { BookOpen, BookMarked, Sparkles, BarChart2, Pencil } from 'lucide-react'
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
```

- [ ] **Step 2: Add the nav link**

Insert a new `<Link>` block right after the closing `</Link>` of the 統計 (stats) nav item and before the closing `</nav>` tag:

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
git commit -m "feat(web): add Notes nav item to sidebar"
```

---

## Task 15: End-to-end manual verification

**Files:** none (verification only)

- [ ] **Step 1: Start both servers**

```bash
cd api && npx wrangler dev --local &
cd web && npm run dev &
```

- [ ] **Step 2: Walk the AI 解析 flow**

1. Open the web app, go to 句子 (Sentences), find any sentence card.
2. Confirm an "Ask AI" pill button is visible bottom-right of the card.
3. Click it. Confirm: the list behind scales down and dims, the sheet slides up from the bottom with the sentence text in the header and three suggested-prompt chips.
4. Tap a suggested prompt, then tap send. Confirm the user bubble appears immediately and the assistant bubble streams in text incrementally (not all at once).
5. After the first AI reply, confirm the purple "整理成筆記" button appears.
6. Tap it. Confirm a loading state shows briefly, then an editable "筆記草稿" textarea appears pre-filled with bullet text.
7. Edit the text, tap "儲存筆記". Confirm a "筆記已儲存 ✓" message flashes, the draft section disappears, and a "刪除筆記" link appears.
8. Close the sheet (swipe down or tap the dimmed backdrop). Confirm the card's button now shows "筆記 ✓" with a purple background instead of "Ask AI".
9. Reopen the sheet on the same sentence (tap "筆記 ✓"). Confirm the saved note state persists ("刪除筆記" link visible, "重新整理筆記" button visible instead of "整理成筆記").
10. Tap "刪除筆記", confirm the inline "確定要刪除這則筆記嗎？" prompt, tap "刪除". Confirm the note is cleared and the card badge reverts to "Ask AI" after closing the sheet.

- [ ] **Step 3: Walk the 筆記頁 flow**

1. Reopen the sheet on a sentence, generate and save a note (repeat steps from Step 2 above) so at least one note exists.
2. Click "筆記" in the sidebar. Confirm the page shows a section header with the platform dot + show title, and a card with the sentence + translation on top and the note (clamped to 3 lines) below.
3. If the note is longer than 3 lines, confirm "展開"/"收合" toggles correctly.
4. Type a word from the note text into the search bar. Confirm the card stays visible; type something not present anywhere. Confirm "找不到符合的筆記" appears.
5. Clear the search, click the trash icon on a note card, confirm the inline "確定要刪除？" prompt, confirm deletion removes the card from the list immediately.
6. Delete all notes and confirm the empty state ("還沒有筆記" / "對任何句子問 AI，整理後就會出現在這裡") renders.

- [ ] **Step 4: Check both light and dark mode**

Toggle the sun/moon button in the header and repeat a quick visual check of the sheet and Notes page — confirm `--ios-purple`, `--bg-subtle`, and text colors look correct in both themes (no hardcoded black-only colors leaking through).

- [ ] **Step 5: Stop servers**

```bash
kill %1 %2
```

No commit for this task — it's a verification pass only.

---

## Self-Review Notes

- **Spec coverage:** All sections of the design spec are implemented — bottom sheet animation (Task 12), chat states A–E (Task 10), note summarization prompt (Task 5), delete-note from both surfaces (Tasks 10, 13), data model (Task 1), all 5 API endpoints (Tasks 3–5), NotesPage structure incl. search/grouping/expand (Task 13), Sidebar nav (Task 14).
- **Deviations from spec, called out explicitly:** NotesPage derives data from `sentences` instead of calling `GET /notes` (documented in "Reference: Spec" section above); delete-note in NotesPage uses a trash-icon + confirm instead of swipe-left (also documented above, spec allowed either).
- **Type consistency checked:** `ChatMessage` defined once in `types.ts` (Task 6), reused by `api.ts` (Task 7) and `SentenceAISheet.tsx` (Task 10) — no duplicate/divergent definitions. `PLATFORM_COLOR`/`PLATFORM_LABEL` defined once in `SentenceCard.tsx` (Task 9) and imported by `SentenceAISheet.tsx` and `NotesPage.tsx` rather than redefined. `Bindings` type defined once in `api/src/index.ts` (Task 3) and imported as a type into `api/src/notes.ts` (Task 4).
- **No placeholders:** every step shows complete, runnable code or exact commands with expected output.
