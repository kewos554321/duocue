# Spec 3 — Web 前端（句子庫）

**日期：** 2026-06-09
**階段：** MVP — 學習用網頁
**目標：** 建立 Cloudflare Pages 網頁，顯示插件存入的句子，支援 hover 查看單字意思、標記學習狀態、依影片/平台篩選、跳回影片

---

## 背景

插件只負責存句子與顯示顏色，所有學習操作（標記單字狀態、查看意思）都在這個網頁完成。這是使用者「複習」的主要場所，採情境記憶學習，不做測驗（MVP）。

---

## 技術選型

- **框架：** React 19 + Vite
- **樣式：** Tailwind CSS v4
- **部署：** Cloudflare Pages（靜態部署，直接打 Workers API）
- **語言：** TypeScript

目錄：`web/`，從 `api/` 獨立，只透過 HTTP API 溝通。

---

## 頁面結構

### Layout（所有頁面共用）

```
┌──────────────────────────────────────────────────┐
│ ● DuoCue                                         │  ← Header（Logo only）
├────────────┬─────────────────────────────────────┤
│  Sidebar   │  Main Content                        │
│  220px     │  flex-1, overflow-y: auto            │
│            │                                      │
│  [主選單]   │                                      │
│  [依影片]   │                                      │
│            │                                      │
│  [帳號]    │                                      │
└────────────┴─────────────────────────────────────┘
```

---

## Sidebar 內容

### 主選單
- 📖 全部句子（帶句子總數 badge）
- 📝 單字本（帶單字數 badge）
- 🧠 練習（badge 顯示「未來」，點擊無反應）

### 依影片瀏覽
依平台分組，每個平台可展開/收合：
- Netflix 🔴 （n 筆）
  - 影片標題或 URL 截短（n 筆）
  - ...
- HBO 🔵
- YouTube 🔴

點選影片 → 主內容區篩選為該影片的句子。

### 帳號區塊（sidebar 底部）
顯示頭像（名字首字母）、名字、email。
MVP 硬寫死設定，不做 auth，未來接 OAuth 時替換此區塊。

---

## 頁面：全部句子 / 依影片篩選

### 篩選列
- filter chips：全部 / 有學習中 / 未標記
- 搜尋框：即時篩選句子文字或單字

### 句子卡片

每張卡片顯示：

```
┌─────────────────────────────────────────────┐
│ [Netflix] Suits · S03E07    ▶ 00:14:32 跳回  │
│                                             │
│  I never thought this would happen to me.  │
│  （橘色底線 = 學習中，綠色底線 = 已學習）      │
│  我從來沒想過這會發生在我身上。                 │
│                                             │
│  [thought] [happen]                        │  ← 標記過的單字 tag
└─────────────────────────────────────────────┘
```

- **跳回影片**：`▶ 00:14:32` 按鈕 → 以 `?t={timestampS}` 參數開啟影片 URL（新分頁）
  - Netflix / YouTube 支援 `?t=` 參數
  - HBO 不支援，直接開影片頁面（不帶時間戳）
- **單字顏色**：同插件端，橘色 = 學習中，綠色 = 已學習，無底線 = 未標記
- **句子 tag**：底部列出該句有標記狀態的單字

### Hover Tooltip（單字查詢）

游標移到任何有顏色標記的單字（或未標記單字）上，顯示 tooltip：

```
┌──────────────────────────┐
│  thought  verb           │
│  ● 學習中                │
│  思考；認為；以為          │
│                          │
│  [📙 學習中]  [✅ 已學習] │
└──────────────────────────┘
```

- tooltip 出現：mouseenter 後 100ms delay（防抖）
- tooltip 消失：mouseleave 後 200ms delay（讓使用者可以移到 tooltip 上點按鈕）
- 中文意思：呼叫 `GET https://api.dictionaryapi.dev/api/v2/entries/en/{word}` 取得（已在 manifest host_permissions 中）；若失敗或無資料，顯示「—」
- 點「學習中」或「已學習」→ 呼叫 `PATCH /words/{word}`，tooltip 即時更新，句子卡片單字顏色即時更新

---

## 頁面：單字本

列出所有 `status = 'learning' | 'learned'` 的單字。

每張單字卡：
- 單字 + 詞性 + 中文意思
- 狀態 badge（橘 / 綠）
- 此單字出現在幾個句子（點擊可展開句子列表）

MVP 先只做列表，不做排序或進階篩選。

---

## 資料取得

MVP 不做 client-side cache（SWR / React Query），直接用 `fetch`。
- 進入頁面時：`GET /sentences`、`GET /videos`、`GET /words`
- 更新單字狀態時：`PATCH /words/{word}`，成功後本地 state 更新（不重新 fetch）

API endpoint 和 API key 硬寫死在 `web/src/config.ts`（MVP）。

---

## 未來功能（不在此 spec）

- 🧠 練習頁面（主動回憶 / fill-in-the-blank）
- 使用者登入（OAuth）
- 深色模式
- 影片標題自動抓取

---

## 成功標準

1. `wrangler pages deploy web/dist` 成功，可透過 Cloudflare Pages URL 存取
2. 頁面載入後顯示所有已儲存句子，句子數與 DB 一致
3. Sidebar 依影片分組正確，點選後主內容區篩選正確
4. 句子卡片上有標記狀態的單字顯示對應底線顏色
5. hover 單字 → tooltip 出現，顯示中文意思（或「—」）
6. 點 tooltip 按鈕 → 單字狀態立即更新，顏色即時改變
7. 點「跳回影片」→ 新分頁開啟影片（Netflix / YouTube 跳到正確時間）
8. 搜尋框輸入 → 即時篩選句子
