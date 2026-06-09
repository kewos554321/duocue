# Extension Experimental Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "實驗功能" toggle in the extension popup that, when enabled, fetches word status from the backend API to color subtitle words, and lets users press S to save the current subtitle sentence to the database.

**Architecture:** All new logic lives behind `if (experimentalEnabled)` guards in `content.js` so the default (OFF) state is identical to the current behavior. The popup gets a new ⑥ accordion section with toggle + API endpoint + API key fields. On startup with experimental ON, `content.js` fetches `GET /words` and merges into the existing `_wordStatus` map so the existing `buildWordSpans()` rendering pipeline picks it up automatically. The S key handler reads `lastEnglish` / `lastChinese` (already tracked in content.js) and calls `POST /sentences`.

**Tech Stack:** Chrome Extension MV3, vanilla JS, chrome.storage.local

---

## File Map

| File | Change |
|------|--------|
| `extension/popup.html` | Add ⑥ 實驗功能 accordion section (toggle + endpoint + key inputs) |
| `extension/popup.js` | Add element refs, storage load, toggle handler, input save handlers |
| `extension/content.js` | Add experimental state vars + `fetchWordCache()` + S key handler + `showToast()` |
| `extension/styles.css` | Add `#duocue-toast` CSS |

---

### Task 1: Popup HTML — 實驗功能 accordion section

**Files:**
- Modify: `extension/popup.html` (insert before closing `</div>` of `#sections`)

- [ ] **Step 1: Add the ⑥ 實驗功能 section**

Open `extension/popup.html`. Find the closing `</div>` that ends the `#sections` div (it comes right after the `<!-- ⑤ 關於 -->` section's closing `</div>`). Insert the following block **before** that closing `</div>`:

```html
    <!-- ⑥ 實驗功能 -->
    <div class="section">
      <div class="section-header" id="hdrExp" role="button" aria-expanded="false">
        <span class="section-title">實驗功能</span>
        <span class="section-summary" id="summaryExp">關閉</span>
        <svg class="chevron" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
      <div class="section-body" id="bodyExp" style="display:none">
        <div class="field-header">
          <div>
            <div style="color:#EDEDEF;font-size:13px;font-weight:500;margin-bottom:2px">句子收集模式</div>
            <div style="color:#636366;font-size:11px;line-height:1.4">按 S 存句子 · 字幕單字顯示學習狀態</div>
          </div>
          <div class="toggle" id="expToggle"><div class="toggle-knob"></div></div>
        </div>
        <div id="expFields" style="opacity:0.4;pointer-events:none;display:flex;flex-direction:column;gap:12px">
          <div>
            <span class="field-label">API Endpoint</span>
            <div class="input-wrap" style="margin-top:6px">
              <input type="text" id="expEndpoint" placeholder="https://duocue-api.xxx.workers.dev" style="padding-right:12px">
            </div>
          </div>
          <div>
            <span class="field-label">API Key</span>
            <div class="input-wrap" style="margin-top:6px">
              <input type="password" id="expApiKey" placeholder="••••••••••••">
              <span class="eye-btn" id="expEyeBtn">
                <svg width="17" height="17" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 3.5C4.5 3.5 1.5 8 1.5 8C1.5 8 4.5 12.5 8 12.5C11.5 12.5 14.5 8 14.5 8C14.5 8 11.5 3.5 8 3.5Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.3"/></svg>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
```

- [ ] **Step 2: Verify HTML structure is correct**

Open the file and confirm the new section appears INSIDE `#sections` (before its closing `</div>`), not after it.

- [ ] **Step 3: Commit**

```bash
git add extension/popup.html
git commit -m "feat(popup): add 實驗功能 accordion section with toggle and API fields"
```

---

### Task 2: Popup JS — wire experimental controls

**Files:**
- Modify: `extension/popup.js`

- [ ] **Step 1: Add element references at the top of popup.js**

After the last existing `const` declaration block (after line `const sourceLangAutoRow = document.getElementById('sourceLangAutoRow')`), add:

```javascript
const expToggle   = document.getElementById('expToggle')
const expEndpoint = document.getElementById('expEndpoint')
const expApiKey   = document.getElementById('expApiKey')
const expEyeBtn   = document.getElementById('expEyeBtn')
const expFields   = document.getElementById('expFields')
```

- [ ] **Step 2: Add storage load for experimental settings**

At the **end** of `popup.js` (after all existing event listener code), add:

```javascript
// ── Experimental settings ─────────────────────────────────────────────────
chrome.storage.local.get(['experimentalMode', 'apiEndpoint', 'apiKey'], ({ experimentalMode, apiEndpoint, apiKey }) => {
  if (experimentalMode) {
    expToggle.classList.add('on')
    expFields.style.opacity = '1'
    expFields.style.pointerEvents = ''
    document.getElementById('summaryExp').textContent = '開啟'
  }
  if (apiEndpoint) expEndpoint.value = apiEndpoint
  if (apiKey) expApiKey.value = apiKey
})

expToggle.addEventListener('click', () => {
  const isOn = expToggle.classList.toggle('on')
  expFields.style.opacity = isOn ? '1' : '0.4'
  expFields.style.pointerEvents = isOn ? '' : 'none'
  document.getElementById('summaryExp').textContent = isOn ? '開啟' : '關閉'
  chrome.storage.local.set({ experimentalMode: isOn })
})

expEndpoint.addEventListener('blur', () => {
  chrome.storage.local.set({ apiEndpoint: expEndpoint.value.trim() })
})

expApiKey.addEventListener('blur', () => {
  chrome.storage.local.set({ apiKey: expApiKey.value.trim() })
})

expEyeBtn.addEventListener('click', () => {
  expApiKey.type = expApiKey.type === 'password' ? 'text' : 'password'
})
```

- [ ] **Step 3: Verify behavior manually**

Load the extension from `extension/` in `chrome://extensions`. Open the popup, expand ⑥ 實驗功能. Confirm:
- Toggle starts OFF, fields are dimmed
- Clicking toggle turns it ON (green), fields become full-opacity and editable
- Type an endpoint + key, click elsewhere → values saved
- Close and reopen popup → values still there

- [ ] **Step 4: Commit**

```bash
git add extension/popup.js
git commit -m "feat(popup): wire experimental toggle, endpoint, and API key controls"
```

---

### Task 3: content.js — load experimental config and fetch word cache

**Files:**
- Modify: `extension/content.js`

- [ ] **Step 1: Add experimental state variables**

In `extension/content.js`, find the `_wordStatus` block:

```javascript
let _wordStatus = {}
chrome.storage.local.get('wordStatus', ({ wordStatus: ws }) => {
  if (ws) _wordStatus = ws
})
```

Immediately **after** this block, add:

```javascript
// ── Experimental mode ──────────────────────────────────────────────────────
let experimentalEnabled = false
let _expApiEndpoint = ''
let _expApiKey = ''

chrome.storage.local.get(['experimentalMode', 'apiEndpoint', 'apiKey'], ({ experimentalMode, apiEndpoint, apiKey }) => {
  experimentalEnabled = !!experimentalMode
  _expApiEndpoint = apiEndpoint || ''
  _expApiKey = apiKey || ''
  if (experimentalEnabled && _expApiEndpoint && _expApiKey) {
    fetchWordCache()
  }
})

async function fetchWordCache() {
  try {
    const res = await fetch(`${_expApiEndpoint}/words`, {
      headers: { Authorization: `Bearer ${_expApiKey}` }
    })
    if (!res.ok) return
    const { words } = await res.json()
    words.forEach(({ word, status }) => { _wordStatus[word] = status })
    console.log('[DuoCue] word cache loaded:', words.length, 'words')
  } catch (e) {
    console.warn('[DuoCue] failed to fetch word cache', e)
  }
}
```

- [ ] **Step 2: Sync experimentalEnabled when storage changes**

In `extension/content.js`, find the `chrome.storage.onChanged.addListener` block. Inside it, after the existing `if (changes.wordStatus)` block, add:

```javascript
  if (changes.experimentalMode) {
    experimentalEnabled = !!changes.experimentalMode.newValue
  }
```

- [ ] **Step 3: Verify word cache fetch works**

In Chrome, open a Netflix or YouTube watch page with the extension loaded. Open DevTools console. In the popup, enable experimental mode with the real API endpoint (`https://duocue-api.kewos554321.workers.dev`) and key (`1faabc8c509c427f5acf0fb8861732b63d5dc6af3c910558db38eec289f3e3d7`). Reload the page. The console should show:

```
[DuoCue] word cache loaded: 1 words
```

(1 word because "thought" was marked as "learned" in the Spec 1 smoke test.)

If the words table is empty from a fresh DB, it will show `0 words` — that's also correct.

- [ ] **Step 4: Commit**

```bash
git add extension/content.js
git commit -m "feat(content): load experimental config, fetch word cache from API on startup"
```

---

### Task 4: content.js + styles.css — S key handler and toast

**Files:**
- Modify: `extension/content.js`
- Modify: `extension/styles.css`

- [ ] **Step 1: Add toast CSS to styles.css**

At the **end** of `extension/styles.css`, append:

```css
#duocue-toast {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 100002;
  background: rgba(28, 28, 30, 0.95);
  color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
  font-size: 14px;
  font-weight: 500;
  padding: 10px 16px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 0.2s, transform 0.2s;
  pointer-events: none;
}

#duocue-toast.duocue-toast-show {
  opacity: 1;
  transform: translateY(0);
}

#duocue-toast.duocue-toast-hide {
  opacity: 0;
  transform: translateY(8px);
}
```

- [ ] **Step 2: Add `showToast()` function to content.js**

At the **end** of `extension/content.js`, append:

```javascript
// ── Experimental: toast notification ──────────────────────────────────────
function showToast(message) {
  let toast = document.getElementById('duocue-toast')
  if (!toast) {
    toast = document.createElement('div')
    toast.id = 'duocue-toast'
    document.body.appendChild(toast)
  }
  toast.textContent = message
  toast.classList.remove('duocue-toast-hide')
  toast.classList.add('duocue-toast-show')
  clearTimeout(toast._timer)
  toast._timer = setTimeout(() => {
    toast.classList.remove('duocue-toast-show')
    toast.classList.add('duocue-toast-hide')
  }, 1500)
}
```

- [ ] **Step 3: Add S key handler to content.js**

Immediately after the `showToast` function, append:

```javascript
// ── Experimental: S key — save current subtitle sentence ──────────────────
document.addEventListener('keydown', async (e) => {
  if (!experimentalEnabled) return
  if (e.key !== 's' && e.key !== 'S') return
  const tag = document.activeElement?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return
  if (!lastEnglish) return

  const platform = await detectPlatform()
  const video = document.querySelector('video')
  const timestampS = video ? Math.floor(video.currentTime) : 0

  try {
    const res = await fetch(`${_expApiEndpoint}/sentences`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${_expApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        platform: platform?.id ?? 'unknown',
        videoUrl: location.href,
        text: lastEnglish,
        translation: lastChinese ?? null,
        timestampS
      })
    })
    showToast(res.ok ? '✓ 已儲存' : '× 儲存失敗')
  } catch {
    showToast('× 儲存失敗')
  }
})
```

- [ ] **Step 4: Verify toast and S key manually**

With experimental mode ON, a subtitle visible on screen, press S. Confirm:
- A small dark toast appears at the bottom-right: `✓ 已儲存`
- It fades out after 1.5 seconds
- Verify in the API:

```bash
curl -s -H "Authorization: Bearer 1faabc8c509c427f5acf0fb8861732b63d5dc6af3c910558db38eec289f3e3d7" \
  https://duocue-api.kewos554321.workers.dev/sentences
```

Expected: the sentence you were watching appears in the response.

- [ ] **Step 5: Verify OFF-mode guard**

Turn experimental mode OFF in the popup. Press S while a subtitle is showing. Confirm: no toast, no network request.

- [ ] **Step 6: Commit**

```bash
git add extension/content.js extension/styles.css
git commit -m "feat(content): add S key sentence save with toast and word cache from API"
```

---

## Done

All six spec success criteria verified:

| Criterion | Verified in |
|-----------|------------|
| Default OFF → behavior unchanged | Task 4 Step 5 |
| Experimental ON → console shows word cache | Task 3 Step 3 |
| Marked words → orange/green underlines in subtitles | Task 3 Step 3 (same session as tooltip marking) |
| Press S → ✓ 已儲存 toast + DB entry | Task 4 Step 4 |
| API error → × 儲存失敗 toast, no crash | Task 4 Step 3 (try/catch handles all failures) |
| Experimental OFF → S does nothing | Task 4 Step 5 |
