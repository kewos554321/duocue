# Background Opacity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a background opacity slider (0–100%, default 75%) to the popup's 字幕外觀 section, applying changes instantly to the subtitle overlay.

**Architecture:** Follows the exact same pattern as `fontSize` — remove the hardcoded value from CSS, add a module-level variable in `content.js` read from `chrome.storage.local`, apply in `createOverlay()` and via `storage.onChanged`. Popup gets a range input wired identically to `fontSizeRange`.

**Tech Stack:** Vanilla JS, Chrome Extension MV3, `chrome.storage.local`

---

## File Map

| File | Change |
|------|--------|
| `styles.css` | Remove `background: rgba(0,0,0,0.75)` from `#duocue-overlay` |
| `content.js` | Add `bgOpacity` var, storage init, `createOverlay` apply, `onChanged` handler |
| `popup.html` | Add slider + label after font size slider |
| `popup.js` | Add refs, init read, `input` event, `updateSummaries` update |

---

## Task 1: styles.css — Remove hardcoded background

**Files:**
- Modify: `styles.css`

- [ ] **Step 1: Remove the background property from #duocue-overlay**

In `styles.css`, find the `#duocue-overlay` rule and delete the line `background: rgba(0, 0, 0, 0.75);`. The rule should now read:

```css
#duocue-overlay {
  position: fixed;
  bottom: 12%;
  left: 50%;
  transform: translateX(-50%);
  z-index: 99999;
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

- [ ] **Step 2: Commit**

```bash
git add styles.css
git commit -m "style: remove hardcoded overlay background (will be set by JS)"
```

---

## Task 2: content.js — Read and apply bgOpacity

**Files:**
- Modify: `content.js`

- [ ] **Step 1: Add bgOpacity module-level variable**

After the existing `let bold = false` line, add:

```js
let bgOpacity = 75
```

- [ ] **Step 2: Read bgOpacity from storage on init**

After the existing font settings storage read block, add:

```js
chrome.storage.local.get('bgOpacity', ({ bgOpacity: op }) => {
  if (op != null) bgOpacity = op
})
```

- [ ] **Step 3: Apply bgOpacity in createOverlay()**

In `createOverlay()`, after the existing `div.style.fontWeight` line, add:

```js
div.style.background = `rgba(0, 0, 0, ${bgOpacity / 100})`
```

- [ ] **Step 4: Handle bgOpacity in storage.onChanged**

In the existing `chrome.storage.onChanged.addListener` handler, after the `changes.bold` block, add:

```js
if (changes.bgOpacity) {
  bgOpacity = changes.bgOpacity.newValue
  const el = document.getElementById('duocue-overlay')
  if (el) el.style.background = `rgba(0, 0, 0, ${bgOpacity / 100})`
}
```

- [ ] **Step 5: Verify in browser**

Reload the extension. Open DevTools console on `play.hbomax.com`. Run:

```js
chrome.storage.local.set({ bgOpacity: 0 })
```

Expected: subtitle background becomes fully transparent. Then run:

```js
chrome.storage.local.set({ bgOpacity: 75 })
```

Expected: subtitle background returns to default opacity.

- [ ] **Step 6: Commit**

```bash
git add content.js
git commit -m "feat: apply bgOpacity from chrome.storage to subtitle overlay"
```

---

## Task 3: popup.html — Add opacity slider

**Files:**
- Modify: `popup.html`

- [ ] **Step 1: Insert slider after the font size slider block**

In `popup.html`, find the font size block inside `#bodyAppearance`:

```html
        <div>
          <div class="slider-row">
            <span class="section-label" style="margin-bottom:0">字型大小</span>
            <span class="slider-value" id="fontSizeLabel">18pt</span>
          </div>
          <input type="range" id="fontSizeRange" min="12" max="32" step="1" value="18">
        </div>
```

Insert the following block immediately after it:

```html
        <div>
          <div class="slider-row">
            <span class="section-label" style="margin-bottom:0">背景透明度</span>
            <span class="slider-value" id="bgOpacityLabel">75%</span>
          </div>
          <input type="range" id="bgOpacityRange" min="0" max="100" step="5" value="75">
        </div>
```

- [ ] **Step 2: Verify popup renders**

Reload the extension. Open the popup → 字幕外觀. Confirm a "背景透明度" slider appears below "字型大小" with label "75%".

- [ ] **Step 3: Commit**

```bash
git add popup.html
git commit -m "feat: add background opacity slider to popup"
```

---

## Task 4: popup.js — Wire up opacity slider

**Files:**
- Modify: `popup.js`

- [ ] **Step 1: Add element refs**

After the existing `const fontFamilySelect` line, add:

```js
const bgOpacityRange = document.getElementById('bgOpacityRange')
const bgOpacityLabel = document.getElementById('bgOpacityLabel')
```

- [ ] **Step 2: Add bgOpacity to the init storage read**

In the `chrome.storage.local.get(...)` init call, add `'bgOpacity'` to the key list:

```js
chrome.storage.local.get(
  ['translationApiKey', 'enabled', 'subtitleColor', 'displayMode', 'transcriptEnabled',
   'transcriptLines', 'transcriptStorageFull', 'fontSize', 'fontFamily', 'bold',
   'translationEngine', 'selectedPlatform', 'detectedPlatform', 'bgOpacity'],
  ({ translationApiKey, enabled, subtitleColor, displayMode, transcriptEnabled,
     transcriptLines = [], transcriptStorageFull, fontSize, fontFamily, bold,
     translationEngine, selectedPlatform, detectedPlatform, bgOpacity }) => {
```

Then inside the callback, after the `fontFamilySelect.value` line, add:

```js
const op = bgOpacity ?? 75
bgOpacityRange.value       = op
bgOpacityLabel.textContent = `${op}%`
```

- [ ] **Step 3: Add input event listener**

After the existing `fontFamilySelect.addEventListener` block, add:

```js
// ── Background opacity ────────────────────────────────────────────────────
bgOpacityRange.addEventListener('input', () => {
  const op = Number(bgOpacityRange.value)
  bgOpacityLabel.textContent = `${op}%`
  chrome.storage.local.set({ bgOpacity: op })
  updateSummaries()
})
```

- [ ] **Step 4: Update updateSummaries() to include opacity**

In the `updateSummaries()` function, find the `summaryAppearance` line:

```js
document.getElementById('summaryAppearance').textContent = `${cName} · ${size}pt · ${font}`
```

Replace with:

```js
const op = bgOpacityRange.value
document.getElementById('summaryAppearance').textContent = `${cName} · ${size}pt · ${font} · ${op}%`
```

- [ ] **Step 5: End-to-end verification**

Reload the extension. Open popup → 字幕外觀.

| Action | Expected |
|--------|----------|
| Open 字幕外觀 | 背景透明度 slider shows 75% |
| Drag to 0% | Subtitle background disappears immediately |
| Drag to 100% | Subtitle background is fully black |
| Drag back to 75% | Returns to default |
| Close popup, reload page, reopen popup | Slider still shows last saved value |
| Check 字幕外觀 summary (collapsed) | Shows e.g. `白 · 18pt · Arial · 75%` |

- [ ] **Step 6: Commit**

```bash
git add popup.js
git commit -m "feat: wire background opacity slider in popup"
```
