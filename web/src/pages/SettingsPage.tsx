import { useEffect, useState } from 'react'
import { Key, Eye, EyeOff, Check } from 'lucide-react'
import { getSettings, saveGeminiKey } from '../api'

export default function SettingsPage() {
  const [hasGeminiKey, setHasGeminiKey] = useState(false)
  const [loading, setLoading] = useState(true)
  const [keyInput, setKeyInput] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)

  useEffect(() => {
    getSettings().then(s => {
      setHasGeminiKey(s.hasGeminiKey)
      setLoading(false)
    })
  }, [])

  const handleSave = async () => {
    if (!keyInput.trim()) return
    setSaving(true)
    try {
      await saveGeminiKey(keyInput.trim())
      setKeyInput('')
      setHasGeminiKey(true)
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="flex flex-col items-center gap-3 mb-8 mt-4">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(191,90,242,0.12)' }}
        >
          <Key size={26} style={{ color: 'var(--ios-purple)' }} />
        </div>
        <div className="text-center">
          <h1 className="text-[18px] font-bold" style={{ color: 'var(--text-primary)' }}>設定</h1>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>管理你的 AI 設定</p>
        </div>
      </div>

      <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)' }}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>Gemini API Key</span>
          {!loading && (
            <span
              className="flex items-center gap-1.5 text-[12px]"
              style={{ color: hasGeminiKey ? 'var(--ios-green)' : 'var(--text-secondary)' }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: hasGeminiKey ? 'var(--ios-green)' : 'var(--text-secondary)' }}
              />
              {hasGeminiKey ? '已設定' : '尚未設定'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 rounded-xl px-3" style={{ background: 'var(--bg-subtle)' }}>
          <input
            type={showKey ? 'text' : 'password'}
            value={keyInput}
            onChange={e => setKeyInput(e.target.value)}
            placeholder={hasGeminiKey ? '輸入新的 key 以覆蓋' : '貼上你的 Gemini API key'}
            className="flex-1 bg-transparent outline-none py-2.5 text-[14px]"
            style={{ color: 'var(--text-primary)' }}
          />
          <button onClick={() => setShowKey(s => !s)} style={{ color: 'var(--text-secondary)' }} aria-label="顯示/隱藏 key">
            {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>

        <p className="text-[11px] mt-2 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          前往{' '}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noreferrer"
            style={{ color: 'var(--ios-blue)' }}
          >
            Google AI Studio
          </a>
          {' '}建立你的免費 API key。
        </p>

        <button
          onClick={handleSave}
          disabled={!keyInput.trim() || saving}
          className="w-full mt-3 rounded-xl py-2.5 text-[14px] font-medium flex items-center justify-center gap-1.5"
          style={{ background: 'var(--ios-blue)', color: '#fff', opacity: !keyInput.trim() || saving ? 0.5 : 1 }}
        >
          {justSaved ? (
            <>
              <Check size={15} /> 已儲存
            </>
          ) : saving ? (
            '儲存中…'
          ) : (
            '儲存'
          )}
        </button>
      </div>
    </div>
  )
}
