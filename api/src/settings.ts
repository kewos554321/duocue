import { Hono } from 'hono'
import type { Bindings } from './index'

export function registerSettingsRoutes(app: Hono<{ Bindings: Bindings }>) {
  app.get('/settings', async (c) => {
    const row = await c.env.DB.prepare(
      `SELECT value FROM settings WHERE key = 'gemini_api_key'`
    ).first<{ value: string }>()
    return c.json({ hasGeminiKey: !!row?.value })
  })

  app.post('/settings', async (c) => {
    let body: { geminiApiKey?: string }
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400)
    }
    if (!body.geminiApiKey || !body.geminiApiKey.trim()) {
      return c.json({ error: 'geminiApiKey is required' }, 400)
    }

    await c.env.DB.prepare(
      `INSERT INTO settings (key, value) VALUES ('gemini_api_key', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    ).bind(body.geminiApiKey.trim()).run()

    return c.json({ ok: true })
  })
}
