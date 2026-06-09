# Spec — 主動練習（字卡 + 記憶曲線）

**日期：** 2026-06-10
**階段：** MVP
**目標：** 在 Web 前端加入字卡練習頁面，採簡單倍增間隔演算法實現間隔重複記憶

---

## 背景

使用者目前只能在句子庫被動複習單字。本功能加入主動回憶環節：
1. 看到英文單字，靠自己回想意思
2. 翻面確認定義與出處例句
3. 評分「知道」或「不知道」→ 系統安排下次複習時間

只有 `status = 'learning'` 的單字進入練習佇列，`status = 'learned'` 視為完成不排入。

---

## 演算法：簡單倍增間隔

- **知道** → `interval_days × 2`，最小起始值 1 天
- **不知道** → reset `interval_days = 1`
- `next_review_at = now + interval_days × 86400`（unix 秒）
- `next_review_at IS NULL`：新單字，立即可練（從未複習）

---

## 資料模型變更

`words` 表新增兩欄：

```sql
ALTER TABLE words ADD COLUMN next_review_at INTEGER DEFAULT NULL;
ALTER TABLE words ADD COLUMN interval_days   INTEGER DEFAULT 1;
```

| 欄位 | 說明 |
|---|---|
| `next_review_at` | NULL = 新單字立即可練；否則為 unix timestamp |
| `interval_days` | 目前間隔天數，初始 1 |

`schema.sql` 同步更新。

---

## API

### `GET /practice/queue`

回傳今日到期的 `learning` 單字（`next_review_at IS NULL OR next_review_at <= unixepoch()`）。
每個單字附帶一句例句（從 `sentences` 表撈含此單字的任一句，使用大小寫不分的 LIKE 比對：`LOWER(s.text) LIKE '% ' || LOWER(word) || ' %' OR LOWER(s.text) LIKE LOWER(word) || ' %' OR LOWER(s.text) LIKE '% ' || LOWER(word)`，ORDER BY RANDOM() LIMIT 1）。

**Response：**
```json
{
  "queue": [
    {
      "word": "thought",
      "intervalDays": 4,
      "nextReviewAt": null,
      "sentence": {
        "text": "I never thought this would happen to me.",
        "translation": "我從來沒想過這會發生在我身上。",
        "videoUrl": "https://www.netflix.com/watch/...",
        "timestampS": 874
      }
    }
  ]
}
```

若單字在 `sentences` 中找不到含該單字的句子，`sentence` 欄位為 `null`。

### `POST /practice/review`

**Body：**
```json
{ "word": "thought", "result": "know" }
```

`result` 只接受 `"know"` 或 `"unknown"`，其他回 400。

**後端邏輯：**
```
know:    new_interval = interval_days * 2
unknown: new_interval = 1
next_review_at = unixepoch() + new_interval * 86400
UPDATE words SET interval_days = new_interval, next_review_at = ... WHERE word = ?
```

**Response：** `{ "word": "thought", "intervalDays": 8, "nextReviewAt": 1749600000 }`

---

## 前端

### 型別（`types.ts`）

```ts
export interface PracticeWord {
  word: string
  intervalDays: number
  nextReviewAt: number | null
  sentence: {
    text: string
    translation: string | null
    videoUrl: string
    timestampS: number
  } | null
}
```

### `App.tsx` 變更

- `page` 型別加入 `'practice'`
- 新增 `practiceQueue: PracticeWord[]` state
- 進入 practice 頁面時 fetch `/practice/queue`，存入 state
- 新增 `handleReview(word: string, result: 'know' | 'unknown')`：
  - 呼叫 `POST /practice/review`
  - 成功後從本地 `practiceQueue` 移除該單字（不重新 fetch）

### `Sidebar.tsx` 變更

- 「練習」button 解除 `disabled`，改為可點擊
- badge 從 `即將推出` 改為顯示 `practiceQueue.length`（為 0 時不顯示 badge）
- 點擊後 `onSelectPage('practice')`

### 新增 `PracticePage.tsx`

Props：
```ts
{
  queue: PracticeWord[]
  onReview: (word: string, result: 'know' | 'unknown') => Promise<void>
}
```

狀態機：
- `idx`：目前字卡 index
- `flipped`：是否已翻面

流程：
1. `queue` 為空 → 顯示「今天沒有待複習單字」+ 下次複習提示
2. 顯示 `FlashCard`，`flipped=false`
3. 點「翻面看答案」→ `flipped=true`，顯示評分按鈕
4. 點「知道」或「不知道」→ `await onReview(word, result)` → `idx++`
5. `idx >= queue.length` → 顯示完成畫面（🎉 今日練習完成）

### 新增 `FlashCard.tsx`

Props：
```ts
{
  item: PracticeWord
  flipped: boolean
  onFlip: () => void
  onAnswer: (result: 'know' | 'unknown') => void
}
```

- `useDefinition(word)` 在 FlashCard 頂層呼叫一次，正背面共用結果
- **正面：** 單字 + 詞性（`useDefinition` 取得，loading 時顯示空白）+ 上次複習資訊（`nextReviewAt` 為 null 顯示「新單字 · 首次複習」；否則顯示「上次：N 天前 · 間隔：M 天」）
- **背面：** 定義（`useDefinition`，loading 時顯示 `…`）+ 例句（`item.sentence`，若 null 則不顯示例句區）
- 翻面動畫：CSS Grid 雙面疊加（`rotateY` + `opacity`），無 `position: absolute`，高度自然撐開
- 正面顯示翻面按鈕，背面顯示「知道／不知道」按鈕（含下次間隔提示）

### `api.ts` 新增

```ts
fetchPracticeQueue(): Promise<PracticeWord[]>
postPracticeReview(word: string, result: 'know' | 'unknown'): Promise<void>
```

---

## UX 細節

- Sidebar badge 只在有待複習單字時顯示（`> 0`）
- 完成畫面顯示「完成了 N 個單字的複習」
- 空佇列畫面顯示「今天沒有待複習單字」+ 最近一個 `next_review_at` 推算「最快 X 天後」
- 字卡背面的「下次 → X 天後」提示：`know` 顯示 `interval_days * 2`，`unknown` 顯示 1

---

## 不在此 Spec

- `status = 'learned'` 單字複習
- 練習歷史紀錄 / 統計圖表
- 每日練習上限
- 音訊發音
- 難度評分（0–5 grade，如 SM-2）

---

## 成功標準

1. Sidebar 練習 badge 顯示正確到期數量
2. 進入練習頁：字卡顯示，翻面後定義與例句正確
3. 評分後字卡前進，進度條更新
4. 全部完成後顯示完成畫面
5. `POST /practice/review` 正確更新 DB；下次 `GET /practice/queue` 不再回傳該單字
6. 空佇列時顯示「今天沒有待複習單字」
