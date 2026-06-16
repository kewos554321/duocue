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

-- Migration: SM-2 spaced repetition fields
ALTER TABLE words ADD COLUMN ease_factor REAL NOT NULL DEFAULT 2.5;
ALTER TABLE words ADD COLUMN repetitions  INTEGER NOT NULL DEFAULT 0;

-- Review log: one row per practice review event
CREATE TABLE IF NOT EXISTS reviews (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  word            TEXT    NOT NULL,
  rating          INTEGER NOT NULL CHECK(rating IN (1,2,3,4)),
  reviewed_at     INTEGER NOT NULL,
  interval_before INTEGER NOT NULL,
  interval_after  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reviews_word ON reviews(word);
CREATE INDEX IF NOT EXISTS idx_reviews_date ON reviews(reviewed_at);

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
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

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
