import { useSyncStatus } from '../hooks/useSyncStatus'

export default function SyncStatusBadge() {
  const { isOnline, pending } = useSyncStatus()

  if (isOnline && pending === 0) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-accent font-medium">
        <span className="w-2 h-2 rounded-full bg-accent" />
        Synced
      </div>
    )
  }

  if (!isOnline) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-warn font-medium">
        <span className="w-2 h-2 rounded-full bg-warn animate-pulse" />
        Offline{pending > 0 ? ` · ${pending} queued` : ''}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-sky-400 font-medium">
      <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
      Syncing {pending} event{pending === 1 ? '' : 's'}...
    </div>
  )
}
