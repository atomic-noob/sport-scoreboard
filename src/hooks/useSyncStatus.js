import { useEffect, useState } from 'react'
import { pendingSyncCount } from '../lib/syncEngine'

/** Live-ish status of connectivity + how many events are queued to sync. */
export function useSyncStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [pending, setPending] = useState(0)

  useEffect(() => {
    const goOnline = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)

    const interval = setInterval(async () => {
      setPending(await pendingSyncCount())
    }, 3000)

    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
      clearInterval(interval)
    }
  }, [])

  return { isOnline, pending }
}
