# S 鍵 Optimistic Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按下 S 鍵後立刻顯示「✓ 已儲存」toast，不等待 API 回應，失敗時再覆蓋為「× 儲存失敗」。

**Architecture:** 將 `showToast('✓ 已儲存')` 移到 `fetch` 呼叫之前，讓 API 呼叫在背景執行。若 `res.ok` 為 false 或發生例外，再呼叫 `showToast('× 儲存失敗')` 覆蓋。

**Tech Stack:** Vanilla JS, Chrome Extension content script

---

### Task 1: 修改 S 鍵 handler，改為 Optimistic UI

**Files:**
- Modify: `extension/content.js:841-858`

- [ ] **Step 1: 確認目前程式碼位置**

在 `extension/content.js` 找到以下程式碼（約第 841~858 行）：

```js
  try {
    const res = await fetch(`${_expApiEndpoint}/sentences`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${_expApiKey}`,
        'Content-Type': 'application/json'
      },
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
```

- [ ] **Step 2: 套用異動**

將上方程式碼替換為：

```js
  showToast('✓ 已儲存')
  try {
    const res = await fetch(`${_expApiEndpoint}/sentences`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${_expApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        platform: platform?.id ?? 'unknown',
        videoUrl: location.href,
        text: textToSave,
        translation,
        timestampS
      })
    })
    if (!res.ok) showToast('× 儲存失敗')
  } catch {
    showToast('× 儲存失敗')
  }
```

- [ ] **Step 3: 手動驗證（正常流程）**

1. 在 Chrome 載入 extension（`chrome://extensions` → Load unpacked → 選 `extension/` 目錄）
2. 打開任何有字幕的影片（Netflix / YouTube）
3. 等字幕出現後按 S
4. 確認：toast「✓ 已儲存」**立刻**出現，不需等待

- [ ] **Step 4: 手動驗證（失敗流程）**

1. 在 extension 設定中暫時填入一個無效的 API endpoint
2. 按 S
3. 確認：先短暫顯示「✓ 已儲存」後被「× 儲存失敗」覆蓋
4. 還原正確的 API endpoint

- [ ] **Step 5: Commit**

```bash
git add extension/content.js
git commit -m "feat(extension): show save toast immediately on S key press (optimistic UI)"
```
