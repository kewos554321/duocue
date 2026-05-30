# DuoCue — PoC 設計文件

**日期：** 2026-05-30  
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
    ↓ 字幕出現/變動
MutationObserver（observe platform adapter 指定的 containerSelector）
    ↓
從 textSelector 取出 textContent
    ↓
console.log + 更新 overlay <div>
```

---

## 元件設計

### Platform Config（inline in `content.js`）

每個平台設定為一個物件，`detectPlatform()` 根據 hostname 選取：

```js
const PLATFORMS = [
  {
    name: 'HBO Max',
    hostname: 'play.hbomax.com',
    containerSelector: '[class*="CaptionWindow-Fuse-Web-Play"]',
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

### Content Script（`content.js`）

1. `detectPlatform()` 取得 adapter，若無對應平台則靜默退出
2. Poll（每 500ms）等待 `containerSelector` 元素出現
3. 找到後建立 `#duocue-overlay` div append 到 body
4. `MutationObserver` observe container，`childList: true, subtree: true`
5. Callback：抓 `textSelector` 的 `textContent`，更新 overlay + console.log

### Overlay（`styles.css`）

- 固定在畫面底部中央（`position: fixed; bottom: 12%; left: 50%; transform: translateX(-50%)`）
- 半透明黑色背景，白色字體
- `z-index: 99999` 確保疊在播放器上方
- 無字幕時 `display: none`

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

## 潛在風險

| 風險 | 說明 | 對策 |
|------|------|------|
| HBO 改版 class hash | styled-components hash 不固定 | 用 `[class*="ComponentName"]` substring 匹配 |
| 播放器延遲載入 | 字幕容器非同步出現 | Poll 輪詢等待，最多等 30 秒 |
| CSP 阻擋 | HBO 可能限制 inline style/script | Extension content script 不受 CSP 限制 |
