import { useState } from 'react'
import { Link } from 'react-router-dom'
import { login } from '../api'
import { setToken } from '../auth'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const token = await login(email, password)
      setToken(token)
      window.location.href = '/'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
      setSubmitting(false)
    }
  }

  return (
    <div className="flex items-center justify-center h-screen" style={{ background: 'var(--bg-primary)' }}>
      <form
        onSubmit={handleSubmit}
        className="w-80 p-6 rounded-2xl flex flex-col gap-3"
        style={{ background: 'var(--bg-card)' }}
      >
        <h1 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>登入 DuoCue</h1>
        <input
          type="email"
          placeholder="Email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="px-3 py-2 rounded-lg border text-sm"
          style={{ borderColor: 'var(--separator)', color: 'var(--text-primary)', background: 'transparent' }}
        />
        <input
          type="password"
          placeholder="密碼"
          required
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="px-3 py-2 rounded-lg border text-sm"
          style={{ borderColor: 'var(--separator)', color: 'var(--text-primary)', background: 'transparent' }}
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="px-3 py-2 rounded-lg text-sm font-medium bg-blue-500 text-white disabled:opacity-50"
        >
          {submitting ? '登入中…' : '登入'}
        </button>
        <p className="text-sm text-center" style={{ color: 'var(--text-secondary)' }}>
          還沒有帳號？<Link to="/register" className="text-blue-500">註冊</Link>
        </p>
      </form>
    </div>
  )
}
