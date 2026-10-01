import { useState, type ReactNode } from 'react'

const KEY = 'p-finance/sections/v1'

function remembered(id: string, fallback: boolean): boolean {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, boolean>
    return typeof all[id] === 'boolean' ? all[id] : fallback
  } catch {
    return fallback
  }
}

function remember(id: string, open: boolean) {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, boolean>
    localStorage.setItem(KEY, JSON.stringify({ ...all, [id]: open }))
  } catch {
    // Only a convenience: the section simply opens closed next time.
  }
}

/**
 * A heading that folds what is under it away, with a line saying what is
 * there. For the parts of a tab worth having but not worth scrolling past
 * every time. Whether it was left open is remembered on this device.
 */
export function Section({
  id,
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  id: string
  title: string
  summary?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(() => remembered(id, defaultOpen))
  return (
    <section className="flex flex-col gap-4">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open)
          remember(id, !open)
        }}
        className="mt-2 flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="min-w-0">
          <h2 className="text-base font-semibold">{title}</h2>
          {summary && (
            <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>
              {summary}
            </span>
          )}
        </span>
        <span className="shrink-0 text-xs font-medium" style={{ color: 'var(--cat-installment)' }}>
          {open ? 'Hide' : 'Show'}
        </span>
      </button>
      {open && children}
    </section>
  )
}
