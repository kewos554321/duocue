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
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  word            TEXT NOT NULL UNIQUE,
  status          TEXT NOT NULL DEFAULT 'learning',
  next_review_at  INTEGER DEFAULT NULL,
  interval_days   INTEGER DEFAULT 1
);

-- Migration: deduplicate sentences and enforce uniqueness
-- Step 1: Remove duplicates, keep earliest (lowest id) per (video_id, text)
DELETE FROM sentences
WHERE id NOT IN (
  SELECT MIN(id) FROM sentences GROUP BY video_id, text
);

-- Step 2: Add unique index to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS uq_sentences_video_text
  ON sentences (video_id, text);
