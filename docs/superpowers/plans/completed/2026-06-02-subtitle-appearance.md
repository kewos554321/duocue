# Subtitle Appearance Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add font size slider, font family dropdown, and bold toggle to the DuoCue popup; changes apply instantly to the subtitle overlay via `chrome.storage.onChanged`.

**Architecture:** Three new `chrome.storage.local` keys (`fontSize`, `fontFamily`, `bold`) are read on page load by `content.js` and applied as inline styles on `#duocue-overlay`. The popup writes to storage on every user interaction; `content.js`'s existing `storage.onChanged` handler is extended to pick up the new keys — no `sendMessage` needed. Static font values are removed from `styles.css` so CSS doesn't fight JS.

**Tech Stack:** Vanilla JS, Chrome Extension MV3, `chrome.storage.local`

---

## File Map

| File | Change |
|------|--------|
| `styles.css` | Remove `font-size` and `font-family` from `#duocue-overlay`, `.duocue-en`, `.duocue-zh` |
| `content.js` | Add module-level font vars + storage init + `createOverlay` apply + `onChanged` handlers |
| `popup.html` | Add CSS for range/select/bold-toggle; add HTML controls between colour swatches and API Key |
| `popup.js` | Add element refs, init from storage, event listeners for three new controls |

---

## Task 1: styles.css — Remove static font values

**Files:**
- Modify: `styles.css`

CSS properties that are about to be controlled by JS must be removed from the stylesheet, otherwise they win on specificity when `style=""` inline overrides are expected to take precedence — they won't because a class selector beats an inline style only when `!important` is involved, but this avoids confusion and keeps the source of truth clear.

- [ ] **Step 1: Remove font-size and font-family from #duocue-overlay**

Open `styles.css`. Replace the `#duocue-overlay` rule so it reads:

```css
#duocue-overlay {
  position: fixed;
  bottom: 12%;
  left: 50%;
  transform: translateX(-50%);
  z-index: 99999;
  background: rgba(0, 0, 0, 0.75);
  color: #ffffff;
  padding: 6px 16px;
  border-radius: 4px;
  max-width: 80vw;
  text-align: center;
  pointer-events: none;
  white-space: pre-wrap;
  display: none;
}
```

(Removed lines: `font-size: 1.4rem;` and `font-family: Arial, sans-serif;`)

- [ ] **Step 2: Remove font-size from .duocue-en and .duocue-zh**

Replace the two class rules:

```css
.duocue-en {
  color: #ffffff;
}

.duocue-zh {
  margin-top: 4px;
  white-space: normal;
}
```

(Removed `font-size: 1.4rem` from `.duocue-en` and `font-size: 1.2rem` from `.duocue-zh` — both will inherit from the overlay's inline `font-size`.)

- [ ] **Step 3: Verify in browser**

Load the extension in Chrome (`chrome://extensions` → Load unpacked → select project folder). Open `play.hbomax.com`, play a video with subtitles. Confirm subtitles still appear (they'll use the browser's default size temporarily — that's expected; `content.js` will set the size in Task 2).

- [ ] **Step 4: Commit**

```bash
git add styles.css
git commit -m "style: remove static font-size and font-family from overlay (will be set by JS)"
```

---

## Task 2: content.js — Read and apply font settings

**Files:**
- Modify: `content.js`

- [ ] **Step 1: Add module-level font variables after the existing subtitleColor variable**

In `content.js`, after line 21 (`let subtitleColor = '#FFD700'`), add:

```js
let fontSize   = 18
let fontFamily = 'Arial, sans-serif'
let bold       = false
```

- [ ] **Step 2: Read font settings from storage on init**

After the existing `chrome.storage.local.get('subtitleColor', ...)` block (around line 27), add:

```js
chrome.storage.local.get(['fontSize', 'fontFamily', 'bold'], ({ fontSize: fs, fontFamily: ff, bold: b }) => {
  if (fs != null) fontSize   = fs
  if (ff != null) fontFamily = ff
  if (b  != null) bold       = b
})
```

- [ ] **Step 3: Apply font settings when overlay is created**

Replace the existing `createOverlay` function with:

```js
function createOverlay() {
  if (document.getElementById('duocue-overlay')) return
  const div = document.createElement('div')
  div.id = 'duocue-overlay'
  div.style.fontSize   = `${fontSize}px`
  div.style.fontFamily = fontFamily
  div.style.fontWeight = bold ? 'bold' : 'normal'
  document.body.appendChild(div)
}
```

- [ ] **Step 4: Handle font changes in storage.onChanged**

In the existing `chrome.storage.onChanged.addListener` handler (around line 39), add three new `if` blocks after the existing `subtitleColor` and `displayMode` ones:

```js
if (changes.fontSize) {
  fontSize = changes.fontSize.newValue
  const el = document.getElementById('duocue-overlay')
  if (el) el.style.fontSize = `${fontSize}px`
}
if (changes.fontFamily) {
  fontFamily = changes.fontFamily.newValue
  const el = document.getElementById('duocue-overlay')
  if (el) el.style.fontFamily = fontFamily
}
if (changes.bold) {
  bold = changes.bold.newValue
  const el = document.getElementById('duocue-overlay')
  if (el) el.style.fontWeight = bold ? 'bold' : 'normal'
}
```

- [ ] **Step 5: Verify in browser**

Reload the extension. Open DevTools console on `play.hbomax.com`. Run:

```js
chrome.storage.local.set({ fontSize: 28, fontFamily: 'Georgia, serif', bold: true })
```

Expected: subtitle overlay immediately updates to large, serif, bold text. Then run:

```js
chrome.storage.local.set({ fontSize: 18, fontFamily: 'Arial, sans-serif', bold: false })
```

Expected: overlay resets to default appearance.

- [ ] **Step 6: Commit**

```bash
git add content.js
git commit -m "feat: apply font size, family and bold from chrome.storage to subtitle overlay"
```

---

## Task 3: popup.html — Add font controls

**Files:**
- Modify: `popup.html`

- [ ] **Step 1: Add CSS for range slider, font select, and bold toggle**

In `popup.html`, inside the `<style>` block, add after the `.clear-btn` rule (before `</style>`):

```css
/* ── Font size slider ── */
.slider-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.slider-value {
  color: #0A84FF;
  font-size: 13px;
  font-weight: 500;
  min-width: 32px;
  text-align: right;
}
input[type="range"] {
  width: 100%;
  height: 4px;
  accent-color: #0A84FF;
  cursor: pointer;
  background: transparent;
  margin: 0;
}

/* ── Font family select ── */
.select-wrap {
  position: relative;
}
.select-wrap select {
  width: 100%;
  height: 44px;
  background: #2C2C2E;
  border: 1px solid #3A3A3C;
  border-radius: 10px;
  padding: 0 36px 0 12px;
  color: #FFFFFF;
  font-size: 14px;
  font-family: inherit;
  appearance: none;
  -webkit-appearance: none;
  cursor: pointer;
  outline: none;
  transition: border-color 0.15s;
}
.select-wrap select:focus {
  border-color: #0A84FF;
}
.select-wrap::after {
  content: '▼';
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #8E8E93;
  font-size: 10px;
  pointer-events: none;
}
```

- [ ] **Step 2: Add font controls HTML between colour swatches and API Key**

In `popup.html`, locate the `<div class="divider"></div>` that sits between the colour section and API Key section. Insert the following **after** that divider:

```html
<!-- Font size -->
<div>
  <div class="slider-row">
    <span class="section-label" style="margin-bottom:0">字型大小</span>
    <span class="slider-value" id="fontSizeLabel">18pt</span>
  </div>
  <input type="range" id="fontSizeRange" min="12" max="32" step="1" value="18">
</div>

<!-- Font family -->
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

<!-- Bold toggle -->
<div style="display:flex;justify-content:space-between;align-items:center;">
  <span class="section-label" style="margin-bottom:0">粗體</span>
  <div class="toggle" id="boldToggle">
    <div class="toggle-knob"></div>
  </div>
</div>

<div class="divider"></div>
```

- [ ] **Step 3: Verify the popup renders**

Reload the extension. Click the DuoCue icon in the toolbar. Confirm three new controls appear between the colour swatches and API Key field: a slider with a blue value label, a styled dropdown, and a bold toggle. No layout breaks.

- [ ] **Step 4: Commit**

```bash
git add popup.html
git commit -m "feat: add font size slider, font family select, and bold toggle to popup UI"
```

---

## Task 4: popup.js — Wire up font controls

**Files:**
- Modify: `popup.js`

- [ ] **Step 1: Add element references at the top of popup.js**

After the existing `const segBtns` line, add:

```js
const fontSizeRange   = document.getElementById('fontSizeRange')
const fontSizeLabel   = document.getElementById('fontSizeLabel')
const fontFamilySelect = document.getElementById('fontFamilySelect')
const boldToggle      = document.getElementById('boldToggle')
```

- [ ] **Step 2: Load saved font settings in the init block**

The existing `chrome.storage.local.get(...)` call at the bottom of the init section reads several keys. Extend the key list and add init logic. Find:

```js
chrome.storage.local.get(
  ['translationApiKey', 'enabled', 'subtitleColor', 'displayMode', 'transcriptEnabled', 'transcriptLines', 'transcriptStorageFull'],
```

Replace with:

```js
chrome.storage.local.get(
  ['translationApiKey', 'enabled', 'subtitleColor', 'displayMode', 'transcriptEnabled', 'transcriptLines', 'transcriptStorageFull', 'fontSize', 'fontFamily', 'bold'],
```

Then inside the same callback, after the `selectMode(displayMode || 'both')` line, add:

```js
const fs = fontSize ?? 18
fontSizeRange.value         = fs
fontSizeLabel.textContent   = `${fs}pt`

fontFamilySelect.value = fontFamily || 'Arial, sans-serif'

if (bold === true) boldToggle.classList.add('on')
```

- [ ] **Step 3: Add event listener for font size slider**

After the existing display-mode event listeners block, add:

```js
// ── Font size ─────────────────────────────────────────────────────────────
fontSizeRange.addEventListener('input', () => {
  const size = Number(fontSizeRange.value)
  fontSizeLabel.textContent = `${size}pt`
  chrome.storage.local.set({ fontSize: size })
})
```

- [ ] **Step 4: Add event listener for font family select**

```js
// ── Font family ───────────────────────────────────────────────────────────
fontFamilySelect.addEventListener('change', () => {
  chrome.storage.local.set({ fontFamily: fontFamilySelect.value })
})
```

- [ ] **Step 5: Add event listener for bold toggle**

```js
// ── Bold ──────────────────────────────────────────────────────────────────
boldToggle.addEventListener('click', () => {
  const isOn = boldToggle.classList.toggle('on')
  chrome.storage.local.set({ bold: isOn })
})
```

- [ ] **Step 6: End-to-end verification**

Reload the extension. Open `play.hbomax.com` with subtitles playing. Open the DuoCue popup.

| Action | Expected result |
|--------|-----------------|
| Drag font size slider to 28 | Subtitle text grows immediately on screen; label shows `28pt` |
| Drag slider back to 14 | Subtitle text shrinks |
| Select `Georgia, serif` | Subtitles switch to serif font immediately |
| Select `Impact, sans-serif` | Subtitles switch to Impact immediately |
| Toggle bold ON | Subtitles go bold |
| Toggle bold OFF | Subtitles return to normal weight |
| Close popup, reload page, open popup | Slider, select, toggle show last saved values |
| All subtitle colours still work | Colour swatches still change `.duocue-zh` colour |

- [ ] **Step 7: Commit**

```bash
git add popup.js
git commit -m "feat: wire font size, family, and bold controls to chrome.storage in popup"
```
