# Transcript Recording — Design Spec

**Date:** 2026-05-31
**Status:** Approved

---

## Overview

Add opt-in subtitle transcript recording to DuoCue. While the user watches, DuoCue silently accumulates timestamped English subtitle lines into `chrome.storage.local`. The user can download the result as a `.txt` file at any time. This feature is entirely non-intrusive: no UI appears during playback, and it is disabled by default.

---

## Requirements

- **Off by default.** User must explicitly enable via a toggle in the popup.
- **Timestamp + English text only.** No Chinese translation in the transcript (for now).
- **Elapsed time timestamps.** Timer starts from when the Transcript toggle is turned on. Format: `HH:MM:SS`.
- **Batched writes.** In-memory buffer flushed to `chrome.storage.local` every 3 new lines. (Reduced from 10 to limit data loss on page close — MV3 content scripts cannot complete async writes in `beforeunload`, so at most 2 lines may be lost on hard navigation.)
- **Storage warning at 9 MB.** Popup displays an orange banner and stops recording. User must download and clear before recording can resume.
- **User-chosen download path.** Uses `chrome.downloads` API with `saveAs: true` to show the native Save dialog.
- **Recording is gated on both toggles.** If the main DuoCue toggle is off, transcript recording also stops — even if the Transcript toggle is on.

---

## Architecture

### Storage Schema (`chrome.storage.local`)

```js
{
  transcriptEnabled: false,   // boolean, default false
  transcriptLines: []         // Array<{ t: string, text: string }>
}
```

Each entry: `{ t: "00:04:23", text: "You know nothing, Jon Snow." }`

### content.js Changes

1. On startup, read `transcriptEnabled` from storage.
2. Listen for `chrome.storage.onChanged` to react to toggle changes in real time.
3. When Transcript toggle turns **on**: record `startTime = Date.now()`, initialize `buffer = []`.
4. In the existing polling loop, when a new subtitle line is detected and both toggles are on:
   - Compute elapsed: `HH:MM:SS` from `startTime`
   - Push `{ t, text }` into `buffer`
   - If `buffer.length >= 10`: append buffer to storage and clear buffer
5. Before the polling loop reads `lastText`, check `transcriptEnabled` to decide whether to record.
6. On storage approaching 9 MB: stop recording, send a message to popup to display the warning.

### popup.js / popup.html Changes

**New Transcript card** below the existing API Key card:

```
┌─────────────────────────────────┐
│  Transcript              ○ Off  │
│                                 │
│  ● 247 lines · 28 KB            │  (shown when recording)
│                                 │
│  ⚠ Storage 接近上限，請下載並清除  │  (shown when >9 MB, orange)
│                                 │
│  [  Download .txt  ] [ Clear ]  │
└─────────────────────────────────┘
```

- Toggle off: stats row, warning banner, and buttons are hidden.
- Green dot next to line count pulses via CSS animation while recording.
- Download and Clear buttons are always visible when toggle is on.
- Clicking **Download**: reads all lines from storage, generates `.txt`, triggers `chrome.downloads.download({ url, filename, saveAs: true })`.
- Clicking **Clear**: calls `chrome.storage.local.set({ transcriptLines: [] })`, resets elapsed timer to `00:00:00`, continues recording if toggle is still on.

### manifest.json Changes

Add `"downloads"` to the `permissions` array.

---

## Download File Format

```
DuoCue Transcript
Generated: 2026-05-31 14:23:05
Lines: 247
─────────────────────────────────
[00:04:23] Previously on Game of Thrones...
[00:04:31] You know nothing, Jon Snow.
[00:05:10] Winter is coming.
```

Filename: `duocue-transcript-YYYY-MM-DD.txt`

---

## Edge Cases

| Scenario | Behaviour |
|---|---|
| DuoCue toggle off, Transcript toggle on | Recording pauses; resumes when DuoCue toggle turns back on |
| Clear while recording | Clears storage, resets timer to `00:00:00`, recording continues immediately |
| Page refresh | In-memory buffer is flushed to storage before unload via `beforeunload` event listener |
| No subtitle (intro, credits, silence) | Nothing written; only non-empty lines are recorded |
| Download while recording in progress | Flush buffer to storage first, then read and download; recording is not interrupted |
| Storage exceeds 9 MB | Recording stops, warning banner shown in popup; resumes after user clears |

---

## Out of Scope

- Chinese translation in transcript
- SRT / VTT file format
- Per-episode segmentation
- Sync/export to cloud
