import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Send, KeyRound } from 'lucide-react'
import { streamAiChat, postNoteSummarize, saveNote, deleteNote, getSettings } from '../api'
import { PLATFORM_COLOR } from './SentenceCard'
import type { ApiSentence, ChatMessage } from '../types'

const SUGGESTED_PROMPTS = ['這個片語怎麼用？', '和哪些詞容易搞混？', '舉幾個例句']

interface Props {
  sentence: ApiSentence | null
  isOpen: boolean
  onClose: () => void
  onNoteSaved: (id: number, note: string, updatedAt: number) => void
  onNoteDeleted: (id: number) => void
}

export default function SentenceAISheet({ sentence, isOpen, onClose, onNoteSaved, onNoteDeleted }: Props) {
  const navigate = useNavigate()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [noteDraft, setNoteDraft] = useState<string | null>(null)
  const [generatingNote, setGeneratingNote] = useState(false)
  const [savedNote, setSavedNote] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [hasGeminiKey, setHasGeminiKey] = useState<boolean | null>(null)

  useEffect(() => {
    setMessages([])
    setInput('')
    setStreaming(false)
    setNoteDraft(null)
    setShowDeleteConfirm(false)
    setSavedNote(sentence?.aiNote ?? null)
  }, [sentence?.id])

  useEffect(() => {
    if (!isOpen) return
    setHasGeminiKey(null)
    getSettings().then(s => setHasGeminiKey(s.hasGeminiKey))
  }, [isOpen])

  if (!sentence) return null

  const platformColor = PLATFORM_COLOR[sentence.platform] ?? '#888'
  const hasAiReply = messages.some(m => m.role === 'assistant' && m.content.trim().length > 0)

  const handleGoToSettings = () => {
    onClose()
    navigate('/settings')
  }

  const handleSend = async () => {
    if (!input.trim() || streaming) return
    const userMsg: ChatMessage = { role: 'user', content: input.trim() }
    const priorMessages = messages
    setMessages([...priorMessages, userMsg, { role: 'assistant', content: '' }])
    setInput('')
    setStreaming(true)
    try {
      await streamAiChat(sentence.id, [...priorMessages, userMsg], (delta) => {
        setMessages(prev => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          updated[updated.length - 1] = { ...last, content: last.content + delta }
          return updated
        })
      })
    } catch {
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', content: '（發生錯誤，請再試一次）' }
        return updated
      })
    } finally {
      setStreaming(false)
    }
  }

  const handleGenerateNote = async () => {
    setGeneratingNote(true)
    try {
      const draft = await postNoteSummarize(sentence.id, messages)
      setNoteDraft(draft)
    } finally {
      setGeneratingNote(false)
    }
  }

  const handleSaveNote = async () => {
    if (noteDraft === null) return
    const updatedAt = await saveNote(sentence.id, noteDraft)
    setSavedNote(noteDraft)
    setNoteDraft(null)
    onNoteSaved(sentence.id, noteDraft, updatedAt)
    setJustSaved(true)
    setTimeout(() => setJustSaved(false), 2000)
  }

  const handleDeleteNote = async () => {
    await deleteNote(sentence.id)
    setSavedNote(null)
    setShowDeleteConfirm(false)
    onNoteDeleted(sentence.id)
  }

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-40"
        style={{
          background: 'rgba(0,0,0,0.5)',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 320ms cubic-bezier(0.32, 0.72, 0, 1)',
        }}
        onClick={onClose}
      />
      <div
        className="fixed left-0 right-0 bottom-0 z-50 flex flex-col mx-auto"
        style={{
          maxWidth: 640,
          height: '92vh',
          background: 'var(--bg-card)',
          borderRadius: '20px 20px 0 0',
          transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 320ms cubic-bezier(0.32, 0.72, 0, 1)',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.2)',
        }}
      >
        <div className="flex justify-center pt-2.5 pb-1.5 shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(120,120,128,0.3)' }} />
        </div>

        <div className="px-4 pb-3 shrink-0" style={{ borderBottom: '1px solid var(--separator)' }}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: platformColor }} />
            <span className="text-[11px] truncate" style={{ color: 'var(--text-secondary)' }}>
              {sentence.videoTitle ?? sentence.videoUrl}
            </span>
          </div>
          <p className="text-[15px] leading-snug" style={{ color: 'var(--text-primary)' }}>
            {sentence.text}
          </p>
        </div>

        {hasGeminiKey === false ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'rgba(191,90,242,0.12)' }}>
              <KeyRound size={22} style={{ color: 'var(--ios-purple)' }} />
            </div>
            <p className="text-[14px] leading-relaxed" style={{ color: 'var(--text-primary)' }}>
              請先設定 Gemini API Key 才能使用 AI 解析
            </p>
            <button
              onClick={handleGoToSettings}
              className="rounded-xl px-4 py-2 text-[13px] font-medium"
              style={{ background: 'var(--ios-blue)', color: '#fff' }}
            >
              前往設定
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
              {messages.length === 0 && (
                <div className="flex gap-2 flex-wrap">
                  {SUGGESTED_PROMPTS.map(p => (
                    <button
                      key={p}
                      onClick={() => setInput(p)}
                      className="px-3 py-1.5 rounded-full text-[12px]"
                      style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}

              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className="max-w-[85%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed whitespace-pre-line"
                    style={{
                      background: m.role === 'user' ? 'var(--ios-blue)' : 'var(--bg-subtle)',
                      color: m.role === 'user' ? '#fff' : 'var(--text-primary)',
                    }}
                  >
                    {m.content || (streaming && i === messages.length - 1 ? '…' : '')}
                  </div>
                </div>
              ))}

              {hasAiReply && noteDraft === null && savedNote === null && (
                <button
                  onClick={handleGenerateNote}
                  disabled={generatingNote}
                  className="rounded-xl py-2.5 text-[14px] font-medium mt-1"
                  style={{ background: 'var(--ios-purple)', color: '#fff', opacity: generatingNote ? 0.6 : 1 }}
                >
                  {generatingNote ? '整理中…' : '整理成筆記'}
                </button>
              )}

              {hasAiReply && savedNote !== null && noteDraft === null && (
                <button
                  onClick={handleGenerateNote}
                  disabled={generatingNote}
                  className="rounded-xl py-2 text-[13px]"
                  style={{ background: 'var(--bg-subtle)', color: 'var(--ios-purple)' }}
                >
                  {generatingNote ? '整理中…' : '重新整理筆記'}
                </button>
              )}

              {noteDraft !== null && (
                <div className="rounded-xl p-3" style={{ background: 'var(--bg-subtle)' }}>
                  <div className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--ios-purple)' }}>
                    筆記草稿
                  </div>
                  <textarea
                    value={noteDraft}
                    onChange={e => setNoteDraft(e.target.value)}
                    rows={5}
                    className="w-full bg-transparent outline-none text-[13px] leading-relaxed resize-none"
                    style={{ color: 'var(--text-primary)' }}
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={handleSaveNote}
                      className="flex-1 rounded-lg py-2 text-[13px] font-medium"
                      style={{ background: 'var(--ios-blue)', color: '#fff' }}
                    >
                      儲存筆記
                    </button>
                    <button
                      onClick={() => setNoteDraft(null)}
                      className="flex-1 rounded-lg py-2 text-[13px]"
                      style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}

              {justSaved && (
                <div className="text-center text-[12px]" style={{ color: 'var(--ios-green)' }}>
                  筆記已儲存 ✓
                </div>
              )}

              {savedNote !== null && noteDraft === null && (
                <div className="text-center">
                  {!showDeleteConfirm ? (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="text-[12px] mt-1"
                      style={{ color: 'var(--ios-red)' }}
                    >
                      刪除筆記
                    </button>
                  ) : (
                    <div className="flex items-center justify-center gap-3 mt-1">
                      <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                        確定要刪除這則筆記嗎？
                      </span>
                      <button onClick={handleDeleteNote} className="text-[12px] font-medium" style={{ color: 'var(--ios-red)' }}>
                        刪除
                      </button>
                      <button onClick={() => setShowDeleteConfirm(false)} className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                        取消
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 px-3 py-2.5 shrink-0" style={{ borderTop: '1px solid var(--separator)' }}>
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder="問 AI 關於這個句子…"
                disabled={streaming}
                className="flex-1 rounded-full px-4 py-2 text-[14px] outline-none"
                style={{ background: 'var(--bg-subtle)', color: 'var(--text-primary)' }}
              />
              <button
                onClick={handleSend}
                disabled={streaming || !input.trim()}
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                style={{ background: 'var(--ios-blue)', opacity: streaming || !input.trim() ? 0.4 : 1 }}
              >
                <Send size={15} color="#fff" />
              </button>
            </div>
          </>
        )}
      </div>
    </>,
    document.body
  )
}
