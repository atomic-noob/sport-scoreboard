import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FEEDBACK_KINDS, isFeedbackAdmin, listFeedback, setFeedbackStatus } from '../../lib/feedbackData'

const KIND_LABEL = Object.fromEntries(FEEDBACK_KINDS.map((k) => [k.value, k.label]))
const STATUSES = ['new', 'read', 'done']

/** Owner-only inbox for feedback. Row-level security is what really protects it; this page just hides itself. */
export default function FeedbackInbox() {
  const [state, setState] = useState('loading') // loading | denied | error | ready
  const [items, setItems] = useState([])
  const [filter, setFilter] = useState('open')

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        if (!(await isFeedbackAdmin())) { if (alive) setState('denied'); return }
        const rows = await listFeedback()
        if (alive) { setItems(rows); setState('ready') }
      } catch {
        if (alive) setState('error')
      }
    })()
    return () => { alive = false }
  }, [])

  async function mark(id, status) {
    const before = items
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, status } : x)))
    try { await setFeedbackStatus(id, status) } catch { setItems(before) }
  }

  const shown = items.filter((x) => (filter === 'open' ? x.status !== 'done' : filter === 'all' ? true : x.status === filter))
  const newCount = items.filter((x) => x.status === 'new').length

  return (
    <div className="min-h-screen bg-void text-ink">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link to="/dashboard" className="text-sm text-ink-dim hover:text-ink">&larr; Dashboard</Link>
        <h1 className="mt-3 text-3xl font-bold">Feedback inbox</h1>

        {state === 'loading' && <p className="mt-6 text-ink-dim">Loading...</p>}
        {state === 'denied' && <p className="mt-6 text-ink-dim">This page is for the Sylve owner. If that is you, add your account to the feedback_admins table (see supabase/feedback.sql).</p>}
        {state === 'error' && <p className="mt-6 text-live">Could not load feedback. Check that the feedback tables exist in Supabase.</p>}

        {state === 'ready' && (
          <>
            <p className="mt-1 text-sm text-ink-dim">{items.length} total, {newCount} new</p>
            <div className="mt-4 flex gap-2" role="group" aria-label="Filter">
              {[['open', 'Open'], ['new', 'New'], ['done', 'Done'], ['all', 'All']].map(([v, l]) => (
                <button key={v} type="button" onClick={() => setFilter(v)} className={`rounded-full border px-3 py-1 text-xs font-medium ${filter === v ? 'border-accent bg-accent-soft text-accent' : 'border-line-strong text-ink-dim hover:text-ink'}`}>{l}</button>
              ))}
            </div>

            {shown.length === 0 && <p className="mt-8 text-ink-dim">Nothing here yet.</p>}
            <ul className="mt-5 space-y-3">
              {shown.map((x) => (
                <li key={x.id} className={`rounded-xl border bg-panel p-4 ${x.status === 'new' ? 'border-accent/50' : 'border-line'}`}>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-ink-dim">
                    <span className="rounded-full bg-panel-alt px-2 py-0.5 font-medium text-ink">{KIND_LABEL[x.kind] || x.kind}</span>
                    <span>{new Date(x.created_at).toLocaleString()}</span>
                    {x.page && <span className="text-ink-faint">on {x.page}</span>}
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{x.message}</p>
                  {x.contact && <p className="mt-2 text-xs text-ink-dim">Contact: {x.contact}</p>}
                  <div className="mt-3 flex gap-2">
                    {STATUSES.map((s) => (
                      <button key={s} type="button" onClick={() => mark(x.id, s)} disabled={x.status === s} className={`rounded-md border px-2.5 py-1 text-xs capitalize ${x.status === s ? 'border-accent text-accent' : 'border-line-strong text-ink-dim hover:text-ink'}`}>{s}</button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
