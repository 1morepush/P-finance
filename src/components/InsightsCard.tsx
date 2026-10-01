import { useMemo } from 'react'
import type { AppState } from '../types'
import { Card } from './Card'
import { generateInsights, type InsightKind } from '../lib/insights'

const INSIGHT_COLOR: Record<InsightKind, string> = {
  warning: 'var(--status-critical)',
  opportunity: 'var(--status-good)',
  milestone: 'var(--cat-installment)',
  context: 'var(--text-muted)',
}

/**
 * What the numbers say, as one card. They were a card each on Home — six of
 * them, a screen and a half of reading between the balance and anything else.
 */
export function InsightsCard({ state }: { state: AppState }) {
  const insights = useMemo(() => generateInsights(state), [state])
  if (insights.length === 0) return null
  return (
    <Card>
      <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
        What the numbers say
      </h2>
      <div className="mt-2 flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
        {insights.map((insight) => (
          <div key={insight.id} className="flex items-start gap-2 py-2 first:pt-0 last:pb-0">
            <span
              className="mt-[5px] inline-block h-2 w-2 shrink-0 rounded-full"
              style={{ background: INSIGHT_COLOR[insight.kind] }}
            />
            <div className="min-w-0">
              <h3 className="text-sm font-medium">{insight.title}</h3>
              <p className="mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                {insight.detail}
              </p>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
        Worked out from your own figures — nothing is sent anywhere.
      </p>
    </Card>
  )
}
