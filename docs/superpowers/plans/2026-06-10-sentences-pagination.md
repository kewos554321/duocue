# Sentences Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add client-side numbered-page pagination to `SentencesPage`, showing 25 sentences per page with centred page controls.

**Architecture:** All sentence data is already loaded in `App.tsx` and passed as a prop. `SentencesPage` slices the filtered array by page. No API changes needed.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Vite (no test framework — verify via dev server + `tsc`)

---

## File Map

| File | Change |
|------|--------|
| `web/src/pages/SentencesPage.tsx` | Add `PAGE_SIZE`, `currentPage` state, reset effect, slice logic, pagination UI |

---

### Task 1: Add state, reset logic, and slice

**Files:**
- Modify: `web/src/pages/SentencesPage.tsx`

- [ ] **Step 1: Add `useEffect` to imports and define `PAGE_SIZE`**

Open `web/src/pages/SentencesPage.tsx`. Change the first line from:

```tsx
import { useState, useMemo } from 'react'
```

to:

```tsx
import { useState, useMemo, useEffect } from 'react'
```

Then add the constant directly below all imports, before the `type Filter` line:

```tsx
const PAGE_SIZE = 25
```

- [ ] **Step 2: Add `currentPage` state inside the component**

Inside `SentencesPage`, after the existing `const [search, setSearch] = useState('')` line, add:

```tsx
const [currentPage, setCurrentPage] = useState(1)
```

- [ ] **Step 3: Add reset effect**

After the `currentPage` state line, add:

```tsx
useEffect(() => {
  setCurrentPage(1)
}, [filter, search, selectedVideoUrl])
```

- [ ] **Step 4: Add derived pagination values**

After the closing of the `filtered` useMemo block (after `}, [sentences, selectedVideoUrl, filter, search, wordMap])`), add:

```tsx
const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
```

- [ ] **Step 5: Add the `getPageNumbers` helper above the return statement**

Add this function inside the component body, just before the `const FILTERS` line:

```tsx
function getPageNumbers(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  if (current <= 4) return [1, 2, 3, 4, 5, '…', total]
  if (current >= total - 3) return [1, '…', total - 4, total - 3, total - 2, total - 1, total]
  return [1, '…', current - 1, current, current + 1, '…', total]
}
```

- [ ] **Step 6: Swap `filtered.map` for `paginated.map` in the card list**

In the JSX, find:

```tsx
{filtered.map(s => (
```

Replace with:

```tsx
{paginated.map(s => (
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add web/src/pages/SentencesPage.tsx
git commit -m "feat(web): add pagination state and slice logic to SentencesPage"
```

---

### Task 2: Add pagination UI

**Files:**
- Modify: `web/src/pages/SentencesPage.tsx`

- [ ] **Step 1: Add pagination block after the card list**

In the JSX, after the closing `</div>` of the card list (the `flex flex-col gap-3` div), add the following block. Place it **inside** the outer `<div>` that wraps the whole return, after the card-list conditional:

```tsx
{filtered.length > 0 && totalPages > 1 && (
  <div
    className="mt-6 pt-5 flex flex-col items-center gap-2.5"
    style={{ borderTop: '1px solid var(--separator)' }}
  >
    {/* Page buttons */}
    <div className="flex items-center gap-1">
      {/* Prev */}
      <button
        onClick={() => setCurrentPage(p => p - 1)}
        disabled={currentPage === 1}
        className="min-w-[32px] h-8 rounded-lg flex items-center justify-center text-[18px] transition-colors px-2"
        style={{
          color: 'var(--ios-blue)',
          background: 'transparent',
          opacity: currentPage === 1 ? 0.3 : 1,
          pointerEvents: currentPage === 1 ? 'none' : 'auto',
        }}
      >
        ‹
      </button>

      {getPageNumbers(currentPage, totalPages).map((p, i) =>
        p === '…' ? (
          <span
            key={`dots-${i}`}
            className="px-1 text-[14px]"
            style={{ color: 'var(--text-secondary)' }}
          >
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => setCurrentPage(p as number)}
            className="min-w-[32px] h-8 rounded-lg flex items-center justify-center text-[14px] transition-colors px-2"
            style={{
              background: currentPage === p ? 'var(--ios-blue)' : 'transparent',
              color: currentPage === p ? 'white' : 'var(--text-secondary)',
              fontWeight: currentPage === p ? 600 : 400,
            }}
          >
            {p}
          </button>
        )
      )}

      {/* Next */}
      <button
        onClick={() => setCurrentPage(p => p + 1)}
        disabled={currentPage === totalPages}
        className="min-w-[32px] h-8 rounded-lg flex items-center justify-center text-[18px] transition-colors px-2"
        style={{
          color: 'var(--ios-blue)',
          background: 'transparent',
          opacity: currentPage === totalPages ? 0.3 : 1,
          pointerEvents: currentPage === totalPages ? 'none' : 'auto',
        }}
      >
        ›
      </button>
    </div>

    {/* Count label */}
    <div className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
      顯示 {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} / {filtered.length} 筆
    </div>
  </div>
)}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Start dev server and verify manually**

```bash
cd web && npm run dev
```

Open `http://localhost:5173`. Go to the 句子 page and check:

- [ ] With < 25 sentences: no pagination bar appears
- [ ] With ≥ 26 sentences: pagination bar appears, cards show first 25
- [ ] Clicking page 2 shows next batch
- [ ] `‹` is disabled on page 1; `›` is disabled on last page
- [ ] Changing filter resets to page 1
- [ ] Changing search resets to page 1
- [ ] Count label shows correct range (e.g. `顯示 1–25 / 63 筆`)
- [ ] Last page shows correct range (e.g. `顯示 51–63 / 63 筆`)

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/SentencesPage.tsx
git commit -m "feat(web): add pagination UI to SentencesPage"
```
