import { BarChart2 } from 'lucide-react'
import type { PracticeStats } from '../types'

interface Props {
  stats: PracticeStats | null
  loading: boolean
}

export default function StatsPage({ stats, loading }: Props) {
  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
        <span style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>載入中…</span>
      </div>
    )
  }

  const max = Math.max(...stats.last30Days.map(d => d.count), 1)

  const today = new Date().toISOString().slice(0, 10)
  const slots: { date: string; count: number }[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)
    const found = stats.last30Days.find(r => r.date === d)
    slots.push({ date: d, count: found?.count ?? 0 })
  }

  return (
    <div className="flex flex-col gap-5" style={{ maxWidth: '600px' }}>
      <h1 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BarChart2 size={18} strokeWidth={1.8} />
          學習統計
        </span>
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
        <StatCard label="🔥 連續天數" value={stats.streak} unit="天" valueColor="var(--ios-orange)" />
        <StatCard label="今日完成" value={stats.todayCount} unit="個單字" />
        <StatCard label="學習中" value={stats.wordCounts.learning} unit="個單字" />
      </div>

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--separator)', borderRadius: '16px', padding: '20px' }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>過去 30 天複習量</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '80px' }}>
          {slots.map(({ date, count }) => {
            const h = count > 0 ? Math.max(4, Math.round((count / max) * 72)) : 2
            const isToday = date === today
            return (
              <div key={date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', height: '80px', justifyContent: 'flex-end' }} title={`${date}: ${count} 個`}>
                <div
                  style={{
                    width: '100%',
                    height: `${h}px`,
                    background: isToday ? 'rgba(48,209,88,0.85)' : count > 0 ? 'rgba(48,209,88,0.38)' : 'var(--bg-subtle)',
                    borderRadius: '3px 3px 0 0',
                    transition: 'background 0.15s',
                  }}
                />
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
          <span style={{ fontSize: '10px', color: 'var(--text-disabled)' }}>30 天前</span>
          <span style={{ fontSize: '10px', color: 'var(--ios-green)', fontWeight: 600 }}>今天</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--separator)', borderRadius: '16px', padding: '18px 20px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--ios-orange)', display: 'inline-block' }} />
            學習中
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)' }}>{stats.wordCounts.learning}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '3px' }}>個單字</div>
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--separator)', borderRadius: '16px', padding: '18px 20px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--ios-green)', display: 'inline-block' }} />
            已學會
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)' }}>{stats.wordCounts.learned}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '3px' }}>個單字</div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, unit, valueColor }: { label: string; value: number; unit: string; valueColor?: string }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--separator)', borderRadius: '16px', padding: '18px 20px' }}>
      <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: '28px', fontWeight: 700, color: valueColor ?? 'var(--text-primary)' }}>{value}</div>
      <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '3px' }}>{unit}</div>
    </div>
  )
}
