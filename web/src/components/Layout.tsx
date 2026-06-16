import { useState } from 'react'
import type { ReactNode } from 'react'
import Sidebar from './Sidebar'
import { useTheme } from '../hooks/useTheme'
import { Sun, Moon, LogOut, KeyRound } from 'lucide-react'
import { logout } from '../api'
import { getToken, clearToken } from '../auth'
import type { ApiSentence, ApiWord } from '../types'

interface Props {
  sentences: ApiSentence[]
  words: ApiWord[]
  practiceQueueCount: number
  children: ReactNode
}

export default function Layout({ sentences, words, practiceQueueCount, children }: Props) {
  const { theme, toggleTheme } = useTheme()
  const [copied, setCopied] = useState(false)

  const handleCopyToken = async () => {
    const token = getToken()
    if (!token) return
    await navigator.clipboard.writeText(token)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleLogout = async () => {
    await logout().catch(() => {})
    clearToken()
    window.location.href = '/login'
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <header
        className="shrink-0 h-12 flex items-center justify-between px-5 border-b"
        style={{
          background: 'var(--bg-card)',
          borderColor: 'var(--separator)',
        }}
      >
        <span
          className="font-semibold text-[15px] tracking-tight select-none"
          style={{ color: 'var(--text-primary)' }}
        >
          DuoCue
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopyToken}
            className="w-8 h-8 flex items-center justify-center rounded-full transition-colors hover:bg-black/5 dark:hover:bg-white/10"
            title={copied ? '已複製！' : '複製 API Token（貼到 Chrome 插件設定）'}
            aria-label="複製 API Token"
          >
            <KeyRound size={16} style={{ color: copied ? '#30D158' : 'var(--text-secondary)' }} />
          </button>
          <button
            onClick={toggleTheme}
            className="w-8 h-8 flex items-center justify-center rounded-full transition-colors hover:bg-black/5 dark:hover:bg-white/10"
            title={theme === 'dark' ? '切換為淺色' : '切換為深色'}
            aria-label={theme === 'dark' ? '切換為淺色' : '切換為深色'}
          >
            {theme === 'dark'
              ? <Sun size={16} style={{ color: 'var(--text-secondary)' }} />
              : <Moon size={16} style={{ color: 'var(--text-secondary)' }} />
            }
          </button>
          <button
            onClick={handleLogout}
            className="w-8 h-8 flex items-center justify-center rounded-full transition-colors hover:bg-black/5 dark:hover:bg-white/10"
            title="登出"
            aria-label="登出"
          >
            <LogOut size={16} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          sentences={sentences}
          words={words}
          practiceQueueCount={practiceQueueCount}
        />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
