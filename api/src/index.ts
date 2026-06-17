import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { hashPassword, verifyPassword, generateToken } from './auth'

export type Bindings = {
  DB: D1Database
  GEMINI_API_KEY: string
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

app.post('/sentences', async (c) => {
  let body: { platform: string; videoUrl: string; title?: string; text: string; translation?: string; timestampS: number }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  if (!body.platform || !body.videoUrl || !body.text || body.timestampS == null) {
    return c.json({ error: 'platform, videoUrl, text, timestampS are required' }, 400)
  }

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

  return c.json({ id: result.meta.last_row_id }, 201)
})

app.get('/sentences', async (c) => {
  const platform = c.req.query('platform')
  const videoUrl = c.req.query('videoUrl')

  const conditions: string[] = ['s.user_id = ?']
  const bindings: (string | number)[] = [c.get('userId')]
  if (platform) { conditions.push('v.platform = ?'); bindings.push(platform) }
  if (videoUrl) { conditions.push('v.url = ?');      bindings.push(videoUrl) }

  const where = `WHERE ${conditions.join(' AND ')}`
  const query = `
    SELECT s.id, s.text, s.translation,
           s.timestamp_s  AS timestampS,
           v.platform,    v.url   AS videoUrl,
           v.title        AS videoTitle,
           s.created_at   AS createdAt,
           s.ai_note      AS aiNote,
           s.ai_note_updated_at AS aiNoteUpdatedAt
    FROM sentences s
    JOIN videos v ON v.id = s.video_id
    ${where}
    ORDER BY s.created_at DESC
  `
  const { results } = await c.env.DB.prepare(query).bind(...bindings).all()
  return c.json({ sentences: results })
})

app.delete('/sentences/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)
  await c.env.DB.prepare('DELETE FROM sentences WHERE id = ? AND user_id = ?').bind(id, c.get('userId')).run()
  return c.json({ deleted: id })
})

app.get('/words', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT word, status FROM words WHERE user_id = ? ORDER BY word`
  ).bind(c.get('userId')).all()
  return c.json({ words: results })
})

app.patch('/words/:word', async (c) => {
  const word = c.req.param('word').toLowerCase()
  let parsedBody: { status?: string }
  try {
    parsedBody = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }
  const status = parsedBody.status ?? ''

  if (status !== 'learning' && status !== 'learned') {
    return c.json({ error: 'status must be "learning" or "learned"' }, 400)
  }

  await c.env.DB.prepare(
    `INSERT INTO words (user_id, word, status) VALUES (?, ?, ?)
     ON CONFLICT(user_id, word) DO UPDATE SET status = excluded.status`
  ).bind(c.get('userId'), word, status).run()

  return c.json({ word, status })
})

app.delete('/words/:word', async (c) => {
  const word = c.req.param('word').toLowerCase()
  await c.env.DB.prepare('DELETE FROM words WHERE word = ? AND user_id = ?').bind(word, c.get('userId')).run()
  return c.json({ deleted: word })
})

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

app.patch('/videos', async (c) => {
  let body: { url?: string; title?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const { url, title } = body
  if (!url || !title?.trim()) {
    return c.json({ error: 'url and title are required' }, 400)
  }

  const result = await c.env.DB.prepare(
    `UPDATE videos SET title = ? WHERE url = ? AND user_id = ?`
  ).bind(title.trim(), url, c.get('userId')).run()

  if (result.meta.changes === 0) {
    return c.json({ error: 'Video not found' }, 404)
  }

  return c.json({ url, title: title.trim() })
})

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

  const sentenceResults = await c.env.DB.batch(stmts)

  const queue = words.map((w, i) => ({
    word: w.word,
    intervalDays: w.intervalDays,
    nextReviewAt: w.nextReviewAt,
    sentence: (sentenceResults[i].results[0] as {
      text: string; translation: string | null; videoUrl: string; timestampS: number
    } | undefined) ?? null,
  }))

  return c.json({ queue })
})

function calcSM2(
  rating: 1 | 2 | 3 | 4,
  intervalDays: number,
  repetitions: number,
  easeFactor: number,
): { newInterval: number; newRepetitions: number; newEaseFactor: number } {
  let newInterval: number
  let newRepetitions: number
  let newEaseFactor = easeFactor

  if (rating === 1) {
    newInterval = 1
    newRepetitions = 0
    newEaseFactor = Math.max(1.3, easeFactor - 0.2)
  } else if (rating === 2) {
    newInterval = Math.max(1, Math.round(intervalDays * 1.2))
    newRepetitions = repetitions
    newEaseFactor = Math.max(1.3, easeFactor - 0.15)
  } else {
    if (repetitions === 0) newInterval = 1
    else if (repetitions === 1) newInterval = 6
    else newInterval = Math.round(intervalDays * easeFactor)
    if (rating === 4) {
      newInterval = Math.round(newInterval * 1.3)
      newEaseFactor = Math.min(3.0, easeFactor + 0.1)
    }
    newRepetitions = repetitions + 1
    newEaseFactor = Math.max(1.3, newEaseFactor)
  }

  return { newInterval, newRepetitions, newEaseFactor }
}

app.post('/practice/review', async (c) => {
  let body: { word?: string; rating?: number }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const { word, rating } = body
  if (!word || ![1, 2, 3, 4].includes(rating as number)) {
    return c.json({ error: 'word and rating (1|2|3|4) required' }, 400)
  }

  const w = word.toLowerCase()
  const r = rating as 1 | 2 | 3 | 4

  const userId = c.get('userId')
  const current = await c.env.DB.prepare(
    `SELECT interval_days, repetitions, ease_factor FROM words WHERE word = ? AND user_id = ?`
  ).bind(w, userId).first<{ interval_days: number; repetitions: number; ease_factor: number }>()

  if (!current) return c.json({ error: 'Word not found' }, 404)

  const { newInterval, newRepetitions, newEaseFactor } = calcSM2(
    r,
    current.interval_days,
    current.repetitions,
    current.ease_factor,
  )

  const nextReviewAt = Math.floor(Date.now() / 1000) + newInterval * 86400
  const newStatus = newInterval >= 21 ? 'learned' : 'learning'

  await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE words SET interval_days = ?, next_review_at = ?, ease_factor = ?, repetitions = ?, status = ? WHERE word = ? AND user_id = ?`
    ).bind(newInterval, nextReviewAt, newEaseFactor, newRepetitions, newStatus, w, userId),
    c.env.DB.prepare(
      `INSERT INTO reviews (user_id, word, rating, reviewed_at, interval_before, interval_after) VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(userId, w, r, Math.floor(Date.now() / 1000), current.interval_days, newInterval),
  ])

  return c.json({ word: w, intervalDays: newInterval, nextReviewAt, graduated: newStatus === 'learned' })
})

app.get('/practice/stats', async (c) => {
  const now = Math.floor(Date.now() / 1000)
  const thirtyDaysAgo = now - 30 * 86400

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

  const dates = (streakRows.results as { date: string }[]).map(r => r.date)
  const todayStr = new Date().toISOString().slice(0, 10)
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

  let streak = 0
  if (dates.length > 0 && (dates[0] === todayStr || dates[0] === yesterdayStr)) {
    streak = 1
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1]).getTime()
      const curr = new Date(dates[i]).getTime()
      if ((prev - curr) / 86400000 === 1) streak++
      else break
    }
  }

  const counts = (wordCounts.results[0] as { learning: number; learned: number }) ?? { learning: 0, learned: 0 }

  return c.json({
    streak,
    todayCount: (todayRow.results[0] as { count: number })?.count ?? 0,
    wordCounts: { learning: counts.learning ?? 0, learned: counts.learned ?? 0 },
    last30Days: last30.results as { date: string; count: number }[],
  })
})

export default app
