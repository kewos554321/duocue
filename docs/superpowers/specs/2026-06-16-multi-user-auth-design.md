# 多使用者帳號系統與資料隔離

**日期：** 2026-06-16
**階段：** 開放測試者使用前的基礎建設
**目標：** 把目前單一固定 API Key（單人共用）的模式，改成每個使用者擁有獨立帳號、獨立的影片/句子/單字/複習紀錄，讓我可以邀請少數測試者使用而不互相干擾。

---

## 背景

目前 DuoCue 的 API（`api/src/index.ts`）只用一個寫死在 `wrangler secret` 裡的固定 `API_KEY` 做驗證，所有人共用同一份 D1 資料（`videos` / `sentences` / `words` / `reviews`），完全沒有使用者帳號的概念。

要開放給少數受邀測試者使用，且每個人要看到自己獨立的影片紀錄，需要：
1. 新增使用者帳號（Email + 密碼登入）
2. 用 session token 取代固定 API Key
3. 既有資料表加上 `user_id`，所有查詢依使用者過濾
4. 把現有資料（我自己的使用紀錄）歸到我的帳號下

未來會加上 Google OAuth 登入，但本次 spec 範圍**不包含** Google 登入，僅在資料結構上預留欄位，避免日後遷移成本。

---

## D1 資料庫 Schema 變更

```sql
-- 新增：使用者帳號
CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT,                  -- "salt:hash"，PBKDF2 算出，Google 登入帳號可為 NULL
  google_id     TEXT UNIQUE,           -- 預留給未來 Google OAuth，本次不使用
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 新增：登入 session（取代固定 API_KEY）
CREATE TABLE sessions (
  token      TEXT PRIMARY KEY,         -- 隨機字串，crypto.getRandomValues 產生
  user_id    INTEGER NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,            -- 建議登入後 30 天
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 既有表都加上 user_id，做資料隔離
-- 註：新增時不加 NOT NULL（SQLite 限制，見下方遷移步驟），由應用層保證每筆新資料都帶入 user_id
ALTER TABLE videos    ADD COLUMN user_id INTEGER REFERENCES users(id);
ALTER TABLE sentences ADD COLUMN user_id INTEGER REFERENCES users(id);
ALTER TABLE words     ADD COLUMN user_id INTEGER REFERENCES users(id);
ALTER TABLE reviews   ADD COLUMN user_id INTEGER REFERENCES users(id);
```

**資料遷移步驟（用 `wrangler d1 execute --remote` 手動跑，沿用專案現有「無 migration framework」做法）：**
1. 先跑上面的 `CREATE TABLE` 建立 `users` / `sessions`
2. 手動插入一筆我自己的 `users` row（email + 自訂密碼算出的 hash）
3. 對 `videos` / `sentences` / `words` / `reviews` 執行 `ALTER TABLE ... ADD COLUMN user_id INTEGER REFERENCES users(id)`（先不加 `NOT NULL`，因為 SQLite 對已有資料的表新增 `NOT NULL` 欄位需要 default 值，而這裡不需要：所有舊資料都會在下一步補上同一個值）
4. 對每張表執行 `UPDATE <table> SET user_id = <我的 user id>`，把所有舊資料歸到我的帳號
5. 確認 `SELECT COUNT(*) FROM videos WHERE user_id IS NULL` 等於 0（其餘三張表同樣檢查）後才視為遷移完成；`NOT NULL` 約束不額外用重建表的方式補上，往後一律由應用層程式碼保證每筆新資料都帶入 `user_id`

---

## API 變更

### 移除
- 既有「比對固定 `c.env.API_KEY`」的 middleware 邏輯整個移除

### 新增 Auth Endpoints

**POST /auth/register**
```json
// Request
{ "email": "test@example.com", "password": "..." }
// Response 201
{ "token": "..." }
```
- Email 已存在 → `409 Conflict`
- 密碼用 Web Crypto `crypto.subtle` 的 PBKDF2（隨機 salt，迭代次數 ≥ 100000）算 hash，存成 `"salt:hash"` 格式
- 註冊成功直接建立 session 並回傳 token（不用再額外登入一次）
- 不做邀請碼限制：先用最簡單的開放註冊，註冊頁網址只私下給受邀測試者，不公開宣傳

**POST /auth/login**
```json
// Request
{ "email": "test@example.com", "password": "..." }
// Response 200
{ "token": "..." }
```
- 帳號不存在或密碼錯誤 → 統一回傳 `401`，訊息不透露是哪一項錯誤

**POST /auth/logout**
- 帶 `Authorization: Bearer <token>`
- 從 `sessions` 表刪除該 token → `204`

### 既有 Endpoints 變更
- Middleware 改為：查 `sessions` 表，token 存在且未過期 → 取得 `user_id`，存入 context（例如 `c.set('userId', ...)`）；否則 `401`
- `/sentences`、`/words`、`/videos`、`/reviews` 等所有讀寫，SQL 都要加上 `WHERE user_id = ?`（取自 context），新增資料時也要帶入 `user_id`

---

## 網頁前端（web）變更

- 新增 `LoginPage` / `RegisterPage`（Email + 密碼表單）
- 登入/註冊成功後，把 `token` 存入 `localStorage`，取代 `web/src/config.ts` 中現在硬編碼的固定 API Key
- API 請求層改為讀取 `localStorage` 中的 token 組 `Authorization` header
- 未登入（無 token）→ 導向登入頁；收到 `401`（token 過期或被撤銷）→ 清除本地 token 並導回登入頁
- 加上登出按鈕（呼叫 `/auth/logout` 後清除本地 token）
- 新增「複製 API Token」功能（供使用者貼到 Chrome extension 設定，見下方）

## Chrome Extension 變更

- `popup.html` / `popup.js` 原本要求填 `apiKey` + `apiEndpoint` 兩個欄位，改為只需填一個「Token」欄位（`apiEndpoint` 固定為線上 API 網址，不再讓使用者填）
- 使用者從網頁登入後，用網頁上的「複製 API Token」功能取得 token，貼到 extension 的 Token 欄位
- `content.js` 原本讀 `chrome.storage.local.apiKey` 的地方改讀這個使用者 token，其餘存句子的邏輯不變

---

## 密碼與 Token 安全性

- 密碼雜湊：PBKDF2（Web Crypto `crypto.subtle.deriveBits`），每筆密碼獨立隨機 salt，迭代次數 ≥ 100000
- Session token：`crypto.getRandomValues` 產生足夠長度的隨機 bytes，轉成字串存入 `sessions.token`
- 不重複使用、不可預測；撤銷只需刪除對應的 `sessions` row

---

## 錯誤處理

| 情境 | 回應 |
|---|---|
| 註冊時 email 已存在 | `409 Conflict` |
| 登入帳密錯誤 | `401`，統一訊息 |
| Token 過期或不存在 | `401`，前端統一導回登入頁 |
| D1 user_id 外鍵失敗（理論上不會發生） | `500`，不特別處理 |

---

## 不做的部分（本次 Spec 範圍外）

- Google OAuth 登入（資料結構預留 `google_id` 欄位，但邏輯不實作）
- 邀請碼 / 註冊白名單（先靠註冊頁網址不公開來控制）
- 密碼重設 / Email 驗證信
- Rate limiting

---

## 成功標準

1. `POST /auth/register` 成功建立帳號並回傳可用的 token
2. `POST /auth/login` 用正確帳密可取得新 token；錯誤帳密回傳 401
3. `POST /auth/logout` 後該 token 立即失效（後續請求回 401）
4. 兩個不同帳號登入後，各自的 `/sentences`、`/videos`、`/words` 互相看不到對方資料
5. 既有資料全部正確歸到我（原開發者）的帳號下，遷移後我的使用紀錄完整可見
6. Chrome extension 貼上個人 token 後，存入的句子正確歸到對應帳號
