# Popup Redesign + Translation Engine Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the popup into four collapsible sections and add a free translation engine (MyMemory) as the default, with Google Translate as an opt-in that shows the API key field.

**Architecture:** `content.js` gains `translateFree()` (MyMemory) and `translateGoogle()` (existing logic renamed), routed by a new `translationEngine` storage key. `popup.html` body is rewritten into four `.section` accordion cards; all existing element IDs are preserved so `popup.js` event handlers require minimal changes. `popup.js` gains `initSections()` for accordion behaviour, `updateSummaries()` to refresh collapsed-row text, and an engine picker handler.

**Tech Stack:** Vanilla JS, Chrome Extension MV3, `chrome.storage.local`, MyMemory REST API

---

## File Map

| File | Change |
|------|--------|
| `manifest.json` | Add MyMemory to `host_permissions` |
| `content.js` | Add `translateFree()`, rename `translate()` → `translateGoogle()`, new `translate()` router, `translationEngine` var |
| `popup.html` | Add section CSS; rewrite `<body>` into 4 collapsible `.section` cards |
| `popup.js` | Narrow `segBtns` selector; add refs, `initSections()`, `updateSummaries()`, engine-picker handler; update init block |

---

## Task 1: manifest.json — Allow MyMemory host

**Files:**
- Modify: `manifest.json`

- [ ] **Step 1: Add MyMemory to host_permissions**

Open `manifest.json`. Replace:

```json
"host_permissions": ["https://translation.googleapis.com/*"],
```

With:

```json
"host_permissions": [
  "https://translation.googleapis.com/*",
  "https://api.mymemory.translated.net/*"
],
```

- [ ] **Step 2: Commit**

```bash
git add manifest.json
git commit -m "feat: allow MyMemory API in host_permissions"
```

---

## Task 2: content.js — MyMemory + engine routing

**Files:**
- Modify: `content.js`

- [ ] **Step 1: Add translationEngine module-level variable**

After the existing `let bold = false` line (~line 26), add:

```js
let translationEngine = 'free'
```

- [ ] **Step 2: Read translationEngine from storage on init**

After the existing font settings storage read block, add:

```js
chrome.storage.local.get('translationEngine', ({ translationEngine: e }) => {
  if (e) translationEngine = e
})
```

- [ ] **Step 3: Add translationEngine to storage.onChanged handler**

Inside the existing `chrome.storage.onChanged.addListener` handler, after the `changes.bold` block, add:

```js
if (changes.translationEngine) {
  translationEngine = changes.translationEngine.newValue
}
```

- [ ] **Step 4: Replace translate() with three functions**

Find the existing `async function translate(text) { ... }` function and replace it entirely with:

```js
async function translateFree(text) {
  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|zh-TW`
    )
    const data = await res.json()
    if (data.responseStatus !== 200) return null
    return data.responseData?.translatedText ?? null
  } catch {
    return null
  }
}

async function translateGoogle(text) {
  const { translationApiKey } = await chrome.storage.local.get('translationApiKey')
  if (!translationApiKey) return null
  try {
    const res = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${translationApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text, target: 'zh-TW', format: 'text' }),
      }
    )
    const data = await res.json()
    return data?.data?.translations?.[0]?.translatedText ?? null
  } catch {
    return null
  }
}

async function translate(text) {
  return translationEngine === 'google'
    ? translateGoogle(text)
    : translateFree(text)
}
```

- [ ] **Step 5: Verify**

Reload the extension. Open a video on `play.hbomax.com`. Open DevTools console. Run:

```js
chrome.storage.local.set({ translationEngine: 'free' })
```

Expected: Chinese subtitles appear via MyMemory (no API key needed). Then run:

```js
chrome.storage.local.set({ translationEngine: 'google' })
```

Expected: Chinese subtitles disappear (no API key set), i.e. overlay shows English only.

- [ ] **Step 6: Commit**

```bash
git add content.js
git commit -m "feat: add MyMemory free translation and engine routing in content.js"
```

---

## Task 3: popup.html — Collapsible sections

**Files:**
- Modify: `popup.html`

- [ ] **Step 1: Add section CSS before </style>**

Inside the `<style>` block, after the `.select-wrap::after` rule, add:

```css
/* ── Sections (accordion) ── */
#sections {
  padding: 10px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section {
  background: #2C2C2E;
  border-radius: 12px;
  overflow: hidden;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 13px 14px;
  cursor: pointer;
  user-select: none;
}

.section-title {
  font-size: 14px;
  font-weight: 500;
  color: #FFFFFF;
  flex: 1;
}

.section-summary {
  font-size: 12px;
  color: #8E8E93;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 140px;
  text-align: right;
}

.chevron {
  flex-shrink: 0;
  color: #8E8E93;
  transition: transform 0.2s, color 0.2s;
}

.section-header.open .chevron {
  transform: rotate(180deg);
  color: #0A84FF;
}

.section-body {
  border-top: 0.5px solid #3A3A3C;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ── Engine info / warning ── */
.engine-info {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.engine-info-icon { color: #30D158; font-size: 14px; line-height: 1.4; }

.engine-info-title {
  color: rgba(235,235,245,0.8);
  font-size: 13px;
  font-weight: 500;
}

.engine-info-desc { color: #636366; font-size: 11px; margin-top: 2px; }

.engine-warning {
  font-size: 11px;
  color: #FF9F0A;
  background: rgba(255,159,10,0.1);
  border: 1px solid rgba(255,159,10,0.25);
  border-radius: 10px;
  padding: 10px 12px;
  line-height: 1.6;
  margin: 0;
}
```

- [ ] **Step 2: Replace the entire body content**

Delete everything between `<body>` and `<script src="popup.js"></script>`, replacing it with:

```html
  <!-- Header -->
  <div class="header">
    <div class="header-title">
      <div class="status-dot"></div>
      <span class="title-text">DuoCue</span>
      <div class="toggle" id="toggle">
        <div class="toggle-knob"></div>
      </div>
    </div>
  </div>

  <div id="sections">

    <!-- ① 字幕顯示 -->
    <div class="section">
      <div class="section-header" id="hdrDisplay" role="button" aria-expanded="false">
        <span class="section-title">字幕顯示</span>
        <span class="section-summary" id="summaryDisplay">兩者</span>
        <svg class="chevron" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
      <div class="section-body" id="bodyDisplay" style="display:none">
        <div>
          <span class="section-label">顯示模式</span>
          <div class="seg-control" id="segControl" role="group" aria-label="Display mode">
            <button class="seg-btn active" data-mode="both">兩者</button>
            <button class="seg-btn" data-mode="original">原文</button>
            <button class="seg-btn" data-mode="translation">翻譯</button>
          </div>
        </div>
      </div>
    </div>

    <!-- ② 字幕外觀 -->
    <div class="section">
      <div class="section-header" id="hdrAppearance" role="button" aria-expanded="false">
        <span class="section-title">字幕外觀</span>
        <span class="section-summary" id="summaryAppearance">白 · 18pt · Arial</span>
        <svg class="chevron" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
      <div class="section-body" id="bodyAppearance" style="display:none">
        <div>
          <span class="section-label">字幕顏色</span>
          <div class="color-swatches">
            <div class="color-swatch" data-color="#FFD700" style="background:#FFD700;--swatch-color:#FFD700"></div>
            <div class="color-swatch" data-color="#FFFFFF" style="background:#FFFFFF;--swatch-color:#FFFFFF"></div>
            <div class="color-swatch" data-color="#00E5FF" style="background:#00E5FF;--swatch-color:#00E5FF"></div>
            <div class="color-swatch" data-color="#FF6B6B" style="background:#FF6B6B;--swatch-color:#FF6B6B"></div>
            <div class="color-swatch" data-color="#98FB98" style="background:#98FB98;--swatch-color:#98FB98"></div>
            <div class="color-swatch color-custom" id="customSwatch" style="--swatch-color:#FFFFFF"></div>
          </div>
          <input type="color" id="colorPicker" style="display:none">
        </div>
        <div>
          <div class="slider-row">
            <span class="section-label" style="margin-bottom:0">字型大小</span>
            <span class="slider-value" id="fontSizeLabel">18pt</span>
          </div>
          <input type="range" id="fontSizeRange" min="12" max="32" step="1" value="18">
        </div>
        <div>
          <span class="section-label">字型</span>
          <div class="select-wrap">
            <select id="fontFamilySelect">
              <option value="Arial, sans-serif">Arial, sans-serif（系統預設）</option>
              <option value="Georgia, serif">Georgia, serif（有襯線）</option>
              <option value='"Courier New", monospace'>Courier New, monospace（等寬）</option>
              <option value='"Helvetica Neue", sans-serif'>Helvetica Neue</option>
              <option value="Impact, sans-serif">Impact（粗黑體）</option>
            </select>
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span class="section-label" style="margin-bottom:0">粗體</span>
          <div class="toggle" id="boldToggle"><div class="toggle-knob"></div></div>
        </div>
      </div>
    </div>

    <!-- ③ 翻譯引擎 -->
    <div class="section">
      <div class="section-header" id="hdrEngine" role="button" aria-expanded="false">
        <span class="section-title">翻譯引擎</span>
        <span class="section-summary" id="summaryEngine">免費</span>
        <svg class="chevron" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
      <div class="section-body" id="bodyEngine" style="display:none">
        <div class="seg-control" id="enginePicker" role="group" aria-label="Translation engine">
          <button class="seg-btn active" data-engine="free">免費</button>
          <button class="seg-btn" data-engine="google">Google Translate</button>
        </div>
        <div id="freeInfo" class="engine-info">
          <span class="engine-info-icon">✓</span>
          <div>
            <div class="engine-info-title">MyMemory 免費翻譯</div>
            <div class="engine-info-desc">每天 1,000 字，無需帳號</div>
          </div>
        </div>
        <div id="googleConfig" style="display:none;flex-direction:column;gap:12px;">
          <div>
            <div class="field-header">
              <span class="field-label">API Key</span>
              <span class="field-status" id="keyStatus"></span>
            </div>
            <div class="input-wrap">
              <input type="password" id="apiKey" placeholder="AIza...">
              <span class="eye-btn" id="eyeBtn"><svg width="17" height="17" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 3.5C4.5 3.5 1.5 8 1.5 8C1.5 8 4.5 12.5 8 12.5C11.5 12.5 14.5 8 14.5 8C14.5 8 11.5 3.5 8 3.5Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.3"/></svg></span>
            </div>
          </div>
          <button id="save">Save Key</button>
          <p class="engine-warning">需要 Google Cloud API Key。每月 500,000 字元免費，超過 $20/1M 字元。</p>
        </div>
      </div>
    </div>

    <!-- ④ 逐字稿 -->
    <div class="section">
      <div class="section-header" id="hdrTranscript" role="button" aria-expanded="false">
        <span class="section-title">逐字稿</span>
        <span class="section-summary" id="summaryTranscript">關閉</span>
        <svg class="chevron" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
      <div class="section-body" id="bodyTranscript" style="display:none">
        <div class="field-header">
          <span class="field-label">記錄字幕</span>
          <div class="toggle" id="transcriptToggle"><div class="toggle-knob"></div></div>
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
    </div>

  </div>
```

- [ ] **Step 3: Verify the popup renders**

Reload the extension. Click the DuoCue icon. Confirm:
- Four collapsed rows visible: 字幕顯示, 字幕外觀, 翻譯引擎, 逐字稿
- Each row shows a summary value on the right and a chevron
- No console errors

- [ ] **Step 4: Commit**

```bash
git add popup.html
git commit -m "feat: rewrite popup body into collapsible accordion sections"
```

---

## Task 4: popup.js — Accordion, summaries, engine picker

**Files:**
- Modify: `popup.js`

- [ ] **Step 1: Narrow segBtns selector and add new element refs**

Replace the existing `const segBtns` line:

```js
const segBtns     = document.querySelectorAll('.seg-btn')
```

With:

```js
const segBtns      = document.querySelectorAll('#segControl .seg-btn')
const engineBtns   = document.querySelectorAll('#enginePicker .seg-btn')
const freeInfo     = document.getElementById('freeInfo')
const googleConfig = document.getElementById('googleConfig')
```

- [ ] **Step 2: Add color name helper and updateSummaries()**

After the existing `const boldToggle` line, add:

```js
const COLOR_NAMES = {
  '#FFD700': '金色', '#FFFFFF': '白色', '#00E5FF': '青色',
  '#FF6B6B': '紅色', '#98FB98': '綠色',
}

function colorName(hex) {
  if (!hex) return '自訂'
  return COLOR_NAMES[hex.toUpperCase()] || '自訂'
}

function fontAbbr(ff) {
  return (ff || 'Arial').split(',')[0].replace(/['"]/g, '').trim()
}

function updateSummaries() {
  const activeMode = [...segBtns].find(b => b.classList.contains('active'))
  document.getElementById('summaryDisplay').textContent = activeMode?.textContent ?? '兩者'

  const selSwatch = [...swatches].find(s => s.classList.contains('selected'))
  const isCustom  = customSwatch.classList.contains('selected')
  const cName     = isCustom ? '自訂' : colorName(selSwatch?.dataset.color || '')
  const size      = fontSizeRange.value
  const font      = fontAbbr(fontFamilySelect.value)
  document.getElementById('summaryAppearance').textContent = `${cName} · ${size}pt · ${font}`

  const activeEngine = [...engineBtns].find(b => b.classList.contains('active'))
  document.getElementById('summaryEngine').textContent =
    activeEngine?.dataset.engine === 'google' ? 'Google Translate' : '免費'

  document.getElementById('summaryTranscript').textContent =
    transcriptToggle.classList.contains('on') ? '記錄中' : '關閉'
}
```

- [ ] **Step 3: Add initSections()**

After `updateSummaries`, add:

```js
function initSections() {
  document.querySelectorAll('.section-header').forEach(header => {
    const body = header.nextElementSibling
    header.addEventListener('click', () => {
      const isOpen = header.classList.contains('open')
      header.classList.toggle('open', !isOpen)
      header.setAttribute('aria-expanded', String(!isOpen))
      body.style.display = isOpen ? 'none' : ''
    })
  })
}
```

- [ ] **Step 4: Add engine picker handler**

After the existing `segBtns.forEach` display-mode block, add:

```js
// ── Engine picker ──────────────────────────────────────────────────────────
function selectEngine(engine) {
  engineBtns.forEach(b => b.classList.toggle('active', b.dataset.engine === engine))
  freeInfo.style.display      = engine === 'free'   ? ''     : 'none'
  googleConfig.style.display  = engine === 'google' ? 'flex' : 'none'
  chrome.storage.local.set({ translationEngine: engine })
  updateSummaries()
}

engineBtns.forEach(btn => {
  btn.addEventListener('click', () => selectEngine(btn.dataset.engine))
})
```

- [ ] **Step 5: Update the init block**

Find the `chrome.storage.local.get(` call and update the key list and callback to include `translationEngine`:

```js
chrome.storage.local.get(
  ['translationApiKey', 'enabled', 'subtitleColor', 'displayMode', 'transcriptEnabled',
   'transcriptLines', 'transcriptStorageFull', 'fontSize', 'fontFamily', 'bold', 'translationEngine'],
  ({ translationApiKey, enabled, subtitleColor, displayMode, transcriptEnabled,
     transcriptLines = [], transcriptStorageFull, fontSize, fontFamily, bold, translationEngine }) => {

    if (enabled !== false) toggle.classList.add('on')

    if (translationApiKey) apiKeyInput.value = translationApiKey
    setKeyStatus(!!translationApiKey)

    selectColor(subtitleColor || '#FFD700')
    selectMode(displayMode || 'both')

    const fs = fontSize ?? 18
    fontSizeRange.value       = fs
    fontSizeLabel.textContent = `${fs}pt`
    fontFamilySelect.value    = fontFamily || 'Arial, sans-serif'
    if (bold === true) boldToggle.classList.add('on')

    if (transcriptEnabled === true) {
      transcriptToggle.classList.add('on')
      transcriptBody.classList.remove('hidden')
      updateTranscriptStats(transcriptLines, transcriptStorageFull === true)
    }

    // Engine (must run after selectColor/selectMode so summaries are accurate)
    selectEngine(translationEngine || 'free')

    initSections()
    updateSummaries()
  }
)
```

- [ ] **Step 6: Add updateSummaries() calls to existing event handlers**

Each time a setting changes, the summary must refresh. Add `updateSummaries()` as the last line inside these existing handlers:

- `toggle.addEventListener('click', ...)` → add `updateSummaries()` at end
- `segBtns.forEach` click handler → add `updateSummaries()` after `chrome.storage.local.set`
- `fontSizeRange.addEventListener('input', ...)` → add `updateSummaries()` at end
- `fontFamilySelect.addEventListener('change', ...)` → add `updateSummaries()` at end
- `boldToggle.addEventListener('click', ...)` → add `updateSummaries()` at end
- `swatches.forEach` click handler → add `updateSummaries()` at end
- `colorPicker.addEventListener('input', ...)` → add `updateSummaries()` at end
- `transcriptToggle.addEventListener('click', ...)` → add `updateSummaries()` at end

Full updated handlers (copy-paste ready):

```js
toggle.addEventListener('click', () => {
  const isOn = toggle.classList.toggle('on')
  chrome.storage.local.set({ enabled: isOn })
  updateSummaries()
})

transcriptToggle.addEventListener('click', () => {
  const isOn = transcriptToggle.classList.toggle('on')
  transcriptBody.classList.toggle('hidden', !isOn)
  chrome.storage.local.set({ transcriptEnabled: isOn })
  updateSummaries()
})

segBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const mode = btn.dataset.mode
    selectMode(mode)
    chrome.storage.local.set({ displayMode: mode })
    updateSummaries()
  })
})

fontSizeRange.addEventListener('input', () => {
  const size = Number(fontSizeRange.value)
  fontSizeLabel.textContent = `${size}pt`
  chrome.storage.local.set({ fontSize: size })
  updateSummaries()
})

fontFamilySelect.addEventListener('change', () => {
  chrome.storage.local.set({ fontFamily: fontFamilySelect.value })
  updateSummaries()
})

boldToggle.addEventListener('click', () => {
  const isOn = boldToggle.classList.toggle('on')
  chrome.storage.local.set({ bold: isOn })
  updateSummaries()
})

swatches.forEach(swatch => {
  swatch.addEventListener('click', () => {
    const color = swatch.dataset.color
    selectColor(color)
    chrome.storage.local.set({ subtitleColor: color })
    updateSummaries()
  })
})

customSwatch.addEventListener('click', () => colorPicker.click())

colorPicker.addEventListener('input', () => {
  const color = colorPicker.value
  selectColor(color, true)
  chrome.storage.local.set({ subtitleColor: color })
  updateSummaries()
})
```

- [ ] **Step 7: End-to-end verification**

Reload the extension. Click the DuoCue icon.

| Action | Expected |
|--------|----------|
| Click 字幕顯示 row | Expands, chevron turns blue and points up |
| Click again | Collapses back |
| Change display mode to 原文 | 字幕顯示 summary updates to 原文 |
| Click 字幕外觀, change size to 24 | Appearance summary updates to `白 · 24pt · Arial` |
| Select custom color via rainbow swatch | Summary shows `自訂 · 24pt · Arial` |
| Click 翻譯引擎, switch to Google Translate | Google config (API Key + Save) appears; free info hides; summary → Google Translate |
| Switch back to 免費 | API Key hides; free info shows; summary → 免費 |
| Open video on play.hbomax.com with 免費 selected | Chinese subtitles appear without API key |

- [ ] **Step 8: Commit**

```bash
git add popup.js
git commit -m "feat: add accordion sections, summaries, and engine picker to popup"
```
