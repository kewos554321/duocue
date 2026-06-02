# DuoCue — 字幕外觀設定設計文件

**日期：** 2026-06-02
**階段：** 功能擴充
**目標：** 讓用戶可在 Popup 調整字幕的字型大小、字型、粗體

---

## 背景

目前 DuoCue 的字幕顏色功能已完整實作（色票 + 自訂色盤，存於 `chrome.storage.local` 的 `subtitleColor`，`content.js` 透過 `storage.onChanged` 即時套用）。

本次新增三個字幕外觀控件：字型大小、字型、粗體。設計風格沿用現有 Apple-style dark UI。

---

## 成功標準

1. 用戶在 Popup 拖動滑桿，字幕大小立即在影片上改變
2. 用戶選擇下拉字型，字幕字型立即切換
3. 用戶切換粗體 toggle，字幕粗細立即改變
4. 設定跨頁面持久化（關閉瀏覽器後仍保留）

---

## UI 設計

### 新增位置

在現有「字幕顏色」區塊與「API Key」區塊之間插入三個新控件，以一條分隔線與顏色區塊分隔。

### 控件規格

#### 字型大小（滑桿）

```
字型大小                    18pt
[━━━━━━━━●──────────────]
12pt                      32pt
```

- 元件：`<input type="range">`
- 範圍：12–32（整數）
- 預設：18
- 單位顯示：`{n}pt`（右側即時更新）
- 樣式：沿用現有 API Key input 的 `#2C2C2E` 背景、`#0A84FF` 藍色 accent

#### 字型（下拉選單）

```
字型
[Arial, sans-serif（系統預設）    ▼]
```

- 元件：`<select>`
- 選項：

| value | 顯示文字 |
|-------|----------|
| `Arial, sans-serif` | Arial, sans-serif（系統預設） |
| `Georgia, serif` | Georgia, serif（有襯線） |
| `"Courier New", monospace` | Courier New, monospace（等寬） |
| `"Helvetica Neue", sans-serif` | Helvetica Neue |
| `Impact, sans-serif` | Impact（粗黑體） |

- 預設：`Arial, sans-serif`（對應現有 `styles.css`）
- 樣式：`height: 44px`，`background: #2C2C2E`，`border: 1px solid #3A3A3C`，`border-radius: 10px`，`color: #FFFFFF`，`font-size: 14px`

#### 粗體（Toggle）

```
粗體                        [●──]
```

- 元件：現有 `.toggle` 元件（與開關 toggle 相同樣式）
- 預設：關閉（`font-weight: normal`）
- 開啟時：`font-weight: bold`

---

## 資料設計

### 新增 Storage Keys（`chrome.storage.local`）

```js
{
  fontSize: 18,                   // number, 12–32
  fontFamily: "Arial, sans-serif", // string
  bold: false,                    // boolean
}
```

### 現有 Keys（不動）

```js
{
  subtitleColor: "#FFD700",  // 已實作
  enabled: true,
  displayMode: "both",
  translationApiKey: "...",
  transcriptEnabled: false,
  // ...
}
```

---

## 實作設計

### popup.js 變更

**初始化（載入時讀取）：**
```js
chrome.storage.local.get(['fontSize', 'fontFamily', 'bold'], ({ fontSize, fontFamily, bold }) => {
  // 設定 slider、select、toggle 的初始值
})
```

**變更時（即時）：**
每個控件 `input`/`change`/`click` 事件觸發時：
1. 更新畫面（slider 數值顯示、toggle 狀態）
2. `chrome.storage.local.set({ fontSize / fontFamily / bold })`

不需要 `sendMessage`——`content.js` 已有 `storage.onChanged` 監聽機制，會自動收到變更。

### content.js 變更

**初始化（於 `startPolling` 前讀取）：**
```js
chrome.storage.local.get(['fontSize', 'fontFamily', 'bold'], (result) => {
  // 存入 module-level 變數
})
```

**監聽變更（追加到現有 `storage.onChanged` handler）：**
```js
const el = document.getElementById('duocue-overlay')
if (!el) return
if (changes.fontSize)   el.style.fontSize   = `${changes.fontSize.newValue}px`
if (changes.fontFamily) el.style.fontFamily  = changes.fontFamily.newValue
if (changes.bold)       el.style.fontWeight  = changes.bold.newValue ? 'bold' : 'normal'
```

**套用範圍：** 整個 `#duocue-overlay`（英文和中文字幕同時套用）

### styles.css 變更

移除 `font-size` 和 `font-family` 的靜態值，改由 JS 動態注入（避免 CSS 優先級衝突）：

```css
/* 移除：font-size: 1.4rem; */
/* 移除：font-family: Arial, sans-serif; */
/* 移除：.duocue-en { font-size: 1.4rem; } */
```

---

## 不在本次範圍

- 英文和中文字幕分開設定字型/大小
- 字幕背景透明度調整
- 更多字型選項（可日後擴充 `<select>`）
- 字型大小的即時預覽框（Popup 內）
