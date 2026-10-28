export function StatTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string
  sub?: string
  accent?: string
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
      <span
        className="tabular-nums text-lg font-semibold sm:text-2xl"
        style={{ color: accent ?? 'var(--text-primary)' }}
      >
        {value}
      </span>
      {sub && (
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {sub}
        </span>
      )}
    </div>
  )
}
