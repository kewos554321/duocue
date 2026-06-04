# DuoCue — Popup 重設計 + 翻譯引擎選擇設計文件

**日期：** 2026-06-03
**階段：** 功能擴充
**目標：** 重新設計 popup 為四個可收合分類，並支援免費翻譯（MyMemory）與 Google Translate 切換

---

## 背景

現有 popup 為平面列表結構，設定項目沒有分類，且唯一翻譯引擎為 Google Cloud Translation API，需要用戶自行申請 API Key，門檻過高。

本次改動：
1. Popup 重排為四個可收合分類，收合時右側顯示摘要值
2. 新增翻譯引擎切換：免費（MyMemory）／Google Translate
3. 預設使用免費引擎，不需要任何設定即可使用

---

## 成功標準

1. 初次安裝無需任何設定，翻譯即可運作（MyMemory）
2. 四個分類皆可獨立展開/收合
3. 收合狀態下顯示當前值摘要（顏色若為自訂色顯示「自訂」）
4. 切換至 Google Translate 後展開 API Key 輸入，反之隱藏
5. 翻譯引擎切換後 content.js 立即切換翻譯邏輯

---

## UI 設計

### 整體結構

```
┌─────────────────────────────┐
│ ● DuoCue              [ON]  │  ← Header（不可收合）
├─────────────────────────────┤
│ 字幕顯示        兩者    ▼   │  ← 收合
│ 字幕外觀  白 · 18pt · Arial ▼│  ← 收合
│ 翻譯引擎        免費    ▼   │  ← 收合
│ 逐字稿          關閉    ▼   │  ← 收合
└─────────────────────────────┘
```

### 收合行為

- 點擊分類 header row 切換展開/收合
- 展開時 chevron 朝上並變藍（`#0A84FF`），收合時朝下灰色（`#8E8E93`）
- 收合/展開狀態僅存在 session（不寫入 storage），預設全部收合
- 展開動畫：不需要，直接顯示/隱藏（保持簡單）

### 收合摘要規則

| 分類 | 摘要格式 | 範例 |
|------|---------|------|
| 字幕顯示 | 顯示模式名稱 | `兩者` / `原文` / `翻譯` |
| 字幕外觀 | 顏色名 · 字型大小 · 字型縮寫 | `白 · 18pt · Arial` |
| 翻譯引擎 | 引擎名稱 | `免費` / `Google Translate` |
| 逐字稿 | 開關狀態 | `關閉` / `記錄中` |

#### 字幕外觀顏色名稱對照

| hex | 名稱 |
|-----|------|
| `#FFD700` | 金色 |
| `#FFFFFF` | 白色 |
| `#00E5FF` | 青色 |
| `#FF6B6B` | 紅色 |
| `#98FB98` | 綠色 |
| 其他 | 自訂 |

#### 字幕外觀字型縮寫

顯示 `fontFamily` 值取第一個逗號前的部分，並去除引號。
例：`"Helvetica Neue", sans-serif` → `Helvetica Neue`；`Arial, sans-serif` → `Arial`。

### 翻譯引擎分類內容

**免費（預設）：**
```
[ 免費 ✓ ] [ Google Translate ]
─────────────────────────────────
✓ MyMemory 免費翻譯
  每天 1,000 字，無需帳號
```

**Google Translate：**
```
[ 免費 ] [ Google Translate ✓ ]
─────────────────────────────────
API Key         ✓ 已設定 / ⚠ 未設定
[•••••••••••••               👁]
[    儲存 API Key              ]
─────────────────────────────────
（提示文字）需要 Google Cloud API Key。
每月 500,000 字元免費，超過 $20/1M 字元。
```

眼睛圖示使用現有 SVG（`popup.js` 中的 `EYE_OPEN` / `EYE_SLASH`）。

---

## 資料設計

### 新增 Storage Key

```js
translationEngine: 'free' | 'google'  // 預設 'free'
```

### 現有 Keys（不動）

```js
translationApiKey, subtitleColor, displayMode,
fontSize, fontFamily, bold,
transcriptEnabled, transcriptLines, transcriptStorageFull
```

---

## 翻譯邏輯

### MyMemory API

```
GET https://api.mymemory.translated.net/get?q={encodeURIComponent(text)}&langpair=en|zh-TW
```

Response：
```json
{ "responseData": { "translatedText": "..." }, "responseStatus": 200 }
```

錯誤處理：`responseStatus !== 200` 或 fetch 失敗時回傳 `null`（不顯示翻譯，靜默失敗）。

### Google Translate API（現有）

```
POST https://translation.googleapis.com/language/translate/v2?key={key}
```

### content.js 切換邏輯

```js
async function translate(text) {
  const { translationEngine } = await chrome.storage.local.get('translationEngine')
  // undefined（首次安裝）視同 'free'
  return translationEngine === 'google'
    ? translateGoogle(text)
    : translateFree(text)
}
```

`storage.onChanged` 監聽 `translationEngine` 變更，無需額外處理（下次字幕更新時自動使用新引擎）。

---

## 實作範圍

### `popup.html`

完整重寫 body 區塊：
- 移除現有平面列表結構
- 改為四個 `.section` 分類，每個含 `.section-header`（標題 + 摘要 span + chevron SVG）和 `.section-body`（預設 `display:none`）
- CSS 新增 `.section`, `.section-header`, `.section-body`, `.section-summary` 樣式

### `popup.js`

- 新增 `initSections()` 處理展開/收合事件
- 新增 `updateSummaries()` 在每次設定變更後更新摘要文字
- 新增 `translationEngine` 初始化和事件處理
- 現有所有事件 handler 保留，重新綁定到新 DOM ID（ID 不變）

### `content.js`

- 將現有 `translate()` 函式拆分為 `translateFree()` 和 `translateGoogle()`
- 新增對 `translationEngine` storage key 的讀取（初始化）
- 現有 `storage.onChanged` 不需監聽 `translationEngine`（自動生效）

### `styles.css`

不需要改動。

---

## 不在本次範圍

- 展開/收合動畫（CSS transition）
- 多語言介面
- 逐字稿分頁獨立出去
- MyMemory 每日限額超出的提示 UI
