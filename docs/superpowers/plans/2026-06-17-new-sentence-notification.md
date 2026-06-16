# 新句子即時提示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在句子列表頁（`/sentences/recent`、`/sentences/all`）顯示「有新句子」的浮動提示按鈕，讓使用者在另一個分頁用 extension 存句子時，不用手動重新整理就能感知並載入新內容。

**Architecture:** API 新增一個輕量的 `GET /sentences/latest` 端點只回最新一筆的 id；web 端用一個 `useNewSentencePoll` hook 每 8 秒呼叫它，跟目前畫面上已知的最大 id 比較，有更新就顯示提示按鈕；點擊按鈕呼叫既有的 `fetchSentences()` 重新載入完整列表。分頁切到背景時暫停輪詢。完全不修改 extension。

**Tech Stack:** Cloudflare Workers (Hono) + D1 / React 19 + TypeScript + Vite

**專案測試慣例說明：** 這個 repo 目前沒有設定任何自動化測試框架（`api/` 和 `web/` 的 `package.json` 都沒有 test runner），所以以下每個任務的驗證都採用手動驗證（`curl` 打 API、`wrangler dev` 本機跑、瀏覽器手動操作），符合現有專案慣例，不引入新的測試框架。

---

### Task 1: API 新增 `GET /sentences/latest`

**Files:**
- Modify: `api/src/index.ts:76`（在現有 `app.get('/sentences', ...)` 之後、`app.delete('/sentences/:id', ...)` 之前插入新路由）

- [ ] **Step 1: 加入新路由**

在 `api/src/index.ts` 第 76 行（`app.get('/sentences', ...)` 的結尾 `}` 之後，`app.delete('/sentences/:id', ...)` 之前）插入：

```ts
app.get('/sentences/latest', async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT id, created_at AS createdAt FROM sentences ORDER BY created_at DESC LIMIT 1`
  ).first<{ id: number; createdAt: string }>()
  return c.json({ latest: row ?? null })
})
```

- [ ] **Step 2: 本機啟動 API 並驗證**

```bash
cd api && npm run dev
```

開另一個 terminal，先確認空狀態或現有資料的回應：

```bash
curl -s http://localhost:8787/sentences/latest -H "Authorization: Bearer $(grep API_KEY ../web/src/config.ts | sed -E 's/.*'\''(.*)'\''.*/\1/')"
```

Expected: 回應是 `{"latest":{"id":<數字>,"createdAt":"<時間字串>"}}`（若本機 D1 是空的會是 `{"latest":null}`，兩者都算正確）

- [ ] **Step 3: 部署 API**

```bash
cd api && npm run deploy
```

Expected: 部署成功訊息，顯示 `https://duocue-api.kewos554321.workers.dev`

- [ ] **Step 4: 用 curl 驗證已部署的端點**

```bash
curl -s https://duocue-api.kewos554321.workers.dev/sentences/latest \
  -H "Authorization: Bearer $(grep API_KEY web/src/config.ts | sed -E 's/.*'\''(.*)'\''.*/\1/')"
```

Expected: 回應 `{"latest":{"id":<數字>,"createdAt":"<時間字串>"}}`，id 應該是目前資料庫中最大的句子 id

- [ ] **Step 5: Commit**

```bash
git add api/src/index.ts
git commit -m "feat(api): add GET /sentences/latest for lightweight polling"
```

---

### Task 2: web 端新增 `fetchLatestSentenceId`

**Files:**
- Modify: `web/src/api.ts`

- [ ] **Step 1: 在 `web/src/api.ts` 加入新函式**

加在 `fetchSentences` 之後（第 14 行之後）：

```ts
export async function fetchLatestSentenceId(): Promise<number | null> {
  const res = await fetch(`${API_ENDPOINT}/sentences/latest`, { headers: authHeaders })
  if (!res.ok) throw new Error(`GET /sentences/latest failed: ${res.status}`)
  const { latest } = await res.json()
  return latest ? (latest.id as number) : null
}
```

- [ ] **Step 2: Type check**

```bash
cd web && npx tsc --noEmit
```

Expected: 沒有錯誤輸出

- [ ] **Step 3: Commit**

```bash
git add web/src/api.ts
git commit -m "feat(web): add fetchLatestSentenceId API client function"
```

---

### Task 3: 建立 `useNewSentencePoll` hook

**Files:**
- Create: `web/src/hooks/useNewSentencePoll.ts`

- [ ] **Step 1: 建立 hook 檔案**

```ts
import { useEffect, useRef, useState } from 'react'
import { fetchLatestSentenceId } from '../api'

export function useNewSentencePoll(baselineId: number, intervalMs = 8000): boolean {
  const [hasNew, setHasNew] = useState(false)
  const seenIdRef = useRef(baselineId)

  useEffect(() => {
    seenIdRef.current = baselineId
    setHasNew(false)
  }, [baselineId])

  useEffect(() => {
    let cancelled = false

    const poll = async () => {
      if (document.hidden) return
      try {
        const latestId = await fetchLatestSentenceId()
        if (!cancelled && latestId !== null && latestId > seenIdRef.current) {
          setHasNew(true)
        }
      } catch {
        // 背景輕量檢查，忽略錯誤、等下一次 interval 重試
      }
    }

    const id = setInterval(poll, intervalMs)
    document.addEventListener('visibilitychange', poll)

    return () => {
      cancelled = true
      clearInterval(id)
      document.removeEventListener('visibilitychange', poll)
    }
  }, [intervalMs])

  return hasNew
}
```

**設計說明（給之後維護的人）：**
- `baselineId` 由呼叫端（`SentencesPage`）從目前畫面上的 `sentences` 算出最大 id 傳入。當父層重新整理列表後 `baselineId` 會自動變大，第一個 `useEffect` 會把 `hasNew` 重設回 `false`——不需要額外的 `dismiss()` 函式
- `visibilitychange` 事件會在分頁從背景切回前景時立刻補打一次（不用等到下一個 8 秒），讓使用者切回分頁時能更快看到提示

- [ ] **Step 2: Type check**

```bash
cd web && npx tsc --noEmit
```

Expected: 沒有錯誤輸出

- [ ] **Step 3: Commit**

```bash
git add web/src/hooks/useNewSentencePoll.ts
git commit -m "feat(web): add useNewSentencePoll hook for background sentence polling"
```

---

### Task 4: 串接到 `SentencesPage`，加入提示按鈕

**Files:**
- Modify: `web/src/App.tsx`
- Modify: `web/src/pages/SentencesPage.tsx`

- [ ] **Step 1: 在 `App.tsx` 加入 refresh callback**

在 `web/src/App.tsx` 的 `handleDeleteSentence` 之前（第 37 行之前）加入：

```ts
  const refreshSentences = async () => {
    const s = await fetchSentences()
    setSentences(s)
  }
```

並把它加進 `sentenceProps`（第 80-87 行的物件）：

```ts
  const sentenceProps = {
    sentences,
    videos,
    wordMap,
    onUpdateWordStatus: updateWordStatus,
    onRemoveWordStatus: handleRemoveWord,
    onDeleteSentence: handleDeleteSentence,
    onRefreshSentences: refreshSentences,
  }
```

- [ ] **Step 2: 修改 `SentencesPage.tsx` 的 Props 與邏輯**

把 `web/src/pages/SentencesPage.tsx` 整個檔案改成：

```tsx
import { useMemo } from 'react'
import { NavLink } from 'react-router-dom'
import RecentSentencesTab from '../components/RecentSentencesTab'
import AllSentencesTab from '../components/AllSentencesTab'
import { useNewSentencePoll } from '../hooks/useNewSentencePoll'
import type { ApiSentence, ApiVideo, WordStatus } from '../types'

interface Props {
  tab: 'recent' | 'all'
  sentences: ApiSentence[]
  videos: ApiVideo[]
  wordMap: Map<string, WordStatus>
  onUpdateWordStatus: (word: string, status: WordStatus) => Promise<void>
  onRemoveWordStatus: (word: string) => Promise<void>
  onDeleteSentence: (id: number) => Promise<void>
  onRefreshSentences: () => Promise<void>
}

export default function SentencesPage({ tab, sentences, videos, wordMap, onUpdateWordStatus, onRemoveWordStatus, onDeleteSentence, onRefreshSentences }: Props) {
  const tabProps = { sentences, wordMap, onUpdateWordStatus, onRemoveWordStatus, onDeleteSentence }

  const baselineId = useMemo(
    () => sentences.reduce((max, s) => Math.max(max, s.id), 0),
    [sentences]
  )
  const hasNewSentence = useNewSentencePoll(baselineId)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div
          className="flex rounded-lg p-0.5 w-fit"
          style={{ background: 'rgba(120,120,128,0.12)' }}
        >
          {([
            ['recent', '/sentences/recent', '最近加入'],
            ['all', '/sentences/all', '全部句子'],
          ] as const).map(([key, to, label]) => (
            <NavLink
              key={key}
              to={to}
              className="px-4 py-1.5 rounded-[6px] text-[13px] transition-all duration-200 no-underline"
              style={({ isActive }) => ({
                background: isActive ? 'var(--bg-card)' : 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: isActive ? 600 : 400,
                boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
              })}
            >
              {label}
            </NavLink>
          ))}
        </div>

        {hasNewSentence && (
          <button
            onClick={onRefreshSentences}
            className="px-3 py-1.5 rounded-full text-[13px] font-medium transition-opacity hover:opacity-80"
            style={{ background: 'var(--ios-blue)', color: 'white' }}
          >
            有新句子，點擊查看
          </button>
        )}
      </div>

      {tab === 'recent'
        ? <RecentSentencesTab {...tabProps} />
        : <AllSentencesTab {...tabProps} videos={videos} />
      }
    </div>
  )
}
```

- [ ] **Step 3: Type check 與 build**

```bash
cd web && npx tsc --noEmit && npm run build
```

Expected: 沒有錯誤，build 成功產出 `web/dist`

- [ ] **Step 4: 手動驗證輪詢與提示按鈕**

```bash
cd web && npm run dev
```

1. 在瀏覽器開啟 `http://localhost:5173/sentences/recent`，打開瀏覽器 DevTools Network tab，確認每 8 秒有一個對 `/sentences/latest` 的請求
2. 用另一個 terminal 模擬 extension 存句子（呼叫正式環境 API，因為 `config.ts` 指向正式環境）：

```bash
curl -s -X POST https://duocue-api.kewos554321.workers.dev/sentences \
  -H "Authorization: Bearer $(grep API_KEY web/src/config.ts | sed -E 's/.*'\''(.*)'\''.*/\1/')" \
  -H "Content-Type: application/json" \
  -d '{"platform":"test","videoUrl":"https://example.com/manual-test","text":"manual polling test sentence","timestampS":1}'
```

3. 等待最多 8 秒，確認頁面右上角出現「有新句子，點擊查看」藍色按鈕
4. 點擊按鈕，確認列表更新（新句子出現在列表中）且按鈕消失
5. 切換瀏覽器分頁到背景（或切換到別的 app），在 Network tab 確認輪詢請求停止；切回前景，確認立刻補打一次請求

- [ ] **Step 5: 清理手動測試資料（可選）**

如果想清掉剛剛手動建立的測試句子，先用 `GET /sentences` 找到它的 id，再呼叫 `DELETE /sentences/:id`：

```bash
curl -s https://duocue-api.kewos554321.workers.dev/sentences \
  -H "Authorization: Bearer $(grep API_KEY web/src/config.ts | sed -E 's/.*'\''(.*)'\''.*/\1/')" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print([s['id'] for s in d['sentences'] if s['text']=='manual polling test sentence'])"
```

拿到 id 後：

```bash
curl -s -X DELETE https://duocue-api.kewos554321.workers.dev/sentences/<ID> \
  -H "Authorization: Bearer $(grep API_KEY web/src/config.ts | sed -E 's/.*'\''(.*)'\''.*/\1/')"
```

- [ ] **Step 6: Commit**

```bash
git add web/src/App.tsx web/src/pages/SentencesPage.tsx
git commit -m "feat(web): show new-sentence prompt on sentences page via polling"
```

---

## 完成後的驗收標準（對照 spec）

- [x] Task 1 對應 spec 的「API 變更」章節
- [x] Task 2、3 對應 spec 的「前端實作」章節（API client + hook）
- [x] Task 4 對應 spec 的「架構與資料流」「邊界情況」（visibilitychange 暫停輪詢、空表回 null、不自動插入列表）
