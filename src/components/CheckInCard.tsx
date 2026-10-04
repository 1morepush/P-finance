import type { AppState } from '../types'
import { Card } from './Card'
import { PlanTaskRow } from './PlanTaskRow'
import { SUNDAY_CHECK_IN } from '../data/recoveryPlan'
import { checkInDone, toggleCheckIn } from '../lib/recovery'
import { today } from '../lib/schedule'

/** The plan's 15-minute Sunday check-in. Ticks last the week; next Sunday starts fresh. */
export function CheckInCard({
  state,
  setState,
  now = today(),
}: {
  state: AppState
  setState: React.Dispatch<React.SetStateAction<AppState>>
  now?: string
}) {
  const done = checkInDone(state, now)
  return (
    <Card>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
          Sunday check-in
        </h2>
        <span className="text-xs tabular-nums" style={{ color: done.length === SUNDAY_CHECK_IN.length ? 'var(--status-good)' : 'var(--text-muted)' }}>
          {done.length} of {SUNDAY_CHECK_IN.length} this week
        </span>
      </div>
      <p className="mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
        15 minutes every Sunday keeps you ahead of every autopay.
      </p>
      <div className="mt-1">
        {SUNDAY_CHECK_IN.map((t) => (
          <PlanTaskRow
            key={t.id}
            text={t.text}
            done={done.includes(t.id)}
            today={now}
            onToggle={() => setState((s) => toggleCheckIn(s, t.id, now))}
          />
        ))}
      </div>
    </Card>
  )
}
