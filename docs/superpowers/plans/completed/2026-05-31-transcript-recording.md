# Transcript Recording Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add opt-in subtitle transcript recording to DuoCue — silently accumulates timestamped English subtitle lines into `chrome.storage.local`, exportable as a `.txt` file.

**Architecture:** Transcript state lives in `chrome.storage.local` (`transcriptEnabled`, `transcriptLines`, `transcriptStorageFull`, `transcriptClearedAt`). `content.js` buffers lines in-memory and flushes every 10 lines. `popup.js` reads/writes this state and drives the Transcript card UI.

**Tech Stack:** Chrome Extension MV3, vanilla JS, `chrome.storage.local`, `chrome.downloads` API.

> **Note:** This project has no test framework. All verification steps are manual (load the unpacked extension in Chrome).

---

## File Map

| File | Change |
|---|---|
| `manifest.json` | Add `"downloads"` to `permissions` |
| `content.js` | Add transcript state, `elapsed()`, `recordSubtitle()`, `flushTranscriptBuffer()`, storage listener, beforeunload flush, hook into polling loop |
| `popup.html` | Add Transcript card HTML + CSS below existing API Key card |
| `popup.js` | Add Transcript card logic: toggle, live stats, download, clear, warning |

---

## Task 1: Add `downloads` permission to manifest.json

**Files:**
- Modify: `manifest.json`

- [ ] **Step 1: Add permission**

Open `manifest.json`. Change the `permissions` array from:

```json
"permissions": ["storage"],
```

to:

```json
"permissions": ["storage", "downloads"],
```

- [ ] **Step 2: Verify extension loads**

1. Open `chrome://extensions`
2. Enable Developer Mode
3. Click "Load unpacked" → select the `duocue` folder (or click the reload ↺ button if already loaded)
4. Confirm no errors appear in the extension card

- [ ] **Step 3: Commit**

```bash
git add manifest.json
git commit -m "feat: add downloads permission for transcript export"
```

---

## Task 2: Add transcript recording logic to content.js

**Files:**
- Modify: `content.js`

- [ ] **Step 1: Add transcript state variables inside `startPolling()`**

In `content.js`, inside the `startPolling(platform)` function, after the `createOverlay()` call and before the existing `let lastText = null` line, add:

```js
let transcriptEnabled = false
let transcriptStartTime = null
let transcriptBuffer = []
let transcriptFull = false

chrome.storage.local.get(['transcriptEnabled', 'transcriptStorageFull'], (result) => {
  transcriptEnabled = result.transcriptEnabled === true
  transcriptFull = result.transcriptStorageFull === true
  if (transcriptEnabled) transcriptStartTime = Date.now()
})
```

- [ ] **Step 2: Add helper functions inside `startPolling()`**

After the state variables block, add:

```js
function elapsed() {
  if (!transcriptStartTime) return '00:00:00'
  const s = Math.floor((Date.now() - transcriptStartTime) / 1000)
  const h = String(Math.floor(s / 3600)).padStart(2, '0')
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const sec = String(s % 60).padStart(2, '0')
  return `${h}:${m}:${sec}`
}

async function flushTranscriptBuffer() {
  if (transcriptBuffer.length === 0) return
  const toWrite = transcriptBuffer.splice(0)
  const { transcriptLines = [] } = await chrome.storage.local.get('transcriptLines')
  const updated = [...transcriptLines, ...toWrite]
  await chrome.storage.local.set({ transcriptLines: updated })
  const bytes = await chrome.storage.local.getBytesInUse('transcriptLines')
  if (bytes > 9 * 1024 * 1024) {
    transcriptFull = true
    await chrome.storage.local.set({ transcriptStorageFull: true })
  }
}

function recordSubtitle(text) {
  transcriptBuffer.push({ t: elapsed(), text })
  if (transcriptBuffer.length >= 10) flushTranscriptBuffer()
}
```

- [ ] **Step 3: Add storage change listener inside `startPolling()`**

After the helper functions, add:

```js
chrome.storage.onChanged.addListener((changes) => {
  if (changes.transcriptEnabled) {
    transcriptEnabled = changes.transcriptEnabled.newValue === true
    if (transcriptEnabled) {
      transcriptStartTime = Date.now()
      transcriptFull = false
    } else {
      flushTranscriptBuffer()
    }
  }
  if (changes.transcriptClearedAt) {
    transcriptStartTime = Date.now()
    transcriptBuffer = []
    transcriptFull = false
  }
})
```

- [ ] **Step 4: Add beforeunload flush inside `startPolling()`**

After the storage listener, add:

```js
window.addEventListener('beforeunload', () => {
  flushTranscriptBuffer()
})
```

- [ ] **Step 5: Hook into the polling loop**

Inside the `setInterval` callback, after `updateOverlay(english, null)` (around line 89) and before `clearTimeout(translateTimer)`, add:

```js
if (transcriptEnabled && !transcriptFull) recordSubtitle(english)
```

The relevant section of the interval callback should look like:

```js
updateOverlay(english, null)
if (transcriptEnabled && !transcriptFull) recordSubtitle(english)

clearTimeout(translateTimer)
```

- [ ] **Step 6: Manual verification**

1. Reload the extension in `chrome://extensions`
2. Open `chrome://extensions` → click "Inspect views: background page" (if available) or open DevTools on HBO Max
3. In the Console, run: `chrome.storage.local.set({ transcriptEnabled: true })`
4. Play a few seconds of content on HBO Max
5. In Console, run: `chrome.storage.local.get('transcriptLines', console.log)`
6. Confirm you see entries like `[{ t: "00:00:03", text: "..." }, ...]`

- [ ] **Step 7: Commit**

```bash
git add content.js
git commit -m "feat: add transcript recording to polling loop"
```

---

## Task 3: Add Transcript card HTML and CSS to popup.html

**Files:**
- Modify: `popup.html`

- [ ] **Step 1: Add CSS for divider, transcript card, and recording dot animation**

Inside the `<style>` block in `popup.html`, add these rules at the end (before the closing `</style>` tag):

```css
.divider {
  height: 1px;
  background: #3A3A3C;
  margin: 0 16px;
}

.transcript-body {
  margin-top: 12px;
}

.transcript-body.hidden { display: none; }

.transcript-stats {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #8E8E93;
  margin-bottom: 10px;
}

.recording-dot {
  width: 8px;
  height: 8px;
  background: #30D158;
  border-radius: 50%;
  flex-shrink: 0;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.transcript-warning {
  background: rgba(255, 159, 10, 0.15);
  border: 1px solid rgba(255, 159, 10, 0.4);
  border-radius: 8px;
  color: #FF9F0A;
  font-size: 12px;
  padding: 8px 10px;
  margin-bottom: 10px;
}

.transcript-warning.hidden { display: none; }

.transcript-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  flex: 1;
  height: 38px;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: opacity 0.15s;
}

.action-btn:hover { opacity: 0.85; }

.download-btn {
  background: #0A84FF;
  color: #FFFFFF;
}

.clear-btn {
  background: #3A3A3C;
  color: #FFFFFF;
}
```

- [ ] **Step 2: Add Transcript card HTML**

In `popup.html`, replace the closing `</body>` tag area. After the existing `<div class="body">...</div>` block (and before `<script src="popup.js"></script>`), add:

```html
  <div class="divider"></div>

  <div class="body">
    <div class="field-header">
      <span class="field-label">Transcript</span>
      <div class="toggle" id="transcriptToggle">
        <div class="toggle-knob"></div>
      </div>
    </div>
    <div class="transcript-body hidden" id="transcriptBody">
      <div class="transcript-stats">
        <span class="recording-dot"></span>
        <span id="transcriptStats">0 lines · 0 KB</span>
      </div>
      <div class="transcript-warning hidden" id="transcriptWarning">
        ⚠ Storage 接近上限，請下載並清除
      </div>
      <div class="transcript-actions">
        <button class="action-btn download-btn" id="downloadBtn">Download .txt</button>
        <button class="action-btn clear-btn" id="clearBtn">Clear</button>
      </div>
    </div>
  </div>
```

- [ ] **Step 3: Manual verification**

1. Reload the extension
2. Open the popup
3. Confirm a "Transcript" row with an Off toggle appears below the Save Key button
4. Confirm the card body (stats + buttons) is hidden while toggle is off

- [ ] **Step 4: Commit**

```bash
git add popup.html
git commit -m "feat: add transcript card to popup UI"
```

---

## Task 4: Wire up Transcript card logic in popup.js

**Files:**
- Modify: `popup.js`

- [ ] **Step 1: Add element references at the top of popup.js**

After the existing element references at the top of `popup.js`, add:

```js
const transcriptToggle = document.getElementById('transcriptToggle')
const transcriptBody = document.getElementById('transcriptBody')
const transcriptStatsEl = document.getElementById('transcriptStats')
const transcriptWarning = document.getElementById('transcriptWarning')
const downloadBtn = document.getElementById('downloadBtn')
const clearBtn = document.getElementById('clearBtn')
```

- [ ] **Step 2: Add helper functions**

After the element references, add:

```js
function updateTranscriptStats(lines, isFull) {
  const kb = Math.round(JSON.stringify(lines).length / 1024)
  transcriptStatsEl.textContent = `${lines.length} lines · ${kb} KB`
  transcriptWarning.classList.toggle('hidden', !isFull)
}

async function downloadTranscript() {
  const { transcriptLines = [] } = await chrome.storage.local.get('transcriptLines')
  const now = new Date()
  const dateStr = now.toISOString().slice(0, 10)
  const generated = now.toISOString().slice(0, 19).replace('T', ' ')
  const header = [
    'DuoCue Transcript',
    `Generated: ${generated}`,
    `Lines: ${transcriptLines.length}`,
    '─'.repeat(33),
    '',
  ].join('\n')
  const body = transcriptLines.map(l => `[${l.t}] ${l.text}`).join('\n')
  const blob = new Blob([header + body], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  chrome.downloads.download(
    { url, filename: `duocue-transcript-${dateStr}.txt`, saveAs: true },
    () => URL.revokeObjectURL(url)
  )
}

async function clearTranscript() {
  await chrome.storage.local.set({
    transcriptLines: [],
    transcriptStorageFull: false,
    transcriptClearedAt: Date.now(),
  })
  updateTranscriptStats([], false)
}
```

- [ ] **Step 3: Load initial transcript state on popup open**

Find the existing `chrome.storage.local.get` call at the top of `popup.js` (the one that loads `translationApiKey` and `enabled`). Extend it to also load transcript state:

```js
chrome.storage.local.get(
  ['translationApiKey', 'enabled', 'transcriptEnabled', 'transcriptLines', 'transcriptStorageFull'],
  ({ translationApiKey, enabled, transcriptEnabled, transcriptLines = [], transcriptStorageFull }) => {
    if (enabled === false) {
      toggle.classList.remove('on')
    }

    if (translationApiKey) {
      apiKeyInput.value = translationApiKey
      keyStatus.textContent = '✓ Set'
      keyStatus.className = 'key-status set'
    }

    if (transcriptEnabled === true) {
      transcriptToggle.classList.add('on')
      transcriptBody.classList.remove('hidden')
      updateTranscriptStats(transcriptLines, transcriptStorageFull === true)
    }
  }
)
```

- [ ] **Step 4: Add transcript toggle listener**

After the existing toggle click listener, add:

```js
transcriptToggle.addEventListener('click', () => {
  const isOn = transcriptToggle.classList.toggle('on')
  transcriptBody.classList.toggle('hidden', !isOn)
  chrome.storage.local.set({ transcriptEnabled: isOn })
})
```

- [ ] **Step 5: Add live stats update via storage listener**

After the transcript toggle listener, add:

```js
chrome.storage.onChanged.addListener((changes) => {
  if (changes.transcriptLines || changes.transcriptStorageFull) {
    chrome.storage.local.get(
      ['transcriptLines', 'transcriptStorageFull'],
      ({ transcriptLines = [], transcriptStorageFull }) => {
        if (transcriptToggle.classList.contains('on')) {
          updateTranscriptStats(transcriptLines, transcriptStorageFull === true)
        }
      }
    )
  }
})
```

- [ ] **Step 6: Add download and clear listeners**

After the storage listener, add:

```js
downloadBtn.addEventListener('click', downloadTranscript)
clearBtn.addEventListener('click', clearTranscript)
```

- [ ] **Step 7: Manual end-to-end verification**

1. Reload the extension
2. Open the popup — confirm Transcript toggle is Off, card body is hidden
3. Click the Transcript toggle — confirm it turns green and the body appears showing "0 lines · 0 KB"
4. Go to HBO Max, play content for ~30 seconds
5. Open the popup again — confirm line count has increased
6. Click **Download .txt** — confirm a Save dialog appears and the file contains correctly formatted lines:
   ```
   DuoCue Transcript
   Generated: 2026-05-31 ...
   Lines: N
   ─────────────────────────────────
   [00:00:04] Hello there.
   ```
7. Click **Clear** — confirm stats reset to "0 lines · 0 KB"
8. Click the Transcript toggle Off — confirm body hides and storage is updated

- [ ] **Step 8: Commit**

```bash
git add popup.js
git commit -m "feat: wire up transcript card logic in popup"
```
