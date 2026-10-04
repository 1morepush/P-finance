import type { AppState } from '../types'
import { Card } from './Card'
import { PlanTaskRow } from './PlanTaskRow'
import { currentPhase, openTasks, toggleTask } from '../lib/recovery'
import { today } from '../lib/schedule'

/** How many to-dos Home shows before pointing to the plan. */
const SHOWN = 4

/**
 * The recovery plan's next few to-dos, soonest due first, with anything left
 * from an earlier week carried along. Ticking here ticks the plan.
 */
export function ThisWeekCard({
  state,
  setState,
  onOpenPlan,
}: {
  state: AppState
  setState: React.Dispatch<React.SetStateAction<AppState>>
  onOpenPlan: () => void
}) {
  const now = today()
  const open = openTasks(state, now)
  const phase = currentPhase(now)
  if (open.length === 0) return null
  return (
    <Card>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
          To do · {phase.title.replace(/ \(.*\)$/, '')}
        </h2>
        <span className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
          {open.length} open
        </span>
      </div>
      <div className="mt-1">
        {open.slice(0, SHOWN).map((t) => (
          <PlanTaskRow
            key={t.id}
            text={t.text}
            due={t.due}
            done={false}
            today={now}
            note={t.carried ? `from ${t.phase.title.replace(/ \(.*\)$/, '').toLowerCase()}` : undefined}
            onToggle={() => setState((s) => toggleTask(s, t.id, now))}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={onOpenPlan}
        className="mt-1 text-xs font-medium"
        style={{ color: 'var(--cat-installment)' }}
      >
        {open.length > SHOWN ? `${open.length - SHOWN} more in the plan ›` : 'Open the plan ›'}
      </button>
    </Card>
  )
}
