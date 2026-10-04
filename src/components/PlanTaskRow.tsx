import type { ReactNode } from 'react'
import { formatShortDate } from '../lib/schedule'

/** Phone numbers in the plan's text become tap-to-call links. */
function withLinks(text: string): ReactNode[] {
  return text.split(/(\b(?:1-)?\d{3}-\d{3}-\d{4}\b)/).map((part, i) =>
    /^(?:1-)?\d{3}-\d{3}-\d{4}$/.test(part) ? (
      <a key={i} href={`tel:${part.replace(/-/g, '')}`} className="underline" style={{ color: 'var(--cat-installment)' }}>
        {part}
      </a>
    ) : (
      part
    ),
  )
}

/** One to-do: a box to tick, the plan's words, and when it is due or was done. */
export function PlanTaskRow({
  text,
  done,
  doneOn,
  due,
  today,
  note,
  onToggle,
}: {
  text: string
  done: boolean
  /** The day it was ticked. */
  doneOn?: string
  due?: string
  today: string
  /** A word on where it came from — "from last week". */
  note?: string
  onToggle: () => void
}) {
  const overdue = !done && due !== undefined && due < today
  return (
    <label className="flex cursor-pointer items-start gap-2 py-1.5 text-sm">
      <input type="checkbox" checked={done} onChange={onToggle} className="mt-1 shrink-0" />
      <span className="min-w-0 flex-1">
        <span style={{ color: done ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: done ? 'line-through' : undefined }}>
          {withLinks(text)}
        </span>
        {(due || doneOn || note) && (
          <span className="mt-0.5 block text-[11px]" style={{ color: overdue ? 'var(--status-critical)' : 'var(--text-muted)' }}>
            {done && doneOn
              ? `Done ${formatShortDate(doneOn)}`
              : [due && `${overdue ? 'Was due' : 'By'} ${formatShortDate(due)}`, note].filter(Boolean).join(' · ')}
          </span>
        )}
      </span>
    </label>
  )
}
