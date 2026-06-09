# Spec 2 — Extension 實驗功能（存句子 + 字幕單字上色）

**日期：** 2026-06-09
**階段：** MVP — 插件端實驗功能
**目標：** 在插件 popup 加入「實驗功能」開關，開啟後支援按 S 存句子 + 字幕單字依學習狀態上色，不影響現有翻譯功能

---

## 背景

DuoCue 現有功能（雙語字幕、翻譯引擎、字體調整等）不能被動到。新功能以實驗性開關隔離，預設關閉，只有明確開啟才生效。

---

## Popup 新增：實驗功能開關

### `popup.html` 新增區塊

在現有設定區塊最下方加入「實驗功能」分隔區：

```
┌─────────────────────────────────────────┐
│ ── 實驗功能 ──────────────────────────── │
│                                         │
│  句子收集模式                            │
│  開啟後：按 S 存句子、字幕單字顯示學習狀態  │
│                              [  OFF  ]  │
│                                         │
│  API Endpoint                           │
│  [https://duocue-api.xxx.workers.dev  ] │
│                                         │
│  API Key                                │
│  [••••••••••••••••••••••              ] │
└─────────────────────────────────────────┘
```

- Toggle 預設 OFF
- API Endpoint 和 API Key 欄位：關閉時灰色顯示，開啟時可編輯
- 值存入 `chrome.storage.local`：`experimentalMode`, `apiEndpoint`, `apiKey`

---

## content.js 變更

### 原則
所有新功能必須包在 `if (experimentalEnabled)` 判斷內，不影響現有流程。

### 啟動時（頁面載入）

```
1. 讀取 chrome.storage.local: experimentalMode, apiEndpoint, apiKey
2. 若 experimentalMode = false → 完全略過以下所有步驟
3. 若 true：
   a. 向 GET /words 拉取單字快取，存入記憶體 wordCache: Map<string, 'learning'|'learned'>
   b. 監聽鍵盤事件（按 S）
```

### 字幕渲染（僅 experimentalMode 開啟時）

現有流程把字幕文字塞入 `#duocue-overlay` div。新流程在顯示前處理：

```
原本：overlay.innerHTML = subtitleText

改為：overlay.innerHTML = tokenize(subtitleText, wordCache)
```

`tokenize()` 函式：
- 將句子依空白切成 token
- 清除 token 的標點符號取得純單字，小寫化，對比 wordCache
- 有 'learning' → `<span class="dc-word dc-learning">token</span>`
- 有 'learned'  → `<span class="dc-word dc-learned">token</span>`
- 無紀錄 → `<span class="dc-word">token</span>`

CSS 新增（`styles.css`）：
```css
.dc-word { cursor: default; }
.dc-learning { color: #f97316; border-bottom: 1.5px solid #f97316; }
.dc-learned  { color: #22c55e; border-bottom: 1.5px solid #22c55e; }
```

顏色沿用插件現有配色（橘色 / 綠色），與字幕底色（黃色）不同，清楚可辨。

### 按 S 存句子（僅 experimentalMode 開啟時）

```
keydown 事件：
  若 event.key === 's' 且 focus 不在 input/textarea 上：
    1. 取得目前 overlay 顯示的原文字幕文字（currentSubtitleText）
    2. 取得目前 overlay 顯示的翻譯文字（currentTranslationText）
    3. 取得目前影片 URL（location.href）
    4. 取得目前影片秒數（video.currentTime，單位秒取整數）
    5. 取得平台名稱（由 platforms.js 的 detectPlatform()）
    6. POST /sentences → { platform, videoUrl, text, translation, timestampS }
    7. 成功：在畫面角落短暫顯示「✓ 已儲存」Toast（1.5 秒後消失）
    8. 失敗：顯示「× 儲存失敗」Toast
```

**Toast 元件：**
獨立的小 div，絕對定位在畫面右下角，不影響字幕 overlay。淡入淡出動畫。

### 單字快取更新時機

- 插件啟動：拉一次完整快取
- 每次按 S 成功後：不重拉（句子存入不影響單字狀態）
- 單字狀態改變只在**網頁端**操作，插件下次啟動才會同步最新狀態

---

## Storage Keys 總覽

| Key | 型別 | 說明 |
|-----|------|------|
| `experimentalMode` | boolean | 實驗功能開關，預設 false |
| `apiEndpoint` | string | Workers API URL |
| `apiKey` | string | API 驗證 key |

---

## 不動的部分

- `manifest.json` host_permissions、content_scripts — 不變
- 翻譯引擎邏輯 — 不變
- 字幕位置、字型、顏色設定 — 不變
- `platforms.js` — 不變
- Popup 現有所有設定項 — 不變

---

## 成功標準

1. 預設狀態（OFF）：插件行為與現在完全相同，console 無新 log
2. 開啟實驗功能 + 填入正確 endpoint/key，重新整理 Netflix 頁面 → console 顯示已拉取單字快取
3. 播放影片，有標記過的單字在字幕中顯示橘色/綠色下底線
4. 按 S → 右下角出現「✓ 已儲存」Toast，DB 有新一筆 sentence
5. 按 S 時 API 錯誤 → 顯示「× 儲存失敗」Toast，不 crash
6. 實驗功能 OFF → 按 S 無任何作用
