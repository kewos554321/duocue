import { useMemo, useState } from 'react'
import { Search, Pencil, Trash2 } from 'lucide-react'
import { PLATFORM_COLOR, PLATFORM_LABEL } from '../components/SentenceCard'
import type { ApiSentence } from '../types'

interface Props {
  sentences: ApiSentence[]
  onOpenAI: (sentence: ApiSentence) => void
  onDeleteNote: (id: number) => Promise<void>
}

function formatDate(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

export default function NotesPage({ sentences, onOpenAI, onDeleteNote }: Props) {
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  const notes = useMemo(
    () => sentences.filter(s => s.aiNote).sort((a, b) => (b.aiNoteUpdatedAt ?? 0) - (a.aiNoteUpdatedAt ?? 0)),
    [sentences]
  )

  const filtered = useMemo(() => {
    if (!search.trim()) return notes
    const q = search.toLowerCase()
    return notes.filter(s =>
      (s.aiNote ?? '').toLowerCase().includes(q) ||
      s.text.toLowerCase().includes(q) ||
      (s.translation ?? '').toLowerCase().includes(q)
    )
  }, [notes, search])

  const groups = useMemo(() => {
    const map = new Map<string, ApiSentence[]>()
    for (const s of filtered) {
      const key = `${s.platform}::${s.videoTitle ?? s.videoUrl}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(s)
    }
    return [...map.entries()]
  }, [filtered])

  const toggleExpanded = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleDelete = async (id: number) => {
    await onDeleteNote(id)
    setConfirmDeleteId(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-[17px] font-bold" style={{ color: 'var(--text-primary)' }}>
          筆記
          <span className="text-[13px] font-normal ml-1.5" style={{ color: 'var(--text-secondary)' }}>
            {notes.length} 則
          </span>
        </h1>
      </div>

      <div className="relative mb-5">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }} />
        <input
          type="search"
          placeholder="搜尋筆記或句子…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-xl pl-8 pr-3 py-2 text-[14px] outline-none"
          style={{ background: 'var(--bg-subtle)', color: 'var(--text-primary)' }}
        />
      </div>

      {notes.length === 0 ? (
        <div className="flex flex-col items-center gap-2.5 py-16 text-center px-8">
          <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'rgba(191,90,242,0.12)' }}>
            <Pencil size={22} style={{ color: 'var(--ios-purple)' }} />
          </div>
          <p className="text-[16px] font-semibold" style={{ color: 'var(--text-primary)' }}>還沒有筆記</p>
          <p className="text-[13px] leading-relaxed max-w-60" style={{ color: 'var(--text-secondary)' }}>
            對任何句子問 AI，整理後就會出現在這裡
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[14px]" style={{ color: 'var(--text-secondary)' }}>
          找不到符合的筆記
        </div>
      ) : (
        groups.map(([key, items]) => {
          const platform = items[0].platform
          const label = items[0].videoTitle ?? items[0].videoUrl
          return (
            <div key={key}>
              <div className="flex items-center gap-1.5 px-1 pt-4 pb-1.5">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: PLATFORM_COLOR[platform] ?? '#888' }} />
                <span className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                  {(PLATFORM_LABEL[platform] ?? platform)} · {label}
                </span>
              </div>

              {items.map(s => {
                const isExpanded = expanded.has(s.id)
                return (
                  <div
                    key={s.id}
                    className="rounded-2xl overflow-hidden mb-2.5"
                    style={{ background: 'var(--bg-card)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
                  >
                    <div
                      className="px-3.5 py-2.5 cursor-pointer"
                      style={{ borderBottom: '1px solid var(--separator)' }}
                      onClick={() => onOpenAI(s)}
                    >
                      <p className="text-[14px] leading-snug mb-0.5" style={{ color: 'var(--text-primary)' }}>{s.text}</p>
                      {s.translation && (
                        <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>{s.translation}</p>
                      )}
                    </div>

                    <div className="px-3.5 py-2.5">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--ios-purple)' }}>
                          筆記
                        </span>
                        <button
                          onClick={() => setConfirmDeleteId(s.id)}
                          className="w-5 h-5 flex items-center justify-center rounded-full hover:opacity-70"
                          style={{ color: 'var(--text-secondary)' }}
                          aria-label="刪除筆記"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>

                      {confirmDeleteId === s.id ? (
                        <div className="flex items-center justify-between">
                          <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>確定要刪除？</span>
                          <div className="flex gap-3">
                            <button onClick={() => handleDelete(s.id)} className="text-[12px] font-medium" style={{ color: 'var(--ios-red)' }}>刪除</button>
                            <button onClick={() => setConfirmDeleteId(null)} className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>取消</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p
                            className="text-[13px] leading-relaxed whitespace-pre-line"
                            style={{
                              color: 'var(--text-primary)',
                              display: isExpanded ? 'block' : '-webkit-box',
                              WebkitBoxOrient: 'vertical',
                              WebkitLineClamp: isExpanded ? 'unset' : 3,
                              overflow: isExpanded ? 'visible' : 'hidden',
                            }}
                          >
                            {s.aiNote}
                          </p>
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                              {formatDate(s.aiNoteUpdatedAt ?? 0)}
                            </span>
                            <button onClick={() => toggleExpanded(s.id)} className="text-[11px]" style={{ color: 'var(--ios-blue)' }}>
                              {isExpanded ? '收合' : '展開'}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })
      )}
    </div>
  )
}
