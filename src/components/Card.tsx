import type { PropsWithChildren } from 'react'

export function Card({
  children,
  className = '',
}: PropsWithChildren<{ className?: string }>) {
  return (
    <div
      className={`rounded-2xl border p-4 ${className}`}
      style={{ background: 'var(--surface-card)', borderColor: 'var(--border)' }}
    >
      {children}
    </div>
  )
}
