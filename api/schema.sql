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
