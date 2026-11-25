import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { getActiveAnnouncement } from '../lib/adminTools'

/** The owner's notice, shown at the very top of every page. A visitor can close it for the rest of their visit. */
export default function AnnouncementBanner() {
  const [ann, setAnn] = useState(null)
  const [closed, setClosed] = useState(false)

  useEffect(() => {
    let alive = true
    getActiveAnnouncement().then((a) => {
      if (!alive || !a || !a.active || !a.message) return
      try { if (sessionStorage.getItem('sylve-ann-closed') === a.updated_at) return } catch { /* private mode */ }
      setAnn(a)
    }).catch(() => {})
    return () => { alive = false }
  }, [])

  if (!ann || closed) return null
  return (
    <div role="status" className="relative z-30 border-b border-accent/30 bg-accent-soft px-10 py-2 text-center text-sm text-accent">
      {ann.message}
      <button
        type="button"
        aria-label="Close announcement"
        onClick={() => { setClosed(true); try { sessionStorage.setItem('sylve-ann-closed', ann.updated_at) } catch { /* private mode */ } }}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded text-accent hover:bg-accent/10"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
