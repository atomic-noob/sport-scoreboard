import { useEffect, useState } from 'react'

/** True when the screen is taller than it is wide (a phone held upright). */
export default function usePortrait() {
  const read = () =>
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(orientation: portrait)').matches : false
  const [portrait, setPortrait] = useState(read)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined
    const mq = window.matchMedia('(orientation: portrait)')
    const onChange = () => setPortrait(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return portrait
}
