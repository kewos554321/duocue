# DuoCue — PoC 設計文件

**日期：** 2026-05-30
**修訂：** 2026-05-31（更新為實際實現）
**階段：** PoC（最小可測試實現）
**目標：** 驗證能從串流平台抓取字幕並注入 overlay 顯示

---

## 背景

DuoCue 是一個 Chrome 插件，讓用戶在串流平台上同時顯示雙語字幕（英文 + 中文）。PoC 階段不含翻譯功能，只驗證字幕擷取與 overlay 注入兩件事是否可行。

---

## PoC 成功標準

1. 播放 `play.hbomax.com` 影片時，overlay 顯示即時英文字幕文字
2. Console 同步印出字幕變動 log
3. 字幕消失時 overlay 清空

---

## 架構

### 檔案結構

```
duocue/
├── manifest.json
├── content.js       ← 全部邏輯（PoC 單檔，含 platform configs inline）
└── styles.css
```

> **PoC 簡化說明：** MV3 content script 不支援 ES module import，引入 bundler（Vite/webpack）會增加 PoC 複雜度。因此 PoC 階段將 platform configs 直接寫在 `content.js` 內。多檔案分離架構留給正式版。

### 資料流

```
串流平台播放器
    ↓
setInterval 每 200ms 讀取 textSelector 的 textContent
    ↓ 文字與上次不同時
console.log + 更新 overlay <div>
```

> **設計決策：** 原始設計使用 MutationObserver，但實測發現 HBO Max 在每次字幕變動時會替換整個 DOM 容器（包括 CaptionWindow 甚至 VerticalCueSpacer），導致 observer 靜默失效。改用 200ms polling 直接讀取 textSelector，完全迴避 DOM 替換問題。字幕每幾秒才換一次，200ms 輪詢效能影響可忽略。

---

## 元件設計

### Platform Config（inline in `content.js`）

每個平台設定為一個物件，`detectPlatform()` 根據 hostname 選取：

```js
const PLATFORMS = [
  {
    name: 'HBO Max',
    hostname: 'play.hbomax.com',
    containerSelector: '[class*="VerticalCueSpacer-Fuse-Web-Play"]',
    textSelector: '[class*="TextCue-Fuse-Web-Play"]',
  },
  // 未來在此新增其他平台
]

function detectPlatform() {
  return PLATFORMS.find(p => location.hostname === p.hostname) ?? null
}
```

**選擇器說明：**
HBO Max 使用 styled-components，class 格式為 `ComponentName-Fuse-Web-Play__sc-<hash>`。用 `[class*="..."]` substring 匹配避免 hash 變動影響。這是在 `play.hbomax.com` 實測確認的 class pattern。

`textSelector` 直接指向 `TextCue`（字幕文字元素），不依賴任何容器存活。`containerSelector` 保留在 config 中供未來用途，但 polling 邏輯不依賴它。

### Content Script（`content.js`）

1. `detectPlatform()` 取得 platform config，若無對應平台則靜默退出
2. `startPolling(platform)` 建立 overlay 並啟動 200ms interval
3. 每次 tick：讀取 `textSelector` 的 textContent，若與上次相同則跳過
4. 有變動時：console.log + 更新 overlay

### Overlay（`styles.css`）

- 固定在畫面底部中央（`position: fixed; bottom: 12%; left: 50%; transform: translateX(-50%)`）
- 半透明黑色背景，白色字體
- `z-index: 99999` 確保疊在播放器上方
- 無字幕時 `display: none`

**全螢幕行為：** 瀏覽器 Fullscreen API 只渲染進入全螢幕的 element 及其子元素。Overlay 預設掛在 `document.body`，進全螢幕時 HBO Max 的 video player element 會覆蓋它。解法：監聽 `fullscreenchange`，進全螢幕時將 overlay 移入 `document.fullscreenElement`，離開時移回 `document.body`。

---

## manifest.json 設定

- Manifest V3
- `content_scripts` matches：`*://play.hbomax.com/*`（未來新增平台時擴充此清單）
- 不需要額外 permission（純 DOM 操作）
- `run_at: document_idle`

---

## 未來擴充路徑（超出 PoC 範圍）

- 接翻譯 API（Google Translate / DeepL）顯示中文字幕
- 新增 Netflix、Disney+、Prime Video 的 adapter
- Popup UI 讓用戶開關功能
- 字幕樣式自訂

---

## 潛在風險與實測結論

| 風險 | 說明 | 對策 | 實測結論 |
|------|------|------|---------|
| HBO 改版 class hash | styled-components hash 不固定 | 用 `[class*="ComponentName"]` substring 匹配 | ✅ 有效 |
| DOM 容器被替換 | HBO 每次換字幕時替換整個容器，導致 observer 失效 | 改用 polling 直接讀 textSelector | ✅ polling 完全迴避此問題 |
| CSP 阻擋 | HBO 可能限制 inline style/script | Extension content script 不受 CSP 限制 | ✅ 無問題 |
