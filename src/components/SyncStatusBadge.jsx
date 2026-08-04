import { useSyncStatus } from '../hooks/useSyncStatus'

export default function SyncStatusBadge() {
  const { isOnline, pending } = useSyncStatus()

  if (isOnline && pending === 0) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
        <span className="w-2 h-2 rounded-full bg-emerald-500" />
        Synced
      </div>
    )
  }

  if (!isOnline) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-amber-600 font-medium">
        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
        Offline{pending > 0 ? ` · ${pending} queued` : ''}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-sky-600 font-medium">
      <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
      Syncing {pending} event{pending === 1 ? '' : 's'}...
    </div>
  )
}
