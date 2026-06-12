import { useState, useEffect, useRef } from 'react'
import { Pencil } from 'lucide-react'

interface Props {
  title: string | null
  onRename: (newTitle: string) => Promise<void>
}

export default function VideoTitleEditor({ title, onRename }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(title ?? '')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  useEffect(() => {
    if (!editing) setDraft(title ?? '')
  }, [title, editing])

  const startEdit = () => {
    setDraft(title ?? '')
    setError(null)
    setEditing(true)
  }

  const cancel = () => {
    setEditing(false)
    setError(null)
  }

  const save = async () => {
    const trimmed = draft.trim()
    if (!trimmed) return
    try {
      await onRename(trimmed)
      setEditing(false)
      setError(null)
    } catch {
      setError('更新失敗，請再試')
    }
  }

  if (!editing) {
    return (
      <button
        onClick={startEdit}
        className="flex items-center justify-center p-1 rounded-md transition-colors"
        style={{ color: 'var(--text-secondary)' }}
        title="改名"
        onMouseOver={e => (e.currentTarget.style.color = 'var(--text-primary)')}
        onMouseOut={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
      >
        <Pencil size={12} />
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <input
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') save()
            if (e.key === 'Escape') cancel()
          }}
          className="px-2 py-0.5 rounded-md text-[12px] outline-none"
          style={{
            background: 'rgba(120,120,128,0.18)',
            color: 'var(--text-primary)',
            border: '1px solid rgba(0,122,255,0.5)',
            boxShadow: '0 0 0 2px rgba(0,122,255,0.12)',
            minWidth: '140px',
          }}
        />
        <button
          onClick={save}
          disabled={!draft.trim()}
          className="px-2 py-0.5 rounded-md text-[12px] font-medium"
          style={{
            background: 'rgba(0,122,255,0.15)',
            color: 'var(--ios-blue)',
            border: '1px solid rgba(0,122,255,0.3)',
            opacity: draft.trim() ? 1 : 0.4,
            cursor: draft.trim() ? 'pointer' : 'default',
          }}
        >
          儲存
        </button>
        <button
          onClick={cancel}
          className="px-2 py-0.5 rounded-md text-[12px]"
          style={{
            color: 'var(--text-secondary)',
            border: '1px solid rgba(120,120,128,0.2)',
            cursor: 'pointer',
          }}
        >
          取消
        </button>
      </div>
      {error && (
        <span className="text-[11px]" style={{ color: 'var(--ios-red, #ff3b30)' }}>
          {error}
        </span>
      )}
    </div>
  )
}
