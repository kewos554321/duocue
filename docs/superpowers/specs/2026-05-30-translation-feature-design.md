# DuoCue — 翻譯功能設計文件

**日期：** 2026-05-30
**階段：** 翻譯功能（PoC 之後的第一個正式功能）
**目標：** 在 overlay 上同時顯示英文原文與繁體中文翻譯

---

## 背景

PoC 已驗證可從 `play.hbomax.com` 抓取字幕並注入 overlay。本階段接入 Google Cloud Translation API，實現真正的雙語字幕。

---

## 成功標準

1. 播放影片時 overlay 顯示兩行：英文原文（白色）＋繁體中文翻譯（黃色）
2. 使用者可透過 Extension popup 輸入並儲存 Google Cloud Translation API key
3. 無 API key 時，僅顯示英文（不顯示錯誤、靜默 fallback）
4. 翻譯 API 失敗時，僅顯示英文（不 crash）
5. 快速對白不會觸發 API 濫用（debounce 150ms）

---

## 檔案變化

| 檔案 | 動作 | 說明 |
|------|------|------|
| `manifest.json` | 修改 | 加 `permissions: ["storage"]`、`host_permissions`、`action` |
| `content.js` | 修改 | 加 `translate()`、debounce、修改 observer callback 與 `updateOverlay` |
| `styles.css` | 修改 | 加中文行樣式（黃色、字體稍小） |
| `popup.html` | 新增 | API key 輸入 UI |
| `popup.js` | 新增 | 讀寫 `chrome.storage.local` |

---

## 元件設計

### manifest.json 修改

新增以下欄位：

```json
{
  "permissions": ["storage"],
  "host_permissions": ["https://translation.googleapis.com/*"],
  "action": {
    "default_popup": "popup.html",
    "default_title": "DuoCue Settings"
  }
}
```

### popup.html

極簡 HTML，無外部依賴：

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { width: 280px; padding: 16px; font-family: Arial, sans-serif; }
    input { width: 100%; box-sizing: border-box; padding: 6px; margin: 8px 0; }
    button { width: 100%; padding: 8px; background: #1a73e8; color: white; border: none; border-radius: 4px; cursor: pointer; }
    #status { margin-top: 8px; font-size: 0.85rem; color: green; }
  </style>
</head>
<body>
  <h3 style="margin:0 0 8px">DuoCue</h3>
  <label>Google Translation API Key</label>
  <input type="password" id="apiKey" placeholder="AIza...">
  <button id="save">Save Key</button>
  <div id="status"></div>
  <script src="popup.js"></script>
</body>
</html>
```

### popup.js

```js
const input = document.getElementById('apiKey')
const status = document.getElementById('status')

chrome.storage.local.get('translationApiKey', ({ translationApiKey }) => {
  if (translationApiKey) input.value = translationApiKey
})

document.getElementById('save').addEventListener('click', () => {
  const key = input.value.trim()
  chrome.storage.local.set({ translationApiKey: key }, () => {
    status.textContent = key ? '✅ Key saved' : '🗑 Key cleared'
    setTimeout(() => { status.textContent = '' }, 2000)
  })
})
```

### content.js — translate()

```js
async function translate(text) {
  const { translationApiKey } = await chrome.storage.local.get('translationApiKey')
  if (!translationApiKey) return null

  try {
    const res = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${translationApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text, target: 'zh-TW', format: 'text' }),
      }
    )
    const data = await res.json()
    return data?.data?.translations?.[0]?.translatedText ?? null
  } catch {
    return null
  }
}
```

### content.js — MutationObserver callback（改為 debounce）

取代原本 `startObserver` 內的 callback：

```js
let debounceTimer = null

const observer = new MutationObserver(() => {
  const english = extractText(platform)
  console.log(`[DuoCue] ${english || '(no subtitle)'}`)

  if (!english) {
    updateOverlay(null, null)
    return
  }

  // 先顯示英文，等翻譯
  updateOverlay(english, null)

  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(async () => {
    const chinese = await translate(english)
    updateOverlay(english, chinese)
  }, 150)
})
```

### content.js — updateOverlay 改為接收兩個參數

```js
function updateOverlay(english, chinese) {
  const overlay = document.getElementById('duocue-overlay')
  if (!overlay) return

  if (!english) {
    overlay.innerHTML = ''
    overlay.style.display = 'none'
    return
  }

  const chineseHtml = chinese
    ? `<div class="duocue-zh">${chinese}</div>`
    : ''
  overlay.innerHTML = `<div class="duocue-en">${english}</div>${chineseHtml}`
  overlay.style.display = 'block'
}
```

> 注意：改用 `innerHTML` 而非 `textContent`，以支援兩個獨立的 `<div>`。英文和中文的文字內容來自 HBO 的 DOM，不含使用者輸入，無 XSS 風險。

### styles.css — 新增雙行樣式

```css
.duocue-en {
  color: #ffffff;
  font-size: 1.4rem;
}

.duocue-zh {
  color: #FFD700;
  font-size: 1.2rem;
  margin-top: 4px;
}
```

---

## 資料流

```
字幕 DOM 變動
  → extractText() → english
  → updateOverlay(english, null)   ← 立即顯示英文
  → debounce 150ms
  → translate(english)             ← 呼叫 Google API
  → updateOverlay(english, chinese) ← 補上中文
```

---

## 錯誤處理

| 情況 | 行為 |
|------|------|
| 無 API key | `translate()` 回傳 `null`，只顯示英文 |
| API 請求失敗（網路/key 錯誤） | catch 回傳 `null`，只顯示英文 |
| API 回傳格式異常 | optional chaining 防護，回傳 `null`，只顯示英文 |

---

## 安全說明

`updateOverlay` 改用 `innerHTML` 注入 HTML 結構。英文文字來自 HBO DOM 的 `textContent`，中文來自 Google Translation API 的回應。兩者皆為受信任來源，不含使用者輸入，無 XSS 風險。

---

## 超出本階段範圍

- 目標語言切換（目前固定 `zh-TW`）
- 翻譯快取（相同句子不重複呼叫 API）
- 字幕樣式自訂 UI
