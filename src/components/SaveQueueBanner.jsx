import { useSaveQueue } from '../hooks/useSaveQueue'
import { useSyncStatus } from '../hooks/useSyncStatus'
import { flushSaveQueue } from '../lib/saveQueue'

/**
 * Shows only when a finished set or a final result has not reached the
 * server yet. It stays until the save succeeds, so nobody closes the page
 * thinking everything is safe.
 */
export default function SaveQueueBanner() {
  const waiting = useSaveQueue()
  const { isOnline } = useSyncStatus()
  if (waiting === 0) return null

  return (
    <div role="status" className="fixed bottom-3 left-3 right-3 sm:left-auto sm:right-4 sm:max-w-sm z-50 rounded-xl border border-warn bg-panel px-4 py-3 shadow-lg">
      <div className="text-sm font-medium text-warn">
        {waiting} result{waiting === 1 ? '' : 's'} not saved yet
      </div>
      <p className="text-xs text-ink-dim mt-1">
        {isOnline
          ? 'Saving now. Keep this page open until this message goes away.'
          : 'No connection. The result is kept on this phone and will upload by itself when the connection is back. Keep the page open and do not clear browser data.'}
      </p>
      {isOnline && (
        <button onClick={() => flushSaveQueue()} className="mt-2 text-xs font-medium text-accent hover:text-accent-strong">
          Try again now
        </button>
      )}
    </div>
  )
}
