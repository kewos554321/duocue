# DuoCue — 字幕背景透明度設計文件

**日期：** 2026-06-03
**階段：** 功能擴充
**目標：** 讓用戶調整字幕黑色背景的透明度

---

## 背景

目前 `#duocue-overlay` 背景硬編碼為 `rgba(0,0,0,0.75)`，部分用戶覺得太深。本次新增一個滑桿讓用戶自行調整，沿用字型大小滑桿的相同實作模式。

---

## 成功標準

1. Popup「字幕外觀」分類裡有背景透明度滑桿（0–100%，預設 75%）
2. 拖動滑桿，字幕背景即時改變
3. 設定跨頁面持久化

---

## UI 設計

位置：popup「字幕外觀」分類，字型大小滑桿下方。

```
背景透明度              75%
[━━━━━━━━━━━━●──────]
0%                   100%
```

- 元件：`<input type="range">`，`min=0 max=100 step=5`，預設 75
- 右側 label 顯示 `{n}%`
- 完全複用現有 `.slider-row` / `.slider-value` CSS 樣式

---

## 資料設計

### 新增 Storage Key

```js
bgOpacity: 75  // number, 0–100，預設 75
```

### 套用邏輯

```js
overlay.style.background = `rgba(0, 0, 0, ${bgOpacity / 100})`
```

---

## 實作範圍

### `styles.css`

移除 `background: rgba(0, 0, 0, 0.75)` 從 `#duocue-overlay`（改由 JS 控制，同 font-size 做法）。

### `content.js`

1. 新增模組層級變數 `let bgOpacity = 75`
2. 初始化時讀取 storage
3. `createOverlay()` 套用初始值：`div.style.background = \`rgba(0,0,0,${bgOpacity/100})\``
4. `storage.onChanged` 新增監聽 `bgOpacity`，即時更新 overlay

### `popup.html`

在字型大小滑桿後新增：

```html
<div>
  <div class="slider-row">
    <span class="section-label" style="margin-bottom:0">背景透明度</span>
    <span class="slider-value" id="bgOpacityLabel">75%</span>
  </div>
  <input type="range" id="bgOpacityRange" min="0" max="100" step="5" value="75">
</div>
```

### `popup.js`

- 新增 element refs：`bgOpacityRange`、`bgOpacityLabel`
- init block 讀取 `bgOpacity`
- `input` 事件：更新 label + 寫入 storage
- `updateSummaries()` 摘要文字加入透明度（`白 · 18pt · Arial · 75%`）

---

## 不在本次範圍

- 背景顏色選擇（目前固定黑色）
- 文字透明度（`color` 的 alpha）
