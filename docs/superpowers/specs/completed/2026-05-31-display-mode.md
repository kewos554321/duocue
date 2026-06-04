# DuoCue — 字幕顯示模式規格

**日期：** 2026-05-31
**目標：** 在 Popup Header 加入 Segmented Control，讓用戶控制字幕顯示模式（兩者 / 原文 / 翻譯）

---

## 成功標準

1. Header 第二行顯示三段式 Segmented Control：兩者 / 原文 / 翻譯
2. 點選後立即更新影片 overlay 的顯示內容
3. 選取的 segment 有明顯高亮（藍色背景 + 白字）
4. 模式設定在 popup 關閉後仍保留（寫入 `chrome.storage.local`）
5. 預設模式為 `'both'`（顯示兩者，與現有行為一致）

---

## Popup Layout

```
┌──────────────────────────────────┐
│ [Header]  bg-secondary           │
│  ⬤ DuoCue               [toggle] │  ← Row 1：標題 + 整體開關
│  [  兩者  |  原文  |  翻譯  ]    │  ← Row 2：Segmented Control
├──────────────────────────────────┤
│ [Body]  bg-primary               │
│  字幕顏色                         │
│  ⬤ ⬤ ⬤ ⬤ ⬤ 🎨               │
│  ─────────────────────────────   │
│  API Key              ✓ Set     │
│  [ AIza•••••••••••••••••  👁 ]  │
│  [        Save Key           ]   │
└──────────────────────────────────┘
```

"Bilingual Subtitles" label 由 Segmented Control 取代。Toggle（整體開關）保持不變，位於 Row 1 右側。

---

## Segmented Control 設計

### 視覺規格

| 狀態 | 背景 | 文字 |
|------|------|------|
| 選中 | `#0A84FF` | `#FFFFFF`，`font-weight: 600` |
| 未選中 | 透明 | `#8E8E93` |
| 容器 | `#1C1C1E`（bg-primary）| — |

```css
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

### HTML 結構

`.header` 改為兩行：

```html
<div class="header">
  <!-- Row 1: title + toggle（toggle 從 .header-row 移到這裡） -->
  <div class="header-title">
    <div class="status-dot"></div>
    <span class="title-text">DuoCue</span>
    <div class="toggle" id="toggle">
      <div class="toggle-knob"></div>
    </div>
  </div>
  <!-- Row 2: segmented control（取代舊的 .header-row） -->
  <div class="seg-control" id="segControl">
    <button class="seg-btn active" data-mode="both">兩者</button>
    <button class="seg-btn" data-mode="original">原文</button>
    <button class="seg-btn" data-mode="translation">翻譯</button>
  </div>
</div>
```

`.header-title` 需加 `justify-content: space-between` 讓 toggle 靠右。移除舊的 `.header-row` 和 `.subtitle-text` CSS。

---

## Storage Schema

| Key | 型別 | 預設值 | 說明 |
|-----|------|--------|------|
| `displayMode` | string | `'both'` | `'both'` \| `'original'` \| `'translation'` |

---

## popup.js 邏輯

```
popup 開啟
  → 讀取 storage: { displayMode }
  → selectMode(data.displayMode || 'both')

Segment 點擊
  → selectMode(mode)
  → chrome.storage.local.set({ displayMode: mode })

selectMode(mode)
  → 移除所有 .seg-btn 的 active class
  → 找到 data-mode === mode 的按鈕，加 active class
```

---

## content.js 修改

模組層級快取（與 `subtitleColor` 相同模式）：

```js
let displayMode = 'both'
chrome.storage.local.get('displayMode', ({ displayMode: m }) => {
  if (m) displayMode = m
})

// 快取最後一次的翻譯結果，供模式切換時重渲染用
let lastEnglish = null
let lastChinese = null

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return
  if (changes.displayMode) {
    displayMode = changes.displayMode.newValue
    // 用快取值重渲染，不讀 DOM
    if (lastEnglish) updateOverlay(lastEnglish, lastChinese)
  }
})
```

`updateOverlay` 根據 `displayMode` 決定渲染內容：

```js
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
```

`startPolling` 中，`lastText` 改名為 `lastEnglish` 並與模組層級快取同步：

```js
// 在 setInterval 內更新快取
lastEnglish = english   // 設定字幕時
lastChinese = chinese   // 翻譯完成時
// 清空時
lastEnglish = null
lastChinese = null
```

**邊緣情況：**
- `displayMode === 'translation'` 且尚未翻譯完成（`chinese` 為 `null`）→ `showZh` 為 false，overlay 隱藏；翻譯完成後 `updateOverlay(english, chinese)` 重新顯示
- `displayMode` 為未知值 → `showEn` 和 `showZh` 都是 false → overlay 隱藏（防呆）

---

## 檔案變化摘要

| 檔案 | 動作 | 說明 |
|------|------|------|
| `popup.html` | 修改 | 移除 `.header-row`（Bilingual Subtitles + toggle 那行），新增 Row 1（title + toggle）和 Row 2（seg-control），加入 `.seg-control` / `.seg-btn` CSS |
| `popup.js` | 修改 | 加入 `selectMode()`，init 讀取 `displayMode`，seg-btn click 處理 |
| `content.js` | 修改 | 加入 `displayMode` 快取、`onChanged` 分支、`updateOverlay` 根據模式渲染 |

---

## 超出本階段範圍

- 翻譯語言切換（目前固定 zh-TW）
- 每個語言獨立顏色控制
- Segmented Control 動畫過渡
