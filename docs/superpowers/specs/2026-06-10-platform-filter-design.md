# Platform Filter in SentencesPage

**Date:** 2026-06-10  
**Status:** Approved

## Summary

Move the sidebar's platform/video navigation into an inline filter bar at the top of SentencesPage. The sidebar becomes a clean 3-item nav. Users can filter sentences by platform and optionally by a specific video, all from within the page.

---

## Current Behaviour

The sidebar has a "依影片" section that groups videos by platform (Netflix / HBO Max / YouTube). Expanding a platform reveals individual videos; clicking a video sets `selectedVideoUrl` in App state, which SentencesPage uses to filter its list. Platform-level filtering does not exist — users must expand and click a specific video.

---

## New Behaviour

### Sidebar

Remove the entire "依影片" section and all related props (`videos`, `selectedVideoUrl`, `onSelectVideo`). The sidebar renders only the three main nav items: 句子、單字本、練習.

### SentencesPage — Filter Bar (Row 1)

A single horizontal row with:

1. **Platform chips** — `全部` (default) + one chip per platform present in data (Netflix, HBO Max, YouTube). Active chip is highlighted in the platform's brand colour. Clicking an active chip (showing ✕) resets to `全部`.
2. **Vertical divider** — appears only when a platform is selected.
3. **Video dropdown** — appears only when a platform is selected. Default label: `所有影片`. Options are the videos belonging to the selected platform. When a specific video is chosen, the dropdown adopts the platform's brand colour.

Row 2 (unchanged): segmented control (全部 / 學習中 / 未標記) + search input.

### Filter Logic

| Platform | Video | Result |
|---|---|---|
| null (全部) | — | all sentences |
| "netflix" | null | all sentences where `platform === "netflix"` |
| "netflix" | `url` | sentences where `videoUrl === url` |

Selecting a new platform resets the video selection to `null`.

### State (internal to SentencesPage)

```ts
const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null)
const [selectedVideoUrl, setSelectedVideoUrl] = useState<string | null>(null)
```

`videos: ApiVideo[]` is passed as a new prop from App.tsx (previously only went to Sidebar).

---

## Component Changes

### `App.tsx`
- Remove `selectedVideoUrl` and `setSelectedVideoUrl` state.
- Pass `videos` to `<SentencesPage>` instead of (only) to `<Layout>`.

### `Layout.tsx`
- Remove `videos`, `selectedVideoUrl`, `onSelectVideo` from props and from the `<Sidebar>` call.

### `Sidebar.tsx`
- Remove `videos`, `selectedVideoUrl`, `onSelectVideo` props.
- Remove `expandedPlatforms` state and `togglePlatform` logic.
- Remove the entire "依影片" JSX block.
- Remove unused imports (`ChevronDown`, `ChevronUp`, `PlayCircle`, `ApiVideo`).

### `SentencesPage.tsx`
- Add `videos: ApiVideo[]` prop.
- Add `selectedPlatform` and `selectedVideoUrl` local state.
- Derive `platformGroups` from `videos` (same logic currently in Sidebar).
- Render filter bar (Row 1) above existing segmented control row.
- Update `filtered` memo to use local `selectedPlatform` / `selectedVideoUrl` instead of the prop.

---

## Out of Scope

- WordBookPage — no platform filter.
- PracticePage — no filter changes.
- Any visual changes to the segmented control or search.
