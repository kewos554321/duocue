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

  await c.env.DB.prepare(
    `INSERT INTO videos (platform, url, title) VALUES (?, ?, ?)
     ON CONFLICT(url) DO UPDATE SET title = COALESCE(NULLIF(excluded.title, ''), videos.title)`
  ).bind(body.platform, body.videoUrl, body.title ?? '').run()

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

app.delete('/sentences/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)
  await c.env.DB.prepare('DELETE FROM sentences WHERE id = ?').bind(id).run()
  return c.json({ deleted: id })
})

app.get('/words', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT word, status FROM words ORDER BY word`
  ).all()
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
    `INSERT INTO words (word, status) VALUES (?, ?)
     ON CONFLICT(word) DO UPDATE SET status = excluded.status`
  ).bind(word, status).run()

  return c.json({ word, status })
})

app.delete('/words/:word', async (c) => {
  const word = c.req.param('word').toLowerCase()
  await c.env.DB.prepare('DELETE FROM words WHERE word = ?').bind(word).run()
  return c.json({ deleted: word })
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
    `UPDATE videos SET title = ? WHERE url = ?`
  ).bind(title.trim(), url).run()

  if (result.meta.changes === 0) {
    return c.json({ error: 'Video not found' }, 404)
  }

  return c.json({ url, title: title.trim() })
})

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

app.post('/practice/review', async (c) => {
  let body: { word?: string; result?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const { word, result } = body
  if (!word || (result !== 'know' && result !== 'unknown')) {
    return c.json({ error: 'word and result ("know"|"unknown") required' }, 400)
  }

  const w = word.toLowerCase()
  const current = await c.env.DB.prepare(
    `SELECT interval_days FROM words WHERE word = ?`
  ).bind(w).first<{ interval_days: number }>()

  if (!current) return c.json({ error: 'Word not found' }, 404)

  const newInterval = result === 'know' ? current.interval_days * 2 : 1
  const nextReviewAt = Math.floor(Date.now() / 1000) + newInterval * 86400

  await c.env.DB.prepare(
    `UPDATE words SET interval_days = ?, next_review_at = ? WHERE word = ?`
  ).bind(newInterval, nextReviewAt, w).run()

  return c.json({ word: w, intervalDays: newInterval, nextReviewAt })
})

export default app
