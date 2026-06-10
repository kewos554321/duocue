# S 鍵儲存：Optimistic UI 反饋設計

**日期：** 2026-06-10  
**範圍：** `extension/content.js`

## 問題

按下 S 後，toast 要等 API 回應才顯示（0.5~2 秒延遲），用戶不知道按鍵是否被接收到。

## 設計

採用 Optimistic UI：按下 S 時**立刻**顯示「✓ 已儲存」toast，不等待 API 回應。

**行為：**

1. 按下 S → 立刻顯示「✓ 已儲存」（duration 1500ms）
2. API 呼叫在背景執行
3. 若 API 呼叫失敗（`catch` 或 `!res.ok`）→ 顯示「× 儲存失敗」並覆蓋先前的 toast

**程式異動（content.js）：**

```js
// 之前：toast 只在 API 回應後顯示
try {
  const res = await fetch(...)
  showToast(res.ok ? '✓ 已儲存' : '× 儲存失敗')
} catch {
  showToast('× 儲存失敗')
}

// 之後：立刻顯示成功，失敗時覆蓋
showToast('✓ 已儲存')
try {
  const res = await fetch(...)
  if (!res.ok) showToast('× 儲存失敗')
} catch {
  showToast('× 儲存失敗')
}
```

## 取捨

- **優點：** 即時反饋，用戶不需等待，不干擾觀影體驗
- **缺點：** 若 API 失敗，用戶會短暫看到「已儲存」後被更正為「失敗」——但此情況極少發生（自架 Cloudflare Workers）
