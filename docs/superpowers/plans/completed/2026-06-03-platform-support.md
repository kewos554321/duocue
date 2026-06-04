# Multi-Platform Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract platform configs into `platforms.js`, add Netflix and YouTube support, and add a manual platform picker to the popup so users select their current platform explicitly.

**Architecture:** A new `platforms.js` file (loaded before `content.js` via manifest) defines all platform configs as a global `PLATFORMS` array. `content.js` reads `selectedPlatform` from storage first (manual popup selection), falling back to hostname detection. The popup gains a "平台" accordion section with three buttons. Hiding native subtitles is injected dynamically per platform; the hardcoded HBO Max CSS is removed from `styles.css`.

**Tech Stack:** Vanilla JS, Chrome Extension MV3, `chrome.storage.local`

---

## File Map

| File | Change |
|------|--------|
| `platforms.js` | **Create** — defines global `PLATFORMS` array with HBO Max, Netflix, YouTube |
| `manifest.json` | Add `platforms.js` to `js` array; add Netflix + YouTube URL matches |
| `content.js` | Remove `PLATFORMS`; make `detectPlatform()` async (storage first, hostname fallback); update `extractText`, `syncOverlayParent`; add `injectHideNativeCSS()` |
| `styles.css` | Remove hardcoded HBO Max native-subtitle CSS |
| `popup.html` | Add "平台" section (first section) with 3-button picker |
| `popup.js` | Add platform picker refs, `selectPlatform()`, init + event wiring, summary update |

---

## Task 1: platforms.js — Create platform config file

**Files:**
- Create: `platforms.js`

- [ ] **Step 1: Create the file**

Create `/Users/kewos/Documents/projects/duocue/platforms.js` with:

```js
const PLATFORMS = [
  {
    id: 'hbomax',
    name: 'HBO Max',
    hostname: 'play.hbomax.com',
    textSelector: '[class*="TextCue-Fuse-Web-Play"]',
    textJoin: '\n',
    playerSelector: '[data-testid="playerContainer"]',
    hideNativeSelector: '[class*="CaptionWindow-Fuse-Web-Play"]',
  },
  {
    id: 'netflix',
    name: 'Netflix',
    hostname: 'www.netflix.com',
    textSelector: '.player-timedtext-text-container',
    textJoin: '\n',
    playerSelector: '.watch-video--player-view',
    hideNativeSelector: '.player-timedtext',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    hostname: 'www.youtube.com',
    textSelector: '.ytp-caption-segment',
    textJoin: ' ',
    playerSelector: '#movie_player',
    hideNativeSelector: '.ytp-caption-window-container',
  },
]
```

- [ ] **Step 2: Commit**

```bash
git add platforms.js
git commit -m "feat: create platforms.js with HBO Max, Netflix, YouTube configs"
```

---

## Task 2: manifest.json — Load platforms.js + add URL matches

**Files:**
- Modify: `manifest.json`

- [ ] **Step 1: Update content_scripts**

Replace the entire `content_scripts` block:

```json
"content_scripts": [
  {
    "matches": [
      "*://play.hbomax.com/*",
      "*://www.netflix.com/watch/*",
      "*://www.youtube.com/*"
    ],
    "js": ["platforms.js", "content.js"],
    "css": ["styles.css"],
    "run_at": "document_idle"
  }
]
```

`platforms.js` must appear before `content.js` so the global `PLATFORMS` is available when `content.js` executes.

- [ ] **Step 2: Commit**

```bash
git add manifest.json
git commit -m "feat: add Netflix and YouTube to manifest content_scripts"
```

---

## Task 3: styles.css — Remove hardcoded HBO Max CSS

**Files:**
- Modify: `styles.css`

- [ ] **Step 1: Remove the HBO Max native subtitle rule**

Find and delete this rule from `styles.css`:

```css
[class*="CaptionWindow-Fuse-Web-Play"] {
  display: none !important;
}
```

`content.js` will inject this dynamically per platform in Task 4.

- [ ] **Step 2: Commit**

```bash
git add styles.css
git commit -m "refactor: remove hardcoded HBO Max CSS (now injected dynamically)"
```

---

## Task 4: content.js — Modularize + async platform detection

**Files:**
- Modify: `content.js`

- [ ] **Step 1: Remove the PLATFORMS array**

Delete lines 1–8 (the entire `const PLATFORMS = [...]` block). `PLATFORMS` now comes from `platforms.js`.

- [ ] **Step 2: Replace detectPlatform() with async version**

Replace the existing `function detectPlatform()` with:

```js
async function detectPlatform() {
  const { selectedPlatform } = await chrome.storage.local.get('selectedPlatform')
  if (selectedPlatform) {
    return PLATFORMS.find(p => p.id === selectedPlatform) ?? null
  }
  return PLATFORMS.find(p => location.hostname === p.hostname) ?? null
}
```

- [ ] **Step 3: Add injectHideNativeCSS() before startPolling**

After the `translate()` function, add:

```js
function injectHideNativeCSS(platform) {
  const id = 'duocue-hide-native'
  if (document.getElementById(id)) return
  const style = document.createElement('style')
  style.id = id
  style.textContent = `${platform.hideNativeSelector} { display: none !important; }`
  document.head.appendChild(style)
}
```

- [ ] **Step 4: Update extractText() to use platform.textJoin**

Replace the existing `extractText` function with:

```js
function extractText(platform) {
  const nodes = document.querySelectorAll(platform.textSelector)
  return Array.from(nodes)
    .map(n => n.textContent.trim())
    .filter(Boolean)
    .join(platform.textJoin ?? '\n')
}
```

- [ ] **Step 5: Update syncOverlayParent to use platform.playerSelector**

Inside `startPolling`, replace the hardcoded `syncOverlayParent` function with:

```js
function syncOverlayParent() {
  const overlay = document.getElementById('duocue-overlay')
  if (!overlay) return
  const player = platform.playerSelector
    ? document.querySelector(platform.playerSelector)
    : null
  const target = player || document.body
  if (overlay.parentElement !== target) target.appendChild(overlay)
}
```

- [ ] **Step 6: Call injectHideNativeCSS at the start of startPolling**

Inside `startPolling`, after `createOverlay()`, add:

```js
injectHideNativeCSS(platform)
```

- [ ] **Step 7: Make the bottom call async**

Replace the last two lines of `content.js`:

```js
const platform = detectPlatform()
if (platform) startPolling(platform)
```

With:

```js
;(async () => {
  const platform = await detectPlatform()
  if (platform) startPolling(platform)
})()
```

- [ ] **Step 8: Verify HBO Max still works**

Reload the extension. Open `play.hbomax.com`, play a video. Confirm:
- Subtitles still appear in the overlay
- Netflix native subtitles are hidden (injected CSS)
- No console errors

- [ ] **Step 9: Commit**

```bash
git add content.js
git commit -m "refactor: modularize platform config, async detectPlatform, dynamic CSS injection"
```

---

## Task 5: popup.html — Add platform picker section

**Files:**
- Modify: `popup.html`

- [ ] **Step 1: Insert platform section as the first section in #sections**

In `popup.html`, find the opening `<div id="sections">` tag and insert the following immediately after it (before the 字幕顯示 section):

```html
    <!-- ⓪ 平台 -->
    <div class="section">
      <div class="section-header" id="hdrPlatform" role="button" aria-expanded="false">
        <span class="section-title">平台</span>
        <span class="section-summary" id="summaryPlatform">未選擇</span>
        <svg class="chevron" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
      <div class="section-body" id="bodyPlatform" style="display:none">
        <div class="seg-control" id="platformPicker" role="group" aria-label="Platform">
          <button class="seg-btn" data-platform="hbomax">HBO Max</button>
          <button class="seg-btn" data-platform="netflix">Netflix</button>
          <button class="seg-btn" data-platform="youtube">YouTube</button>
        </div>
        <p style="color:#636366;font-size:11px;margin:0;line-height:1.5;">切換平台後請重新整理頁面</p>
      </div>
    </div>

```

- [ ] **Step 2: Verify popup renders**

Reload the extension. Open the popup. Confirm a "平台" row appears at the top with "未選擇" summary and a chevron. Clicking it expands to show three buttons.

- [ ] **Step 3: Commit**

```bash
git add popup.html
git commit -m "feat: add platform picker section to popup"
```

---

## Task 6: popup.js — Wire platform picker

**Files:**
- Modify: `popup.js`

- [ ] **Step 1: Add platformBtns ref**

After the existing `const engineBtns` line, add:

```js
const platformBtns = document.querySelectorAll('#platformPicker .seg-btn')
```

- [ ] **Step 2: Add selectPlatform() function**

After the existing `selectEngine()` function, add:

```js
// ── Platform picker ───────────────────────────────────────────────────────
function selectPlatform(id) {
  platformBtns.forEach(b => b.classList.toggle('active', b.dataset.platform === id))
  const name = [...platformBtns].find(b => b.dataset.platform === id)?.textContent ?? '未選擇'
  document.getElementById('summaryPlatform').textContent = name
  chrome.storage.local.set({ selectedPlatform: id })
}
```

- [ ] **Step 3: Add platform event listeners**

After the `engineBtns.forEach` block, add:

```js
platformBtns.forEach(btn => {
  btn.addEventListener('click', () => selectPlatform(btn.dataset.platform))
})
```

- [ ] **Step 4: Load savedPlatform in the init block**

In the `chrome.storage.local.get(...)` init call, add `'selectedPlatform'` to the key list:

```js
chrome.storage.local.get(
  ['translationApiKey', 'enabled', 'subtitleColor', 'displayMode', 'transcriptEnabled',
   'transcriptLines', 'transcriptStorageFull', 'fontSize', 'fontFamily', 'bold',
   'translationEngine', 'selectedPlatform'],
  ({ translationApiKey, enabled, subtitleColor, displayMode, transcriptEnabled,
     transcriptLines = [], transcriptStorageFull, fontSize, fontFamily, bold,
     translationEngine, selectedPlatform }) => {
```

Then inside the callback, after `selectEngine(translationEngine || 'free')`, add:

```js
if (selectedPlatform) selectPlatform(selectedPlatform)
```

- [ ] **Step 5: End-to-end verification**

Reload the extension.

| Action | Expected |
|--------|----------|
| Open popup | 平台 row shows "未選擇" |
| Click 平台, select Netflix | Summary shows "Netflix"; storage has `selectedPlatform: "netflix"` |
| Reload page on `www.netflix.com` | DuoCue overlay shows subtitle + translation |
| Open popup again | 平台 still shows "Netflix" (persisted) |
| Select HBO Max, reload `play.hbomax.com` | Overlay still works on HBO Max |
| Select YouTube, go to `youtube.com` with captions | Overlay shows subtitle + translation |

- [ ] **Step 6: Commit**

```bash
git add popup.js
git commit -m "feat: wire platform picker to chrome.storage in popup"
```
