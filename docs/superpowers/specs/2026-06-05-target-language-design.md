# DuoCue — 目標語言選擇設計文件

**日期：** 2026-06-05
**階段：** 功能擴充
**目標：** 讓用戶可選擇翻譯的原文語言與目標語言，不再固定為英文→繁中

---

## 背景

目前 `translateFree()` 硬編碼 `langpair=en|zh-TW`，`translateGoogle()` 硬編碼 `target: 'zh-TW'`。用戶無法選擇目標語言，限制了 DuoCue 對多語言學習者的適用性。

---

## 語言清單

共 10 種，兩個 dropdown 使用相同清單：

| code | 完整名稱 | 摘要縮寫 |
|------|---------|---------|
| `zh-TW` | 繁體中文（預設 target） | 繁中 |
| `zh-CN` | 簡體中文 | 簡中 |
| `en` | 英文（預設 source） | EN |
| `ja` | 日文 | 日文 |
| `ko` | 韓文 | 韓文 |
| `es` | 西班牙文 | 西文 |
| `fr` | 法文 | 法文 |
| `de` | 德文 | 德文 |
| `pt` | 葡萄牙文 | 葡文 |
| `vi` | 越南文 | 越文 |

---

## 資料設計

新增兩個 storage key：

```js
sourceLanguage: 'en'      // MyMemory source，預設英文
targetLanguage: 'zh-TW'  // 兩引擎共用，預設繁體中文
```

現有 keys 不動。

---

## UI 設計

### 翻譯引擎 section — 免費模式（展開）

```
[ 免費 ✓ ] [ Google Translate ]
─────────────────────────────────
✓ MyMemory 免費翻譯
  每天 1,000 字，無需帳號

原文語言   [English        ▼]
目標語言   [繁體中文        ▼]
```

### 翻譯引擎 section — Google 模式（展開）

```
[ 免費 ] [ Google Translate ✓ ]
─────────────────────────────────
原文語言   自動偵測
目標語言   [繁體中文        ▼]

─────────────────────────────────
API Key    ✓ 已設定 / ⚠ 未設定
[•••••••••••••               👁]
[    Save Key                   ]
需要 Google Cloud API Key。...
```

Google 模式下「原文語言」顯示為灰色靜態文字「自動偵測」，不可互動。

### 新增 DOM 元素

| id | 說明 |
|----|------|
| `sourceLangSelect` | 原文語言 `<select>`（免費模式可用） |
| `targetLangSelect` | 目標語言 `<select>`（兩模式皆用） |
| `sourceLangRow` | 包住 label + select 的 row，Google 模式切換顯示邏輯 |
| `sourceLangAuto` | Google 模式顯示「自動偵測」的靜態文字 span |

---

## 摘要文字

| 引擎 | 格式 | 範例 |
|------|------|------|
| 免費 | `免費 · {src縮寫}→{tgt縮寫}` | `免費 · EN→繁中` |
| Google | `Google · {tgt縮寫}` | `Google · 繁中` |

`updateSummaries()` 讀取 `sourceLangSelect.value` 和 `targetLangSelect.value` 生成摘要。

---

## 翻譯邏輯（content.js）

### translateFree()

```js
async function translateFree(text) {
  const { sourceLanguage, targetLanguage } = await chrome.storage.local.get(
    ['sourceLanguage', 'targetLanguage']
  )
  const src = sourceLanguage || 'en'
  const tgt = targetLanguage || 'zh-TW'
  if (src === tgt) return null  // 原文 = 目標，不翻譯
  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${src}|${tgt}`
    )
    const data = await res.json()
    if (data.responseStatus !== 200) return null
    return data.responseData.translatedText ?? null
  } catch {
    return null
  }
}
```

### translateGoogle()

```js
async function translateGoogle(text) {
  const { translationApiKey, targetLanguage } = await chrome.storage.local.get(
    ['translationApiKey', 'targetLanguage']
  )
  if (!translationApiKey) return null
  const tgt = targetLanguage || 'zh-TW'
  try {
    const res = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${translationApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text, target: tgt, format: 'text' }),
      }
    )
    const data = await res.json()
    return data?.data?.translations?.[0]?.translatedText ?? null
  } catch {
    return null
  }
}
```

`storage.onChanged` 監聽 `sourceLanguage` 和 `targetLanguage`，不需額外處理（下次字幕更新自動生效）。

---

## popup.js 改動

- 初始化時讀取 `sourceLanguage`（預設 `'en'`）和 `targetLanguage`（預設 `'zh-TW'`）
- 兩個 select 的 `change` 事件即時寫入 storage 並呼叫 `updateSummaries()`
- `selectEngine()` 更新：免費模式顯示 `sourceLangSelect`，Google 模式顯示 `sourceLangAuto`

---

## 不在本次範圍

- 自動偵測字幕語言（source 語言始終由用戶手動選擇或 Google auto）
- 翻譯快取
- 10 種以外的語言
- MyMemory 每日限額超出提示

---

## 成功標準

1. 翻譯引擎 section 展開後，免費模式顯示「原文語言」和「目標語言」兩個 dropdown
2. 切到 Google 模式後，「原文語言」變為灰色「自動偵測」，不可互動
3. 兩個 dropdown 各含 10 種語言，預設 source=英文、target=繁體中文
4. 更改語言後下一句字幕立即以新設定翻譯
5. 重新整理頁面後設定持續生效
6. 免費模式 source=target 時不顯示翻譯行（靜默跳過）
7. 收合摘要格式：免費顯示 `免費 · EN→繁中`，Google 顯示 `Google · 繁中`
