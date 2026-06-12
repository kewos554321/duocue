# Video Title Rename — Design Spec

**Date:** 2026-06-12  
**Status:** Draft

## Problem

Video titles are captured automatically by the Chrome extension. Some titles contain errors or don't match the user's preferred naming convention. There is no way to correct them from the web app.

## Goal

Allow users to rename any video title inline from the SentencesPage filter bar — without leaving the current view.

---

## Architecture

Two layers of change:

1. **API** — new `PATCH /videos` endpoint to update a video's title in D1
2. **Web** — inline edit control in `SentencesPage` that appears when a video is selected

---

## API

### `PATCH /videos`

Updates the title for a video identified by its URL (which is unique in the DB).

**Request body:**
```json
{ "url": "https://...", "title": "新標題" }
```

**Validation:**
- Both `url` and `title` are required
- `title` must be non-empty after trim

**Success response:** `200`
```json
{ "url": "...", "title": "新標題" }
```

**Error responses:**
- `400` — missing/empty fields
- `404` — no video with that URL

**DB statement:**
```sql
UPDATE videos SET title = ? WHERE url = ?
```

No schema changes needed — `title TEXT` already exists.

---

## Frontend

### `web/src/api.ts`

Add one function:

```ts
patchVideoTitle(url: string, title: string): Promise<void>
```

Calls `PATCH /videos` with the auth header. Throws on non-2xx.

### `web/src/pages/SentencesPage.tsx`

**Normal state (video selected):**  
Replace the raw `{v.title ?? v.url}` text in the filter row with a `<VideoTitleEditor>` component:

```
[魷魚遊戲 S2 Ep.3] [✏️]
```

The pencil icon is visible at all times but subdued (`text-slate-500`), becomes `text-slate-300` on hover.

**Edit state (pencil clicked):**  
The title text and pencil are replaced by:

```
[魷魚遊戲 S2 Ep.3          ] [儲存] [取消]
```

- `<input>` pre-filled with current title, auto-focused, blue focus ring
- Keyboard: `Enter` → save, `Escape` → cancel
- Save disabled if input is empty after trim

**After save:**  
- Input collapses back to title display immediately (optimistic)
- `patchVideoTitle` called in background
- On API error: revert title to original, show a brief inline error ("更新失敗，請再試")
- No full page refetch needed — only local `videos` state updated

### State management

`SentencesPage` receives `videos: ApiVideo[]` from props. To support local title overrides without touching the parent, `SentencesPage` maintains a `localVideos` state initialized from the `videos` prop. On successful rename, only the matching entry in `localVideos` is updated. The parent (`App.tsx`) is not involved — rename is purely local UI state + API call. The prop and local state reconcile naturally on the next full page reload.

---

## Component boundary

Extract a small `VideoTitleEditor` component (inline in `SentencesPage.tsx` or its own file if it grows):

- Props: `title: string | null`, `videoUrl: string`, `onSave: (newTitle: string) => Promise<void>`
- Manages its own `editing` boolean and `draft` string
- Parent handles the API call and state update

This keeps `SentencesPage` readable and makes the editor independently testable.

---

## Error handling

| Scenario | Behaviour |
|---|---|
| Empty input on save | Save button disabled; Enter does nothing |
| Network error on PATCH | Revert optimistic update; show inline "更新失敗，請再試" |
| 404 from API | Treat as network error (shouldn't happen in normal flow) |
| Title unchanged | Still allow save (no-op on server is fine) |

---

## Out of scope

- Renaming from any page other than SentencesPage
- Bulk rename
- Rename history / undo
- Video deletion
