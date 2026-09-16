import { useEffect, type PropsWithChildren } from 'react'

export function Modal({
  title,
  onClose,
  children,
}: PropsWithChildren<{ title: string; onClose: () => void }>) {
  // Escape closes, like every other sheet on the phone.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-20 flex items-end justify-center bg-black/60 sm:items-center"
      // Tapping the dimmed backdrop closes; tapping inside the sheet does not.
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl border p-4 sm:rounded-2xl"
        style={{ background: 'var(--surface-card)', borderColor: 'var(--border)' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm"
            style={{ color: 'var(--text-muted)' }}
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
