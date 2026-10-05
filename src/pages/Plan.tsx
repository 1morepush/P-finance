import type { AppState } from '../types'
import { Card } from '../components/Card'
import { Section } from '../components/Section'
import { PlanTaskRow } from '../components/PlanTaskRow'
import { CheckInCard } from '../components/CheckInCard'
import { FloorCard, FundsCard } from '../components/SavingCards'
import {
  COST_CUTS,
  EARNING,
  LUMP_SUM,
  MONEY_COMING,
  OCTOBER,
  PAYCHECK_ORDER,
  PHASES,
  PLAN_DATE,
  RULES,
} from '../data/recoveryPlan'
import { currentPhase, isDone, LUMP_SUM_PHASE, phaseProgress, toggleTask } from '../lib/recovery'
import { formatDate } from '../lib/finance'
import { today } from '../lib/schedule'

const muted = { color: 'var(--text-muted)' }
const secondary = { color: 'var(--text-secondary)' }

/**
 * The Money Recovery Plan, to work through. Its figures are its own and are
 * shown as written; the live balances are on the Debts tab.
 */
export function Plan({
  state,
  setState,
}: {
  state: AppState
  setState: React.Dispatch<React.SetStateAction<AppState>>
}) {
  const now = today()
  const current = currentPhase(now)
  const toggle = (id: string) => setState((s) => toggleTask(s, id, now))

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      <div>
        <h1 className="text-lg font-semibold">Money recovery plan</h1>
        <p className="text-xs" style={muted}>
          From {formatDate(PLAN_DATE)}. Its figures are as written; your live balances are on the Debts
          tab.
        </p>
      </div>

      <p className="text-sm" style={secondary}>
        Cover every payment through October, let Klarna finish on Nov 5, then put the $5,250
        reimbursement to work in the order below.
      </p>

      <Section id="plan-october" title="The October squeeze" summary="October is the hardest month of the whole payoff">
        <Card>
          <div className="flex flex-col divide-y text-sm" style={{ borderColor: 'var(--border)' }}>
            {OCTOBER.map(([what, est]) => (
              <div key={what} className="flex items-baseline justify-between gap-3 py-1.5">
                <span style={what.startsWith('In') ? { color: 'var(--status-good)' } : undefined}>{what}</span>
                <span className="shrink-0 text-right text-xs tabular-nums">{est}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs" style={secondary}>
            Depending on your hours and whether September's Apple Card minimum is still owed, October nets
            between about -$360 and +$445 before food and gas. DoorDash, Depop and the cuts below have to
            close that gap.
          </p>
          <p className="mt-1 text-xs" style={muted}>
            Klarna's last payments in early November free up $358 a month by December, and the Tokyo and
            Airbnb loans ending in February free $186 more.
          </p>
        </Card>
      </Section>

      <Section id="plan-coming" title="Money that's coming" summary="Don't spend either lump sum before it's in your account">
        <Card>
          <div className="flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
            {MONEY_COMING.map((m) => (
              <div key={m.source} className="py-2 text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">{m.source}</span>
                  <span className="shrink-0 tabular-nums" style={{ color: 'var(--status-warning)' }}>
                    {m.amount}
                  </span>
                </div>
                <div className="text-xs" style={muted}>
                  {m.expected} · {m.status}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs" style={secondary}>
            Don't spend either lump sum before it's in your account. Neither has a confirmed date.
          </p>
        </Card>
      </Section>

      {PHASES.map((phase) => {
        const { done, total } = phaseProgress(state, phase)
        const isCurrent = phase.id === current.id
        return (
          <Section
            key={phase.id}
            id={`plan-${phase.id}`}
            title={phase.title}
            summary={`${done} of ${total} done${isCurrent ? ' · now' : phase.to < now && done < total ? ' · still open' : ''}`}
            defaultOpen={isCurrent}
          >
            <Card>
              {phase.tasks.map((t) => (
                <PlanTaskRow
                  key={t.id}
                  text={t.text}
                  due={t.due}
                  done={isDone(state, t.id)}
                  doneOn={state.planDone?.[t.id]}
                  today={now}
                  onToggle={() => toggle(t.id)}
                />
              ))}
            </Card>
          </Section>
        )
      })}

      <Section
        id="plan-lump"
        title="When the $5,250 lands"
        summary={`${phaseProgress(state, LUMP_SUM_PHASE).done} of ${LUMP_SUM.length} done · in this order`}
      >
        <Card>
          <p className="text-xs" style={muted}>
            Use it in this order. The amounts assume normal payments until January.
          </p>
          <ol className="mt-1">
            {LUMP_SUM.map((t, i) => (
              <li key={t.id} className="flex gap-1">
                <span className="mt-1.5 w-4 shrink-0 text-sm tabular-nums" style={muted}>
                  {i + 1}.
                </span>
                <div className="flex-1">
                  <PlanTaskRow
                    text={t.text}
                    done={isDone(state, t.id)}
                    doneOn={state.planDone?.[t.id]}
                    today={now}
                    onToggle={() => toggle(t.id)}
                  />
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs" style={secondary}>
            If the wage claim pays out, all of it goes to the Apple Card until it's gone, then to the
            emergency fund.
          </p>
          <p className="mt-1 text-xs" style={muted}>
            If the $5,250 lands on time, the ~36% loans end months ahead of their July schedule, and the
            Apple Card is what's left.
          </p>
        </Card>
      </Section>

      <CheckInCard state={state} setState={setState} now={now} />

      <Section
        id="plan-cuts"
        title="Cost cutters"
        summary={`${COST_CUTS.filter((c) => isDone(state, c.id)).length} of ${COST_CUTS.length} done · the first four free about $70 a month`}
      >
        <Card>
          <p className="text-xs" style={muted}>
            The first four cuts free about $70 a month ($90 with Claude), and the bank settings stop the
            $36 overdraft fees.
          </p>
          <div className="mt-1 flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
            {COST_CUTS.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-start gap-2 py-2 text-sm">
                <input type="checkbox" checked={isDone(state, c.id)} onChange={() => toggle(c.id)} className="mt-1 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span
                      className="font-medium"
                      style={{ textDecoration: isDone(state, c.id) ? 'line-through' : undefined, color: isDone(state, c.id) ? 'var(--text-muted)' : undefined }}
                    >
                      {c.cut}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums" style={{ color: 'var(--status-good)' }}>
                      {c.saves}
                    </span>
                  </span>
                  <span className="block text-xs" style={muted}>
                    {c.how}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs" style={muted}>
            Keep the rave tickets you've already paid for. Just don't buy new events on payment plans
            until the ~36% loans are gone.
          </p>
        </Card>
      </Section>

      <Section id="plan-saving" title="Saving" summary="The checking floor, sinking funds, and how to split each paycheck">
        <p className="text-sm" style={secondary}>
          For now, saving means a protected checking floor and a small car fund. Real savings start once
          the ~36% loans are gone.
        </p>
        <FloorCard state={state} />
        <FundsCard state={state} setState={setState} />
        <Card>
          <h2 className="text-sm font-semibold" style={secondary}>
            Splitting each paycheck now
          </h2>
          <ol className="mt-2 flex list-decimal flex-col gap-1 pl-5 text-sm">
            {PAYCHECK_ORDER.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </Card>
        <Card>
          <h2 className="text-sm font-semibold" style={secondary}>
            After the debt is gone
          </h2>
          <p className="mt-1 text-sm">
            Split take-home pay roughly 50% essentials, 15% Roth IRA, 10% emergency fund, 10% investing,
            10% fun and 5% leftover debts.
          </p>
          <p className="mt-1 text-xs" style={muted}>
            Once the emergency fund covers 3-6 months of expenses, its 10% moves to investing. That's
            also when a FedEx 401(k) match becomes worth taking, if your part-time role is eligible.
          </p>
        </Card>
      </Section>

      <Section id="plan-earning" title="Earning more" summary="A remote part-time job is the biggest lever">
        <Card>
          <p className="text-xs" style={muted}>
            At $20-45 an hour with no gas cost, 10 hours a week beats any DoorDash shift you can fit in.
          </p>
          <div className="mt-1 flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
            {EARNING.map((e, i) => (
              <div key={e.option} className="py-2 text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">
                    {i + 1}. {e.option}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums">{e.pay}</span>
                </div>
                <div className="text-xs" style={{ color: 'var(--status-good)' }}>
                  Keep: {e.keep}
                </div>
                <div className="text-xs" style={muted}>
                  {e.notes}
                </div>
                {e.links && (
                  <ul className="mt-1 flex flex-col gap-0.5 text-xs">
                    {e.links.map((l) => (
                      <li key={l.href}>
                        <a href={l.href} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--cat-installment)' }}>
                          {l.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs" style={secondary}>
            For the applications, lead your resume with RevOps, Salesforce and Excel/SQL. Your
            fuzzy-matching project, merging 2,300+ records, is your strongest example.
          </p>
          <p className="mt-1 text-xs" style={muted}>
            Already in motion: the $5,250 reimbursement, a spring application, the wage claim, and the
            mileage deduction at tax time, so log every gig mile. Skip payday loans, cash-advance apps,
            new payment plans, and any listing that promises $1,000-5,000 a week.
          </p>
        </Card>
      </Section>

      <Section id="plan-rules" title="The rules" summary="Five rules keep new debt from coming back" defaultOpen>
        <Card>
          <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm">
            {RULES.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ol>
        </Card>
      </Section>

    </div>
  )
}
