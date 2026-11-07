import { useEffect, useState } from 'react'
import { pendingSaveCount, subscribeSaveQueue } from '../lib/saveQueue'

/** How many finished sets/results are still waiting to be saved. */
export function useSaveQueue() {
  const [count, setCount] = useState(pendingSaveCount())
  useEffect(() => {
    const update = () => setCount(pendingSaveCount())
    const unsub = subscribeSaveQueue(update)
    const timer = setInterval(update, 3000)
    update()
    return () => { unsub(); clearInterval(timer) }
  }, [])
  return count
}
