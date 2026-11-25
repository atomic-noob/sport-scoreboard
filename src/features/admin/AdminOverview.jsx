import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AdminGate from './AdminGate'
import { getOverview } from '../../lib/adminTools'
import { SPORTS } from '../../lib/sportConfig'

function Stat({ label, value, to }) {
  const body = (
    <div className="rounded-xl border border-line bg-panel px-4 py-4">
      <p className="text-3xl font-display font-bold text-ink tabular-nums">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-wider text-ink-faint">{label}</p>
    </div>
  )
  return to ? <Link to={to} className="block hover:[&>div]:border-accent">{body}</Link> : body
}

function Body() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { getOverview().then(setData).catch((e) => setError(e.message)) }, [])

  if (error) return <p className="mt-6 text-live">{error} Check that supabase/admin-tools.sql was run.</p>
  if (!data) return <p className="mt-6 text-ink-dim">Loading...</p>
  return (
    <>
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Stat label="Tournaments" value={data.tournaments} />
        <Stat label="Organizers" value={data.organizers} />
        <Stat label="Games played" value={data.completed_matches} />
        <Stat label="Games total" value={data.matches} />
        <Stat label="Waiting for verification" value={data.pending_verification} to="/admin/verify" />
        <Stat label="New feedback" value={data.feedback_new} to="/admin/feedback" />
      </div>
      <h2 className="mt-8 mb-3 text-sm font-semibold uppercase tracking-wider text-ink-faint">Tournaments by sport</h2>
      {data.by_sport.length === 0 ? <p className="text-ink-dim text-sm">None yet.</p> : (
        <ul className="space-y-1.5">
          {data.by_sport.map((s) => (
            <li key={s.sport} className="flex justify-between rounded-lg border border-line bg-panel px-4 py-2 text-sm">
              <span>{SPORTS[s.sport]?.label ?? s.sport}</span>
              <span className="tabular-nums text-ink-dim">{s.count}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

export default function AdminOverview() {
  return <AdminGate title="Admin overview"><Body /></AdminGate>
}
