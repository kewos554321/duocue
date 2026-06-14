# Spec: Deduplicate Sentences

**Date:** 2026-06-15

## Problem

The `sentences` table has no uniqueness constraint. Pressing "S" twice on the same subtitle, or rewinding and re-saving, inserts exact duplicate rows. These duplicates clutter the web UI's sentence list.

## Scope

- **Duplicate definition:** same `video_id` + same `text` within the same video.
- **Out of scope:** cross-video deduplication; fuzzy/near-duplicate matching.

## Requirements

- Duplicates are prevented at the database layer — no additional round-trips from the Extension.
- The Extension's save flow (`POST /sentences`) must remain unchanged: always returns 201, no new error codes.
- Viewing experience is unaffected.

## Design

### 1. Database Migration

Run against D1 in order:

```sql
-- Step 1: Remove duplicates, keep the earliest (lowest id) per (video_id, text)
DELETE FROM sentences
WHERE id NOT IN (
  SELECT MIN(id) FROM sentences GROUP BY video_id, text
);

-- Step 2: Add unique index
CREATE UNIQUE INDEX IF NOT EXISTS uq_sentences_video_text
  ON sentences (video_id, text);
```

`CREATE UNIQUE INDEX` is used because SQLite does not support `ALTER TABLE ... ADD CONSTRAINT`.

### 2. API Change

In `api/src/index.ts`, `POST /sentences`, change one keyword:

```diff
- INSERT INTO sentences (video_id, text, translation, timestamp_s) VALUES (?, ?, ?, ?)
+ INSERT OR IGNORE INTO sentences (video_id, text, translation, timestamp_s) VALUES (?, ?, ?, ?)
```

Behavior:
- **New sentence:** inserted normally, `last_row_id` is the new id, returns 201.
- **Duplicate sentence:** `INSERT OR IGNORE` silently skips, `last_row_id` is 0, returns 201. Extension is unaware.

### 3. Files Changed

| File | Change |
|------|--------|
| `api/schema.sql` | Add migration SQL (steps 1 & 2) |
| `api/src/index.ts` | `INSERT` → `INSERT OR IGNORE` |

Extension (`content.js`) and web UI require **no changes**.

## Verification

After applying the migration:

```sql
-- Should return 0 rows
SELECT video_id, text, COUNT(*) AS cnt
FROM sentences
GROUP BY video_id, text
HAVING cnt > 1;

-- Should include uq_sentences_video_text
SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'sentences';
```

API smoke test:
1. POST `/sentences` twice with the same `videoUrl` + `text`.
2. Both calls return 201.
3. `GET /sentences` shows exactly one record for that text.
