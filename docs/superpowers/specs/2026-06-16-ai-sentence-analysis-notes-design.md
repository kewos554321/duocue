# AI Sentence Analysis & Notes — Design Spec

**Date:** 2026-06-16  
**Status:** Ready for implementation  
**Features:** AI 解析 (AI Sentence Analysis) · 筆記頁 (Notes Page)

---

## 1. Overview

Two interconnected features that let users deepen their understanding of saved sentences through AI conversation, then preserve that understanding as searchable personal notes.

**Feature 1 — AI 解析:** From the Sentences page, tap "Ask AI" on any sentence to open an iOS-style bottom sheet with a multi-turn chat about that sentence. After at least one AI reply, a "整理成筆記" (Organize into Note) button appears, which summarizes the conversation into an editable draft that can be saved.

**Feature 2 — 筆記頁:** A top-level navigation page listing all sentences that have saved AI notes, grouped by platform + show, with search and expand/collapse.

**Delete note:** Notes can be deleted from both the AI 解析 sheet and the 筆記頁, restoring the sentence to a note-free state.

---

## 2. Feature 1 — AI 解析 (AI Sentence Analysis)

### 2.1 Trigger

- `SentenceCard` gains an "Ask AI" button (secondary, text-only or ghost style, bottom-right of card).
- If the sentence already has a saved note, the button is replaced by a "筆記 ✓" badge (purple, tappable — opens the same sheet, scrolled to the note section).

### 2.2 Navigation: Bottom Sheet Animation

Opening the sheet mimics the iOS Maps / App Store detail sheet pattern:

1. The Sentences list **scales back**: `transform: scale(0.94) translateY(-12px)` + `opacity: 0.6`, transition duration `320ms`, easing `cubic-bezier(0.32, 0.72, 0, 1)`.
2. The AI sheet **slides up from off-screen**: starts at `translateY(100%)`, transitions to `translateY(0)` with the same easing.
3. The sheet covers ≈92 % of the screen height with `border-radius: 20px` on the top corners.
4. A drag handle (40 × 4 px rounded pill, `rgba(255,255,255,0.25)`) sits at the top of the sheet.
5. Closing: reverse animation. Sheet slides down, list scales and fades back to full.
6. Dismiss gestures: swipe-down on the sheet, or tap the dimmed list behind it.

The sheet is a **separate React component** (`SentenceAISheet.tsx`) rendered in a portal at the root, not a separate route.

### 2.3 Sheet Layout (States)

#### State A — Empty (initial open)
- Header: sentence text (clamped to 2 lines, `font-size: 15px`, white) + platform dot + video title (`font-size: 12px`, secondary color).
- Suggested prompt chips (3, horizontally scrollable):
  - "這個片語怎麼用？"
  - "和哪些詞容易搞混？"
  - "舉幾個例句"
- Text input bar pinned at bottom, placeholder "問 AI 關於這個句子…".
- No "整理成筆記" button yet.

#### State B — Typing indicator
- After user sends, show three animated dots (`...`) as an AI "bubble" while awaiting the response.

#### State C — First AI reply received
- AI response renders as a chat bubble (dark background `#2c2c2e`, left-aligned, markdown rendered — bullet lists, bold).
- "整理成筆記" button appears above the input bar (full-width, purple, `#BF5AF2`).
- Subsequent user messages and AI replies stack as a conversation.

#### State D — Note generation (after tapping "整理成筆記")
- Sends the full conversation to the AI summary endpoint.
- Shows a brief loading spinner inside the button area.
- The conversation area scrolls down to reveal a **note draft section** (below a divider):
  - Label: "筆記草稿" (purple, uppercase, 10 px).
  - Editable `<textarea>` pre-filled with the AI-generated summary (bullet format).
  - Two buttons: "儲存筆記" (blue, primary) · "取消" (secondary).

#### State E — Note saved
- The draft section collapses.
- A brief success toast: "筆記已儲存 ✓" (bottom of sheet, 2 s auto-dismiss).
- The "整理成筆記" button changes to "重新整理筆記" (allows regenerating/overwriting).
- The conversation remains visible and scrollable.
- A "刪除筆記" (Delete Note) option appears (red text button, near the bottom of the note section).

### 2.4 Note Prompt (AI Summary)

System prompt sent to Claude for note generation:

```
你是一位英語學習助理。根據以下對話，為學習者整理一份簡潔的學習筆記，
以條列格式（bullet points）呈現，每條控制在30字以內，
聚焦在這個句子的語意、用法差異、語境與記憶技巧。
不要重複問題，直接給學習重點。
```

The full prior conversation (user + AI turns) is appended as context.

### 2.5 Delete Note from Sheet

- "刪除筆記" button (red text, `#FF453A`) visible only when a note exists.
- Tapping shows an inline confirmation: "確定要刪除這則筆記嗎？" with "刪除"(red) and "取消" buttons.
- On confirm: calls `DELETE /sentences/:id/note`, clears the local note state, the "筆記 ✓" badge on the parent card reverts to "Ask AI".

---

## 3. Feature 2 — 筆記頁 (Notes Page)

### 3.1 Navigation

- New item in the left sidebar/bottom nav: "筆記" with a pencil icon.
- Route: `/notes` (or sidebar state `notes`).
- Renders `NotesPage.tsx`.

### 3.2 Page Structure

```
┌─────────────────────────────┐
│  筆記          4 則          │  ← navbar
├─────────────────────────────┤
│  🔍 搜尋筆記或句子…           │  ← search bar
├─────────────────────────────┤
│  ● HBO Max · The Long …     │  ← section header (platform dot + show)
│  ┌──────────────────────┐   │
│  │ ● HBO Max  The Long… │   │  ← note card
│  │ except when you …   │   │
│  │ 除非你想讓他閉嘴       │   │
│  ├──────────────────────┤   │
│  │ 筆記  • except when… │   │
│  │       • shut up vs…  │   │
│  │  2026/06/16  [展開]  │   │
│  └──────────────────────┘   │
│  ● Netflix · Adolescence    │
│  ...                        │
└─────────────────────────────┘
```

### 3.3 Section Header

- Platform color dot (5 × 5 px, `border-radius: 50%`) + `platform · videoTitle`
- `font-size: 12px`, `font-weight: 600`, `color: var(--text-secondary)`, `text-transform: uppercase`, `letter-spacing: 0.4px`
- Grouped by `platform + videoTitle`; groups sorted by most-recently-updated note.

### 3.4 Note Card

**Top half — sentence:**
- Platform dot + label (colored) + video title (secondary, truncated).
- Sentence text in English (14 px, primary).
- Translation in Chinese (12 px, secondary).
- Border-bottom separator.

**Bottom half — note content:**
- "筆記" label with pencil SVG icon (purple, 10 px, uppercase, bold).
- Note text: `font-size: 13px`, `line-height: 1.65`, `white-space: pre-line`, **clamped to 3 lines** when collapsed.
- Footer row: date (left) + "展開" / "收合" toggle button (right, blue).
- Tapping the card (outside the expand button) opens the AI sheet for that sentence.

### 3.5 Delete from Notes Page

- Each note card has a **swipe-left** gesture (iOS convention) revealing a red "刪除" action button, OR a long-press context menu with "刪除筆記".
- On tap: inline confirmation, then calls `DELETE /sentences/:id/note`, removes card from list (animate out with `opacity: 0` + `max-height: 0`, `200ms`).

### 3.6 Search

- `<input type="search">` in a rounded container (`background: rgba(120,120,128,0.15)`, `border-radius: 12px`).
- Placeholder: "搜尋筆記或句子…"
- Filters client-side: matches against `note` text OR sentence `text` OR `translation`, case-insensitive.
- Empty search = show all.
- No results: centered empty state ("找不到符合的筆記").

### 3.7 Empty State (no notes at all)

- Centered purple-tinted circle icon + "還沒有筆記" (16 px, bold) + "對任何句子問 AI，整理後就會出現在這裡" (13 px, secondary, max-width 240 px, centered).

---

## 4. Data Model

### 4.1 Schema Changes (D1 SQLite)

```sql
ALTER TABLE sentences ADD COLUMN ai_note TEXT;
ALTER TABLE sentences ADD COLUMN ai_note_updated_at INTEGER;  -- Unix epoch seconds
```

- `ai_note NULL` = no note exists.
- `ai_note_updated_at NULL` until first note is saved.

### 4.2 Updated `ApiSentence` type

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
  aiNote: string | null           // new
  aiNoteUpdatedAt: number | null  // new, Unix epoch seconds
}
```

### 4.3 `ApiNote` type (for GET /notes)

```ts
export interface ApiNote {
  sentenceId: number
  text: string
  translation: string | null
  platform: string
  videoTitle: string | null
  videoUrl: string
  timestampS: number
  aiNote: string
  aiNoteUpdatedAt: number
}
```

---

## 5. API Endpoints

All endpoints are added to `api/src/index.ts` (Hono app, Cloudflare Workers).

### 5.1 `POST /sentences/:id/ai-chat`

Multi-turn AI conversation about a sentence.

**Request body:**
```json
{
  "messages": [
    { "role": "user", "content": "這個片語怎麼用？" }
  ]
}
```
`messages` is the full conversation history so far. Each call sends the entire history (stateless on the server).

**System prompt:**
```
你是一位專業的英語學習助理，精通英語語意、語用與語境差異。
使用者正在學習以下英語句子，請針對問題給予精簡、有用的分析（以繁體中文回答）。

句子：{sentence.text}
中文翻譯：{sentence.translation}
```

**Response:** streamed SSE (Server-Sent Events), each chunk is a JSON object `{ "delta": "..." }`. Final chunk: `{ "done": true }`.

**Claude model:** `claude-haiku-4-5` (fast and cheap for conversational turns).  
**Streaming:** use `@anthropic-ai/sdk` with `client.messages.stream(...)`.

**Implementation note:** The Anthropic API key is stored in Cloudflare Workers secret (`ANTHROPIC_API_KEY`), never exposed to the frontend.

### 5.2 `POST /sentences/:id/note`

Save (create or overwrite) a note for a sentence.

**Request body:**
```json
{ "note": "• except when = 除非在…\n• shut up vs be quiet…" }
```

**Response:**
```json
{ "ok": true, "aiNoteUpdatedAt": 1750032000 }
```

Updates `sentences.ai_note` and `sentences.ai_note_updated_at` for the given `id`.

### 5.3 `DELETE /sentences/:id/note`

Delete the note for a sentence (sets both columns to NULL).

**Response:**
```json
{ "ok": true }
```

### 5.4 `POST /sentences/:id/note/summarize`

Generate a note summary from the conversation (for "整理成筆記").

**Request body:**
```json
{
  "sentence": "except when you wanted him to shut up",
  "translation": "除非你想讓他閉嘴",
  "messages": [ ... ]
}
```

**Response:** `{ "draft": "• except when = ...\n• shut up vs..." }` (non-streaming — summary is short enough).

**Claude model:** `claude-haiku-4-5`.

### 5.5 `GET /notes`

Return all sentences that have a non-null `ai_note`.

**Query params:** none (search is done client-side).

**Response:**
```json
{
  "notes": [
    {
      "sentenceId": 42,
      "text": "except when you wanted him to shut up",
      "translation": "除非你想讓他閉嘴",
      "platform": "hbomax",
      "videoTitle": "The Long Bright Dark",
      "videoUrl": "https://...",
      "timestampS": 583,
      "aiNote": "• except when = ...",
      "aiNoteUpdatedAt": 1750032000
    }
  ]
}
```

SQL: `SELECT ... FROM sentences WHERE ai_note IS NOT NULL ORDER BY ai_note_updated_at DESC`.

---

## 6. Frontend Architecture

### 6.1 New Files

| File | Purpose |
|---|---|
| `web/src/components/SentenceAISheet.tsx` | Bottom sheet component with chat UI, note draft, delete |
| `web/src/pages/NotesPage.tsx` | Notes top-level page |

### 6.2 Modified Files

| File | Change |
|---|---|
| `web/src/components/SentenceCard.tsx` | Add "Ask AI" button; add "筆記 ✓" badge when `aiNote` present |
| `web/src/types.ts` | Add `aiNote`, `aiNoteUpdatedAt` to `ApiSentence`; add `ApiNote` |
| `web/src/api.ts` | Add `postAiChat`, `postNoteSummarize`, `saveNote`, `deleteNote`, `getNotes` |
| `web/src/App.tsx` | Add `NotesPage` route; render `SentenceAISheet` portal; pass sheet open/close state |
| `web/src/Sidebar.tsx` (or nav component) | Add "筆記" nav item with pencil icon |

### 6.3 `SentenceAISheet` Props

```ts
interface SentenceAISheetProps {
  sentence: ApiSentence
  isOpen: boolean
  onClose: () => void
  onNoteSaved: (note: string, updatedAt: number) => void
  onNoteDeleted: () => void
}
```

### 6.4 Chat State (inside `SentenceAISheet`)

```ts
type ChatMessage = { role: 'user' | 'assistant'; content: string }

// local state
const [messages, setMessages] = useState<ChatMessage[]>([])
const [input, setInput] = useState('')
const [streaming, setStreaming] = useState(false)
const [noteDraft, setNoteDraft] = useState<string | null>(null)
const [savedNote, setSavedNote] = useState<string | null>(sentence.aiNote)
const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
```

SSE streaming: use `EventSource` or `fetch` with `ReadableStream` to consume `POST /sentences/:id/ai-chat` chunks and append to the last assistant message incrementally.

### 6.5 Platform Color Map

```ts
const PLATFORM_COLORS: Record<string, string> = {
  netflix: '#E50914',
  hbomax: '#5822B4',
  disney: '#0B3D8F',
  appletv: '#555555',
  primevideo: '#00A8E1',
}
const getPlatformColor = (platform: string) =>
  PLATFORM_COLORS[platform.toLowerCase()] ?? '#888888'
```

---

## 7. Streaming Implementation (Cloudflare Workers)

Cloudflare Workers supports streaming via `TransformStream` and `ReadableStream`. The `/sentences/:id/ai-chat` route must:

1. Instantiate `@anthropic-ai/sdk`'s `Anthropic` client with `apiKey: c.env.ANTHROPIC_API_KEY`.
2. Call `client.messages.stream({ model: 'claude-haiku-4-5', max_tokens: 1024, system: '...', messages })`.
3. Pipe each `text_delta` event as an SSE chunk: `data: {"delta":"..."}\n\n`.
4. Send `data: {"done":true}\n\n` on stream end.
5. Return `new Response(readable, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } })`.

---

## 8. Out of Scope

- Note sharing or export.
- AI conversation history persistence (conversations are ephemeral; only the note is saved).
- Per-sentence multiple notes (one note per sentence).
- Note editing after save from NotesPage (edit opens the AI sheet).
- Voice input.

---

## 9. Open Questions (resolved)

| Question | Decision |
|---|---|
| Navigation pattern for AI detail | Bottom sheet (iOS-style), not a new page |
| Note storage | Single `ai_note TEXT` column on `sentences` table |
| AI model | `claude-haiku-4-5` for chat and summarization |
| Note grouping in NotesPage | By `platform + videoTitle` |
| Delete confirmation | Inline confirmation (not a modal dialog) |
| Client-side vs server-side search | Client-side (notes list is small) |
