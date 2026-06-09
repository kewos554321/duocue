# Spec — S 鍵存句子翻譯 Race Condition 修正

**日期：** 2026-06-10  
**階段：** Bug Fix  
**目標：** 確保按 S 存句子時，翻譯永遠對應到當下畫面的原文，即使翻譯 API 尚未回應或字幕已跳下一句

---

## 問題描述

### 現有流程（有 bug）

```
[polling loop 每 200ms]
  字幕 A 出現
    → lastEnglish = A
    → updateOverlay(A, null)        ← 先顯示原文
    → setTimeout 150ms → translate(A) 開始（async）
                                      ↓ API 飛行中（300~1000ms）

[使用者按 S]
  → 讀 lastChinese                  ← 可能是 null 或上一句的翻譯
  → POST { text: A, translation: null }   ← 存到爛資料

[字幕跳 B]
  → lastEnglish = B
  → lastChinese = null

[A 的翻譯回來]
  → lastChinese = A_translation
  → updateOverlay(A, A_translation) ← 畫面還是 B，卻更新成 A 的翻譯
```

**兩個獨立 bug：**

1. **S 鍵讀到錯的 `lastChinese`** — 翻譯還沒回來時 `lastChinese` 是 null 或前一句的值
2. **翻譯回來太晚更新畫面** — 字幕已跳 B，A 的翻譯回來卻呼叫 `updateOverlay(A, ...)`，若此時 `lastEnglish` 已是 B，畫面反而顯示錯誤翻譯

---

## 修正方案

### Bug 1 修正：S 鍵自己發獨立翻譯請求

S 鍵按下時：
1. **立刻 snapshot** `textToSave = lastEnglish`（此刻螢幕上的原文）
2. 呼叫 **`translate(textToSave)`** — 獨立 fetch，不依賴 polling loop 的結果
3. 等這個翻譯回來後，再 POST 存檔

```
[使用者按 S]
  textToSave = lastEnglish          ← snapshot 當前原文
  showToast('儲存中...')
  translation = await translate(textToSave)   ← 自己的獨立請求

[字幕跳 B（期間）]                   ← 不影響，這個 translate call 仍在翻 A

[translation 回來]
  POST { text: textToSave, translation }      ← 原文 + 正確翻譯
  showToast('✓ 已儲存')
```

**優點：**
- 完全不跟 polling loop 共享狀態
- 字幕跳走也沒關係，這個請求是針對 A 的
- 邏輯自包含，易讀

**缺點：**
- 若 polling loop 剛好也在翻 A，會多打一次翻譯 API（可接受，free engine 無計費上限問題；Google API 多一次呼叫）

---

### Bug 2 修正：polling loop 翻譯回來時確認字幕未換

```javascript
translateTimer = setTimeout(async () => {
  const chinese = await translate(english)
  if (english !== lastEnglish) return   // ← 字幕已換，丟棄
  lastChinese = chinese
  updateOverlay(english, chinese)
}, 150)
```

---

## 實作範圍

### `extension/content.js`

**1. polling loop（Bug 2）**

在 `translateTimer` callback 裡，翻譯回來後先比對：

```javascript
translateTimer = setTimeout(async () => {
  const chinese = await translate(english)
  if (english !== lastEnglish) return
  lastChinese = chinese
  updateOverlay(english, chinese)
}, 150)
```

**2. S 鍵 handler（Bug 1）**

```javascript
document.addEventListener('keydown', async (e) => {
  // ... 現有檢查不變 ...
  if (!lastEnglish) return
  if (!_expApiEndpoint || !_expApiKey) return

  const textToSave = lastEnglish          // snapshot

  const platform = await detectPlatform()
  const video = document.querySelector('video')
  const timestampS = video ? Math.floor(video.currentTime) : 0

  // lastChinese 在 Bug 2 修完後，有值代表它一定對應 lastEnglish
  // 所以有值就直接用，沒值才自己發請求（翻譯還在飛的邊緣情況）
  showToast('儲存中...')
  const translation = lastChinese ?? await translate(textToSave).catch(() => null)

  try {
    const res = await fetch(`${_expApiEndpoint}/sentences`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${_expApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: platform?.id ?? 'unknown',
        videoUrl: location.href,
        text: textToSave,
        translation,
        timestampS
      })
    })
    showToast(res.ok ? '✓ 已儲存' : '× 儲存失敗')
  } catch {
    showToast('× 儲存失敗')
  }
})
```

---

## 不在範圍內

- AbortController 取消 in-flight 請求（不必要，polling loop 的舊翻譯回來會被 `if (english !== lastEnglish) return` 擋掉）
- 翻譯結果 cache（現有 `_lookupCache` 只給 word lookup 用，sentence translation 不共用）
- 重複防呼叫（連按 S 兩次會送兩次，暫不處理）

---

## 測試情境

| 情境 | 預期結果 |
|------|---------|
| 正常：字幕出現後等翻譯顯示，再按 S | 存到原文 + 正確翻譯 |
| 字幕剛出現翻譯還沒回來，立刻按 S | S 自己等翻譯回來，存到原文 + 翻譯 |
| 按 S 後字幕跳下一句，翻譯才回來 | 存的是按 S 當下那句 + 其翻譯，不受影響 |
| 翻譯 API 失敗 | 存 `translation: null`，toast 顯示失敗 |
| 字幕跳走後 polling loop 翻譯才回來 | 不更新畫面（被 `lastEnglish` 比對擋掉） |
