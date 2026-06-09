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
  let body: { platform: string; videoUrl: string; text: string; translation?: string; timestampS: number }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

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
