import { formatCurrency } from '../lib/finance'

interface Segment {
  label: string
  value: number
  color: string
}

export function CategoryBar({ segments }: { segments: Segment[] }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0)
  const visible = segments.filter((s) => s.value > 0)

  if (total <= 0) {
    return (
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        No debt tracked in this category yet.
      </p>
    )
  }

  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full" style={{ gap: 2 }}>
        {visible.map((s) => (
          <div
            key={s.label}
            title={`${s.label}: ${formatCurrency(s.value)}`}
            style={{
              width: `${(s.value / total) * 100}%`,
              background: s.color,
              borderRadius: 4,
            }}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {visible.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-xs">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: s.color }}
            />
            <span style={{ color: 'var(--text-secondary)' }}>{s.label}</span>
            <span className="tabular-nums" style={{ color: 'var(--text-primary)' }}>
              {formatCurrency(s.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
