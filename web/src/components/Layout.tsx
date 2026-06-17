import { useState } from 'react'
import type { ReactNode } from 'react'
import Sidebar from './Sidebar'
import { useTheme } from '../hooks/useTheme'
import { Sun, Moon, LogOut, KeyRound, X } from 'lucide-react'
import { logout } from '../api'
import { getToken, clearToken } from '../auth'
import type { ApiSentence, ApiWord } from '../types'

const BANNER_KEY = 'duocue_token_banner_dismissed'

interface Props {
  sentences: ApiSentence[]
  words: ApiWord[]
  practiceQueueCount: number
  dimmed?: boolean
  children: ReactNode
}

export default function Layout({ sentences, words, practiceQueueCount, dimmed, children }: Props) {
  const { theme, toggleTheme } = useTheme()
  const [copied, setCopied] = useState(false)
  const [showBanner, setShowBanner] = useState(() => !localStorage.getItem(BANNER_KEY))

  const dismissBanner = () => {
    localStorage.setItem(BANNER_KEY, '1')
    setShowBanner(false)
  }

  const handleCopyToken = async () => {
    const token = getToken()
    if (!token) return
    await navigator.clipboard.writeText(token)
    setCopied(true)
    dismissBanner()
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

      {showBanner && (
        <div
          className="shrink-0 flex items-center justify-between gap-3 px-5 py-2.5 border-b"
          style={{
            background: 'rgba(10, 132, 255, 0.07)',
            borderColor: 'rgba(10, 132, 255, 0.18)',
          }}
        >
          <span className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
            在 Chrome 插件開啟「句子收集」功能前，先複製你的個人 Token
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopyToken}
              className="px-3 h-7 rounded-md text-xs font-semibold transition-colors"
              style={{
                background: copied ? '#30D158' : '#0A84FF',
                color: '#fff',
              }}
            >
              {copied ? '已複製！' : '複製 Token'}
            </button>
            <button
              onClick={dismissBanner}
              className="w-6 h-6 flex items-center justify-center rounded-full transition-colors hover:bg-black/5 dark:hover:bg-white/10"
              aria-label="關閉"
              style={{ color: 'var(--text-tertiary)' }}
            >
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          sentences={sentences}
          words={words}
          practiceQueueCount={practiceQueueCount}
        />
        <main className="flex-1 overflow-y-auto p-6">
          <div
            className="max-w-2xl mx-auto"
            style={{
              transform: dimmed ? 'scale(0.94) translateY(-12px)' : 'none',
              opacity: dimmed ? 0.6 : 1,
              transition: 'transform 320ms cubic-bezier(0.32, 0.72, 0, 1), opacity 320ms cubic-bezier(0.32, 0.72, 0, 1)',
            }}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
