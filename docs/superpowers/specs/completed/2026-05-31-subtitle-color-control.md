# DuoCue — 第二語言顏色控制規格

**日期：** 2026-05-31
**依賴：** `2026-05-31-popup-ui-redesign.md`（Apple Dark Mode popup 重設計，需一起實作）
**目標：** 在 Popup 加入色票讓用戶控制中文字幕顏色，點選立即套用

---

## 成功標準

1. Popup 顯示 5 顆預設色票 + 1 顆彩虹自訂圓
2. 點選任何色票後，影片頁面的中文字幕顏色立即更新（不需按 Save）
3. 點選彩虹圓開啟系統原生 color picker，選完後立即套用
4. 當前選中的顏色有明顯選取指示（白色外圈）
5. 顏色設定在 popup 關閉後仍保留（寫入 `chrome.storage.local`）
6. 預設顏色為 `#FFD700`（與現有行為一致）

---

## Popup Layout

欄位由上至下：

```
┌──────────────────────────────────┐
│ [Header]  bg-secondary           │
│  ⬤ DuoCue                       │
│  Bilingual Subtitles    [toggle] │
├──────────────────────────────────┤
│ [Body]  bg-primary               │
│                                  │
│  字幕顏色                         │
│  ⬤ ⬤ ⬤ ⬤ ⬤ 🎨               │
│  ─────────────────────────────   │
│  API Key              ✓ Set     │
│  [ AIza•••••••••••••••••  👁 ]  │
│                                  │
│  [        Save Key           ]   │
└──────────────────────────────────┘
```

顏色區塊在上方，API Key 和 Save Key 在下方，中間用分隔線隔開。Save Key 按鈕只負責儲存 API Key，與顏色無關。

---

## 色票設計

### 預設顏色（5 顆）

| 色票 | 色碼 | 說明 |
|------|------|------|
| 金色 | `#FFD700` | 預設，現有顏色 |
| 白色 | `#FFFFFF` | 純白 |
| 青色 | `#00E5FF` | 清爽藍綠 |
| 珊瑚紅 | `#FF6B6B` | 柔和紅 |
| 淺綠 | `#98FB98` | 柔和綠 |

### 自訂顏色（1 顆）

- 外觀：`conic-gradient(red, yellow, green, cyan, blue, magenta, red)` 彩虹圓
- 點擊：觸發隱藏的 `<input type="color">` — Chrome 原生支援
- 選完後：立即套用，與預設色票行為一致

### 選取指示

```css
.color-swatch.selected {
  border: 2px solid #FFFFFF;
  box-shadow: 0 0 0 2px currentColor; /* 外圈顯示選中 */
}
```

---

## HTML 結構

```html
<!-- 顏色區塊（位於 Body 最上方） -->
<div class="color-section">
  <span class="section-label">字幕顏色</span>
  <div class="color-swatches">
    <div class="color-swatch selected" data-color="#FFD700" style="background:#FFD700"></div>
    <div class="color-swatch" data-color="#FFFFFF" style="background:#FFFFFF"></div>
    <div class="color-swatch" data-color="#00E5FF" style="background:#00E5FF"></div>
    <div class="color-swatch" data-color="#FF6B6B" style="background:#FF6B6B"></div>
    <div class="color-swatch" data-color="#98FB98" style="background:#98FB98"></div>
    <div class="color-swatch color-custom" id="customSwatch"></div>
  </div>
  <input type="color" id="colorPicker" style="display:none">
</div>
<div class="divider"></div>

<!-- API Key 區塊（不變） -->
```

---

## popup.js 邏輯

```
popup 開啟
  → 讀取 storage: { subtitleColor }
  → 找到 data-color 對應的色票，加上 selected class
  → 若無對應（自訂顏色），設 customSwatch 為 selected

色票點擊
  → 移除所有 selected class
  → 加上 selected 到點擊的色票
  → 取 data-color 值
  → chrome.storage.local.set({ subtitleColor: color })

彩虹圓點擊
  → colorPicker.click()

colorPicker input 事件
  → 移除所有 selected class
  → 加上 selected 到 customSwatch
  → chrome.storage.local.set({ subtitleColor: colorPicker.value })
```

---

## content.js 修改

用模組層級變數快取顏色，避免每次 polling 都做 storage IO：

```js
// 模組層級快取，script 載入時初始化
let subtitleColor = '#FFD700'
chrome.storage.local.get('subtitleColor', ({ subtitleColor: c }) => {
  if (c) subtitleColor = c
})

// 監聽變更，立即更新 DOM 上現有的 .duocue-zh 元素
chrome.storage.onChanged.addListener((changes) => {
  if (changes.subtitleColor) {
    subtitleColor = changes.subtitleColor.newValue
    document.querySelectorAll('.duocue-zh').forEach(el => {
      el.style.color = subtitleColor
    })
  }
})
```

`updateOverlay` 使用快取值（不需改為 async）：

```js
function updateOverlay(english, chinese) {
  // ...
  const chineseHtml = chinese
    ? `<div class="duocue-zh" style="color:${subtitleColor}">${chinese}</div>`
    : ''
  overlay.innerHTML = `<div class="duocue-en">${english}</div>${chineseHtml}`
  overlay.style.display = 'block'
}
```

---

## styles.css 修改

移除 `.duocue-zh` 的 hardcoded `color`，改由 JS 動態控制：

```css
/* 前 */
.duocue-zh {
  color: #FFD700;  /* 移除此行 */
  font-size: 1.2rem;
  margin-top: 4px;
  white-space: normal;
}

/* 後 */
.duocue-zh {
  font-size: 1.2rem;
  margin-top: 4px;
  white-space: normal;
  /* color 由 JS 動態設定，預設 #FFD700 */
}
```

---

## Storage Schema

| Key | 型別 | 預設值 | 說明 |
|-----|------|--------|------|
| `subtitleColor` | string | `#FFD700` | 中文字幕顏色，任何合法 CSS color 值 |

---

## 檔案變化摘要

| 檔案 | 動作 | 說明 |
|------|------|------|
| `popup.html` | 改寫 | 加入顏色區塊（含 Apple Dark Mode 重設計） |
| `popup.js` | 改寫 | 處理色票點擊、custom picker、storage 讀寫 |
| `content.js` | 修改 | 加入 `storage.onChanged` listener；`updateOverlay` 讀取 `subtitleColor` |
| `styles.css` | 修改 | 移除 `.duocue-zh` hardcoded color |

---

## 超出本階段範圍

- 英文字幕顏色控制
- 字幕字型大小調整
- 顏色透明度控制
