import type { PropsWithChildren } from 'react'

export function Modal({
  title,
  onClose,
  children,
}: PropsWithChildren<{ title: string; onClose: () => void }>) {
  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/60 sm:items-center">
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl border p-4 sm:rounded-2xl"
        style={{ background: 'var(--surface-card)', borderColor: 'var(--border)' }}
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
