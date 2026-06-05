# DuoCue — 平台狀態燈設計文件

**日期：** 2026-06-05
**階段：** UI 優化
**目標：** Header 的 `status-dot` 改為三狀態指示燈，讓使用者一眼看出目前頁面是否支援 DuoCue

---

## 背景

目前 `status-dot` 永遠是綠色，與實際平台狀態完全脫鉤。使用者在 Google 或 Netflix 首頁開 popup 時看不出任何警告，不知道 DuoCue 此刻無法作用。

---

## 三狀態定義

| 狀態 | 顏色 | 條件 | 說明文字 |
|------|------|------|----------|
| 播放中 | 🟢 綠色 `#30D158` | 目前 tab URL 符合支援平台的播放頁 pattern | （不顯示說明，保持現狀） |
| 平台首頁 | 🟡 黃色 `#FF9F0A` | URL 屬於支援平台的 domain，但不在播放頁 | 「請前往影片播放頁面」 |
| 不支援 | 🔴 紅色 `#FF453A` | URL 不屬於任何支援平台 | 「此頁面不支援 DuoCue」 |

---

## URL 判斷規則

在 popup.js 中，用 `chrome.tabs.query({active:true, currentWindow:true})` 取得目前 tab URL，接著：

```
播放頁 pattern（綠燈）：
  - play.hbomax.com（任意路徑）
  - www.netflix.com/watch/（任意路徑）
  - www.youtube.com/watch（有 ?v= 參數）

平台 domain（黃燈，不在播放頁）：
  - *.hbomax.com
  - www.netflix.com（非 /watch/）
  - www.youtube.com（非 /watch）

其他 → 紅燈
```

---

## 說明文字位置

說明文字插入 header 的 `status-dot` 正下方，獨佔一行，字級 11px，顏色與燈號同色。綠燈時不顯示。

```
┌─────────────────────────────┐
│ ● DuoCue          [toggle]  │  ← status-dot 變色
│ 此頁面不支援 DuoCue           │  ← 紅/黃時顯示
└─────────────────────────────┘
```

---

## 需要的變更

### `manifest.json`
- `permissions` 加入 `"activeTab"`

### `popup.html`
- header 內 `status-dot` 下方加入 `<div id="platformStatus"></div>`
- 加對應 CSS（三色 + 說明文字樣式）

### `popup.js`
- 新增 `detectTabStatus()` function：呼叫 `chrome.tabs.query`，比對 URL，回傳 `'watch' | 'platform' | 'unsupported'`
- 初始化時呼叫，根據結果設定 dot 顏色 + 說明文字
- `chrome.tabs.onUpdated` 監聽 tab URL 變化（使用者切換 tab 時即時更新）

---

## 不改的部分

- `detectedPlatform` storage 邏輯維持不動（content.js 無需改動）
- `#sections.inactive` 不啟用——控制項保持可互動
- Toggle（開關）保持可點擊

---

## 成功標準

1. 在 google.com 開 popup → 紅燈 + 「此頁面不支援 DuoCue」
2. 在 netflix.com 首頁開 popup → 黃燈 + 「請前往影片播放頁面」
3. 在 netflix.com/watch/xxx 開 popup → 綠燈，無說明文字
4. 在 youtube.com/watch?v=xxx 開 popup → 綠燈，無說明文字
5. 切換 tab 後重新開 popup，顯示新頁面的正確狀態
