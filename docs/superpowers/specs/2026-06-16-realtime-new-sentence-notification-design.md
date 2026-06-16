# 新句子即時提示 — 設計文件

日期：2026-06-16

## 背景與目標

使用者在另一個分頁追劇，透過 extension 按下儲存句子；同時 web app 開著句子列表頁。
目標：讓使用者在 web 端能感知到「有新句子被存了」，不需要手動重新整理頁面，但也不能打斷使用者正在閱讀/操作列表的體驗。

extension 端（`extension/content.js`）目前是直接 `fetch` POST `/sentences`、fire-and-forget，跟 web 完全沒有耦合。本設計不修改 extension 任何程式碼，確保不影響觀影體驗。

## 範圍

- 只處理「句子列表」頁面（`/sentences/recent` 與 `/sentences/all`）的新句子提示
- 不處理單字表（`/words`）的即時更新 —— 未來如有需要，可套用同一套模式（YAGNI，先驗證這個功能好不好用）
- 不修改 extension

## 為什麼不用 WebSocket

使用者原本詢問 WebSocket，但這個場景是**單向**（伺服器 → 網頁），網頁不需要回傳任何訊息給伺服器。

Cloudflare Workers 本身無狀態，兩次請求之間不能互相通訊；要做到真即時推播（WebSocket 或 SSE）都需要額外引入 Durable Object 當作 broadcast 中心，複雜度較高。

評估三個方案：

| 方案 | 即時性 | 複雜度 | 取捨 |
|---|---|---|---|
| A. 短間隔輪詢 | 5–10 秒延遲 | 低 | 零新基礎設施、零 extension 改動，足以滿足需求 |
| B. SSE + Durable Object | <1 秒 | 中 | 單向、瀏覽器原生自動重連，但需要新的 DO class 與通知機制 |
| C. WebSocket + Durable Object | <1 秒 | 高 | 雙向能力在此場景是浪費的複雜度 |

**選擇方案 A**：可接受的延遲（用戶體驗上以「提示按鈕」呈現,不需要秒級精確度），複雜度最低、最快可上線。之後如果方案 A 的延遲體驗不夠好，可以re-evaluate 升級到方案 B。

## 架構與資料流

```
extension (content.js) ──POST /sentences──> API (不變)
                                                │
web (SentencesPage 開著時)                      │
  每 8 秒 ──GET /sentences/latest──────────────>│  (新的輕量 endpoint)
         <──{ id, createdAt }───────────────────┘
  比對本地 baseline id
    │
    ├─ 沒有更新 → 不做任何事
    └─ 有更新   → 顯示「+N 新句子」浮動按鈕
                    │ 使用者點擊
                    ▼
              GET /sentences（現有，拿完整列表）
                    │
              更新 state，按鈕消失，baseline 更新
```

關鍵行為：
- 只在 `/sentences/recent` 或 `/sentences/all` 頁面開著時輪詢；路由切換離開頁面就清除 interval
- Tab 切到背景（`document.visibilitychange` → hidden）時暫停輪詢，回到前景恢復，避免分頁開著但沒在看時浪費請求
- 偵測到新句子時**不自動插入列表**，避免打斷使用者正在閱讀/操作的內容；改用浮動提示按鈕，由使用者主動點擊才載入

## API 變更

新增一個輕量端點，不影響現有 `/sentences` 邏輯：

```ts
app.get('/sentences/latest', async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT id, created_at AS createdAt FROM sentences ORDER BY created_at DESC LIMIT 1`
  ).first<{ id: number; createdAt: string }>()
  return c.json({ latest: row ?? null })
})
```

- 純粹查 `sentences` 表最新一筆，不需要 join，查詢成本極小
- 回應格式：`{ latest: { id, createdAt } | null }`（空表時回 null）
- 沿用現有 `Bearer API_KEY` middleware，不需要額外驗證邏輯

## 前端實作

新增 `useNewSentencePoll` hook（`web/src/hooks/`），在 `SentencesPage` 層級使用（兩個 tab 共用同一個提示，邏輯只寫一次）：

- **baseline**：頁面 mount 時，從現有 `sentences` prop 算出目前最大 id 作為起點
- **輪詢**：每 8 秒呼叫 `GET /sentences/latest`，若回傳的 `id` 大於目前已知的 baseline，標記「有新句子」
- **visibilitychange**：分頁不在前景時暫停輪詢（不啟動新的 interval），回到前景才恢復
- **+N 按鈕**：浮動在列表上方（sticky），文字「有新句子」或「+N 則新句子」。點擊後呼叫既有的 `fetchSentences()`（`App.tsx`）重新拿完整列表、更新 state，按鈕消失、baseline 更新為最新 id

不需要在 `RecentSentencesTab` / `AllSentencesTab` 個別重複輪詢邏輯。

## 邊界情況

- 句子表是空的（新使用者）→ `latest` 回 `null`，不顯示提示
- 使用者刪除句子（`DELETE /sentences/:id`）→ 不影響判斷邏輯，因為只比較「最新 id 是否變大」，刪除不會讓 id 變大
- 多分頁同時開著 `/sentences/recent` 和 `/sentences/all` → 各自獨立輪詢，屬於可接受的重複請求（個人規模無感）
- 使用者短時間內存好幾句（對話密集場景）→ 按鈕只需呈現「有新句子」，不強求精確計數，避免額外複雜度
- 網路錯誤/輪詢失敗 → 靜默忽略、等下一次 interval 重試，不彈錯誤訊息（背景輕量檢查不該打斷使用者）

## 測試方式

- API：手動 `curl` 打 `/sentences/latest`，確認空表回 `null`、有資料回最新一筆
- 前端：開兩個分頁，一個開 `/sentences/recent`，另一個模擬 extension 呼叫 `POST /sentences`，確認輪詢間隔內按鈕出現、點擊後列表更新且按鈕消失
- 確認切到背景分頁後輪詢真的停止（在瀏覽器 Network tab 觀察請求是否暫停）

## 未來可能的延伸（不在本次範圍）

- 單字表（`/words`）套用同一套輪詢模式
- 若輪詢延遲體驗不佳，升級為方案 B（SSE + Durable Object）做到真即時推播
