import { Hono } from 'hono'
import type { Bindings, Variables } from './index'
import { GoogleGenerativeAI } from '@google/generative-ai'

export function registerNoteRoutes(app: Hono<{ Bindings: Bindings; Variables: Variables }>) {
  type ChatMessage = { role: 'user' | 'assistant'; content: string }

  async function loadSentence(db: D1Database, id: number) {
    return db.prepare(
      `SELECT text, translation FROM sentences WHERE id = ?`
    ).bind(id).first<{ text: string; translation: string | null }>()
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

    const sentence = await loadSentence(c.env.DB, id)
    if (!sentence) return c.json({ error: 'Sentence not found' }, 404)

    const genAI = new GoogleGenerativeAI(c.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: `你是一位專業的英語學習助理，精通英語語意、語用與語境差異。使用者正在學習以下英語句子，請針對問題給予精簡、有用的分析（以繁體中文回答）。\n\n句子：${sentence.text}\n中文翻譯：${sentence.translation ?? ''}`,
    })

    const messages = body.messages
    // Convert to Gemini history format: all messages except the last one
    const history = messages.slice(0, -1).map(m => ({
      role: m.role === 'user' ? 'user' as const : 'model' as const,
      parts: [{ text: m.content }],
    }))
    const lastMessage = messages[messages.length - 1].content

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        try {
          const chat = model.startChat({ history })
          const result = await chat.sendMessageStream(lastMessage)
          for await (const chunk of result.stream) {
            const text = chunk.text()
            if (text) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: text })}\n\n`))
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

    const sentence = await loadSentence(c.env.DB, id)
    if (!sentence) return c.json({ error: 'Sentence not found' }, 404)

    const genAI = new GoogleGenerativeAI(c.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: `你是一位英語學習助理。根據以下對話，為學習者整理一份簡潔的學習筆記，以條列格式（bullet points）呈現，每條控制在30字以內，聚焦在這個句子的語意、用法差異、語境與記憶技巧。不要重複問題，直接給學習重點。\n\n句子：${sentence.text}\n中文翻譯：${sentence.translation ?? ''}`,
    })

    const conversation = body.messages
      .map(m => `${m.role === 'user' ? '使用者' : 'AI'}：${m.content}`)
      .join('\n')

    const result = await model.generateContent(`對話紀錄：\n${conversation}`)
    const draft = result.response.text()

    return c.json({ draft })
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
