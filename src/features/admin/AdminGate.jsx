import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { isFeedbackAdmin } from '../../lib/feedbackData'

/** Wraps an owner-only page: checks the account is on the owner list, keeps the page out of search engines. */
export default function AdminGate({ title, children }) {
  const [state, setState] = useState('loading') // loading | denied | ok

  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])

  useEffect(() => {
    let alive = true
    isFeedbackAdmin().then((ok) => alive && setState(ok ? 'ok' : 'denied')).catch(() => alive && setState('denied'))
    return () => { alive = false }
  }, [])

  return (
    <div className="min-h-screen bg-void text-ink">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link to="/dashboard" className="text-sm text-ink-dim hover:text-ink">&larr; Dashboard</Link>
        <h1 className="mt-3 text-3xl font-bold">{title}</h1>
        {state === 'loading' && <p className="mt-6 text-ink-dim">Loading...</p>}
        {state === 'denied' && <p className="mt-6 text-ink-dim">This page is for the Sylve owner.</p>}
        {state === 'ok' && children}
      </div>
    </div>
  )
}
