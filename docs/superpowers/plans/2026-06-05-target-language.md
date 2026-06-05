# Target Language Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users choose source and target languages for translation in the popup, supporting 10 languages.

**Architecture:** popup.html gets two compact `<select>` dropdowns inside the 翻譯引擎 section (between freeInfo and googleConfig). popup.js reads/writes the two new storage keys (`sourceLanguage`, `targetLanguage`) and updates the engine summary. content.js reads those keys inside `translateFree()` and `translateGoogle()` instead of using hardcoded `zh-TW`.

**Tech Stack:** Chrome Extension MV3, vanilla JS, chrome.storage.local

---

## File Map

| File | Change |
|------|--------|
| `popup.html` | Add CSS for compact lang selects; add `#langConfig` block with `#sourceLangRow`, `#sourceLangAutoRow`, `#targetLangSelect` inside `#bodyEngine` |
| `popup.js` | Add `LANG_LIST`; add DOM refs; update `selectEngine()`, `updateSummaries()`, storage init, and add `change` listeners |
| `content.js` | Update `translateFree()` and `translateGoogle()` to read `sourceLanguage`/`targetLanguage` from storage |

---

## Task 1: Add CSS + HTML for language dropdowns

**Files:**
- Modify: `popup.html`

- [ ] **Step 1: Add CSS for compact language selects**

Find the `/* ── Font family select ── */` block (around line 306). Add the following CSS immediately after the closing `}` of `.select-wrap::after { ... }`:

```css
/* ── Language selects ── */
.lang-select-wrap {
  width: 130px;
}
.lang-select-wrap select {
  height: 30px;
  font-size: 13px;
  padding: 0 28px 0 10px;
}
```

- [ ] **Step 2: Add the langConfig HTML block**

Find this comment in `popup.html`:

```html
    <!-- ③ 翻譯引擎 -->
```

Locate `<div id="freeInfo" class="engine-info">` — it ends with its closing `</div>`. Add the `langConfig` block immediately **after** `</div>` (before `<div id="googleConfig"`):

```html
        <!-- language config -->
        <div id="langConfig" style="display:flex;flex-direction:column;gap:6px;margin-top:8px">
          <div id="sourceLangRow" class="field-header" style="margin-bottom:0">
            <span class="field-label">原文語言</span>
            <div class="select-wrap lang-select-wrap">
              <select id="sourceLangSelect"></select>
            </div>
          </div>
          <div id="sourceLangAutoRow" class="field-header" style="display:none;margin-bottom:0">
            <span class="field-label">原文語言</span>
            <span style="color:#8e8e93;font-size:13px">自動偵測</span>
          </div>
          <div class="field-header" style="margin-bottom:0">
            <span class="field-label">目標語言</span>
            <div class="select-wrap lang-select-wrap">
              <select id="targetLangSelect"></select>
            </div>
          </div>
        </div>
```

- [ ] **Step 3: Verify HTML structure**

Open `popup.html` and confirm `#bodyEngine` has this child order:
1. `#enginePicker`
2. `#freeInfo`
3. `#langConfig` ← new
4. `#googleConfig`

- [ ] **Step 4: Commit**

```bash
git add popup.html
git commit -m "feat: add language dropdown HTML and CSS"
```

---

## Task 2: Wire popup.js — LANG_LIST, init, events, selectEngine, summaries

**Files:**
- Modify: `popup.js`

- [ ] **Step 1: Add LANG_LIST constant**

At the top of `popup.js`, after the existing `const COLOR_NAMES = { ... }` block, add:

```js
const LANG_LIST = [
  { code: 'zh-TW', label: '繁體中文', abbr: '繁中' },
  { code: 'zh-CN', label: '簡體中文', abbr: '簡中' },
  { code: 'en',    label: '英文',     abbr: 'EN'   },
  { code: 'ja',    label: '日文',     abbr: '日文' },
  { code: 'ko',    label: '韓文',     abbr: '韓文' },
  { code: 'es',    label: '西班牙文', abbr: '西文' },
  { code: 'fr',    label: '法文',     abbr: '法文' },
  { code: 'de',    label: '德文',     abbr: '德文' },
  { code: 'pt',    label: '葡萄牙文', abbr: '葡文' },
  { code: 'vi',    label: '越南文',   abbr: '越文' },
]
```

- [ ] **Step 2: Add DOM refs**

At the top of `popup.js`, in the block of `const` DOM refs (around line 1–31), add:

```js
const sourceLangSelect  = document.getElementById('sourceLangSelect')
const targetLangSelect  = document.getElementById('targetLangSelect')
const sourceLangRow     = document.getElementById('sourceLangRow')
const sourceLangAutoRow = document.getElementById('sourceLangAutoRow')
```

Then, immediately **after** the `LANG_LIST` block added in Step 1 (not near the DOM refs), populate both selects:

```js
LANG_LIST.forEach(({ code, label }) => {
  sourceLangSelect.appendChild(new Option(label, code))
  targetLangSelect.appendChild(new Option(label, code))
})
```

- [ ] **Step 3: Update updateSummaries() to include language abbreviations**

Find `updateSummaries()`. Replace the `summaryEngine` block:

```js
  // OLD (two lines):
  const activeEngine = [...engineBtns].find(b => b.classList.contains('active'))
  document.getElementById('summaryEngine').textContent =
    activeEngine?.dataset.engine === 'google' ? 'Google Translate' : '免費'
```

with:

```js
  const activeEngine = [...engineBtns].find(b => b.classList.contains('active'))
  const isGoogle = activeEngine?.dataset.engine === 'google'
  const tgtAbbr = LANG_LIST.find(l => l.code === targetLangSelect.value)?.abbr ?? targetLangSelect.value
  if (isGoogle) {
    document.getElementById('summaryEngine').textContent = `Google · ${tgtAbbr}`
  } else {
    const srcAbbr = LANG_LIST.find(l => l.code === sourceLangSelect.value)?.abbr ?? sourceLangSelect.value
    document.getElementById('summaryEngine').textContent = `免費 · ${srcAbbr}→${tgtAbbr}`
  }
```

- [ ] **Step 4: Update selectEngine() to toggle source row visibility**

Find `selectEngine(engine)`. It currently has two lines that toggle freeInfo / googleConfig. Replace those two lines with:

```js
function selectEngine(engine) {
  engineBtns.forEach(b => b.classList.toggle('active', b.dataset.engine === engine))
  freeInfo.style.display          = engine === 'free'   ? ''     : 'none'
  googleConfig.style.display      = engine === 'google' ? 'flex' : 'none'
  sourceLangRow.style.display     = engine === 'free'   ? ''     : 'none'
  sourceLangAutoRow.style.display = engine === 'google' ? ''     : 'none'
  chrome.storage.local.set({ translationEngine: engine })
  updateSummaries()
}
```

- [ ] **Step 5: Update storage init to load sourceLanguage and targetLanguage**

Find `chrome.storage.local.get(` in the `// ── Init ──` block. Add `'sourceLanguage'` and `'targetLanguage'` to the keys array:

```js
chrome.storage.local.get(
  ['translationApiKey', 'enabled', 'subtitleColor', 'displayMode', 'transcriptEnabled',
   'transcriptLines', 'transcriptStorageFull', 'fontSize', 'fontFamily', 'bold',
   'translationEngine', 'selectedPlatform', 'detectedPlatform', 'bgOpacity',
   'subtitleBottom', 'subtitleLeft', 'sourceLanguage', 'targetLanguage'],   // ← added two keys
  ({ translationApiKey, enabled, subtitleColor, displayMode, transcriptEnabled,
     transcriptLines = [], transcriptStorageFull, fontSize, fontFamily, bold,
     translationEngine, selectedPlatform, detectedPlatform, bgOpacity: savedOp,
     subtitleBottom: savedBottom, subtitleLeft: savedLeft,
     sourceLanguage, targetLanguage }) => {                                  // ← destructure
```

Inside that callback, after `selectEngine(translationEngine || 'free')`, add:

```js
    sourceLangSelect.value = sourceLanguage || 'en'
    targetLangSelect.value = targetLanguage || 'zh-TW'
```

- [ ] **Step 6: Add change event listeners for both selects**

After the `engineBtns.forEach(...)` block (the one that calls `selectEngine`), add:

```js
// ── Language pickers ──────────────────────────────────────────────────────
sourceLangSelect.addEventListener('change', () => {
  chrome.storage.local.set({ sourceLanguage: sourceLangSelect.value })
  updateSummaries()
})

targetLangSelect.addEventListener('change', () => {
  chrome.storage.local.set({ targetLanguage: targetLangSelect.value })
  updateSummaries()
})
```

- [ ] **Step 7: Manual verification**

Load the extension in `chrome://extensions` (Developer mode → Load unpacked → select project folder).

Open popup on any tab. Confirm:
- 翻譯引擎 section expands and shows 原文語言 + 目標語言 dropdowns with 10 options
- Changing target language updates summary (e.g. `免費 · EN→日文`)
- Switching to Google Translate hides the 原文語言 select and shows 「自動偵測」
- Google summary shows `Google · 繁中`
- Reload popup — previously saved languages persist

- [ ] **Step 8: Commit**

```bash
git add popup.js
git commit -m "feat: wire language pickers in popup"
```

---

## Task 3: Update content.js translation functions

**Files:**
- Modify: `content.js`

- [ ] **Step 1: Update translateFree()**

Replace the current `translateFree()` function:

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
```

with:

```js
async function translateFree(text) {
  const { sourceLanguage, targetLanguage } = await chrome.storage.local.get(
    ['sourceLanguage', 'targetLanguage']
  )
  const src = sourceLanguage || 'en'
  const tgt = targetLanguage || 'zh-TW'
  if (src === tgt) return null
  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${src}|${tgt}`
    )
    const data = await res.json()
    if (data.responseStatus !== 200) return null
    return data.responseData?.translatedText ?? null
  } catch {
    return null
  }
}
```

- [ ] **Step 2: Update translateGoogle()**

Replace the current `translateGoogle()` function:

```js
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
```

with:

```js
async function translateGoogle(text) {
  const { translationApiKey, targetLanguage } = await chrome.storage.local.get(
    ['translationApiKey', 'targetLanguage']
  )
  if (!translationApiKey) return null
  const tgt = targetLanguage || 'zh-TW'
  try {
    const res = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${translationApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text, target: tgt, format: 'text' }),
      }
    )
    const data = await res.json()
    return data?.data?.translations?.[0]?.translatedText ?? null
  } catch {
    return null
  }
}
```

- [ ] **Step 3: Manual verification**

Reload the extension. Open Netflix or YouTube with English subtitles.

1. Open popup → change target language to 日文 → verify subtitle shows Japanese translation
2. Change target to 韓文 → next subtitle shows Korean translation
3. In 免費 mode, set source=英文, target=英文 → translation row disappears (null returned, only original shown)

- [ ] **Step 4: Commit**

```bash
git add content.js
git commit -m "feat: read sourceLanguage/targetLanguage from storage in translation functions"
```
