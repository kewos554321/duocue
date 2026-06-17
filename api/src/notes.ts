import { Hono } from 'hono'
import type { Bindings, Variables } from './index'

export function registerNoteRoutes(app: Hono<{ Bindings: Bindings; Variables: Variables }>) {
  app.post('/sentences/:id/note', async (c) => {
    const id = parseInt(c.req.param('id'))
    if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)

    let body: { note?: string }
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400)
    }
    if (!body.note || !body.note.trim()) {
      return c.json({ error: 'note is required' }, 400)
    }

    const updatedAt = Math.floor(Date.now() / 1000)
    const result = await c.env.DB.prepare(
      `UPDATE sentences SET ai_note = ?, ai_note_updated_at = ? WHERE id = ? AND user_id = ?`
    ).bind(body.note.trim(), updatedAt, id, c.get('userId')).run()

    if (result.meta.changes === 0) return c.json({ error: 'Sentence not found' }, 404)

    return c.json({ ok: true, aiNoteUpdatedAt: updatedAt })
  })

  app.delete('/sentences/:id/note', async (c) => {
    const id = parseInt(c.req.param('id'))
    if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)

    const result = await c.env.DB.prepare(
      `UPDATE sentences SET ai_note = NULL, ai_note_updated_at = NULL WHERE id = ? AND user_id = ?`
    ).bind(id, c.get('userId')).run()

    if (result.meta.changes === 0) return c.json({ error: 'Sentence not found' }, 404)

    return c.json({ ok: true })
  })

  app.get('/notes', async (c) => {
    const { results } = await c.env.DB.prepare(`
      SELECT s.id              AS sentenceId,
             s.text,
             s.translation,
             v.platform,
             v.title           AS videoTitle,
             v.url             AS videoUrl,
             s.timestamp_s     AS timestampS,
             s.ai_note         AS aiNote,
             s.ai_note_updated_at AS aiNoteUpdatedAt
      FROM sentences s
      JOIN videos v ON v.id = s.video_id
      WHERE s.user_id = ? AND s.ai_note IS NOT NULL
      ORDER BY s.ai_note_updated_at DESC
    `).bind(c.get('userId')).all()
    return c.json({ notes: results })
  })
}
