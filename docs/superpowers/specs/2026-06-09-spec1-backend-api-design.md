# Spec 1 — 後端 API + Cloudflare D1 資料庫

**日期：** 2026-06-09
**階段：** MVP — 後端基礎建設
**目標：** 建立 Cloudflare Workers API + D1 資料庫，接收插件存入的句子，提供網頁查詢所需資料

---

## 背景

目前 DuoCue 是純前端插件，所有資料存在 `chrome.storage.local`。這個 spec 引入後端，讓句子可以跨裝置存取，並支援後續的 Web 前端與學習功能。

---

## Monorepo 目錄結構調整

將現有插件檔案移入 `extension/`，新增 `api/` 和 `web/`：

```
duocue/
├── extension/          ← 現有插件檔案全部移進來
│   ├── manifest.json
│   ├── content.js
│   ├── popup.html
│   ├── popup.js
│   ├── platforms.js
│   ├── styles.css
│   └── icons/
├── api/                ← Cloudflare Workers（本 Spec）
│   ├── src/
│   │   └── index.ts
│   ├── schema.sql
│   └── wrangler.toml
├── web/                ← Cloudflare Pages（Spec 3）
├── .gitignore
└── package.json
```

---

## D1 資料庫 Schema

```sql
-- 存句子時建立 or 取得影片紀錄
CREATE TABLE IF NOT EXISTS videos (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  platform  TEXT NOT NULL,           -- 'netflix' | 'hbo' | 'youtube'
  url       TEXT NOT NULL UNIQUE,    -- 影片頁面 URL
  title     TEXT                     -- 影片標題（選填，未來可補）
);

-- 存入的字幕句子
CREATE TABLE IF NOT EXISTS sentences (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id    INTEGER NOT NULL REFERENCES videos(id),
  text        TEXT NOT NULL,          -- 原文句子
  translation TEXT,                   -- 中文翻譯（選填）
  timestamp_s INTEGER NOT NULL,       -- 影片秒數
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 使用者標記的單字
CREATE TABLE IF NOT EXISTS words (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  word        TEXT NOT NULL UNIQUE,   -- 小寫標準化
  status      TEXT NOT NULL DEFAULT 'learning'  -- 'learning' | 'learned'
);

-- 句子與單字的多對多關聯（未來功能，MVP 不建立）
-- MVP 透過掃描 sentences.text 判斷句子是否含有特定單字
-- CREATE TABLE IF NOT EXISTS sentence_words (
--   sentence_id INTEGER NOT NULL REFERENCES sentences(id),
--   word_id     INTEGER NOT NULL REFERENCES words(id),
--   PRIMARY KEY (sentence_id, word_id)
-- );
```

---

## API Endpoints

所有請求需帶 `Authorization: Bearer <API_KEY>` header。
API_KEY 以 Cloudflare Workers Secret 儲存（`wrangler secret put API_KEY`）。

### POST /sentences
插件按 S 時呼叫，存入一句字幕。

**Request body:**
```json
{
  "platform": "netflix",
  "videoUrl": "https://www.netflix.com/watch/12345",
  "text": "I never thought this would happen to me.",
  "translation": "我從來沒想過這會發生在我身上。",
  "timestampS": 872
}
```

**Response 201:**
```json
{ "id": 42 }
```

---

### GET /sentences
網頁查詢所有句子，支援篩選。

**Query params:**
- `platform` — 篩選平台（選填）
- `videoUrl` — 篩選特定影片（選填）

**Response 200:**
```json
{
  "sentences": [
    {
      "id": 42,
      "text": "I never thought this would happen to me.",
      "translation": "我從來沒想過這會發生在我身上。",
      "timestampS": 872,
      "platform": "netflix",
      "videoUrl": "https://www.netflix.com/watch/12345",
      "videoTitle": null,
      "createdAt": "2026-06-09T10:00:00Z"
    }
  ]
}
```

---

### GET /words
插件啟動時拉快取，取得所有已標記單字與狀態。

**Response 200:**
```json
{
  "words": [
    { "word": "thought", "status": "learning" },
    { "word": "happen",  "status": "learned"  }
  ]
}
```

---

### PATCH /words/:word
網頁端更新單字學習狀態，若不存在則自動建立。

**Request body:**
```json
{ "status": "learned" }
```

**Response 200:**
```json
{ "word": "thought", "status": "learned" }
```

---

### GET /videos
網頁 sidebar 用，取得影片列表（依平台分組）。

**Response 200:**
```json
{
  "videos": [
    {
      "platform": "netflix",
      "url": "https://www.netflix.com/watch/12345",
      "title": null,
      "sentenceCount": 12
    }
  ]
}
```

---

## wrangler.toml

```toml
name = "duocue-api"
main = "src/index.ts"
compatibility_date = "2026-06-09"

[[d1_databases]]
binding = "DB"
database_name = "duocue"
database_id = "<待建立後填入>"
```

---

## Auth（MVP）

- API key 以 Wrangler Secret 儲存：`wrangler secret put API_KEY`
- 每個請求驗證 `Authorization: Bearer <API_KEY>` header
- 不符合 → 回傳 `401 Unauthorized`
- 插件端 API key 寫死在 `content.js` 的常數（之後改為從 popup 設定輸入）

---

## 不做的部分（MVP）

- 使用者 Auth（登入 / JWT）
- 分頁（先回傳全部）
- 影片標題自動抓取
- Rate limiting

---

## 成功標準

1. `POST /sentences` 可成功存入一筆句子與影片資訊
2. `GET /sentences` 回傳所有句子，`?videoUrl=xxx` 篩選正確
3. `GET /words` 回傳空陣列（初始狀態）
4. `PATCH /words/thought` 建立單字，再次呼叫回傳更新後狀態
5. 無效 API key → 回傳 401
6. `wrangler deploy` 成功部署到 Cloudflare
