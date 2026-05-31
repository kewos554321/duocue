# Display Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 popup header 加入 Segmented Control（兩者 / 原文 / 翻譯），讓用戶控制字幕顯示模式並即時更新 overlay。

**Architecture:** `popup.html` 重構 header（Toggle 移入 Row 1，Segmented Control 取代 Row 2）；`popup.js` 讀取 / 寫入 `displayMode`；`content.js` 用模組層級快取 + `onChanged` 即時切換渲染邏輯。

**Tech Stack:** Chrome Extension MV3，純 HTML/CSS/JS，chrome.storage.local

---

## 檔案對照

| 檔案 | 動作 | 說明 |
|------|------|------|
| `popup.html` | 修改 | Header 重構 + Segmented Control CSS |
| `popup.js` | 修改 | 加入 `selectMode()`，init 讀取 `displayMode`，seg-btn click |
| `content.js` | 修改 | `displayMode` + `lastEnglish` + `lastChinese` 快取，`updateOverlay` 根據模式渲染 |

---

## 如何載入測試

1. 開啟 `chrome://extensions`
2. 啟用「開發者模式」
3. 點「載入未封裝項目」→ 選本專案資料夾（或點重新整理 icon）

---

## Task 1: 修改 popup.html

**Files:**
- Modify: `popup.html`

- [ ] **Step 1: 更新 `.title-text` CSS，加入 `flex: 1`**

找到現有的 `.title-text { ... }` 規則：

```css
.title-text {
  font-size: 17px;
  font-weight: 600;
}
```

改為：

```css
.title-text {
  font-size: 17px;
  font-weight: 600;
  flex: 1;
}
```

這讓 toggle 被推到最右側。

- [ ] **Step 2: 移除 `.header-row` 和 `.subtitle-text` CSS**

找到並刪除這兩個 CSS 規則（共約 8 行）：

```css
/* 刪除這整個區塊 */
.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.subtitle-text {
  color: #8E8E93;
  font-size: 13px;
}
```

- [ ] **Step 3: 在 `/* ── Save button ── */` 之前加入 Segmented Control CSS**

```css
/* ── Segmented Control ── */
.seg-control {
  background: #1C1C1E;
  border-radius: 9px;
  padding: 3px;
  display: flex;
  gap: 2px;
}
.seg-btn {
  flex: 1;
  border-radius: 7px;
  padding: 6px 0;
  text-align: center;
  font-size: 12px;
  font-family: inherit;
  border: none;
  cursor: pointer;
  color: #8E8E93;
  background: transparent;
  transition: background 0.15s, color 0.15s;
}
.seg-btn.active {
  background: #0A84FF;
  color: #FFFFFF;
  font-weight: 600;
}
```

- [ ] **Step 4: 更新 Header HTML 結構**

找到現有的 `<!-- Header -->` 區塊：

```html
<!-- Header -->
<div class="header">
  <div class="header-title">
    <div class="status-dot"></div>
    <span class="title-text">DuoCue</span>
  </div>
  <div class="header-row">
    <span class="subtitle-text">Bilingual Subtitles</span>
    <div class="toggle" id="toggle">
      <div class="toggle-knob"></div>
    </div>
  </div>
</div>
```

改為：

```html
<!-- Header -->
<div class="header">
  <!-- Row 1: title + toggle -->
  <div class="header-title">
    <div class="status-dot"></div>
    <span class="title-text">DuoCue</span>
    <div class="toggle" id="toggle">
      <div class="toggle-knob"></div>
    </div>
  </div>
  <!-- Row 2: display mode segmented control -->
  <div class="seg-control" id="segControl">
    <button class="seg-btn active" data-mode="both">兩者</button>
    <button class="seg-btn" data-mode="original">原文</button>
    <button class="seg-btn" data-mode="translation">翻譯</button>
  </div>
</div>
```

- [ ] **Step 5: 驗證**

載入擴充功能，開啟 popup：
- Header Row 1：DuoCue 標題（左）+ toggle（右）
- Header Row 2：深色圓角容器內，「兩者」藍色高亮，「原文」「翻譯」灰色
- Body 不變（色票、API Key、Save）

- [ ] **Step 6: Commit**

```bash
git add popup.html
git commit -m "feat: add display mode segmented control to popup header"
```

---

## Task 2: 修改 popup.js

**Files:**
- Modify: `popup.js`

- [ ] **Step 1: 加入 `segBtns` DOM reference**

在現有 DOM references 最後一行（`const swatches = ...`）後加一行：

```js
const segBtns     = document.querySelectorAll('.seg-btn')
```

- [ ] **Step 2: 在 init 的 storage.get 加入 `displayMode`**

找到現有的 init 讀取：

```js
chrome.storage.local.get(['translationApiKey', 'enabled', 'subtitleColor'], (data) => {
```

改為：

```js
chrome.storage.local.get(['translationApiKey', 'enabled', 'subtitleColor', 'displayMode'], (data) => {
```

- [ ] **Step 3: 在 init callback 末尾加入 `selectMode` 呼叫**

在 init callback 內的 `// Color` 區塊之後，加一行：

```js
  // Display Mode
  selectMode(data.displayMode || 'both')
```

完整 init callback 長這樣：

```js
chrome.storage.local.get(['translationApiKey', 'enabled', 'subtitleColor', 'displayMode'], (data) => {
  // Toggle
  if (data.enabled !== false) toggle.classList.add('on')

  // API Key
  if (data.translationApiKey) {
    apiKeyInput.value = data.translationApiKey
    setKeyStatus(true)
  } else {
    setKeyStatus(false)
  }

  // Color
  selectColor(data.subtitleColor || '#FFD700')

  // Display Mode
  selectMode(data.displayMode || 'both')
})
```

- [ ] **Step 4: 在 `// ── Color swatches ──` 之前加入 seg-btn 點擊監聽**

```js
// ── Display Mode ──────────────────────────────────────────────────────────
segBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const mode = btn.dataset.mode
    selectMode(mode)
    chrome.storage.local.set({ displayMode: mode })
  })
})
```

- [ ] **Step 5: 在 `// ── Helpers ──` 區塊加入 `selectMode()` 函式**

在現有 `selectColor()` 函式之後加入：

```js
function selectMode(mode) {
  segBtns.forEach(b => b.classList.remove('active'))
  const match = [...segBtns].find(b => b.dataset.mode === mode)
  if (match) match.classList.add('active')
}
```

- [ ] **Step 6: 驗證**

載入擴充功能，開啟 popup：
- 預設「兩者」藍色高亮
- 點「原文」→ 切換高亮到「原文」
- 關閉再開 popup → 「原文」仍被選中（設定保留）

- [ ] **Step 7: Commit**

```bash
git add popup.js
git commit -m "feat: add display mode selection to popup.js"
```

---

## Task 3: 修改 content.js

**Files:**
- Modify: `content.js`

- [ ] **Step 1: 將 content.js 完整改寫為以下內容**

（此 Task 改動較多，直接提供完整檔案以避免錯誤）

```js
const PLATFORMS = [
  {
    name: 'HBO Max',
    hostname: 'play.hbomax.com',
    containerSelector: '[class*="VerticalCueSpacer-Fuse-Web-Play"]',
    textSelector: '[class*="TextCue-Fuse-Web-Play"]',
  },
]

function detectPlatform() {
  return PLATFORMS.find(p => location.hostname === p.hostname) ?? null
}

function createOverlay() {
  if (document.getElementById('duocue-overlay')) return
  const div = document.createElement('div')
  div.id = 'duocue-overlay'
  document.body.appendChild(div)
}

let subtitleColor = '#FFD700'

function sanitizeColor(c) {
  return /^#[0-9A-Fa-f]{3,8}$|^[a-zA-Z]+$/.test(c) ? c : '#FFD700'
}

chrome.storage.local.get('subtitleColor', ({ subtitleColor: c }) => {
  if (c) subtitleColor = sanitizeColor(c)
})

let displayMode = 'both'
chrome.storage.local.get('displayMode', ({ displayMode: m }) => {
  if (m) displayMode = m
})

let lastEnglish = null
let lastChinese = null

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return
  if (changes.subtitleColor) {
    subtitleColor = sanitizeColor(changes.subtitleColor.newValue)
    document.querySelectorAll('.duocue-zh').forEach(el => {
      el.style.color = subtitleColor
    })
  }
  if (changes.displayMode) {
    displayMode = changes.displayMode.newValue
    if (lastEnglish) updateOverlay(lastEnglish, lastChinese)
  }
})

function updateOverlay(english, chinese) {
  const overlay = document.getElementById('duocue-overlay')
  if (!overlay) return
  if (!english) {
    overlay.innerHTML = ''
    overlay.style.display = 'none'
    return
  }

  const showEn = displayMode === 'both' || displayMode === 'original'
  const showZh = (displayMode === 'both' || displayMode === 'translation') && chinese

  const enHtml = showEn ? `<div class="duocue-en">${english}</div>` : ''
  const zhHtml = showZh ? `<div class="duocue-zh" style="color:${subtitleColor}">${chinese}</div>` : ''

  if (!enHtml && !zhHtml) {
    overlay.innerHTML = ''
    overlay.style.display = 'none'
    return
  }

  overlay.innerHTML = enHtml + zhHtml
  overlay.style.display = 'block'
}

function extractText(platform) {
  const nodes = document.querySelectorAll(platform.textSelector)
  return Array.from(nodes)
    .map(n => n.textContent.trim())
    .filter(Boolean)
    .join('\n')
}

async function translate(text) {
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

function startPolling(platform) {
  createOverlay()
  console.log(`[DuoCue] Polling subtitles for ${platform.name}`)

  let transcriptEnabled = false
  let transcriptStartTime = null
  let transcriptBuffer = []
  let transcriptFull = false

  chrome.storage.local.get(['transcriptEnabled', 'transcriptStorageFull'], (result) => {
    transcriptEnabled = result.transcriptEnabled === true
    transcriptFull = result.transcriptStorageFull === true
    if (transcriptEnabled) transcriptStartTime = Date.now()
  })

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

  window.addEventListener('beforeunload', () => {
    flushTranscriptBuffer()
  })

  let translateTimer = null

  setInterval(async () => {
    const { enabled } = await chrome.storage.local.get('enabled')
    if (enabled === false) {
      updateOverlay(null, null)
      lastEnglish = null
      lastChinese = null
      return
    }

    const english = extractText(platform)

    if (english === lastEnglish) return
    lastEnglish = english

    console.log(`[DuoCue] ${english || '(no subtitle)'}`)

    if (!english) {
      updateOverlay(null, null)
      lastChinese = null
      return
    }

    updateOverlay(english, null)
    if (transcriptEnabled && !transcriptFull) recordSubtitle(english)

    clearTimeout(translateTimer)
    translateTimer = setTimeout(async () => {
      const chinese = await translate(english)
      lastChinese = chinese
      updateOverlay(english, chinese)
    }, 150)
  }, 200)
}

const platform = detectPlatform()
if (platform) startPolling(platform)
```

- [ ] **Step 2: 驗證**

載入擴充功能，前往 `play.hbomax.com` 播放影片，確認：
- 預設「兩者」→ 英文 + 中文字幕均顯示
- popup 切換「原文」→ 只顯示英文
- popup 切換「翻譯」→ 只顯示中文（翻譯完成後）
- popup 切回「兩者」→ 兩者恢復

- [ ] **Step 3: Commit**

```bash
git add content.js
git commit -m "feat: add displayMode support to content.js with instant overlay re-render"
```

---

## Task 4: 端對端驗證

- [ ] **Step 1: 完整流程驗證**

前往 `play.hbomax.com` 播放有字幕的影片，依序執行：

1. 預設狀態 → 英文 + 中文均顯示（兩者模式）
2. 開啟 popup → 「兩者」有藍色高亮
3. 點「原文」→ overlay 立即只剩英文，popup 顯示「原文」高亮
4. 點「翻譯」→ overlay 立即只剩中文（若翻譯在快取中；若無則等翻譯完成後顯示）
5. 點「兩者」→ 恢復兩行
6. 關閉 popup，重新開啟 → 選中狀態正確保留

- [ ] **Step 2: 驗證預設值（清空 storage）**

在 `chrome://extensions` → Service Worker → DevTools Console：

```js
chrome.storage.local.remove('displayMode')
```

重新載入擴充功能，開啟 popup → 「兩者」應被選中（預設行為正確）

- [ ] **Step 3: 若有修正，commit**

```bash
git add -p
git commit -m "fix: <描述修正內容>"
```
