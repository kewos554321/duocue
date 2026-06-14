# Deduplicate Sentences Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent duplicate sentences (same `video_id + text`) from being inserted into the database, without changing the Extension's save flow or API contract.

**Architecture:** Add a `UNIQUE INDEX` on `sentences(video_id, text)` and change the INSERT to `INSERT OR IGNORE`. Migration first cleans existing duplicates. No changes to Extension or web UI.

**Tech Stack:** Cloudflare D1 (SQLite), Hono (Cloudflare Workers), wrangler CLI

---

### Task 1: Add migration SQL to schema.sql

**Files:**
- Modify: `api/schema.sql`

- [ ] **Step 1: Open `api/schema.sql` and append the migration block at the bottom**

The file currently ends after the `words` table. Add:

```sql
-- Migration: deduplicate sentences and enforce uniqueness
-- Step 1: Remove duplicates, keep earliest (lowest id) per (video_id, text)
DELETE FROM sentences
WHERE id NOT IN (
  SELECT MIN(id) FROM sentences GROUP BY video_id, text
);

-- Step 2: Add unique index to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS uq_sentences_video_text
  ON sentences (video_id, text);
```

- [ ] **Step 2: Commit**

```bash
git add api/schema.sql
git commit -m "feat(db): add unique index on sentences(video_id, text)"
```

---

### Task 2: Apply the migration to D1

**Files:** none (runtime operation)

> Run from the `api/` directory. This touches the live D1 database.

- [ ] **Step 1: Check for existing duplicates before migrating**

```bash
cd api
npx wrangler d1 execute duocue --remote --command \
  "SELECT video_id, text, COUNT(*) AS cnt FROM sentences GROUP BY video_id, text HAVING cnt > 1;"
```

Expected: zero rows (or some rows if duplicates exist — that's fine, they will be cleaned).

- [ ] **Step 2: Run the deduplication DELETE**

```bash
npx wrangler d1 execute duocue --remote --command \
  "DELETE FROM sentences WHERE id NOT IN (SELECT MIN(id) FROM sentences GROUP BY video_id, text);"
```

Expected output: `{ changes: N }` where N is the number of deleted duplicates (0 is fine).

- [ ] **Step 3: Create the unique index**

```bash
npx wrangler d1 execute duocue --remote --command \
  "CREATE UNIQUE INDEX IF NOT EXISTS uq_sentences_video_text ON sentences (video_id, text);"
```

Expected output: `{ changes: 0 }` (DDL).

- [ ] **Step 4: Verify the index exists**

```bash
npx wrangler d1 execute duocue --remote --command \
  "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='sentences';"
```

Expected: row with `name = "uq_sentences_video_text"`.

- [ ] **Step 5: Verify no duplicates remain**

```bash
npx wrangler d1 execute duocue --remote --command \
  "SELECT video_id, text, COUNT(*) AS cnt FROM sentences GROUP BY video_id, text HAVING cnt > 1;"
```

Expected: zero rows.

---

### Task 3: Change INSERT to INSERT OR IGNORE in the API

**Files:**
- Modify: `api/src/index.ts:45-47`

- [ ] **Step 1: In `api/src/index.ts`, find the INSERT in `POST /sentences` (around line 45) and add `OR IGNORE`**

Before:
```typescript
  const result = await c.env.DB.prepare(
    `INSERT INTO sentences (video_id, text, translation, timestamp_s) VALUES (?, ?, ?, ?)`
  ).bind(video.id, body.text, body.translation ?? null, body.timestampS).run()
```

After:
```typescript
  const result = await c.env.DB.prepare(
    `INSERT OR IGNORE INTO sentences (video_id, text, translation, timestamp_s) VALUES (?, ?, ?, ?)`
  ).bind(video.id, body.text, body.translation ?? null, body.timestampS).run()
```

The `return c.json({ id: result.meta.last_row_id }, 201)` line immediately after stays unchanged. When a duplicate is ignored, `last_row_id` will be 0 — the Extension doesn't inspect this value, so behaviour is identical from the client's perspective.

- [ ] **Step 2: Commit**

```bash
git add api/src/index.ts
git commit -m "feat(api): use INSERT OR IGNORE to silently skip duplicate sentences"
```

---

### Task 4: Deploy and smoke-test

**Files:** none

- [ ] **Step 1: Deploy the updated Worker**

```bash
cd api
npx wrangler deploy
```

Expected: deployment URL printed, no errors.

- [ ] **Step 2: Smoke-test — first save (should succeed)**

Replace `<ENDPOINT>` and `<KEY>` with your actual values from the extension settings.

```bash
curl -s -X POST <ENDPOINT>/sentences \
  -H "Authorization: Bearer <KEY>" \
  -H "Content-Type: application/json" \
  -d '{"platform":"youtube","videoUrl":"https://example.com/v1","title":"Test","text":"Hello world","translation":"你好世界","timestampS":10}' \
  | jq .
```

Expected: `{ "id": <some positive number> }` with HTTP 201.

- [ ] **Step 3: Smoke-test — duplicate save (should silently succeed)**

Run the exact same curl command again.

Expected: `{ "id": 0 }` with HTTP 201 (no error, Extension-transparent).

- [ ] **Step 4: Verify only one record stored**

```bash
npx wrangler d1 execute duocue --remote --command \
  "SELECT id, text FROM sentences WHERE text = 'Hello world' ORDER BY id;"
```

Expected: exactly one row.
