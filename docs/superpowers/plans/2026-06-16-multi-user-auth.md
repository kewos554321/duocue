# 多使用者帳號系統與資料隔離 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 DuoCue API 從「單一固定 API Key、所有人共用同一份資料」改成「Email + 密碼登入、每個使用者擁有獨立的影片/句子/單字/複習紀錄」，讓開發者可以邀請少數測試者使用而不互相看到對方的資料。

**Architecture:** Cloudflare Workers (Hono) 新增 `users` / `sessions` 兩張 D1 表，用 session token（存在 `sessions` 表、Bearer header 傳遞）取代現在寫死的 `API_KEY` middleware。既有的 `videos` / `sentences` / `words` / `reviews` 表全部加上 `user_id`，所有查詢依登入者過濾。Web 前端新增登入/註冊頁，token 存 `localStorage`；Chrome extension 的設定欄位從「API Endpoint + API Key」簡化成單一「Token」欄位。

**Tech Stack:** Hono + Cloudflare D1（API）、Web Crypto API（PBKDF2 雜湊、隨機 token）、React 19 + react-router-dom v7（Web）、Chrome Extension MV3（`chrome.storage.local`）。

**關於測試方式：** 這個專案目前沒有任何測試框架（`api/`、`web/` 都沒有 vitest/jest），所有現有功能都是用 `wrangler dev` + 手動操作驗證的。本計畫延續這個慣例：每個後端步驟用 `curl` 對本機 `wrangler dev`（`--local` D1）驗證，前端步驟用瀏覽器手動操作驗證，而不是引入新的測試框架。

---

### Task 1: D1 schema — 新增 `users` / `sessions` 表

**Files:**
- Modify: `api/schema.sql`（在檔案最後加上新內容）

- [ ] **Step 1: 在 `api/schema.sql` 末尾加上新表**

```sql

-- Multi-user auth: accounts and login sessions
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  google_id     TEXT UNIQUE,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

- [ ] **Step 2: 套用到本機 D1**

Run: `cd api && npm run db:init:local`
Expected: 沒有錯誤訊息（`CREATE TABLE IF NOT EXISTS` 對已存在的表是 no-op，這裡是全新表所以會建立成功）

- [ ] **Step 3: 套用到正式環境 D1**

Run: `cd api && wrangler d1 execute duocue --remote --command "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, password_hash TEXT, google_id TEXT UNIQUE, created_at TEXT NOT NULL DEFAULT (datetime('now')));"`
然後 Run: `wrangler d1 execute duocue --remote --command "CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));"`
Expected: 兩個指令都回傳成功（`success: true`）

- [ ] **Step 4: Commit**

```bash
git add api/schema.sql
git commit -m "feat(api): add users and sessions tables for multi-user auth"
```

---

### Task 2: 密碼雜湊與 token 產生工具

**Files:**
- Create: `api/src/auth.ts`

- [ ] **Step 1: 寫 `api/src/auth.ts`**

```typescript
const PBKDF2_ITERATIONS = 100_000

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
  return bytes
}

async function derive(password: string, salt: Uint8Array): Promise<ArrayBuffer> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256,
  )
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await derive(password, salt)
  return `${toHex(salt)}:${toHex(new Uint8Array(hash))}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':')
  if (!saltHex || !hashHex) return false
  const hash = await derive(password, fromHex(saltHex))
  return toHex(new Uint8Array(hash)) === hashHex
}

export function generateToken(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(32)))
}
```

- [ ] **Step 2: 用 `wrangler dev` 手動驗證雜湊邏輯正確**

在 `api/src/index.ts` 暫時加一行（之後 Task 3 會移除）：在檔案最上面 `import` 區塊後加 `import { hashPassword, verifyPassword } from './auth'`，並在 `app.get('/words', ...)` 上方暫時加一個除錯路由：

```typescript
app.get('/__debug_auth', async (c) => {
  const h = await hashPassword('test1234')
  const ok = await verifyPassword('test1234', h)
  const bad = await verifyPassword('wrong', h)
  return c.json({ h, ok, bad })
})
```

Run: `cd api && npm run dev`，另開一個終端機執行：
`curl http://localhost:8787/__debug_auth`
Expected: 回傳 JSON，`ok: true`、`bad: false`，`h` 是 `<32位hex>:<64位hex>` 格式的字串

驗證完成後，把這個暫時的 `/__debug_auth` 路由和 import 都刪除（Task 3 會重新 import）。

- [ ] **Step 3: Commit**

```bash
git add api/src/auth.ts
git commit -m "feat(api): add PBKDF2 password hashing and token generation helpers"
```

---

### Task 3: Auth endpoints + 用 session token 取代固定 API_KEY

**Files:**
- Modify: `api/src/index.ts`

- [ ] **Step 1: 加上 import，並把 `Bindings` 型別與 middleware 換成 session 驗證**

把現在的：
```typescript
import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Bindings = {
  DB: D1Database
  API_KEY: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', cors())

app.use('*', async (c, next) => {
  if (c.req.method === 'OPTIONS') return next()
  const auth = c.req.header('Authorization')
  if (!auth || auth !== `Bearer ${c.env.API_KEY}`) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  await next()
})
```

換成：
```typescript
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { hashPassword, verifyPassword, generateToken } from './auth'

type Bindings = {
  DB: D1Database
}

type Variables = {
  userId: number
  token: string
}

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

app.use('*', cors())

const PUBLIC_PATHS = new Set(['/auth/register', '/auth/login'])

app.use('*', async (c, next) => {
  if (c.req.method === 'OPTIONS') return next()
  if (PUBLIC_PATHS.has(c.req.path)) return next()

  const auth = c.req.header('Authorization')
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return c.json({ error: 'Unauthorized' }, 401)

  const session = await c.env.DB.prepare(
    `SELECT user_id, expires_at FROM sessions WHERE token = ?`
  ).bind(token).first<{ user_id: number; expires_at: string }>()

  if (!session || new Date(session.expires_at) < new Date()) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  c.set('token', token)
  c.set('userId', session.user_id)
  await next()
})
```

- [ ] **Step 2: 加上 `/auth/register`、`/auth/login`、`/auth/logout`，放在 `app.post('/sentences', ...)` 之前**

```typescript
function newExpiry(): string {
  return new Date(Date.now() + 30 * 86400 * 1000).toISOString()
}

app.post('/auth/register', async (c) => {
  let body: { email?: string; password?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const email = body.email?.trim().toLowerCase()
  const password = body.password
  if (!email || !password) {
    return c.json({ error: 'email and password are required' }, 400)
  }

  const existing = await c.env.DB.prepare(`SELECT id FROM users WHERE email = ?`).bind(email).first()
  if (existing) return c.json({ error: 'Email already registered' }, 409)

  const passwordHash = await hashPassword(password)
  const result = await c.env.DB.prepare(
    `INSERT INTO users (email, password_hash) VALUES (?, ?)`
  ).bind(email, passwordHash).run()
  const userId = result.meta.last_row_id

  const token = generateToken()
  await c.env.DB.prepare(
    `INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`
  ).bind(token, userId, newExpiry()).run()

  return c.json({ token }, 201)
})

app.post('/auth/login', async (c) => {
  let body: { email?: string; password?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const email = body.email?.trim().toLowerCase()
  const password = body.password
  if (!email || !password) {
    return c.json({ error: 'email and password are required' }, 400)
  }

  const user = await c.env.DB.prepare(
    `SELECT id, password_hash FROM users WHERE email = ?`
  ).bind(email).first<{ id: number; password_hash: string | null }>()

  if (!user || !user.password_hash || !(await verifyPassword(password, user.password_hash))) {
    return c.json({ error: 'Invalid email or password' }, 401)
  }

  const token = generateToken()
  await c.env.DB.prepare(
    `INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`
  ).bind(token, user.id, newExpiry()).run()

  return c.json({ token })
})

app.post('/auth/logout', async (c) => {
  await c.env.DB.prepare(`DELETE FROM sessions WHERE token = ?`).bind(c.get('token')).run()
  return c.body(null, 204)
})
```

- [ ] **Step 3: 手動驗證**

Run: `cd api && npm run dev`

```bash
curl -X POST http://localhost:8787/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"a@test.com","password":"test1234"}'
```
Expected: `201`，回傳 `{"token":"<64位hex>"}`

```bash
curl -X POST http://localhost:8787/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"a@test.com","password":"test1234"}'
```
Expected: `409 {"error":"Email already registered"}`

```bash
curl -X POST http://localhost:8787/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"a@test.com","password":"wrong"}'
```
Expected: `401 {"error":"Invalid email or password"}`

```bash
TOKEN=$(curl -s -X POST http://localhost:8787/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"a@test.com","password":"test1234"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
curl -i http://localhost:8787/words -H "Authorization: Bearer $TOKEN"
```
Expected: `200`（middleware 接受這個 token；`/words` 路由本身還沒篩選 user_id，Task 6 會處理）

```bash
curl -X POST http://localhost:8787/auth/logout -H "Authorization: Bearer $TOKEN"
curl -i http://localhost:8787/words -H "Authorization: Bearer $TOKEN"
```
Expected: 第一個指令 `204`；第二個指令 `401`（token 已被刪除）

- [ ] **Step 4: Commit**

```bash
git add api/src/index.ts
git commit -m "feat(api): add register/login/logout endpoints, replace static API_KEY with session tokens"
```

---

### Task 4: 部署並建立開發者自己的帳號

這是手動操作步驟，不是程式碼變更——目的是先有一個真實的 `users` row，下一個 Task 的資料搬移要用到它的 `id`。

- [ ] **Step 1: 部署到正式環境**

Run: `cd api && npm run deploy`
Expected: 部署成功，輸出新的 Worker URL（應該還是 `https://duocue-api.kewos554321.workers.dev`）

- [ ] **Step 2: 對正式環境註冊自己的帳號**

```bash
curl -X POST https://duocue-api.kewos554321.workers.dev/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"<你的 email>","password":"<自訂密碼>"}'
```
Expected: `201`，回傳 `{"token":"..."}`——把這個 token 記下來，稍後 Task 9 設定 Web 前端會用到

- [ ] **Step 3: 確認自己的 `user_id` 是 1**

```bash
wrangler d1 execute duocue --remote --command "SELECT id, email FROM users;"
```
Expected: 只有一筆，`id = 1`，`email` 是你剛剛註冊的帳號。如果不是 1（例如重試過導致多筆），記下實際的 id，下一個 Task 的 SQL 要把所有 `<MY_USER_ID>` 換成這個實際值。

---

### Task 5: 資料搬移 — 既有表加上 `user_id`，並把所有舊資料歸到開發者帳號

`videos.url` 和 `words.word` 原本是全域唯一（`UNIQUE`），但多使用者之後，不同人可能存同一個網址或同一個單字，所以這兩張表的唯一限制要改成「每個使用者底下唯一」（`UNIQUE(user_id, url)` / `UNIQUE(user_id, word)`）。SQLite 不支援直接修改既有的 `UNIQUE` 限制，所以這兩張表用「建新表 → 搬資料 → 刪舊表 → 改名」的方式重建；`sentences` 和 `reviews` 沒有這個問題，直接 `ALTER TABLE ADD COLUMN` 即可。

以下指令以 `user_id = 1` 為例（Task 4 Step 3 確認過的開發者帳號 id）。

**Files:**
- Modify: `api/schema.sql`

- [ ] **Step 1: 在 `api/schema.sql` 末尾記錄這次的 migration（文件用途，方便之後對照歷史）**

```sql

-- Multi-user data isolation: rebuild videos/words with per-user UNIQUE constraints,
-- add user_id to sentences/reviews, backfill all existing rows to user_id 1
CREATE TABLE videos_new (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id   INTEGER NOT NULL REFERENCES users(id),
  platform  TEXT NOT NULL,
  url       TEXT NOT NULL,
  title     TEXT,
  UNIQUE(user_id, url)
);
INSERT INTO videos_new (id, user_id, platform, url, title)
  SELECT id, 1, platform, url, title FROM videos;
DROP TABLE videos;
ALTER TABLE videos_new RENAME TO videos;

CREATE TABLE words_new (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users(id),
  word            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'learning',
  next_review_at  INTEGER DEFAULT NULL,
  interval_days   INTEGER DEFAULT 1,
  ease_factor     REAL NOT NULL DEFAULT 2.5,
  repetitions     INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, word)
);
INSERT INTO words_new (id, user_id, word, status, next_review_at, interval_days, ease_factor, repetitions)
  SELECT id, 1, word, status, next_review_at, interval_days, ease_factor, repetitions FROM words;
DROP TABLE words;
ALTER TABLE words_new RENAME TO words;

ALTER TABLE sentences ADD COLUMN user_id INTEGER REFERENCES users(id);
UPDATE sentences SET user_id = 1;

ALTER TABLE reviews ADD COLUMN user_id INTEGER REFERENCES users(id);
UPDATE reviews SET user_id = 1;
```

- [ ] **Step 2: 套用到本機 D1**

Run: `cd api && npm run db:init:local`
Expected: 沒有錯誤（本機 D1 可能還沒有舊資料，這步主要是確保語法正確、表結構建立成功）

- [ ] **Step 3: 套用到正式環境 D1**

把 Step 1 的整段 SQL 存成暫存檔再執行（多語句一次 apply 比逐行 `--command` 可靠）：

```bash
cat > /tmp/migrate_users.sql << 'EOF'
CREATE TABLE videos_new (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id   INTEGER NOT NULL REFERENCES users(id),
  platform  TEXT NOT NULL,
  url       TEXT NOT NULL,
  title     TEXT,
  UNIQUE(user_id, url)
);
INSERT INTO videos_new (id, user_id, platform, url, title)
  SELECT id, 1, platform, url, title FROM videos;
DROP TABLE videos;
ALTER TABLE videos_new RENAME TO videos;

CREATE TABLE words_new (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users(id),
  word            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'learning',
  next_review_at  INTEGER DEFAULT NULL,
  interval_days   INTEGER DEFAULT 1,
  ease_factor     REAL NOT NULL DEFAULT 2.5,
  repetitions     INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, word)
);
INSERT INTO words_new (id, user_id, word, status, next_review_at, interval_days, ease_factor, repetitions)
  SELECT id, 1, word, status, next_review_at, interval_days, ease_factor, repetitions FROM words;
DROP TABLE words;
ALTER TABLE words_new RENAME TO words;

ALTER TABLE sentences ADD COLUMN user_id INTEGER REFERENCES users(id);
UPDATE sentences SET user_id = 1;

ALTER TABLE reviews ADD COLUMN user_id INTEGER REFERENCES users(id);
UPDATE reviews SET user_id = 1;
EOF
wrangler d1 execute duocue --remote --file=/tmp/migrate_users.sql
```

如果 Task 4 Step 3 確認你的 `user_id` 不是 1，先把這個檔案裡所有 `1`（user_id 的值，不是其他欄位）換成實際值再執行。

Expected: 全部語句成功執行

- [ ] **Step 4: 確認資料完整搬移**

```bash
wrangler d1 execute duocue --remote --command "SELECT COUNT(*) AS n FROM videos WHERE user_id IS NULL;"
wrangler d1 execute duocue --remote --command "SELECT COUNT(*) AS n FROM words WHERE user_id IS NULL;"
wrangler d1 execute duocue --remote --command "SELECT COUNT(*) AS n FROM sentences WHERE user_id IS NULL;"
wrangler d1 execute duocue --remote --command "SELECT COUNT(*) AS n FROM reviews WHERE user_id IS NULL;"
```
Expected: 四個查詢都回傳 `n: 0`

- [ ] **Step 5: Commit**

```bash
git add api/schema.sql
git commit -m "feat(api): migrate videos/sentences/words/reviews to per-user data with user_id"
```

---

### Task 6: 既有的句子/單字/影片 endpoints 加上 `user_id` 過濾

**Files:**
- Modify: `api/src/index.ts`

- [ ] **Step 1: `POST /sentences` 加上 `user_id`**

把：
```typescript
  await c.env.DB.prepare(
    `INSERT INTO videos (platform, url, title) VALUES (?, ?, ?)
     ON CONFLICT(url) DO UPDATE SET title = COALESCE(NULLIF(excluded.title, ''), videos.title)`
  ).bind(body.platform, body.videoUrl, body.title ?? '').run()

  const video = await c.env.DB.prepare(
    `SELECT id FROM videos WHERE url = ?`
  ).bind(body.videoUrl).first<{ id: number }>()

  if (!video) return c.json({ error: 'Failed to create video record' }, 500)

  const result = await c.env.DB.prepare(
    `INSERT OR IGNORE INTO sentences (video_id, text, translation, timestamp_s) VALUES (?, ?, ?, ?)`
  ).bind(video.id, body.text, body.translation ?? null, body.timestampS).run()
```
換成：
```typescript
  const userId = c.get('userId')

  await c.env.DB.prepare(
    `INSERT INTO videos (user_id, platform, url, title) VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, url) DO UPDATE SET title = COALESCE(NULLIF(excluded.title, ''), videos.title)`
  ).bind(userId, body.platform, body.videoUrl, body.title ?? '').run()

  const video = await c.env.DB.prepare(
    `SELECT id FROM videos WHERE user_id = ? AND url = ?`
  ).bind(userId, body.videoUrl).first<{ id: number }>()

  if (!video) return c.json({ error: 'Failed to create video record' }, 500)

  const result = await c.env.DB.prepare(
    `INSERT OR IGNORE INTO sentences (user_id, video_id, text, translation, timestamp_s) VALUES (?, ?, ?, ?, ?)`
  ).bind(userId, video.id, body.text, body.translation ?? null, body.timestampS).run()
```

- [ ] **Step 2: `GET /sentences` 加上 `user_id` 過濾**

把：
```typescript
  const conditions: string[] = []
  const bindings: string[] = []
  if (platform) { conditions.push('v.platform = ?'); bindings.push(platform) }
  if (videoUrl) { conditions.push('v.url = ?');      bindings.push(videoUrl) }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
```
換成：
```typescript
  const conditions: string[] = ['s.user_id = ?']
  const bindings: (string | number)[] = [c.get('userId')]
  if (platform) { conditions.push('v.platform = ?'); bindings.push(platform) }
  if (videoUrl) { conditions.push('v.url = ?');      bindings.push(videoUrl) }

  const where = `WHERE ${conditions.join(' AND ')}`
```
並把下面的：
```typescript
  const stmt = c.env.DB.prepare(query)
  const { results } = await (bindings.length ? stmt.bind(...bindings) : stmt).all()
```
換成：
```typescript
  const { results } = await c.env.DB.prepare(query).bind(...bindings).all()
```

- [ ] **Step 3: `DELETE /sentences/:id` 加上 `user_id` 過濾**

把：
```typescript
  await c.env.DB.prepare('DELETE FROM sentences WHERE id = ?').bind(id).run()
```
換成：
```typescript
  await c.env.DB.prepare('DELETE FROM sentences WHERE id = ? AND user_id = ?').bind(id, c.get('userId')).run()
```

- [ ] **Step 4: `GET /words` 加上 `user_id` 過濾**

把：
```typescript
app.get('/words', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT word, status FROM words ORDER BY word`
  ).all()
  return c.json({ words: results })
})
```
換成：
```typescript
app.get('/words', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT word, status FROM words WHERE user_id = ? ORDER BY word`
  ).bind(c.get('userId')).all()
  return c.json({ words: results })
})
```

- [ ] **Step 5: `PATCH /words/:word` 加上 `user_id`**

把：
```typescript
  await c.env.DB.prepare(
    `INSERT INTO words (word, status) VALUES (?, ?)
     ON CONFLICT(word) DO UPDATE SET status = excluded.status`
  ).bind(word, status).run()
```
換成：
```typescript
  await c.env.DB.prepare(
    `INSERT INTO words (user_id, word, status) VALUES (?, ?, ?)
     ON CONFLICT(user_id, word) DO UPDATE SET status = excluded.status`
  ).bind(c.get('userId'), word, status).run()
```

- [ ] **Step 6: `DELETE /words/:word` 加上 `user_id` 過濾**

把：
```typescript
  await c.env.DB.prepare('DELETE FROM words WHERE word = ?').bind(word).run()
```
換成：
```typescript
  await c.env.DB.prepare('DELETE FROM words WHERE word = ? AND user_id = ?').bind(word, c.get('userId')).run()
```

- [ ] **Step 7: `GET /videos` 加上 `user_id` 過濾**

把：
```typescript
app.get('/videos', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT v.platform, v.url, v.title,
           COUNT(s.id) AS sentenceCount
    FROM videos v
    LEFT JOIN sentences s ON s.video_id = v.id
    GROUP BY v.id
    ORDER BY v.platform, v.url
  `).all()
  return c.json({ videos: results })
})
```
換成：
```typescript
app.get('/videos', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT v.platform, v.url, v.title,
           COUNT(s.id) AS sentenceCount
    FROM videos v
    LEFT JOIN sentences s ON s.video_id = v.id
    WHERE v.user_id = ?
    GROUP BY v.id
    ORDER BY v.platform, v.url
  `).bind(c.get('userId')).all()
  return c.json({ videos: results })
})
```

- [ ] **Step 8: `PATCH /videos` 加上 `user_id` 過濾**

把：
```typescript
  const result = await c.env.DB.prepare(
    `UPDATE videos SET title = ? WHERE url = ?`
  ).bind(title.trim(), url).run()
```
換成：
```typescript
  const result = await c.env.DB.prepare(
    `UPDATE videos SET title = ? WHERE url = ? AND user_id = ?`
  ).bind(title.trim(), url, c.get('userId')).run()
```

- [ ] **Step 9: 手動驗證資料隔離**

Run: `cd api && npm run dev`

```bash
TOKEN_A=$(curl -s -X POST http://localhost:8787/auth/register -H "Content-Type: application/json" -d '{"email":"usera@test.com","password":"test1234"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
TOKEN_B=$(curl -s -X POST http://localhost:8787/auth/register -H "Content-Type: application/json" -d '{"email":"userb@test.com","password":"test1234"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

curl -X POST http://localhost:8787/sentences -H "Authorization: Bearer $TOKEN_A" -H "Content-Type: application/json" \
  -d '{"platform":"netflix","videoUrl":"https://netflix.com/watch/1","text":"hello world","timestampS":10}'

curl http://localhost:8787/sentences -H "Authorization: Bearer $TOKEN_B"
```
Expected: 最後一個指令回傳 `{"sentences":[]}`（B 帳號看不到 A 存的句子）

```bash
curl http://localhost:8787/sentences -H "Authorization: Bearer $TOKEN_A"
```
Expected: 回傳剛剛存的那一筆句子

- [ ] **Step 10: Commit**

```bash
git add api/src/index.ts
git commit -m "feat(api): scope sentences/words/videos endpoints by user_id"
```

---

### Task 7: 練習功能 endpoints 加上 `user_id` 過濾

**Files:**
- Modify: `api/src/index.ts`

- [ ] **Step 1: `GET /practice/queue` 加上 `user_id` 過濾**

把：
```typescript
app.get('/practice/queue', async (c) => {
  const { results: words } = await c.env.DB.prepare(`
    SELECT word, interval_days AS intervalDays, next_review_at AS nextReviewAt
    FROM words
    WHERE status = 'learning'
      AND (next_review_at IS NULL OR next_review_at <= unixepoch())
    ORDER BY COALESCE(next_review_at, 0) ASC, word ASC
  `).all<{ word: string; intervalDays: number; nextReviewAt: number | null }>()

  if (words.length === 0) return c.json({ queue: [] })

  const stmts = words.map(w =>
    c.env.DB.prepare(`
      SELECT s.text, s.translation, v.url AS videoUrl, s.timestamp_s AS timestampS
      FROM sentences s JOIN videos v ON v.id = s.video_id
      WHERE LOWER(s.text) LIKE '% ' || LOWER(?) || ' %'
         OR LOWER(s.text) LIKE LOWER(?) || ' %'
         OR LOWER(s.text) LIKE '% ' || LOWER(?)
         OR LOWER(s.text) = LOWER(?)
      ORDER BY RANDOM() LIMIT 1
    `).bind(w.word, w.word, w.word, w.word)
  )
```
換成：
```typescript
app.get('/practice/queue', async (c) => {
  const userId = c.get('userId')
  const { results: words } = await c.env.DB.prepare(`
    SELECT word, interval_days AS intervalDays, next_review_at AS nextReviewAt
    FROM words
    WHERE user_id = ? AND status = 'learning'
      AND (next_review_at IS NULL OR next_review_at <= unixepoch())
    ORDER BY COALESCE(next_review_at, 0) ASC, word ASC
  `).bind(userId).all<{ word: string; intervalDays: number; nextReviewAt: number | null }>()

  if (words.length === 0) return c.json({ queue: [] })

  const stmts = words.map(w =>
    c.env.DB.prepare(`
      SELECT s.text, s.translation, v.url AS videoUrl, s.timestamp_s AS timestampS
      FROM sentences s JOIN videos v ON v.id = s.video_id
      WHERE s.user_id = ?
        AND (LOWER(s.text) LIKE '% ' || LOWER(?) || ' %'
         OR LOWER(s.text) LIKE LOWER(?) || ' %'
         OR LOWER(s.text) LIKE '% ' || LOWER(?)
         OR LOWER(s.text) = LOWER(?))
      ORDER BY RANDOM() LIMIT 1
    `).bind(userId, w.word, w.word, w.word, w.word)
  )
```

- [ ] **Step 2: `POST /practice/review` 加上 `user_id` 過濾**

把：
```typescript
  const current = await c.env.DB.prepare(
    `SELECT interval_days, repetitions, ease_factor FROM words WHERE word = ?`
  ).bind(w).first<{ interval_days: number; repetitions: number; ease_factor: number }>()
```
換成：
```typescript
  const userId = c.get('userId')
  const current = await c.env.DB.prepare(
    `SELECT interval_days, repetitions, ease_factor FROM words WHERE word = ? AND user_id = ?`
  ).bind(w, userId).first<{ interval_days: number; repetitions: number; ease_factor: number }>()
```
並把：
```typescript
  await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE words SET interval_days = ?, next_review_at = ?, ease_factor = ?, repetitions = ?, status = ? WHERE word = ?`
    ).bind(newInterval, nextReviewAt, newEaseFactor, newRepetitions, newStatus, w),
    c.env.DB.prepare(
      `INSERT INTO reviews (word, rating, reviewed_at, interval_before, interval_after) VALUES (?, ?, ?, ?, ?)`
    ).bind(w, r, Math.floor(Date.now() / 1000), current.interval_days, newInterval),
  ])
```
換成：
```typescript
  await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE words SET interval_days = ?, next_review_at = ?, ease_factor = ?, repetitions = ?, status = ? WHERE word = ? AND user_id = ?`
    ).bind(newInterval, nextReviewAt, newEaseFactor, newRepetitions, newStatus, w, userId),
    c.env.DB.prepare(
      `INSERT INTO reviews (user_id, word, rating, reviewed_at, interval_before, interval_after) VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(userId, w, r, Math.floor(Date.now() / 1000), current.interval_days, newInterval),
  ])
```

- [ ] **Step 3: `GET /practice/stats` 加上 `user_id` 過濾**

把：
```typescript
  const [last30, streakRows, wordCounts, todayRow] = await c.env.DB.batch([
    c.env.DB.prepare(`
      SELECT date(reviewed_at, 'unixepoch') AS date, COUNT(*) AS count
      FROM reviews
      WHERE reviewed_at >= ?
      GROUP BY date
      ORDER BY date ASC
    `).bind(thirtyDaysAgo),

    c.env.DB.prepare(`
      SELECT date(reviewed_at, 'unixepoch') AS date
      FROM reviews
      GROUP BY date
      ORDER BY date DESC
    `),

    c.env.DB.prepare(`
      SELECT
        SUM(CASE WHEN status = 'learning' THEN 1 ELSE 0 END) AS learning,
        SUM(CASE WHEN status = 'learned'  THEN 1 ELSE 0 END) AS learned
      FROM words
    `),

    c.env.DB.prepare(`
      SELECT COUNT(*) AS count FROM reviews
      WHERE reviewed_at >= unixepoch('now','start of day')
    `),
  ])
```
換成：
```typescript
  const userId = c.get('userId')
  const [last30, streakRows, wordCounts, todayRow] = await c.env.DB.batch([
    c.env.DB.prepare(`
      SELECT date(reviewed_at, 'unixepoch') AS date, COUNT(*) AS count
      FROM reviews
      WHERE user_id = ? AND reviewed_at >= ?
      GROUP BY date
      ORDER BY date ASC
    `).bind(userId, thirtyDaysAgo),

    c.env.DB.prepare(`
      SELECT date(reviewed_at, 'unixepoch') AS date
      FROM reviews
      WHERE user_id = ?
      GROUP BY date
      ORDER BY date DESC
    `).bind(userId),

    c.env.DB.prepare(`
      SELECT
        SUM(CASE WHEN status = 'learning' THEN 1 ELSE 0 END) AS learning,
        SUM(CASE WHEN status = 'learned'  THEN 1 ELSE 0 END) AS learned
      FROM words
      WHERE user_id = ?
    `).bind(userId),

    c.env.DB.prepare(`
      SELECT COUNT(*) AS count FROM reviews
      WHERE user_id = ? AND reviewed_at >= unixepoch('now','start of day')
    `).bind(userId),
  ])
```

- [ ] **Step 4: 手動驗證**

Run: `cd api && npm run dev`，沿用 Task 6 Step 9 註冊的 `$TOKEN_A`：
```bash
curl -X PATCH http://localhost:8787/words/hello -H "Authorization: Bearer $TOKEN_A" -H "Content-Type: application/json" -d '{"status":"learning"}'
curl http://localhost:8787/practice/queue -H "Authorization: Bearer $TOKEN_A"
```
Expected: queue 裡有 `word: "hello"`，且 `sentence` 不是 null（會抓到 Task 6 存的 "hello world" 那句）

```bash
curl -X POST http://localhost:8787/practice/review -H "Authorization: Bearer $TOKEN_A" -H "Content-Type: application/json" -d '{"word":"hello","rating":3}'
curl http://localhost:8787/practice/stats -H "Authorization: Bearer $TOKEN_A"
```
Expected: review 回傳 200；stats 的 `todayCount` 至少是 1

- [ ] **Step 5: Commit**

```bash
git add api/src/index.ts
git commit -m "feat(api): scope practice queue/review/stats endpoints by user_id"
```

---

### Task 8: 清除不再使用的 `API_KEY`

**Files:**
- Modify: `api/wrangler.toml`（確認沒有殘留設定，這個檔案目前沒有 API_KEY 設定，主要是刪正式環境的 secret）

- [ ] **Step 1: 刪除正式環境的 `API_KEY` secret**

Run: `cd api && wrangler secret delete API_KEY`
Expected: 確認刪除成功（如果出現是否確認的提示，輸入 y）

- [ ] **Step 2: 確認本機 `.dev.vars` 沒有殘留的 `API_KEY`**

Run: `cat api/.dev.vars 2>/dev/null || echo "no .dev.vars file"`
如果有這個檔案且包含 `API_KEY=...`，手動編輯刪除那一行（這個檔案通常被 `.gitignore` 排除，不會進版控）

---

### Task 9: Web — token 儲存與 `api.ts` 改用 session token

**Files:**
- Modify: `web/src/config.ts`
- Create: `web/src/auth.ts`
- Modify: `web/src/api.ts`

- [ ] **Step 1: 移除 `web/src/config.ts` 裡的固定 API Key**

把：
```typescript
export const API_ENDPOINT = 'https://duocue-api.kewos554321.workers.dev'
export const API_KEY = '1faabc8c509c427f5acf0fb8861732b63d5dc6af3c910558db38eec289f3e3d7'
```
換成：
```typescript
export const API_ENDPOINT = 'https://duocue-api.kewos554321.workers.dev'
```

- [ ] **Step 2: 新增 `web/src/auth.ts`**

```typescript
const TOKEN_KEY = 'duocue_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}
```

- [ ] **Step 3: 改寫 `web/src/api.ts`，加上 `request` helper 與 auth 函式**

把檔案最上面：
```typescript
import { API_ENDPOINT, API_KEY } from './config'
import type { ApiSentence, ApiVideo, ApiWord, WordStatus, PracticeWord, PracticeStats } from './types'

const authHeaders = {
  Authorization: `Bearer ${API_KEY}`,
  'Content-Type': 'application/json',
}
```
換成：
```typescript
import { API_ENDPOINT } from './config'
import { getToken, clearToken } from './auth'
import type { ApiSentence, ApiVideo, ApiWord, WordStatus, PracticeWord, PracticeStats } from './types'

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${API_ENDPOINT}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': 'application/json',
    },
  })
  if (res.status === 401) {
    clearToken()
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }
  return res
}

export async function register(email: string, password: string): Promise<string> {
  const res = await fetch(`${API_ENDPOINT}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `Register failed: ${res.status}`)
  return data.token as string
}

export async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${API_ENDPOINT}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `Login failed: ${res.status}`)
  return data.token as string
}

export async function logout(): Promise<void> {
  await request('/auth/logout', { method: 'POST' })
}
```

- [ ] **Step 4: 把其餘所有 `fetch(..., { headers: authHeaders ... })` 改成用 `request(...)`**

把每一個現有函式裡的 `fetch(\`${API_ENDPOINT}/xxx\`, { ...options, headers: authHeaders })` 改成 `request('/xxx', options)`。完整改寫後的檔案其餘部分：

```typescript
export async function fetchSentences(): Promise<ApiSentence[]> {
  const res = await request('/sentences')
  if (!res.ok) throw new Error(`GET /sentences failed: ${res.status}`)
  const { sentences } = await res.json()
  return sentences as ApiSentence[]
}

export async function fetchVideos(): Promise<ApiVideo[]> {
  const res = await request('/videos')
  if (!res.ok) throw new Error(`GET /videos failed: ${res.status}`)
  const { videos } = await res.json()
  return videos as ApiVideo[]
}

export async function fetchWords(): Promise<ApiWord[]> {
  const res = await request('/words')
  if (!res.ok) throw new Error(`GET /words failed: ${res.status}`)
  const { words } = await res.json()
  return words as ApiWord[]
}

export async function deleteSentence(id: number): Promise<void> {
  const res = await request(`/sentences/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`DELETE /sentences/${id} failed: ${res.status}`)
}

export async function removeWord(word: string): Promise<void> {
  const res = await request(`/words/${encodeURIComponent(word.toLowerCase())}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`DELETE /words/${word} failed: ${res.status}`)
}

export async function patchWordStatus(word: string, status: WordStatus): Promise<void> {
  const res = await request(`/words/${encodeURIComponent(word.toLowerCase())}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
  if (!res.ok) throw new Error(`PATCH /words/${word} failed: ${res.status}`)
}

export async function patchVideoTitle(url: string, title: string): Promise<void> {
  const res = await request('/videos', {
    method: 'PATCH',
    body: JSON.stringify({ url, title }),
  })
  if (!res.ok) throw new Error(`PATCH /videos failed: ${res.status}`)
}

export async function fetchPracticeQueue(): Promise<PracticeWord[]> {
  const res = await request('/practice/queue')
  if (!res.ok) throw new Error(`GET /practice/queue failed: ${res.status}`)
  const { queue } = await res.json()
  return queue as PracticeWord[]
}

export async function postPracticeReview(word: string, rating: 1 | 2 | 3 | 4): Promise<void> {
  const res = await request('/practice/review', {
    method: 'POST',
    body: JSON.stringify({ word, rating }),
  })
  if (!res.ok) throw new Error(`POST /practice/review failed: ${res.status}`)
}

export async function fetchPracticeStats(): Promise<PracticeStats> {
  const res = await request('/practice/stats')
  if (!res.ok) throw new Error(`GET /practice/stats failed: ${res.status}`)
  return res.json()
}
```

- [ ] **Step 5: Commit**

```bash
git add web/src/config.ts web/src/auth.ts web/src/api.ts
git commit -m "feat(web): replace static API key with per-user session token"
```

---

### Task 10: Web — Login / Register 頁面與路由保護

**Files:**
- Create: `web/src/pages/LoginPage.tsx`
- Create: `web/src/pages/RegisterPage.tsx`
- Modify: `web/src/App.tsx`

- [ ] **Step 1: 新增 `web/src/pages/LoginPage.tsx`**

```tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { login } from '../api'
import { setToken } from '../auth'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const token = await login(email, password)
      setToken(token)
      window.location.href = '/'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
      setSubmitting(false)
    }
  }

  return (
    <div className="flex items-center justify-center h-screen" style={{ background: 'var(--bg-primary)' }}>
      <form
        onSubmit={handleSubmit}
        className="w-80 p-6 rounded-2xl flex flex-col gap-3"
        style={{ background: 'var(--bg-card)' }}
      >
        <h1 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>登入 DuoCue</h1>
        <input
          type="email"
          placeholder="Email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="px-3 py-2 rounded-lg border text-sm"
          style={{ borderColor: 'var(--separator)', color: 'var(--text-primary)', background: 'transparent' }}
        />
        <input
          type="password"
          placeholder="密碼"
          required
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="px-3 py-2 rounded-lg border text-sm"
          style={{ borderColor: 'var(--separator)', color: 'var(--text-primary)', background: 'transparent' }}
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="px-3 py-2 rounded-lg text-sm font-medium bg-blue-500 text-white disabled:opacity-50"
        >
          {submitting ? '登入中…' : '登入'}
        </button>
        <p className="text-sm text-center" style={{ color: 'var(--text-secondary)' }}>
          還沒有帳號？<Link to="/register" className="text-blue-500">註冊</Link>
        </p>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: 新增 `web/src/pages/RegisterPage.tsx`**

```tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { register } from '../api'
import { setToken } from '../auth'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const token = await register(email, password)
      setToken(token)
      window.location.href = '/'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Register failed')
      setSubmitting(false)
    }
  }

  return (
    <div className="flex items-center justify-center h-screen" style={{ background: 'var(--bg-primary)' }}>
      <form
        onSubmit={handleSubmit}
        className="w-80 p-6 rounded-2xl flex flex-col gap-3"
        style={{ background: 'var(--bg-card)' }}
      >
        <h1 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>註冊 DuoCue</h1>
        <input
          type="email"
          placeholder="Email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="px-3 py-2 rounded-lg border text-sm"
          style={{ borderColor: 'var(--separator)', color: 'var(--text-primary)', background: 'transparent' }}
        />
        <input
          type="password"
          placeholder="密碼（至少 8 位）"
          required
          minLength={8}
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="px-3 py-2 rounded-lg border text-sm"
          style={{ borderColor: 'var(--separator)', color: 'var(--text-primary)', background: 'transparent' }}
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="px-3 py-2 rounded-lg text-sm font-medium bg-blue-500 text-white disabled:opacity-50"
        >
          {submitting ? '註冊中…' : '註冊'}
        </button>
        <p className="text-sm text-center" style={{ color: 'var(--text-secondary)' }}>
          已經有帳號？<Link to="/login" className="text-blue-500">登入</Link>
        </p>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: 修改 `web/src/App.tsx`，未登入時導向登入頁**

把檔案最上面的 import 區塊：
```tsx
import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import SentencesPage from './pages/SentencesPage'
import WordBookPage from './pages/WordBookPage'
import PracticePage from './pages/PracticePage'
import StatsPage from './pages/StatsPage'
import {
  fetchSentences, fetchVideos, fetchWords,
  fetchPracticeQueue, fetchPracticeStats,
  patchWordStatus, deleteSentence, removeWord, postPracticeReview,
} from './api'
import type { ApiSentence, ApiVideo, ApiWord, WordStatus, PracticeWord, PracticeStats } from './types'
```
換成：
```tsx
import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import SentencesPage from './pages/SentencesPage'
import WordBookPage from './pages/WordBookPage'
import PracticePage from './pages/PracticePage'
import StatsPage from './pages/StatsPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import { getToken } from './auth'
import {
  fetchSentences, fetchVideos, fetchWords,
  fetchPracticeQueue, fetchPracticeStats,
  patchWordStatus, deleteSentence, removeWord, postPracticeReview,
} from './api'
import type { ApiSentence, ApiVideo, ApiWord, WordStatus, PracticeWord, PracticeStats } from './types'
```

把 `useEffect` 區塊：
```tsx
  useEffect(() => {
    Promise.all([fetchSentences(), fetchVideos(), fetchWords(), fetchPracticeQueue(), fetchPracticeStats()])
      .then(([s, v, w, q, st]) => {
        setSentences(s)
        setVideos(v)
        setWords(w)
        setPracticeQueue(q)
        setStats(st)
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])
```
換成：
```tsx
  useEffect(() => {
    if (!getToken()) {
      setLoading(false)
      return
    }
    Promise.all([fetchSentences(), fetchVideos(), fetchWords(), fetchPracticeQueue(), fetchPracticeStats()])
      .then(([s, v, w, q, st]) => {
        setSentences(s)
        setVideos(v)
        setWords(w)
        setPracticeQueue(q)
        setStats(st)
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])
```

把函式最後的 `return` 區塊（從 `if (loading) {` 開始到檔案結尾）整段：
```tsx
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white/40 text-sm">
        載入中…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-red-400 text-sm">
        {error}
      </div>
    )
  }

  const sentenceProps = {
    sentences,
    videos,
    wordMap,
    onUpdateWordStatus: updateWordStatus,
    onRemoveWordStatus: handleRemoveWord,
    onDeleteSentence: handleDeleteSentence,
  }

  return (
    <Layout sentences={sentences} words={words} practiceQueueCount={practiceQueue.length}>
      <Routes>
        <Route path="/" element={<Navigate to="/sentences/recent" replace />} />
        <Route path="/sentences/recent" element={<SentencesPage tab="recent" {...sentenceProps} />} />
        <Route path="/sentences/all" element={<SentencesPage tab="all" {...sentenceProps} />} />
        <Route path="/words" element={<WordBookPage words={words} sentences={sentences} onUpdateWordStatus={updateWordStatus} onRemoveWord={handleRemoveWord} />} />
        <Route path="/practice" element={<PracticePage queue={practiceQueue} onReview={handleReview} />} />
        <Route path="/stats" element={<StatsPage stats={stats} loading={false} />} />
      </Routes>
    </Layout>
  )
}
```
換成：
```tsx
  if (!getToken()) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white/40 text-sm">
        載入中…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-red-400 text-sm">
        {error}
      </div>
    )
  }

  const sentenceProps = {
    sentences,
    videos,
    wordMap,
    onUpdateWordStatus: updateWordStatus,
    onRemoveWordStatus: handleRemoveWord,
    onDeleteSentence: handleDeleteSentence,
  }

  return (
    <Layout sentences={sentences} words={words} practiceQueueCount={practiceQueue.length}>
      <Routes>
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/register" element={<Navigate to="/" replace />} />
        <Route path="/" element={<Navigate to="/sentences/recent" replace />} />
        <Route path="/sentences/recent" element={<SentencesPage tab="recent" {...sentenceProps} />} />
        <Route path="/sentences/all" element={<SentencesPage tab="all" {...sentenceProps} />} />
        <Route path="/words" element={<WordBookPage words={words} sentences={sentences} onUpdateWordStatus={updateWordStatus} onRemoveWord={handleRemoveWord} />} />
        <Route path="/practice" element={<PracticePage queue={practiceQueue} onReview={handleReview} />} />
        <Route path="/stats" element={<StatsPage stats={stats} loading={false} />} />
      </Routes>
    </Layout>
  )
}
```

- [ ] **Step 4: 手動驗證**

Run: `cd web && npm run dev`，瀏覽器開啟 `http://localhost:5173`
Expected: 因為沒有 token，自動導向 `/login`；輸入 Task 4 註冊的帳密（或先點「註冊」開新帳號）登入後，畫面回到正常的句子列表

- [ ] **Step 5: Commit**

```bash
git add web/src/pages/LoginPage.tsx web/src/pages/RegisterPage.tsx web/src/App.tsx
git commit -m "feat(web): add login/register pages, redirect unauthenticated users"
```

---

### Task 11: Web — 登出按鈕與「複製 API Token」功能

**Files:**
- Modify: `web/src/components/Layout.tsx`

- [ ] **Step 1: 在 Layout 的 header 加上登出與複製 token 按鈕**

把：
```tsx
import type { ReactNode } from 'react'
import Sidebar from './Sidebar'
import { useTheme } from '../hooks/useTheme'
import { Sun, Moon } from 'lucide-react'
import type { ApiSentence, ApiWord } from '../types'

interface Props {
  sentences: ApiSentence[]
  words: ApiWord[]
  practiceQueueCount: number
  children: ReactNode
}

export default function Layout({ sentences, words, practiceQueueCount, children }: Props) {
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <header
        className="shrink-0 h-12 flex items-center justify-between px-5 border-b"
        style={{
          background: 'var(--bg-card)',
          borderColor: 'var(--separator)',
        }}
      >
        <span
          className="font-semibold text-[15px] tracking-tight select-none"
          style={{ color: 'var(--text-primary)' }}
        >
          DuoCue
        </span>
        <button
          onClick={toggleTheme}
          className="w-8 h-8 flex items-center justify-center rounded-full transition-colors hover:bg-black/5 dark:hover:bg-white/10"
          title={theme === 'dark' ? '切換為淺色' : '切換為深色'}
          aria-label={theme === 'dark' ? '切換為淺色' : '切換為深色'}
        >
          {theme === 'dark'
            ? <Sun size={16} style={{ color: 'var(--text-secondary)' }} />
            : <Moon size={16} style={{ color: 'var(--text-secondary)' }} />
          }
        </button>
      </header>
```
換成：
```tsx
import { useState } from 'react'
import type { ReactNode } from 'react'
import Sidebar from './Sidebar'
import { useTheme } from '../hooks/useTheme'
import { Sun, Moon, LogOut, KeyRound } from 'lucide-react'
import { logout } from '../api'
import { getToken, clearToken } from '../auth'
import type { ApiSentence, ApiWord } from '../types'

interface Props {
  sentences: ApiSentence[]
  words: ApiWord[]
  practiceQueueCount: number
  children: ReactNode
}

export default function Layout({ sentences, words, practiceQueueCount, children }: Props) {
  const { theme, toggleTheme } = useTheme()
  const [copied, setCopied] = useState(false)

  const handleCopyToken = async () => {
    const token = getToken()
    if (!token) return
    await navigator.clipboard.writeText(token)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleLogout = async () => {
    await logout().catch(() => {})
    clearToken()
    window.location.href = '/login'
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <header
        className="shrink-0 h-12 flex items-center justify-between px-5 border-b"
        style={{
          background: 'var(--bg-card)',
          borderColor: 'var(--separator)',
        }}
      >
        <span
          className="font-semibold text-[15px] tracking-tight select-none"
          style={{ color: 'var(--text-primary)' }}
        >
          DuoCue
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopyToken}
            className="w-8 h-8 flex items-center justify-center rounded-full transition-colors hover:bg-black/5 dark:hover:bg-white/10"
            title={copied ? '已複製！' : '複製 API Token（貼到 Chrome 插件設定）'}
            aria-label="複製 API Token"
          >
            <KeyRound size={16} style={{ color: copied ? '#30D158' : 'var(--text-secondary)' }} />
          </button>
          <button
            onClick={toggleTheme}
            className="w-8 h-8 flex items-center justify-center rounded-full transition-colors hover:bg-black/5 dark:hover:bg-white/10"
            title={theme === 'dark' ? '切換為淺色' : '切換為深色'}
            aria-label={theme === 'dark' ? '切換為淺色' : '切換為深色'}
          >
            {theme === 'dark'
              ? <Sun size={16} style={{ color: 'var(--text-secondary)' }} />
              : <Moon size={16} style={{ color: 'var(--text-secondary)' }} />
            }
          </button>
          <button
            onClick={handleLogout}
            className="w-8 h-8 flex items-center justify-center rounded-full transition-colors hover:bg-black/5 dark:hover:bg-white/10"
            title="登出"
            aria-label="登出"
          >
            <LogOut size={16} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>
      </header>
```

剩下檔案內容（`<div className="flex flex-1 overflow-hidden">` 開始到結尾）不變。

- [ ] **Step 2: 手動驗證**

Run: `cd web && npm run dev`，登入後點 header 右上角的鑰匙圖示
Expected: 顏色短暫變綠（複製成功提示），用瀏覽器開發工具的 clipboard 或貼到任何輸入框確認真的複製到 token；點登出圖示應導回 `/login`，且再整理頁面會留在登入頁（token 已被清除）

- [ ] **Step 3: Commit**

```bash
git add web/src/components/Layout.tsx
git commit -m "feat(web): add logout and copy-API-token buttons to header"
```

---

### Task 12: Chrome Extension — 簡化設定為單一 Token 欄位

**Files:**
- Modify: `extension/popup.html`
- Modify: `extension/popup.js`
- Modify: `extension/content.js`

- [ ] **Step 1: 修改 `extension/popup.html`，把「API Endpoint + API Key」兩個欄位改成一個「個人 Token」欄位**

把：
```html
        <div id="expFields" style="opacity:0.4;pointer-events:none;display:flex;flex-direction:column;gap:12px">
          <div>
            <span class="field-label">API Endpoint</span>
            <div class="input-wrap" style="margin-top:6px">
              <input type="text" id="expEndpoint" placeholder="https://duocue-api.xxx.workers.dev" style="padding-right:12px">
            </div>
          </div>
          <div>
            <span class="field-label">API Key</span>
            <div class="input-wrap" style="margin-top:6px">
              <input type="password" id="expApiKey" placeholder="••••••••••••">
              <span class="eye-btn" id="expEyeBtn">
                <svg width="17" height="17" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 3.5C4.5 3.5 1.5 8 1.5 8C1.5 8 4.5 12.5 8 12.5C11.5 12.5 14.5 8 14.5 8C14.5 8 11.5 3.5 8 3.5Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.3"/></svg>
              </span>
            </div>
          </div>
        </div>
```
換成：
```html
        <div id="expFields" style="opacity:0.4;pointer-events:none;display:flex;flex-direction:column;gap:12px">
          <div>
            <span class="field-label">個人 Token</span>
            <div class="input-wrap" style="margin-top:6px">
              <input type="password" id="expApiKey" placeholder="到網頁登入後複製貼上">
              <span class="eye-btn" id="expEyeBtn">
                <svg width="17" height="17" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 3.5C4.5 3.5 1.5 8 1.5 8C1.5 8 4.5 12.5 8 12.5C11.5 12.5 14.5 8 14.5 8C14.5 8 11.5 3.5 8 3.5Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.3"/></svg>
              </span>
            </div>
          </div>
        </div>
```

- [ ] **Step 2: 修改 `extension/popup.js`，移除 `expEndpoint` 相關程式碼**

把：
```javascript
const expToggle   = document.getElementById('expToggle')
const expEndpoint = document.getElementById('expEndpoint')
const expApiKey   = document.getElementById('expApiKey')
const expEyeBtn   = document.getElementById('expEyeBtn')
const expFields   = document.getElementById('expFields')
```
換成：
```javascript
const expToggle   = document.getElementById('expToggle')
const expApiKey   = document.getElementById('expApiKey')
const expEyeBtn   = document.getElementById('expEyeBtn')
const expFields   = document.getElementById('expFields')
const DUOCUE_API_ENDPOINT = 'https://duocue-api.kewos554321.workers.dev'
```

把：
```javascript
chrome.storage.local.get(['experimentalMode', 'apiEndpoint', 'apiKey'], ({ experimentalMode, apiEndpoint, apiKey }) => {
  if (experimentalMode) {
    expToggle.classList.add('on')
    expFields.style.opacity = '1'
    expFields.style.pointerEvents = ''
    document.getElementById('summaryExp').textContent = '開啟'
  }
  if (apiEndpoint) expEndpoint.value = apiEndpoint
  if (apiKey) expApiKey.value = apiKey
})
```
換成：
```javascript
chrome.storage.local.set({ apiEndpoint: DUOCUE_API_ENDPOINT })
chrome.storage.local.get(['experimentalMode', 'apiKey'], ({ experimentalMode, apiKey }) => {
  if (experimentalMode) {
    expToggle.classList.add('on')
    expFields.style.opacity = '1'
    expFields.style.pointerEvents = ''
    document.getElementById('summaryExp').textContent = '開啟'
  }
  if (apiKey) expApiKey.value = apiKey
})
```

把：
```javascript
expEndpoint.addEventListener('blur', () => {
  chrome.storage.local.set({ apiEndpoint: expEndpoint.value.trim() })
})

expApiKey.addEventListener('blur', () => {
  chrome.storage.local.set({ apiKey: expApiKey.value.trim() })
})
```
換成：
```javascript
expApiKey.addEventListener('blur', () => {
  chrome.storage.local.set({ apiKey: expApiKey.value.trim() })
})
```

（`apiEndpoint` 仍然存進 `chrome.storage.local`，只是值固定為 `DUOCUE_API_ENDPOINT`，這樣 `content.js` 完全不用改讀取邏輯。）

- [ ] **Step 3: 確認 `extension/content.js` 不需要改動**

`content.js` 第 83-90 行讀取 `apiEndpoint` / `apiKey` 的邏輯維持原樣——`apiKey` 現在存的是使用者的個人 session token，`apiEndpoint` 現在永遠是固定的正式環境網址，邏輯完全相容，不用改程式碼。

- [ ] **Step 4: 手動驗證**

在 Chrome 載入 `extension/` 資料夾（`chrome://extensions` → 載入未封裝項目），打開 popup → 展開「實驗功能」→ 確認只看到一個「個人 Token」欄位 → 貼上 Task 4 或 Task 10 取得的 token → 切到任一支援的影片網站，按 S 存一句字幕
Run: 用該帳號的 token 查詢 `curl https://duocue-api.kewos554321.workers.dev/sentences -H "Authorization: Bearer <token>"`
Expected: 剛剛存的句子出現在回應裡

- [ ] **Step 5: Commit**

```bash
git add extension/popup.html extension/popup.js
git commit -m "feat(extension): simplify experimental settings to a single personal token field"
```

---

### Task 13: 端對端驗證（雙帳號資料隔離）

這是手動驗收步驟，確認整個系統串起來後行為符合 spec 的成功標準。

- [ ] **Step 1: 用兩個帳號在網頁上各自存資料**

開兩個不同瀏覽器（或一般視窗 + 無痕視窗），各自註冊一個帳號，登入後各自從插件存幾句不同的字幕、標記幾個不同的單字

- [ ] **Step 2: 確認資料互不可見**

互相切換帳號檢查 `/sentences`、`/words`、`/practice/stats` 頁面，確認 A 帳號看不到 B 帳號存的句子/單字/統計，反之亦然

- [ ] **Step 3: 確認登出後無法再用舊 token**

在某個帳號登出後，記下登出前複製的 token，用 `curl https://duocue-api.kewos554321.workers.dev/sentences -H "Authorization: Bearer <已登出的token>"` 驗證
Expected: `401 Unauthorized`

- [ ] **Step 4: 確認開發者原有資料完整保留**

用 Task 4 註冊的開發者帳號登入，確認原本（遷移前）累積的句子、單字、複習紀錄都還在
