# DuoCue — 多平台支援 + 模組化設計文件

**日期：** 2026-06-03
**修訂：** 2026-06-03（更新為實際實現）
**階段：** 功能擴充
**目標：** 新增 Netflix 和 YouTube 支援，將平台設定模組化，並在 popup 提供手動平台選擇器

---

## 背景

原 `content.js` 直接內嵌 `PLATFORMS` 陣列、硬編碼 HBO Max 的 playerSelector 和 native subtitle CSS。本次將平台設定拆分至 `platforms.js`，新增平台只需修改該檔案和 `manifest.json`。

Popup 新增手動平台選擇器，讓用戶明確指定當前平台；`content.js` 優先讀取 storage 選擇，fallback 到 hostname 自動偵測。

---

## 成功標準

1. HBO Max 行為與之前完全一致（無回歸）
2. Netflix：播放含英文字幕的影片，DuoCue overlay 顯示英文 + 中文翻譯，原生字幕隱藏
3. YouTube：播放含英文字幕的影片，DuoCue overlay 顯示英文 + 中文翻譯，原生字幕隱藏
4. 新增平台只需在 `platforms.js` 加一個物件 + 更新 `manifest.json`
5. Popup 手動選擇平台後重新整理頁面即生效

---

## 平台設定

### Platform Config 結構（`platforms.js`）

```js
{
  id: string,                // storage key 識別用（'hbomax'|'netflix'|'youtube'）
  name: string,              // popup 顯示名稱
  hostname: string,          // hostname 自動偵測 fallback
  textSelector: string,      // 字幕文字元素 selector（DOM 實測確認）
  textJoin: string,          // 多元素連接字元（'\n' 或 ' '）
  playerSelector: string,    // 播放器容器 selector（全螢幕用）
  hideNativeSelector: string, // 要隱藏的原生字幕 selector
}
```

### 三個平台完整設定（DOM 實測確認）

```js
const PLATFORMS = [
  {
    id: 'hbomax',
    name: 'HBO Max',
    hostname: 'play.hbomax.com',
    textSelector: '[class*="TextCue-Fuse-Web-Play"]',
    textJoin: '\n',
    playerSelector: '[data-testid="playerContainer"]',
    hideNativeSelector: '[class*="CaptionWindow-Fuse-Web-Play"]',
  },
  {
    id: 'netflix',
    name: 'Netflix',
    hostname: 'www.netflix.com',
    textSelector: '.player-timedtext-text-container',  // 實測確認
    textJoin: '\n',
    playerSelector: '.watch-video--player-view',        // 實測確認
    hideNativeSelector: '.player-timedtext',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    hostname: 'www.youtube.com',
    textSelector: '.ytp-caption-segment',               // 實測確認
    textJoin: ' ',
    playerSelector: '#movie_player',
    hideNativeSelector: '.ytp-caption-window-container',
  },
]
```

`textJoin` 說明：
- HBO Max / Netflix：每個元素是一整行字幕，用 `'\n'` 連接多行
- YouTube：`.ytp-caption-segment` 是同一行的詞組片段，用 `' '` 合併成完整句子

---

## 架構

### `platforms.js`（新增）

全域變數 `PLATFORMS`，在 `content.js` 之前載入（manifest `js` 陣列順序保證）。

### `content.js` 變更

| 項目 | 變更 |
|------|------|
| `PLATFORMS` 陣列 | 移除，改用 `platforms.js` 全域 |
| `detectPlatform()` | 改為 async，優先讀 storage `selectedPlatform`，fallback hostname |
| `extractText()` | 使用 `platform.textJoin` 取代硬編碼 `'\n'` |
| `syncOverlayParent()` | 使用 `platform.playerSelector` 取代硬編碼 selector |
| `injectHideNativeCSS()` | 新增，startPolling 時動態注入 `<style>` |
| 底部呼叫 | 改為 async IIFE `(async () => { ... })()` |

```js
async function detectPlatform() {
  const { selectedPlatform } = await chrome.storage.local.get('selectedPlatform')
  if (selectedPlatform) {
    return PLATFORMS.find(p => p.id === selectedPlatform) ?? null
  }
  return PLATFORMS.find(p => location.hostname === p.hostname) ?? null
}

function injectHideNativeCSS(platform) {
  const id = 'duocue-hide-native'
  if (document.getElementById(id)) return
  const style = document.createElement('style')
  style.id = id
  style.textContent = `${platform.hideNativeSelector} { display: none !important; }`
  document.head.appendChild(style)
}
```

### `styles.css` 變更

移除 `[class*="CaptionWindow-Fuse-Web-Play"] { display: none !important; }`，改由 `injectHideNativeCSS()` 動態注入。

### `manifest.json` 變更

```json
"content_scripts": [
  {
    "matches": [
      "*://play.hbomax.com/*",
      "*://www.netflix.com/watch/*",
      "*://www.youtube.com/*"
    ],
    "js": ["platforms.js", "content.js"],
    "css": ["styles.css"],
    "run_at": "document_idle"
  }
]
```

### Popup 變更

新增「平台」accordion 分類（第一個 section），包含三個按鈕：HBO Max / Netflix / YouTube。

Storage key：`selectedPlatform: 'hbomax' | 'netflix' | 'youtube'`

切換平台後須重新整理頁面（content script 只在頁面載入時執行）。

---

## 已知限制

- **SPA 導航**：Netflix、YouTube 皆為 SPA，從首頁點進影片不會觸發 content script，需直接在 watch URL 開新頁或重新整理
- **SPA 影片切換**：YouTube 切換影片時不重新初始化（留待後續）
- **Disney+、Prime Video、Apple TV+**：日後用相同模式新增，只需在 `platforms.js` 加一個物件
