# Sentences Page Pagination Design

**Date:** 2026-06-10  
**Scope:** `web/src/pages/SentencesPage.tsx` only  
**Type:** Client-side pagination, no API changes

---

## Overview

Add numbered page navigation to `SentencesPage`. All sentence data is already fetched upfront in `App.tsx`; pagination slices the filtered result set in the front end only.

---

## Architecture & Data Flow

```
sentences (prop from App.tsx — full array, unchanged)
  ↓ useMemo (filter + search)  →  filtered[]
  ↓ slice by page              →  paginated[]  (max 25 items)
  ↓ render                     →  SentenceCard × ≤25
  ↓
Pagination UI (page buttons + count label, centred below cards)
```

No changes to `App.tsx`, `api.ts`, or the API.

---

## State

Added inside `SentencesPage`:

| State | Type | Initial | Description |
|-------|------|---------|-------------|
| `currentPage` | `number` | `1` | Active page index (1-based) |

`PAGE_SIZE = 25` defined as a module-level constant.

**Reset rule:** whenever `filter` or `search` changes, `currentPage` resets to `1`. Implemented via a `useEffect` watching both values.

---

## Derived Values

```ts
const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
const paginated  = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
```

---

## Pagination UI

Rendered below the card list. Hidden when `filtered.length === 0`.

**Layout:** centred column  
```
[ ‹  1  2  3  › ]
  顯示 26–50 / 63 筆
```

### Page Number Display (max 7 slots)

| Condition | Display |
|-----------|---------|
| `totalPages ≤ 7` | all pages: `1 2 3 4 5 6 7` |
| `currentPage ≤ 4` | `1 2 3 4 5 … N` |
| `currentPage ≥ N − 3` | `1 … N−4 N−3 N−2 N−1 N` |
| otherwise | `1 … P−1 P P+1 … N` |

### Prev / Next Buttons

- `‹` is disabled (reduced opacity, non-interactive) when `currentPage === 1`
- `›` is disabled when `currentPage === totalPages`

### Count Label (below buttons, centred)

Format: `顯示 {start}–{end} / {total} 筆`

- `start = (currentPage - 1) * PAGE_SIZE + 1`
- `end   = Math.min(currentPage * PAGE_SIZE, filtered.length)`

---

## Styling

Follows existing design tokens:

- Active page: `background: var(--ios-blue)`, white text
- Inactive pages: `color: var(--text-secondary)`, transparent background, hover darkens slightly
- Disabled nav buttons: `opacity: 0.3`, `pointer-events: none`
- Separator above pagination: `border-top: 1px solid var(--separator)`
- Count label: `font-size: 13px`, `color: var(--text-secondary)`

---

## Edge Cases

| Case | Behaviour |
|------|-----------|
| `filtered.length === 0` | Pagination row hidden; existing empty-state message shown |
| Last page with fewer than 25 results | `end` clamps to `filtered.length` |
| Filter/search change empties results | Page resets to 1, empty-state shown |
| Filter/search change reduces total pages below `currentPage` | Reset to 1 via `useEffect` |

---

## Files Changed

| File | Change |
|------|--------|
| `web/src/pages/SentencesPage.tsx` | Add `PAGE_SIZE`, `currentPage` state, `useEffect` reset, slice logic, pagination UI |

No other files are modified.
