# DuoCue — 多平台支援 + 模組化設計文件

**日期：** 2026-06-03
**階段：** 功能擴充
**目標：** 新增 Netflix 和 YouTube 支援，並將平台設定從 `content.js` 拆分至獨立的 `platforms.js`，讓新增平台不需碰 content.js 邏輯

---

## 背景

目前 `content.js` 直接內嵌 `PLATFORMS` 陣列，且 `syncOverlayParent` 硬編碼 HBO Max 的 `[data-testid="playerContainer"]`，`styles.css` 也硬編碼 HBO Max 的 native subtitle CSS。新增平台需要修改多個地方，風險高。

本次重構：
1. 將 `PLATFORMS` 抽出到新的 `platforms.js`（全域載入，`content.js` 直接使用）
2. 每個平台 config 包含所有平台特定資訊
3. `content.js` 動態注入 `hideNativeSelector` CSS，不再依賴 `styles.css` 硬編碼
4. 新增 Netflix 和 YouTube 平台

---

## 成功標準

1. HBO Max 行為與目前完全一致（無回歸）
2. Netflix：播放含英文字幕的影片，DuoCue overlay 顯示英文 + 中文翻譯
3. YouTube：播放含英文字幕的影片，DuoCue overlay 顯示英文 + 中文翻譯
4. 新增平台只需在 `platforms.js` 加一個物件 + 更新 `manifest.json`，不需動 `content.js`

---

## 平台設定

### Platform Config 結構

```js
{
  name: string,              // 顯示名稱
  hostname: string,          // location.hostname 匹配值
  textSelector: string,      // 字幕文字元素 selector
  textJoin: string,          // 多元素時的連接字元（'\n' 或 ' '）
  playerSelector: string,    // 播放器容器 selector（全螢幕用）
  hideNativeSelector: string, // 要隱藏的原生字幕 selector
}
```

### 三個平台的完整設定

```js
const PLATFORMS = [
  {
    name: 'HBO Max',
    hostname: 'play.hbomax.com',
    textSelector: '[class*="TextCue-Fuse-Web-Play"]',
    textJoin: '\n',
    playerSelector: '[data-testid="playerContainer"]',
    hideNativeSelector: '[class*="CaptionWindow-Fuse-Web-Play"]',
  },
  {
    name: 'Netflix',
    hostname: 'www.netflix.com',
    textSelector: '.player-timedtext-text-container',
    textJoin: '\n',
    playerSelector: '.watch-video--player-view',
    hideNativeSelector: '.player-timedtext',
  },
  {
    name: 'YouTube',
    hostname: 'www.youtube.com',
    textSelector: '.ytp-caption-segment',
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

## 實作範圍

### 新增：`platforms.js`

- 定義 `PLATFORMS` 陣列（全域變數，供 `content.js` 直接取用）
- 包含上方三個平台的完整設定

### 修改：`content.js`

1. **移除** `PLATFORMS` 陣列（改用 `platforms.js` 的全域）
2. **`extractText`**：改用 `platform.textJoin` 取代硬編碼的 `'\n'`
3. **`syncOverlayParent`**：改用 `platform.playerSelector` 取代硬編碼的 `[data-testid="playerContainer"]`
4. **新增 `injectHideNativeCSS(platform)`**：在 `startPolling` 時動態注入 `<style>` 隱藏原生字幕

```js
function injectHideNativeCSS(platform) {
  const id = 'duocue-hide-native'
  if (document.getElementById(id)) return
  const style = document.createElement('style')
  style.id = id
  style.textContent = `${platform.hideNativeSelector} { display: none !important; }`
  document.head.appendChild(style)
}
```

### 修改：`styles.css`

- 移除 `[class*="CaptionWindow-Fuse-Web-Play"] { display: none !important; }`（改由 `content.js` 動態注入）

### 修改：`manifest.json`

- `js` 陣列改為 `["platforms.js", "content.js"]`（platforms.js 必須在 content.js 之前載入）
- `matches` 新增 Netflix 和 YouTube 的 URL pattern
- `host_permissions` 新增 Netflix 和 YouTube（content script 不需要，但保持一致）

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

---

## 不在本次範圍

- Disney+、Prime Video、Apple TV+（日後用相同模式新增）
- YouTube 自動語言偵測（目前固定偵測英文字幕）
- SPA 頁面切換後重新初始化（YouTube 切換影片時）
