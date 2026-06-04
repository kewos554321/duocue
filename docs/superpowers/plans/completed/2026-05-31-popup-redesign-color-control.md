# Popup 重設計 + 第二語言顏色控制 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將 popup 升級為 Apple Dark Mode 風格，加入 toggle、眼睛 icon、API Key 狀態、以及中文字幕顏色色票控制（5 預設 + 1 自訂）。

**Architecture:** popup.html/popup.js 完整改寫為 Apple Dark Mode UI；content.js 加入 `subtitleColor` 模組層級快取並透過 `chrome.storage.onChanged` 即時更新 DOM；`styles.css` 移除 hardcoded 顏色改由 JS inline style 控制。

**Tech Stack:** Chrome Extension MV3，純 HTML/CSS/JS，chrome.storage.local，原生 `<input type="color">`

---

## 檔案對照

| 檔案 | 動作 | 說明 |
|------|------|------|
| `content.js` | 修改 | 加入 subtitleColor 快取、onChanged listener、enabled 檢查、updateOverlay 使用 inline style |
| `styles.css` | 修改 | 移除 `.duocue-zh` 的 `color: #FFD700` |
| `popup.html` | 改寫 | Apple Dark Mode layout：header + toggle + 顏色區塊 + API Key + Save |
| `popup.js` | 改寫 | 全部 UI 邏輯：toggle、眼睛、狀態、色票、custom picker、Save 回饋 |

---

## 如何載入測試（每個 Task 都需要）

1. 開啟 `chrome://extensions`
2. 啟用右上角「開發者模式」
3. 點「載入未封裝項目」，選擇本專案資料夾
4. 若已載入，點擊重新整理 icon（或刪除後重新載入）

---

## Task 1: 修改 content.js

**Files:**
- Modify: `content.js`

- [ ] **Step 1: 將 content.js 完整改寫為以下內容**

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
chrome.storage.local.get('subtitleColor', ({ subtitleColor: c }) => {
  if (c) subtitleColor = c
})

chrome.storage.onChanged.addListener((changes) => {
  if (changes.subtitleColor) {
    subtitleColor = changes.subtitleColor.newValue
    document.querySelectorAll('.duocue-zh').forEach(el => {
      el.style.color = subtitleColor
    })
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
  const chineseHtml = chinese
    ? `<div class="duocue-zh" style="color:${subtitleColor}">${chinese}</div>`
    : ''
  overlay.innerHTML = `<div class="duocue-en">${english}</div>${chineseHtml}`
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

  let lastText = null
  let translateTimer = null

  setInterval(async () => {
    const { enabled } = await chrome.storage.local.get('enabled')
    if (enabled === false) {
      updateOverlay(null, null)
      lastText = null
      return
    }

    const english = extractText(platform)

    if (english === lastText) return
    lastText = english

    console.log(`[DuoCue] ${english || '(no subtitle)'}`)

    if (!english) {
      updateOverlay(null, null)
      return
    }

    updateOverlay(english, null)

    clearTimeout(translateTimer)
    translateTimer = setTimeout(async () => {
      const chinese = await translate(english)
      updateOverlay(english, chinese)
    }, 150)
  }, 200)
}

const platform = detectPlatform()
if (platform) startPolling(platform)
```

- [ ] **Step 2: 驗證**

載入擴充功能，前往 `play.hbomax.com` 播放任一影片：
- 中文字幕仍以金色顯示（`subtitleColor` 預設 `#FFD700`）
- Console 仍印出 `[DuoCue] Polling subtitles for HBO Max`

- [ ] **Step 3: Commit**

```bash
git add content.js
git commit -m "feat: add subtitleColor cache and enabled toggle to content.js"
```

---

## Task 2: 修改 styles.css

**Files:**
- Modify: `styles.css`

- [ ] **Step 1: 移除 .duocue-zh 的 hardcoded color**

將 `styles.css` 的 `.duocue-zh` 區塊改為：

```css
.duocue-zh {
  font-size: 1.2rem;
  margin-top: 4px;
  white-space: normal;
}
```

（移除 `color: #FFD700;` 這一行，其他不動）

- [ ] **Step 2: 驗證**

重新載入擴充功能，前往 HBO Max 播放影片：
- 中文字幕仍以金色顯示（顏色來自 content.js 的 inline style，不是 CSS）
- 若看到中文字幕變成白色，代表 content.js 的 inline style 沒有正確套用 → 回頭檢查 Task 1 的 `updateOverlay`

- [ ] **Step 3: Commit**

```bash
git add styles.css
git commit -m "refactor: remove hardcoded duocue-zh color, now controlled by JS"
```

---

## Task 3: 改寫 popup.html

**Files:**
- Modify: `popup.html`

- [ ] **Step 1: 將 popup.html 完整改寫為以下內容**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      width: 300px;
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
      background: #1C1C1E;
      color: #FFFFFF;
    }

    /* ── Header ── */
    .header {
      background: #2C2C2E;
      padding: 14px 16px;
    }
    .header-title {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #30D158;
      flex-shrink: 0;
    }
    .title-text {
      font-size: 17px;
      font-weight: 600;
    }
    .header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .subtitle-text {
      color: #8E8E93;
      font-size: 13px;
    }

    /* ── Toggle ── */
    .toggle {
      width: 44px;
      height: 26px;
      border-radius: 13px;
      background: #636366;
      position: relative;
      cursor: pointer;
      transition: background 0.2s;
      flex-shrink: 0;
    }
    .toggle.on { background: #30D158; }
    .toggle-knob {
      position: absolute;
      top: 3px;
      left: 3px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: white;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
      transition: transform 0.2s;
    }
    .toggle.on .toggle-knob { transform: translateX(18px); }

    /* ── Divider ── */
    .divider { height: 1px; background: #3A3A3C; }

    /* ── Body ── */
    .body {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    /* ── Color swatches ── */
    .section-label {
      color: #8E8E93;
      font-size: 13px;
      margin-bottom: 8px;
      display: block;
    }
    .color-swatches {
      display: flex;
      gap: 10px;
      align-items: center;
    }
    .color-swatch {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      cursor: pointer;
      border: 2px solid #3A3A3C;
      transition: border-color 0.15s, box-shadow 0.15s;
      flex-shrink: 0;
    }
    .color-swatch.selected {
      border-color: #FFFFFF;
      box-shadow: 0 0 0 2px var(--swatch-color);
    }
    .color-custom {
      background: conic-gradient(red, yellow, green, cyan, blue, magenta, red);
    }

    /* ── API Key ── */
    .field-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }
    .field-label {
      color: #8E8E93;
      font-size: 13px;
    }
    .field-status { font-size: 12px; }
    .field-status.set   { color: #30D158; }
    .field-status.unset { color: #FF9F0A; }

    .input-wrap { position: relative; }
    .input-wrap input {
      width: 100%;
      height: 44px;
      background: #2C2C2E;
      border: 1px solid #3A3A3C;
      border-radius: 10px;
      padding: 0 44px 0 12px;
      color: #FFFFFF;
      font-size: 14px;
      font-family: inherit;
      outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .input-wrap input:focus {
      border-color: #0A84FF;
      box-shadow: 0 0 0 3px rgba(10,132,255,0.3);
    }
    .eye-btn {
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      cursor: pointer;
      font-size: 16px;
      color: #8E8E93;
      user-select: none;
    }

    /* ── Save button ── */
    #save {
      width: 100%;
      height: 44px;
      background: #0A84FF;
      color: white;
      border: none;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      transition: background 0.2s;
    }
    #save.saved { background: #30D158; }
  </style>
</head>
<body>

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

  <div class="divider"></div>

  <!-- Body -->
  <div class="body">

    <!-- Color section -->
    <div>
      <span class="section-label">字幕顏色</span>
      <div class="color-swatches">
        <div class="color-swatch" data-color="#FFD700" style="background:#FFD700;--swatch-color:#FFD700"></div>
        <div class="color-swatch" data-color="#FFFFFF" style="background:#FFFFFF;--swatch-color:#FFFFFF"></div>
        <div class="color-swatch" data-color="#00E5FF" style="background:#00E5FF;--swatch-color:#00E5FF"></div>
        <div class="color-swatch" data-color="#FF6B6B" style="background:#FF6B6B;--swatch-color:#FF6B6B"></div>
        <div class="color-swatch" data-color="#98FB98" style="background:#98FB98;--swatch-color:#98FB98"></div>
        <div class="color-swatch color-custom" id="customSwatch"></div>
      </div>
      <input type="color" id="colorPicker" style="display:none">
    </div>

    <div class="divider"></div>

    <!-- API Key section -->
    <div>
      <div class="field-header">
        <span class="field-label">API Key</span>
        <span class="field-status" id="keyStatus"></span>
      </div>
      <div class="input-wrap">
        <input type="password" id="apiKey" placeholder="AIza...">
        <span class="eye-btn" id="eyeBtn">👁</span>
      </div>
    </div>

    <button id="save">Save Key</button>

  </div>

  <script src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 2: 驗證**

重新載入擴充功能，點擊 Chrome 工具列的 DuoCue icon：
- Popup 呈現深色背景（`#1C1C1E`）
- Header 顯示 DuoCue 名稱 + toggle
- 色票列可見（5 顆 + 彩虹圓）
- API Key 輸入框下方有 Save Key 按鈕
- 不需要驗證互動行為（popup.js 尚未更新）

- [ ] **Step 3: Commit**

```bash
git add popup.html
git commit -m "feat: rewrite popup.html with Apple Dark Mode layout and color swatches"
```

---

## Task 4: 改寫 popup.js

**Files:**
- Modify: `popup.js`

- [ ] **Step 1: 將 popup.js 完整改寫為以下內容**

```js
const toggle     = document.getElementById('toggle')
const apiKeyInput = document.getElementById('apiKey')
const eyeBtn     = document.getElementById('eyeBtn')
const keyStatus  = document.getElementById('keyStatus')
const saveBtn    = document.getElementById('save')
const colorPicker = document.getElementById('colorPicker')
const customSwatch = document.getElementById('customSwatch')
const swatches   = document.querySelectorAll('.color-swatch[data-color]')

// ── Init ──────────────────────────────────────────────────────────────────
chrome.storage.local.get(['translationApiKey', 'enabled', 'subtitleColor'], (data) => {
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
})

// ── Toggle ────────────────────────────────────────────────────────────────
toggle.addEventListener('click', () => {
  const isOn = toggle.classList.toggle('on')
  chrome.storage.local.set({ enabled: isOn })
})

// ── Eye button ────────────────────────────────────────────────────────────
eyeBtn.addEventListener('click', () => {
  const isPassword = apiKeyInput.type === 'password'
  apiKeyInput.type = isPassword ? 'text' : 'password'
  eyeBtn.textContent = isPassword ? '🙈' : '👁'
})

// ── Save Key ──────────────────────────────────────────────────────────────
saveBtn.addEventListener('click', () => {
  const key = apiKeyInput.value.trim()
  chrome.storage.local.set({ translationApiKey: key }, () => {
    setKeyStatus(!!key)
    saveBtn.textContent = '✓ Saved'
    saveBtn.classList.add('saved')
    setTimeout(() => {
      saveBtn.textContent = 'Save Key'
      saveBtn.classList.remove('saved')
    }, 1500)
  })
})

// ── Color swatches ────────────────────────────────────────────────────────
swatches.forEach(swatch => {
  swatch.addEventListener('click', () => {
    const color = swatch.dataset.color
    selectColor(color)
    chrome.storage.local.set({ subtitleColor: color })
  })
})

customSwatch.addEventListener('click', () => colorPicker.click())

colorPicker.addEventListener('input', () => {
  const color = colorPicker.value
  selectColor(color, true)
  chrome.storage.local.set({ subtitleColor: color })
})

// ── Helpers ───────────────────────────────────────────────────────────────
function selectColor(color, isCustom = false) {
  swatches.forEach(s => s.classList.remove('selected'))
  customSwatch.classList.remove('selected')

  if (!isCustom) {
    const match = [...swatches].find(
      s => s.dataset.color.toLowerCase() === color.toLowerCase()
    )
    if (match) {
      match.classList.add('selected')
      return
    }
  }

  // 自訂顏色（或找不到對應的預設色票）
  customSwatch.classList.add('selected')
  colorPicker.value = color
}

function setKeyStatus(isSet) {
  keyStatus.textContent = isSet ? '✓ Set' : '⚠ Not set'
  keyStatus.className = 'field-status ' + (isSet ? 'set' : 'unset')
}
```

- [ ] **Step 2: 驗證 toggle**

重新載入擴充功能，開啟 popup：
- Toggle 預設為 ON（綠色）
- 點擊 toggle → 切換為 OFF（灰色）
- 前往 HBO Max 播放影片 → overlay 消失（enabled=false）
- 再點 toggle 切換回 ON → overlay 恢復

- [ ] **Step 3: 驗證眼睛 icon**

在 popup 的 API Key 欄位：
- 預設顯示遮罩（`type="password"`）
- 點擊 👁 → 顯示明文，icon 變 🙈
- 再點 → 恢復遮罩，icon 變回 👁

- [ ] **Step 4: 驗證 Save Key 回饋**

輸入任意文字按 Save Key：
- 按鈕文字變 `✓ Saved`，背景變綠色
- 1.5 秒後恢復 `Save Key` + 藍色背景
- 狀態指示器顯示 `✓ Set`（綠色）

- [ ] **Step 5: 驗證色票**

在 popup 點擊不同色票：
- 被選中的色票出現白色外圈
- 前往 HBO Max → 中文字幕即時變換顏色
- 點彩虹圓 → 系統 color picker 開啟 → 選完後字幕立即更新
- 關閉再開 popup → 上次選的顏色仍被選中（外圈指示正確）

- [ ] **Step 6: Commit**

```bash
git add popup.js
git commit -m "feat: rewrite popup.js with toggle, eye icon, key status, and color swatches"
```

---

## Task 5: 端對端驗證

- [ ] **Step 1: 完整流程驗證**

前往 `play.hbomax.com` 播放任一有字幕的影片，依序執行：

1. 雙語字幕正常顯示（英文 + 中文金色）
2. 開啟 popup → 選青色（`#00E5FF`）→ 字幕立即變青色
3. 選彩虹圓 → 選一個自訂顏色 → 字幕立即更新
4. 關閉再開 popup → 自訂顏色仍被選中（彩虹圓有白色外圈）
5. Toggle 切為 OFF → overlay 消失
6. Toggle 切回 ON → overlay 恢復，顏色保持自訂顏色
7. Save Key：輸入 API key → 按 Save → `✓ Saved` 回饋 → 1.5s 後恢復

- [ ] **Step 2: 驗證預設值（全新安裝情境）**

在 `chrome://extensions` 點「Service Worker」→ 開啟 DevTools → 執行：

```js
chrome.storage.local.clear()
```

重新載入擴充功能，開啟 popup：
- Toggle 為 ON
- 金色色票（第一顆）有白色外圈（popup.js 預設 `#FFD700`）
- 狀態顯示 `⚠ Not set`

- [ ] **Step 3: 最終 commit（若有任何修正）**

```bash
git add -p
git commit -m "fix: <描述修正內容>"
```
