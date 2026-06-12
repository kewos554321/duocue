# Sentences Page Tab Redesign

**Date:** 2026-06-12  
**Status:** Approved

## Problem

The "全部句子" page renders all saved sentences in one long scrollable list. Users don't scroll far, so most content is never seen. Users also need quick access to recently added sentences — typically the ones saved moments ago while watching a show.

## Solution

Add a **最近加入 / 全部句子** tab switcher at the top of SentencesPage, managed by React Router. The app gains real URL-based navigation for the first time, which also means refreshing or pressing browser back/forward preserves the user's exact position and filter state.

---

## Routing

Install `react-router-dom`. Wrap `App` in `<BrowserRouter>`.

| Path | Content |
|---|---|
| `/` | Redirect → `/sentences/recent` |
| `/sentences/recent` | SentencesPage — RecentSentencesTab |
| `/sentences/all` | SentencesPage — AllSentencesTab |
| `/words` | WordBookPage |
| `/practice` | PracticePage |

`App.tsx` drops the `page` useState entirely. `Layout` bottom navigation switches from `onSelectPage` callback + `page` prop to `<NavLink>` components. The sentences nav item is active when the path matches `/sentences/*`.

---

## Components

### `SentencesPage`

Becomes a thin shell. Reads the current route to determine which tab is active, renders the tab switcher UI, and delegates all content to the appropriate tab component. Passes `sentences`, `videos`, `wordMap`, and the three callbacks down to both tabs.

Tab switcher: a segmented control (`最近加入` | `全部句子`) using `<NavLink>` to `/sentences/recent` and `/sentences/all`. Styled to match the existing iOS-style segmented control pattern used in other parts of the app.

### `RecentSentencesTab`

Props: `sentences`, `wordMap`, `onUpdateWordStatus`, `onRemoveWordStatus`, `onDeleteSentence`

- Sorts `sentences` by `createdAt` desc, takes the first 20.
- No filter UI — the list is already the most relevant content.
- Passes a `relativeTime` string to each `SentenceCard` for display in the card header.

Relative time rules:
- < 1 minute → `剛才`
- < 60 minutes → `X 分鐘前`
- < 24 hours → `X 小時前`
- < 7 days → `X 天前`
- ≥ 7 days → locale date string (e.g. `6/5`)

### `AllSentencesTab`

Props: `sentences`, `videos`, `wordMap`, `onUpdateWordStatus`, `onRemoveWordStatus`, `onDeleteSentence`

All existing filter logic moves here (platform chips, video dropdown, word status segmented control, search input). Filter state is managed by `useSearchParams` instead of `useState`, so the URL always reflects the active filters.

URL search params:

| Param | Values | Notes |
|---|---|---|
| `platform` | `netflix` / `hbomax` / `youtube` | Omitted when "全部" |
| `video` | encoded video URL | Only meaningful when `platform` is set |
| `filter` | `learning` / `unmarked` | Omitted when "全部" |
| `q` | search string | Updated with `replace` (no history entry per keystroke) |

Pagination: 20 sentences per page. Page number is local state (not in URL) — it resets to 1 whenever any filter changes. Pagination UI matches the existing design from the earlier pagination implementation.

### `SentenceCard`

Adds one optional prop: `relativeTime?: string`.

When present, the relative time string is rendered in the card header to the right of the video title, replacing the existing timestamp/jump-link area. When absent (in AllSentencesTab), the card renders exactly as it does today — timestamp jump-link intact.

---

## Data

No backend changes. `ApiSentence.createdAt` (ISO string) already exists in the API response and is used by `RecentSentencesTab` for sorting and time display.

---

## File Changes

| File | Change |
|---|---|
| `web/package.json` | Add `react-router-dom` |
| `web/src/main.tsx` | Wrap app in `<BrowserRouter>` |
| `web/src/App.tsx` | Remove `page` state; add `<Routes>` with four route definitions |
| `web/src/components/Layout.tsx` | Replace `onSelectPage`/`page` props with `<NavLink>`; active detection via `/sentences/*` |
| `web/src/pages/SentencesPage.tsx` | Replace filter logic with tab switcher + route-based rendering |
| `web/src/components/SentenceCard.tsx` | Add optional `relativeTime` prop |
| `web/src/components/RecentSentencesTab.tsx` | New — recent 20 sentences, relative time, no filters |
| `web/src/components/AllSentencesTab.tsx` | New — all existing filter logic + `useSearchParams` + pagination |

---

## Out of Scope

- Configurable "recent" count (hardcoded 20)
- Infinite scroll (pagination is sufficient)
- Deep-linking to a specific sentence
- Backend pagination API (all sentences fetched client-side as today)
