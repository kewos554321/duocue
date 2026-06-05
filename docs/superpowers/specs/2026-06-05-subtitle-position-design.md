# DuoCue — 字幕位置控制設計文件

**日期：** 2026-06-05
**階段：** 功能擴充
**目標：** 讓使用者可在 popup 調整字幕 overlay 的垂直與水平位置，解決字幕壓在進度條上的問題

---

## 背景

目前 overlay 的位置硬編碼為 `bottom: 12%; left: 50%; transform: translateX(-50%)`，無法調整。使用者反映有時字幕會壓到影片的進度條，需要往上移。同時也有水平置中以外的需求（例如雙螢幕或寬螢幕場景）。

---

## UI 設計

在 popup 「字幕外觀」section 新增兩個 slider，放在現有「背景透明度」slider 下方：

```
垂直位置          [12%]
├──────────○────────────┤

水平位置          [50%]
├──────────────○────────┤
```

| 控制項 | Storage key | 範圍 | 預設值 | 說明 |
|--------|-------------|------|--------|------|
| 垂直位置 | `subtitleBottom` | 5–80 (%) | 12 | 距畫面底部的百分比 |
| 水平位置 | `subtitleLeft` | 10–90 (%) | 50 | 距畫面左側的百分比（50 = 置中）|

水平範圍限定 10–90% 以避免 overlay 超出視窗邊緣（因為 `transform: translateX(-50%)` 以元素中心為錨點）。

---

## 技術實作

### `styles.css`

`bottom: 12%` 改為 CSS 變數（初始值保留 12%），`left: 50%` 同理。但實際上不用 CSS 變數，直接由 JS 寫 inline style 即可（與字型大小、背景透明度相同做法）。

### `content.js`

`createOverlay()` 讀取 `subtitleBottom`、`subtitleLeft` 並套用：

```js
div.style.bottom = `${subtitleBottom}%`
div.style.left   = `${subtitleLeft}%`
```

`chrome.storage.onChanged` 監聽這兩個 key 即時更新 overlay。

`styles.css` 的 `bottom: 12%` 和 `left: 50%` 移除（改由 JS 控制）。

### `popup.html`

在「字幕外觀」section body 的背景透明度 slider 後面新增：

```html
<!-- 垂直位置 -->
<div>
  <div class="slider-row">
    <span class="section-label" style="margin-bottom:0">垂直位置</span>
    <span class="slider-value" id="subtitleBottomLabel">12%</span>
  </div>
  <input type="range" id="subtitleBottomRange" min="5" max="80" step="1" value="12">
</div>

<!-- 水平位置 -->
<div>
  <div class="slider-row">
    <span class="section-label" style="margin-bottom:0">水平位置</span>
    <span class="slider-value" id="subtitleLeftLabel">50%</span>
  </div>
  <input type="range" id="subtitleLeftRange" min="10" max="90" step="1" value="50">
</div>
```

### `popup.js`

- 初始化時讀取 `subtitleBottom`（預設 12）和 `subtitleLeft`（預設 50）
- 兩個 slider `input` 事件即時寫入 storage
- `updateSummaries()` 的 `summaryAppearance` 加入位置資訊（e.g. `↕12% ↔50%`）

---

## 不改的部分

- `transform: translateX(-50%)` 保留（維持水平定位以元素中心為錨點）
- 其他 overlay 屬性（`z-index`、`max-width`、`pointer-events` 等）不動
- `playerSelector` / `syncOverlayParent()` 邏輯不動

---

## 成功標準

1. popup 「字幕外觀」出現垂直位置和水平位置兩個 slider
2. 拖動垂直 slider → overlay 即時上下移動
3. 拖動水平 slider → overlay 即時左右移動
4. 重新整理頁面後，位置設定持續生效（從 storage 讀取）
5. 預設值（12% / 50%）行為與現在完全一致
