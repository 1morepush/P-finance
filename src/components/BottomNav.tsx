export type Tab = 'dashboard' | 'debts' | 'income' | 'settings'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Home', icon: '⌂' },
  { id: 'debts', label: 'Debts', icon: '≣' },
  { id: 'income', label: 'Income', icon: '↻' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
]

export function BottomNav({
  active,
  onChange,
}: {
  active: Tab
  onChange: (tab: Tab) => void
}) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-10 flex border-t pb-[env(safe-area-inset-bottom)]"
      style={{ background: 'var(--surface-card)', borderColor: 'var(--border)' }}
    >
      {TABS.map((tab) => {
        const isActive = tab.id === active
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs"
            style={{ color: isActive ? 'var(--cat-installment)' : 'var(--text-muted)' }}
          >
            <span className="text-lg leading-none">{tab.icon}</span>
            {tab.label}
          </button>
        )
      })}
    </nav>
  )
}
