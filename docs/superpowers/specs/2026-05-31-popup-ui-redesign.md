# DuoCue — Popup UI 重設計規格

**日期：** 2026-05-31
**目標：** 將現有極簡 popup 升級為 Apple Dark Mode 風格，加入 enable/disable toggle、API key 可視切換、以及狀態指示器

---

## 成功標準

1. Popup 呈現 iOS Dark Mode 視覺風格（色彩、字型、圓角、間距）
2. Toggle 可即時開關雙語功能，不需移除 API key
3. API Key 欄位預設遮罩，眼睛 icon 可切換顯示
4. Label 旁顯示 key 設定狀態（✓ Set / ⚠ Not set）
5. Save 按鈕點擊後有短暫成功回饋（1.5 秒）
6. content.js 在 toggle 關閉時隱藏 overlay 並停止翻譯

---

## 檔案變化

| 檔案 | 動作 | 說明 |
|------|------|------|
| `popup.html` | 改寫 | 加入 toggle、眼睛 icon、狀態指示，重寫全部樣式 |
| `popup.js` | 改寫 | 處理 toggle、眼睛切換、狀態讀取、Save 回饋 |
| `content.js` | 修改 | polling loop 讀取 `enabled` state，關閉時隱藏 overlay |

---

## 視覺規格

### 色彩系統

| Token | 色碼 | 用途 |
|-------|------|------|
| `bg-primary` | `#1C1C1E` | popup 主背景 |
| `bg-secondary` | `#2C2C2E` | header 區塊、input 背景 |
| `bg-tertiary` | `#3A3A3C` | input border、分隔線 |
| `accent-blue` | `#0A84FF` | 按鈕、focus ring |
| `accent-green` | `#30D158` | toggle ON、✓ Set 狀態 |
| `accent-orange` | `#FF9F0A` | ⚠ Not set 狀態 |
| `toggle-off` | `#636366` | toggle OFF |
| `text-primary` | `#FFFFFF` | 主要文字 |
| `text-secondary` | `#8E8E93` | 次要文字（副標題、label） |

### 字型

```css
font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
```

### 尺寸

- Popup 寬度：`300px`
- 外邊距：`0`（讓 Chrome 決定外框）
- 內容 padding：`16px`
- Input / Button 圓角：`10px`（iOS 風格）
- Toggle 圓角：`pill`

---

## Layout 結構

```
┌──────────────────────────────────┐
│  [Header]                        │  bg-secondary, padding 16px
│  ⬤ DuoCue                       │  icon 8px + 名稱 17px bold
│  Bilingual Subtitles    [toggle] │  副標 13px secondary + toggle 右對齊
├──────────────────────────────────┤  border-top bg-tertiary
│  [Body]                          │  bg-primary, padding 16px
│  API Key              ✓ Set     │  label 13px secondary + 狀態右對齊
│  ┌────────────────────────────┐  │
│  │ AIza••••••••••••••••  👁  │  │  input bg-secondary, 44px 高
│  └────────────────────────────┘  │
│                                  │
│  ┌────────────────────────────┐  │
│  │          Save Key          │  │  accent-blue 背景，白字，44px 高
│  └────────────────────────────┘  │
└──────────────────────────────────┘
```

---

## 元件設計

### Toggle（開/關）

- 外觀：iOS 風格，寬 `44px` × 高 `26px`，pill 形
- 狀態：ON → `#30D158` 背景，白色圓點右側；OFF → `#636366` 背景，白色圓點左側
- 過渡：`transition: background 0.2s, transform 0.2s`
- 儲存：`chrome.storage.local` 的 `enabled` key（boolean，預設 `true`）
- 實作：純 CSS + JS，不使用 `<input type="checkbox">` 的原生外觀

```html
<div class="toggle" id="toggle">
  <div class="toggle-knob"></div>
</div>
```

### API Key Input

- `type="password"` 預設（遮罩顯示）
- 右側絕對定位眼睛 icon（`👁` / `🙈`）
- 點擊 icon：`input.type` 在 `password` ↔ `text` 間切換，icon 同步更新
- Focus 時：border 變 `#0A84FF`，`box-shadow: 0 0 0 3px rgba(10,132,255,0.3)`

### 狀態指示

- popup 開啟時讀取 `translationApiKey`
- 有值：`✓ Set`（`#30D158`，12px）
- 無值：`⚠ Not set`（`#FF9F0A`，12px）
- 位置：`API Key` label 右側，flex space-between

### Save 按鈕回饋

- 正常態：`Save Key`，`#0A84FF` 背景
- 點擊後：按鈕文字改為 `✓ Saved`，背景改為 `#30D158`
- 1500ms 後恢復原狀
- 同時更新狀態指示器為 `✓ Set`

---

## content.js 修改

在 `startPolling` 的 `setInterval` callback 中加入 `enabled` 檢查：

```js
setInterval(async () => {
  const { enabled } = await chrome.storage.local.get('enabled')
  if (enabled === false) {
    updateOverlay(null, null)
    lastText = null
    return
  }
  // ... 原有 polling 邏輯
}, 200)
```

- `enabled` 未設定（undefined）視為 `true`（向後相容）
- 關閉時立即清空 overlay、重置 `lastText`（重新開啟時重新抓取並翻譯）

---

## popup.js 邏輯流程

```
popup 開啟
  → 讀取 storage: { translationApiKey, enabled }
  → 更新 toggle 狀態（ON/OFF）
  → 更新 key 狀態指示（✓ Set / ⚠ Not set）
  → 若有 key：填入 input（遮罩顯示）

toggle 點擊
  → 切換 enabled 狀態
  → 儲存到 storage
  → 更新 toggle 視覺

眼睛 icon 點擊
  → 切換 input.type
  → 切換 icon

Save 按鈕點擊
  → 讀取 input.value.trim()
  → 儲存 translationApiKey 到 storage
  → 按鈕回饋（✓ Saved → 1500ms → Save Key）
  → 更新狀態指示器
```

---

## 超出本階段範圍

- 目標語言切換（目前固定 zh-TW）
- 動畫過渡效果（超出 popup 標準需求）
- 深色/淺色主題切換
