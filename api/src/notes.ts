import { Hono } from 'hono'
import { GoogleGenAI } from '@google/genai'
import type { Bindings, Variables } from './index'

export function registerNoteRoutes(app: Hono<{ Bindings: Bindings; Variables: Variables }>) {
  type ChatMessage = { role: 'user' | 'assistant'; content: string }

  async function loadSentence(c: { env: { DB: D1Database } }, id: number, userId: number) {
    return c.env.DB.prepare(
      `SELECT text, translation FROM sentences WHERE id = ? AND user_id = ?`
    ).bind(id, userId).first<{ text: string; translation: string | null }>()
  }

  async function loadGeminiKey(c: { env: { DB: D1Database } }): Promise<string | null> {
    const row = await c.env.DB.prepare(
      `SELECT value FROM settings WHERE key = 'gemini_api_key'`
    ).first<{ value: string }>()
    return row?.value ?? null
  }

  function toGeminiContents(messages: ChatMessage[]) {
    return messages.map(m => ({
      role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
      parts: [{ text: m.content }],
    }))
  }

  app.post('/sentences/:id/ai-chat', async (c) => {
    const id = parseInt(c.req.param('id'))
    if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)

    let body: { messages?: ChatMessage[] }
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400)
    }
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return c.json({ error: 'messages is required' }, 400)
    }

    const sentence = await loadSentence(c, id, c.get('userId'))
    if (!sentence) return c.json({ error: 'Sentence not found' }, 404)

    const geminiKey = await loadGeminiKey(c)
    if (!geminiKey) return c.json({ error: 'GEMINI_KEY_MISSING' }, 400)

    const ai = new GoogleGenAI({ apiKey: geminiKey })
    const messages = body.messages
    const systemInstruction = `你是一位專業的英語學習助理，精通英語語意、語用與語境差異。\n使用者正在學習以下英語句子，請針對問題給予精簡、有用的分析（以繁體中文回答）。\n\n句子：${sentence.text}\n中文翻譯：${sentence.translation ?? ''}`

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        try {
          const geminiStream = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: toGeminiContents(messages),
            config: { systemInstruction },
          })
          for await (const chunk of geminiStream) {
            if (chunk.text) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: chunk.text })}\n\n`))
            }
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`))
        } catch (err) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: String(err) })}\n\n`))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  })

  app.post('/sentences/:id/note/summarize', async (c) => {
    const id = parseInt(c.req.param('id'))
    if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)

    let body: { messages?: ChatMessage[] }
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400)
    }
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return c.json({ error: 'messages is required' }, 400)
    }

    const sentence = await loadSentence(c, id, c.get('userId'))
    if (!sentence) return c.json({ error: 'Sentence not found' }, 404)

    const geminiKey = await loadGeminiKey(c)
    if (!geminiKey) return c.json({ error: 'GEMINI_KEY_MISSING' }, 400)

    const ai = new GoogleGenAI({ apiKey: geminiKey })
    const conversation = body.messages
      .map(m => `${m.role === 'user' ? '使用者' : 'AI'}：${m.content}`)
      .join('\n')

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `對話紀錄：\n${conversation}`,
      config: {
        systemInstruction: `你是一位英語學習助理。根據以下對話，為學習者整理一份簡潔的學習筆記，以條列格式（bullet points）呈現，每條控制在30字以內，聚焦在這個句子的語意、用法差異、語境與記憶技巧。不要重複問題，直接給學習重點。\n\n句子：${sentence.text}\n中文翻譯：${sentence.translation ?? ''}`,
      },
    })

    return c.json({ draft: response.text ?? '' })
  })

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

  // The web app derives its notes list from the already-loaded /sentences data instead of
  // calling this endpoint, to avoid a second fetch. Kept for other future clients.
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
      WHERE s.ai_note IS NOT NULL AND s.user_id = ?
      ORDER BY s.ai_note_updated_at DESC
    `).bind(c.get('userId')).all()
    return c.json({ notes: results })
  })
}
