# WordBook Optimization Design

**Date:** 2026-06-15  
**Status:** Approved

## Goal

Improve the WordBookPage (`/words`) with search, filtering, sorting, inline status management, word removal, source video display, and definition API caching.

## Scope

Changes are confined to:
- `web/src/pages/WordBookPage.tsx` — main changes
- `web/src/hooks/useDefinition.ts` — add module-level cache
- `web/src/App.tsx` — pass `onRemoveWord` prop to `WordBookPage`

No backend changes. No changes to `SentenceCard`, `AllSentencesTab`, or any other component.

## Features

### A. Search & Filter & Sort

**Search:** Text input in the header toolbar. Filters words client-side by `word` substring (case-insensitive). Instant, no debounce needed (list is small).

**Status filter:** Segmented control with three options: 全部 / 學習中 / 已學習. Filters `markedWords` to the selected status.

**Sort:** Fixed order — `learning` words before `learned`, then alphabetical (A–Z) within each group. No user-facing sort toggle. When filter is set to `all`, a section label ("學習中" / "已學習") appears between groups.

### B. Inline Status Change & Word Removal

**Status toggle:** The status badge (`學習中` / `已學習`) on each word card is a clickable button. Clicking it calls `onUpdateWordStatus` to flip the status (`learning` ↔ `learned`) and re-renders immediately via optimistic update in App state.

**Word removal:** A `✕` button appears on hover (top-right of card). Clicking it calls `onRemoveWord` (already wired in `App.tsx` as `handleRemoveWord`). `WordBookPage` needs `onRemoveWord` added as a new prop.

### C. Source Video Display

Each `WordRow` derives unique source videos from `matchingSentences` (sentences that contain the word). Unique sources are determined by `videoUrl` (dedup key). Display uses `videoTitle ?? videoUrl` (truncated). Displayed as small chips below the word definition, each chip showing the platform color dot + video title (truncated). When sentences are expanded, each sentence row also shows its source title + platform dot.

### D. Definition API Caching

**Problem:** `useDefinition` calls `dictionaryapi.dev` once per `WordRow` on mount, with no cache. Navigating away and back re-fetches all N words simultaneously.

**Fix:** Add a module-level `Map<string, { definition: string; partOfSpeech: string }>` in `useDefinition.ts`. Before fetching, check the map; if hit, return cached values synchronously (skip loading state). Write to map on successful fetch. Cache persists for the session lifetime — definitions don't change.

## Component Interface Changes

```ts
// WordBookPage — add two props
interface Props {
  words: ApiWord[]
  sentences: ApiSentence[]
  onUpdateWordStatus: (word: string, status: WordStatus) => Promise<void>  // new
  onRemoveWord: (word: string) => Promise<void>                            // new
}
```

`App.tsx` already has `updateWordStatus` and `handleRemoveWord`; just pass them through to `WordBookPage`.

## What Does NOT Change

- Example sentence expand/collapse logic
- `SentenceCard` component
- All API endpoints
- `AllSentencesTab`, `RecentSentencesTab`, `PracticePage`
- `useDefinition` external API URL (only caching layer added)
