# DuoCue — 翻譯功能設計文件

**日期：** 2026-05-30
**修訂：** 2026-05-31（更新為實際實現）
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
6. HBO 原生字幕隱藏，只顯示 DuoCue overlay
7. 多行英文翻譯成中文時，中文不出現多餘空白行

---

## 檔案變化

| 檔案 | 動作 | 說明 |
|------|------|------|
| `manifest.json` | 修改 | 加 `permissions: ["storage"]`、`host_permissions`、`action` |
| `content.js` | 修改 | 以 `startPolling` 取代 MutationObserver，加 `translate()`，修改 `updateOverlay` |
| `styles.css` | 修改 | 加中文行樣式、隱藏 HBO 原生字幕 |
| `popup.html` | 新增 | API key 輸入 UI |
| `popup.js` | 新增 | 讀寫 `chrome.storage.local` |

---

## 元件設計

### manifest.json 修改

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

### content.js — startPolling（取代原 MutationObserver 方案）

```js
function startPolling(platform) {
  createOverlay()
  console.log(`[DuoCue] Polling subtitles for ${platform.name}`)

  let lastText = null
  let translateTimer = null

  setInterval(async () => {
    const english = extractText(platform)

    if (english === lastText) return
    lastText = english

    console.log(`[DuoCue] ${english || '(no subtitle)'}`)

    if (!english) {
      updateOverlay(null, null)
      return
    }

    updateOverlay(english, null)

    clearTimeout(translateTimer)
    translateTimer = setTimeout(async () => {
      const chinese = await translate(english)
      updateOverlay(english, chinese)
    }, 150)
  }, 200)
}
```

> **為什麼用 polling 而非 MutationObserver：** 實測發現 HBO Max 每次換字幕時會替換整個 DOM 容器（CaptionWindow 乃至 VerticalCueSpacer），導致 MutationObserver 靜默失效。polling 直接讀取 `textSelector` 的 textContent，不依賴任何容器存活，完全迴避此問題。200ms 間隔對字幕每幾秒才換一次的場景效能影響可忽略。

### content.js — updateOverlay

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

### styles.css — 完整新增內容

```css
/* 隱藏 HBO 原生字幕，改由 DuoCue overlay 顯示 */
[class*="CaptionWindow-Fuse-Web-Play"] {
  display: none !important;
}

.duocue-en {
  color: #ffffff;
  font-size: 1.4rem;
}

.duocue-zh {
  color: #FFD700;
  font-size: 1.2rem;
  margin-top: 4px;
  white-space: normal; /* 防止 Google Translate 保留的 \n 造成空白行 */
}
```

> **`white-space: normal` 說明：** Google Translate API 會保留輸入文字的換行符，多行英文（多個 TextCue 節點 join 後）翻譯回來的中文也可能含 `\n`。`#duocue-overlay` 設有 `white-space: pre-wrap`，若中文 div 繼承此設定則 `\n` 會渲染為空白行。設 `white-space: normal` 讓中文自動折行，不保留換行符。

---

## 資料流

```
setInterval 每 200ms
  → extractText(platform)        ← 讀取 TextCue DOM 的 textContent
  → 若與上次相同：跳過
  → 有變動：
    → updateOverlay(english, null)  ← 立即顯示英文
    → debounce 150ms
    → translate(english)            ← 呼叫 Google Cloud Translation API
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

`updateOverlay` 使用 `innerHTML` 注入 HTML 結構。英文文字來自 HBO DOM 的 `textContent`，中文來自 Google Translation API 的回應。兩者皆為受信任來源，不含使用者輸入，無 XSS 風險。

---

## 超出本階段範圍

- 目標語言切換（目前固定 `zh-TW`）
- 翻譯快取（相同句子不重複呼叫 API）
- 字幕樣式自訂 UI
