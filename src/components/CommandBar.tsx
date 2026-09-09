import { useMemo, useState } from 'react'
import type { AppState } from '../types'
import { Card } from './Card'
import { applyAction, parseCommand, EXAMPLES, type Understanding } from '../lib/command'

export function CommandBar({
  state,
  setState,
}: {
  state: AppState
  setState: React.Dispatch<React.SetStateAction<AppState>>
}) {
  const [text, setText] = useState('')
  const [picked, setPicked] = useState(0)
  const [done, setDone] = useState<string | null>(null)
  const [showHelp, setShowHelp] = useState(false)

  const result = useMemo(() => parseCommand(text, state), [text, state])

  // Which reading is on screen: the only one, or the one chosen from the list.
  const chosen: Understanding | null =
    result.status === 'ok'
      ? result.understanding
      : result.status === 'choose'
        ? (result.options[picked] ?? result.options[0])
        : null

  function confirm() {
    if (!chosen) return
    setState((s) => applyAction(s, chosen.action))
    setDone(chosen.summary)
    setText('')
    setPicked(0)
  }

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
          Tell it what you did
        </h2>
        <button
          type="button"
          onClick={() => setShowHelp((v) => !v)}
          className="rounded-lg px-2 py-1 text-xs"
          style={{ background: 'var(--surface-page)', color: 'var(--text-muted)' }}
        >
          {showHelp ? 'Hide' : 'Examples'}
        </button>
      </div>

      <textarea
        rows={2}
        value={text}
        placeholder="paid 50 toward Omio"
        onChange={(e) => {
          setText(e.target.value)
          setPicked(0)
          setDone(null)
        }}
        className="w-full resize-none rounded-lg border px-3 py-2 text-sm"
        style={{
          background: 'var(--surface-page)',
          borderColor: 'var(--border)',
          color: 'var(--text-primary)',
        }}
      />

      {showHelp && (
        <ul className="mt-2 flex flex-col gap-1">
          {EXAMPLES.map((e) => (
            <li key={e}>
              <button
                type="button"
                onClick={() => {
                  setText(e)
                  setPicked(0)
                  setDone(null)
                }}
                className="text-left text-xs underline decoration-dotted underline-offset-2"
                style={{ color: 'var(--text-muted)' }}
              >
                {e}
              </button>
            </li>
          ))}
        </ul>
      )}

      {done && !text && (
        <p className="mt-2 text-xs font-medium" style={{ color: 'var(--status-good)' }}>
          ✓ {done}
        </p>
      )}

      {text.trim() && result.status === 'unclear' && result.message && (
        <p className="mt-2 text-xs" style={{ color: 'var(--status-warning)' }}>
          {result.message}
        </p>
      )}

      {result.status === 'choose' && (
        <div className="mt-2 flex flex-col gap-1">
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {result.message}
          </p>
          <div className="flex flex-wrap gap-1">
            {result.options.map((o, i) => (
              <button
                key={o.summary}
                type="button"
                onClick={() => setPicked(i)}
                className="rounded-lg px-2 py-1 text-xs"
                style={{
                  background: i === picked ? 'var(--cat-installment)' : 'var(--surface-page)',
                  color: i === picked ? 'white' : 'var(--text-secondary)',
                }}
              >
                {o.action.kind === 'payment' ? o.action.debt.name : o.summary}
              </button>
            ))}
          </div>
        </div>
      )}

      {chosen && (
        <div className="mt-3 rounded-xl p-3" style={{ background: 'var(--surface-page)' }}>
          <p className="text-sm font-semibold">{chosen.summary}</p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {chosen.lines.map((line) => (
              <li key={line} className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {line}
              </li>
            ))}
          </ul>
          {chosen.warning && (
            <p className="mt-2 text-xs font-medium" style={{ color: 'var(--status-warning)' }}>
              ⚠ {chosen.warning}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setText('')
                setPicked(0)
              }}
              className="flex-1 rounded-lg py-2 text-xs font-medium"
              style={{ background: 'var(--surface-card)', color: 'var(--text-secondary)' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirm}
              className="flex-1 rounded-lg py-2 text-xs font-medium"
              style={{ background: 'var(--status-good)', color: 'white' }}
            >
              Confirm
            </button>
          </div>
        </div>
      )}
    </Card>
  )
}
