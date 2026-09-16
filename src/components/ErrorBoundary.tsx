import { Component, type ErrorInfo, type ReactNode } from 'react'
import { rawSavedState } from '../lib/storage'
import { copyText, deliverFile } from '../lib/share'
import { today } from '../lib/schedule'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
  delivered: string | null
}

/**
 * The one place a crash can be caught. Everything the user has entered lives
 * only in this browser's storage, so a white screen is not an inconvenience —
 * it is the data becoming unreachable. Whatever broke, the export has to work.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, delivered: null }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('P-Finance crashed', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    const raw = rawSavedState()
    const name = `p-finance-rescue-${today()}.json`

    return (
      <div className="mx-auto min-h-dvh max-w-md p-4" style={{ background: 'var(--surface-page)' }}>
        <div
          className="rounded-xl border p-4"
          style={{ background: 'var(--surface-card)', borderColor: 'var(--status-critical)' }}
        >
          <h1 className="text-base font-semibold" style={{ color: 'var(--status-critical)' }}>
            Something broke on this screen
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Your data is still saved on this device. Get a copy of it out first, then reload.
          </p>
          <p className="mt-2 rounded-lg p-2 text-[11px]" style={{ background: 'var(--surface-page)', color: 'var(--text-muted)' }}>
            {this.state.error.message || String(this.state.error)}
          </p>

          {raw ? (
            <div className="mt-3 flex flex-col gap-2">
              <button
                type="button"
                onClick={async () => {
                  const how = await deliverFile(name, raw, 'application/json')
                  this.setState({ delivered: how === 'cancelled' ? null : `Backup ${how}.` })
                }}
                className="w-full rounded-lg py-2 text-sm font-medium"
                style={{ background: 'var(--status-good)', color: 'white' }}
              >
                Save a backup
              </button>
              <button
                type="button"
                onClick={async () => {
                  const ok = await copyText(raw)
                  this.setState({ delivered: ok ? 'Copied — paste it somewhere safe.' : 'Copy was refused by the browser.' })
                }}
                className="w-full rounded-lg py-2 text-sm font-medium"
                style={{ background: 'var(--surface-page)', color: 'var(--text-primary)' }}
              >
                Copy the data as text
              </button>
              {this.state.delivered && (
                <p className="text-xs" style={{ color: 'var(--status-good)' }}>
                  ✓ {this.state.delivered}
                </p>
              )}
            </div>
          ) : (
            <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
              Nothing is saved in this browser yet, so there is nothing to lose.
            </p>
          )}

          <button
            type="button"
            onClick={() => location.reload()}
            className="mt-3 w-full rounded-lg py-2 text-sm font-medium"
            style={{ background: 'var(--cat-installment)', color: 'white' }}
          >
            Reload the app
          </button>
        </div>
      </div>
    )
  }
}
