# DuoCue Backend API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Cloudflare Workers API + D1 database that stores subtitle sentences and word-learning status, serving both the Chrome extension and the web frontend.

**Architecture:** Single Cloudflare Worker (`api/src/index.ts`) routes all endpoints via Hono. D1 SQLite database holds `videos`, `sentences`, and `words` tables. Bearer token auth via Wrangler secret. Extension files are moved into `extension/` as part of the monorepo restructure.

**Tech Stack:** Cloudflare Workers, D1 (SQLite), Hono v4, TypeScript 5, Wrangler v3

---

### Task 1: Move extension files into `extension/` subfolder

**Files:**
- Move: `content.js` → `extension/content.js`
- Move: `manifest.json` → `extension/manifest.json`
- Move: `popup.html` → `extension/popup.html`
- Move: `popup.js` → `extension/popup.js`
- Move: `platforms.js` → `extension/platforms.js`
- Move: `styles.css` → `extension/styles.css`
- Move: `icons/` → `extension/icons/`
- Create: `package.json` (root monorepo)

- [ ] **Step 1: Create `extension/` and move files with git**

```bash
mkdir extension
git mv content.js manifest.json popup.html popup.js platforms.js styles.css extension/
git mv icons extension/icons
```

- [ ] **Step 2: Verify Chrome can still load the extension**

Open `chrome://extensions/` → enable Developer mode → "Load unpacked" → select the `extension/` folder. Confirm DuoCue v0.2.0 appears and activates on Netflix or YouTube.

- [ ] **Step 3: Create root `package.json`**

```json
{
  "name": "duocue",
  "version": "1.0.0",
  "private": true,
  "workspaces": ["api", "web"]
}
```

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "chore: restructure monorepo — move extension into extension/ subfolder"
```

---

### Task 2: Scaffold `api/` project

**Files:**
- Create: `api/package.json`
- Create: `api/tsconfig.json`
- Create: `api/wrangler.toml`
- Create: `api/schema.sql`
- Create: `api/src/index.ts` (placeholder)
- Modify: `.gitignore`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p api/src
```

- [ ] **Step 2: Create `api/package.json`**

```json
{
  "name": "duocue-api",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "db:init:local": "wrangler d1 execute duocue --local --file=schema.sql",
    "db:init": "wrangler d1 execute duocue --file=schema.sql"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20240529.0",
    "typescript": "^5.4.5",
    "wrangler": "^3.60.0"
  },
  "dependencies": {
    "hono": "^4.4.0"
  }
}
```

- [ ] **Step 3: Create `api/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types"],
    "strict": true
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 4: Create `api/wrangler.toml`** (database_id is a placeholder — filled in Task 3)

```toml
name = "duocue-api"
main = "src/index.ts"
compatibility_date = "2026-06-09"

[[d1_databases]]
binding = "DB"
database_name = "duocue"
database_id = "placeholder"
```

- [ ] **Step 5: Create `api/schema.sql`**

```sql
CREATE TABLE IF NOT EXISTS videos (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  platform  TEXT NOT NULL,
  url       TEXT NOT NULL UNIQUE,
  title     TEXT
);

CREATE TABLE IF NOT EXISTS sentences (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id    INTEGER NOT NULL REFERENCES videos(id),
  text        TEXT NOT NULL,
  translation TEXT,
  timestamp_s INTEGER NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS words (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  word   TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'learning'
);
```

- [ ] **Step 6: Create placeholder `api/src/index.ts`**

```typescript
export default {
  fetch() {
    return new Response('ok')
  }
}
```

- [ ] **Step 7: Add `.dev.vars` to `.gitignore`** (this file stores local secrets — never commit it)

Open `.gitignore` and add:
```
api/.dev.vars
```

- [ ] **Step 8: Install dependencies**

```bash
cd api && npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 9: Commit**

```bash
cd ..
git add api/ .gitignore
git commit -m "chore: scaffold api/ project with Wrangler, Hono, TypeScript, and D1 schema"
```

---

### Task 3: Create D1 database and configure Wrangler

- [ ] **Step 1: Log in to Cloudflare**

```bash
cd api && npx wrangler login
```

A browser window opens for OAuth. Complete the login flow. Terminal should print:
```
✅ Successfully logged in.
```

- [ ] **Step 2: Create the D1 database**

```bash
npx wrangler d1 create duocue
```

Expected output (note the database_id):
```
✅ Successfully created DB 'duocue'

[[d1_databases]]
binding = "DB"
database_name = "duocue"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

- [ ] **Step 3: Paste the real `database_id` into `api/wrangler.toml`**

Replace `"placeholder"` with the UUID from the previous step:
```toml
[[d1_databases]]
binding = "DB"
database_name = "duocue"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

- [ ] **Step 4: Apply schema to local D1** (used by `wrangler dev --local`)

```bash
npm run db:init:local
```

Expected:
```
🌀 Executing on local database duocue from ./schema.sql:
✅ Successfully applied migrations.
```

- [ ] **Step 5: Create `api/.dev.vars`** for the local API key secret

```
API_KEY=test-key
```

This file is git-ignored. `wrangler dev` reads it automatically for local secrets.

- [ ] **Step 6: Commit updated wrangler.toml**

```bash
cd ..
git add api/wrangler.toml
git commit -m "chore: add D1 database_id to wrangler.toml"
```

---

### Task 4: Implement the Worker

**Files:**
- Modify: `api/src/index.ts` (full implementation)

- [ ] **Step 1: Replace `api/src/index.ts` with the full Worker**

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
  const auth = c.req.header('Authorization')
  if (!auth || auth !== `Bearer ${c.env.API_KEY}`) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  await next()
})

app.post('/sentences', async (c) => {
  const body = await c.req.json<{
    platform: string
    videoUrl: string
    text: string
    translation?: string
    timestampS: number
  }>()

  if (!body.platform || !body.videoUrl || !body.text || body.timestampS == null) {
    return c.json({ error: 'platform, videoUrl, text, timestampS are required' }, 400)
  }

  await c.env.DB.prepare(
    `INSERT INTO videos (platform, url) VALUES (?, ?) ON CONFLICT(url) DO NOTHING`
  ).bind(body.platform, body.videoUrl).run()

  const video = await c.env.DB.prepare(
    `SELECT id FROM videos WHERE url = ?`
  ).bind(body.videoUrl).first<{ id: number }>()

  if (!video) return c.json({ error: 'Failed to create video record' }, 500)

  const result = await c.env.DB.prepare(
    `INSERT INTO sentences (video_id, text, translation, timestamp_s) VALUES (?, ?, ?, ?)`
  ).bind(video.id, body.text, body.translation ?? null, body.timestampS).run()

  return c.json({ id: result.meta.last_row_id }, 201)
})

app.get('/sentences', async (c) => {
  const platform = c.req.query('platform')
  const videoUrl = c.req.query('videoUrl')

  const conditions: string[] = []
  const bindings: string[] = []
  if (platform) { conditions.push('v.platform = ?'); bindings.push(platform) }
  if (videoUrl) { conditions.push('v.url = ?');      bindings.push(videoUrl) }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const query = `
    SELECT s.id, s.text, s.translation,
           s.timestamp_s  AS timestampS,
           v.platform,    v.url   AS videoUrl,
           v.title        AS videoTitle,
           s.created_at   AS createdAt
    FROM sentences s
    JOIN videos v ON v.id = s.video_id
    ${where}
    ORDER BY s.created_at DESC
  `
  const stmt = c.env.DB.prepare(query)
  const { results } = await (bindings.length ? stmt.bind(...bindings) : stmt).all()
  return c.json({ sentences: results })
})

app.get('/words', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT word, status FROM words ORDER BY word`
  ).all()
  return c.json({ words: results })
})

app.patch('/words/:word', async (c) => {
  const word = c.req.param('word').toLowerCase()
  const { status } = await c.req.json<{ status: string }>()

  if (status !== 'learning' && status !== 'learned') {
    return c.json({ error: 'status must be "learning" or "learned"' }, 400)
  }

  await c.env.DB.prepare(
    `INSERT INTO words (word, status) VALUES (?, ?)
     ON CONFLICT(word) DO UPDATE SET status = excluded.status`
  ).bind(word, status).run()

  return c.json({ word, status })
})

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

export default app
```

- [ ] **Step 2: Commit**

```bash
git add api/src/index.ts
git commit -m "feat: implement all API endpoints (sentences, words, videos) in Cloudflare Worker"
```

---

### Task 5: Local integration tests

Run `wrangler dev --local` in one terminal, then test each endpoint in another. All tests use `Authorization: Bearer test-key`.

- [ ] **Step 1: Start local dev server**

```bash
cd api && npx wrangler dev --local
```

Expected: `⎔ Starting local server... Listening on http://localhost:8787`

- [ ] **Step 2: Test — auth rejection**

```bash
curl -s http://localhost:8787/words
```

Expected:
```json
{"error":"Unauthorized"}
```

- [ ] **Step 3: Test — `GET /words` returns empty array**

```bash
curl -s -H "Authorization: Bearer test-key" http://localhost:8787/words
```

Expected:
```json
{"words":[]}
```

- [ ] **Step 4: Test — `POST /sentences` creates video + sentence**

```bash
curl -s -X POST http://localhost:8787/sentences \
  -H "Authorization: Bearer test-key" \
  -H "Content-Type: application/json" \
  -d '{"platform":"netflix","videoUrl":"https://www.netflix.com/watch/12345","text":"I never thought this would happen to me.","translation":"我從來沒想過這會發生在我身上。","timestampS":872}'
```

Expected:
```json
{"id":1}
```

- [ ] **Step 5: Test — `GET /sentences` returns the saved sentence**

```bash
curl -s -H "Authorization: Bearer test-key" http://localhost:8787/sentences
```

Expected (check `text`, `translation`, `platform`, `videoUrl`, `timestampS` fields are present):
```json
{"sentences":[{"id":1,"text":"I never thought this would happen to me.","translation":"我從來沒想過這會發生在我身上。","timestampS":872,"platform":"netflix","videoUrl":"https://www.netflix.com/watch/12345","videoTitle":null,"createdAt":"..."}]}
```

- [ ] **Step 6: Test — `GET /sentences?platform=netflix` filters correctly**

```bash
curl -s -H "Authorization: Bearer test-key" "http://localhost:8787/sentences?platform=netflix"
```

Expected: same sentence as above.

```bash
curl -s -H "Authorization: Bearer test-key" "http://localhost:8787/sentences?platform=hbo"
```

Expected:
```json
{"sentences":[]}
```

- [ ] **Step 7: Test — `PATCH /words/:word` creates and updates a word**

```bash
curl -s -X PATCH http://localhost:8787/words/thought \
  -H "Authorization: Bearer test-key" \
  -H "Content-Type: application/json" \
  -d '{"status":"learning"}'
```

Expected:
```json
{"word":"thought","status":"learning"}
```

```bash
curl -s -X PATCH http://localhost:8787/words/thought \
  -H "Authorization: Bearer test-key" \
  -H "Content-Type: application/json" \
  -d '{"status":"learned"}'
```

Expected:
```json
{"word":"thought","status":"learned"}
```

- [ ] **Step 8: Test — `GET /words` returns the updated word**

```bash
curl -s -H "Authorization: Bearer test-key" http://localhost:8787/words
```

Expected:
```json
{"words":[{"word":"thought","status":"learned"}]}
```

- [ ] **Step 9: Test — `GET /videos` returns video with sentence count**

```bash
curl -s -H "Authorization: Bearer test-key" http://localhost:8787/videos
```

Expected:
```json
{"videos":[{"platform":"netflix","url":"https://www.netflix.com/watch/12345","title":null,"sentenceCount":1}]}
```

- [ ] **Step 10: Test — `PATCH /words/:word` rejects invalid status**

```bash
curl -s -X PATCH http://localhost:8787/words/thought \
  -H "Authorization: Bearer test-key" \
  -H "Content-Type: application/json" \
  -d '{"status":"invalid"}'
```

Expected:
```json
{"error":"status must be \"learning\" or \"learned\""}
```

All tests pass → stop dev server (`Ctrl+C`).

---

### Task 6: Deploy to Cloudflare

- [ ] **Step 1: Apply schema to the remote D1 database**

```bash
cd api && npm run db:init
```

Expected:
```
🌀 Executing on remote database duocue from ./schema.sql:
✅ Successfully applied migrations.
```

- [ ] **Step 2: Set the production API key secret**

```bash
npx wrangler secret put API_KEY
```

Wrangler prompts: `Enter a secret value:` — type a strong random string (e.g. output of `openssl rand -hex 32`). Press Enter.

Expected:
```
✅ Successfully created secret API_KEY
```

- [ ] **Step 3: Deploy the Worker**

```bash
npx wrangler deploy
```

Expected (note the URL):
```
✅ Deployed duocue-api to https://duocue-api.<your-subdomain>.workers.dev
```

- [ ] **Step 4: Smoke-test the remote deployment**

Replace `<YOUR_KEY>` with the secret you set in Step 2.

```bash
export DUOCUE_API="https://duocue-api.<your-subdomain>.workers.dev"
export DUOCUE_KEY="<YOUR_KEY>"

# Auth check
curl -s "$DUOCUE_API/words"
# Expected: {"error":"Unauthorized"}

# GET /words (empty)
curl -s -H "Authorization: Bearer $DUOCUE_KEY" "$DUOCUE_API/words"
# Expected: {"words":[]}

# POST /sentences
curl -s -X POST "$DUOCUE_API/sentences" \
  -H "Authorization: Bearer $DUOCUE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"platform":"netflix","videoUrl":"https://www.netflix.com/watch/99999","text":"Hello world.","translation":"你好世界。","timestampS":10}'
# Expected: {"id":1}

# GET /sentences
curl -s -H "Authorization: Bearer $DUOCUE_KEY" "$DUOCUE_API/sentences"
# Expected: array with one sentence
```

- [ ] **Step 5: Commit deploy confirmation**

```bash
cd ..
git commit --allow-empty -m "chore: deploy duocue-api to Cloudflare Workers"
```

---

## Done

All five spec success criteria are now verified:

| Criterion | Verified in |
|-----------|------------|
| `POST /sentences` stores sentence + video | Task 5 Step 4 |
| `GET /sentences?videoUrl=xxx` filters correctly | Task 5 Step 6 |
| `GET /words` returns empty array initially | Task 5 Step 3 |
| `PATCH /words/:word` creates and updates status | Task 5 Steps 7–8 |
| Invalid API key → 401 | Task 5 Step 2 |
| `wrangler deploy` succeeds | Task 6 Step 3 |
